import { randomUUID } from 'crypto'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { waiverVersions, waiverAcceptances } from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import { sha256Hex } from '@/lib/ledger/hash'
import type { Result } from './identity'

/**
 * Waiver module. Mirrors IssuerWaiverRegistry semantics:
 * versioned waivers, one active version per org, acceptance recorded
 * against the content hash. Only the sha256 of the body would ever go
 * on-chain — the document itself stays with the organization.
 */

export async function createWaiverVersion(input: {
  orgId: string
  title: string
  body: string
  actorId: string
}): Promise<Result<{ id: string; version: number; sha256: string }>> {
  if (!input.title.trim() || !input.body.trim()) {
    return { ok: false, error: 'Waiver title and body are required.' }
  }

  const latest = await db
    .select({ version: waiverVersions.version })
    .from(waiverVersions)
    .where(eq(waiverVersions.orgId, input.orgId))
    .orderBy(desc(waiverVersions.version))
    .limit(1)

  const version = latest.length > 0 ? latest[0].version + 1 : 1
  const id = randomUUID()
  const hash = sha256Hex(input.body)

  await db.transaction(async (tx) => {
    // Atomic rollover: deactivate prior versions, activate the new one.
    // (Mirrors replaceCurrentWaiverVersion from the audited contracts, S-07.)
    await tx.update(waiverVersions).set({ active: 0 }).where(eq(waiverVersions.orgId, input.orgId))
    await tx.insert(waiverVersions).values({
      id,
      orgId: input.orgId,
      version,
      title: input.title.trim(),
      body: input.body,
      sha256: hash,
      active: 1,
      createdAt: Date.now(),
    })
    await appendEvent(
      tx,
      EventTypes.WAIVER_VERSION_CREATED,
      { waiverVersionId: id, orgId: input.orgId, version, sha256: hash },
      input.actorId,
    )
  })

  return { ok: true, id, version, sha256: hash }
}

export async function getActiveWaiver(orgId: string) {
  const rows = await db
    .select()
    .from(waiverVersions)
    .where(and(eq(waiverVersions.orgId, orgId), eq(waiverVersions.active, 1)))
    .limit(1)
  return rows[0] ?? null
}

export async function hasAcceptedWaiver(userId: string, waiverVersionId: string): Promise<boolean> {
  const rows = await db
    .select({ id: waiverAcceptances.id })
    .from(waiverAcceptances)
    .where(
      and(eq(waiverAcceptances.userId, userId), eq(waiverAcceptances.waiverVersionId, waiverVersionId)),
    )
    .limit(1)
  return rows.length > 0
}

export async function acceptWaiver(input: {
  waiverVersionId: string
  userId: string
}): Promise<Result> {
  const rows = await db
    .select()
    .from(waiverVersions)
    .where(eq(waiverVersions.id, input.waiverVersionId))
    .limit(1)
  const waiver = rows[0]
  if (!waiver) return { ok: false, error: 'Waiver version not found.' }
  if (!waiver.active) return { ok: false, error: 'This waiver version is no longer active.' }

  if (await hasAcceptedWaiver(input.userId, input.waiverVersionId)) {
    return { ok: true }
  }

  await db.transaction(async (tx) => {
    await tx.insert(waiverAcceptances).values({
      id: randomUUID(),
      waiverVersionId: waiver.id,
      orgId: waiver.orgId,
      userId: input.userId,
      sha256: waiver.sha256,
      acceptedAt: Date.now(),
    })
    await appendEvent(
      tx,
      EventTypes.WAIVER_ACCEPTED,
      { waiverVersionId: waiver.id, orgId: waiver.orgId, version: waiver.version, sha256: waiver.sha256 },
      input.userId,
    )
  })

  return { ok: true }
}
