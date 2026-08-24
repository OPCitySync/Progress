import { randomUUID } from 'crypto'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orgProfiles, waiverVersions, waiverAcceptances } from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import { canonicalJson, sha256Hex } from '@/lib/ledger/hash'
import type { Result } from './identity'
import { programBelongsToOrganization } from './volunteer-programs'

export type OnboardingWaiverMethod = 'digital' | 'in_person'

function normalizeOnboardingWaiverMethod(value: unknown): OnboardingWaiverMethod | null {
  return value === 'digital' || value === 'in_person' ? value : null
}

/**
 * Waiver module. Mirrors IssuerWaiverRegistry semantics:
 * independently published waivers, all of which can be active for an org,
 * with acceptance recorded against the content hash. Only the sha256 of the body would ever go
 * on-chain — the document itself stays with the organization.
 */

export async function createWaiverVersion(input: {
  orgId: string
  title: string
  body: string
  actorId: string
  programId?: string | null
  onboardingWaiverMethod?: OnboardingWaiverMethod
  document?: {
    url: string
    name: string
    mimeType: string
    sha256: string
  }
}): Promise<Result<{ id: string; version: number; sha256: string }>> {
  if (!input.title.trim() || (!input.body.trim() && !input.document)) {
    return { ok: false, error: 'Give the waiver a title and add either waiver text or a source file.' }
  }
  if (!(await programBelongsToOrganization(input.orgId, input.programId))) {
    return { ok: false, error: 'Choose a volunteer program belonging to your organization.' }
  }

  const latest = await db
    .select({ version: waiverVersions.version })
    .from(waiverVersions)
    .where(eq(waiverVersions.orgId, input.orgId))
    .orderBy(desc(waiverVersions.version))
    .limit(1)

  const version = latest.length > 0 ? latest[0].version + 1 : 1
  const id = randomUUID()
  // The acceptance hash covers both accessible waiver text and the optional
  // uploaded source document, without storing the binary in the database.
  const hash = sha256Hex(
    canonicalJson({ body: input.body, documentSha256: input.document?.sha256 ?? null }),
  )

  await db.transaction(async (tx) => {
    // A waiver is a distinct requirement, not a replacement for another
    // waiver. New publications join the organization's active set and are
    // automatically included with future onboarding reservations.
    await tx.insert(waiverVersions).values({
      id,
      orgId: input.orgId,
      programId: input.programId || null,
      version,
      title: input.title.trim(),
      body: input.body,
      documentUrl: input.document?.url ?? null,
      documentName: input.document?.name ?? null,
      documentMimeType: input.document?.mimeType ?? null,
      documentSha256: input.document?.sha256 ?? null,
      sha256: hash,
      active: 1,
      createdAt: Date.now(),
    })
    if (input.onboardingWaiverMethod) {
      await tx
        .insert(orgProfiles)
        .values({
          orgId: input.orgId,
          onboardingWaiverMethod: input.onboardingWaiverMethod,
          updatedAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: orgProfiles.orgId,
          set: { onboardingWaiverMethod: input.onboardingWaiverMethod, updatedAt: Date.now() },
        })
    }
    await appendEvent(
      tx,
      EventTypes.WAIVER_VERSION_CREATED,
      {
        waiverVersionId: id,
        orgId: input.orgId,
        version,
        sha256: hash,
        documentSha256: input.document?.sha256 ?? null,
      },
      input.actorId,
    )
  })

  return { ok: true, id, version, sha256: hash }
}

export async function getActiveWaiver(orgId: string): Promise<typeof waiverVersions.$inferSelect | null> {
  const waivers = await getActiveWaivers(orgId)
  return waivers[0] ?? null
}

/** All currently required waivers, newest first. */
export async function getActiveWaivers(orgId: string): Promise<(typeof waiverVersions.$inferSelect)[]> {
  const rows = await db
    .select()
    .from(waiverVersions)
    .where(and(eq(waiverVersions.orgId, orgId), eq(waiverVersions.active, 1)))
    .orderBy(desc(waiverVersions.createdAt), desc(waiverVersions.version))
  return rows
}

/** The active waiver set and collection rule governing a new onboarding reservation. */
export async function getOnboardingWaiverSetup(orgId: string): Promise<{
  waiver: Awaited<ReturnType<typeof getActiveWaiver>>
  waivers: Awaited<ReturnType<typeof getActiveWaivers>>
  method: OnboardingWaiverMethod | null
}> {
  const [waivers, profile] = await Promise.all([
    getActiveWaivers(orgId),
    db
      .select({ onboardingWaiverMethod: orgProfiles.onboardingWaiverMethod })
      .from(orgProfiles)
      .where(eq(orgProfiles.orgId, orgId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ])

  if (waivers.length === 0) return { waiver: null, waivers: [], method: null }
  // Existing organizations already used the digital acceptance path. Preserve
  // that behavior until they expressly switch to paper collection.
  return {
    waiver: waivers[0],
    waivers,
    method: normalizeOnboardingWaiverMethod(profile?.onboardingWaiverMethod) ?? 'digital',
  }
}

/** Changes only the collection process; the published waiver version remains intact. */
export async function setOnboardingWaiverMethod(input: {
  orgId: string
  method: OnboardingWaiverMethod
}): Promise<Result> {
  const waiver = await getActiveWaiver(input.orgId)
  if (!waiver) return { ok: false, error: 'Publish a liability waiver before choosing how it is collected.' }

  const now = Date.now()
  await db
    .insert(orgProfiles)
    .values({ orgId: input.orgId, onboardingWaiverMethod: input.method, updatedAt: now })
    .onConflictDoUpdate({
      target: orgProfiles.orgId,
      set: { onboardingWaiverMethod: input.method, updatedAt: now },
    })
  return { ok: true }
}

/** Stops a waiver from being included with future onboarding sessions without
 * deleting the version or any participant acceptance history. */
export async function retireWaiverVersion(input: {
  orgId: string
  waiverVersionId: string
  actorId: string
}): Promise<Result> {
  const rows = await db
    .select()
    .from(waiverVersions)
    .where(and(eq(waiverVersions.id, input.waiverVersionId), eq(waiverVersions.orgId, input.orgId)))
    .limit(1)
  const waiver = rows[0]
  if (!waiver) return { ok: false, error: 'Waiver not found for this organization.' }
  if (!waiver.active) return { ok: true }

  await db.transaction(async (tx) => {
    await tx.update(waiverVersions).set({ active: 0 }).where(eq(waiverVersions.id, waiver.id))
    await appendEvent(
      tx,
      EventTypes.WAIVER_RETIRED,
      { waiverVersionId: waiver.id, orgId: input.orgId, version: waiver.version, sha256: waiver.sha256 },
      input.actorId,
    )
  })

  return { ok: true }
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
