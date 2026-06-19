import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { credentials } from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import { isCredentialKey } from '@/lib/credentials'
import type { Result } from './identity'

export type CredentialRow = typeof credentials.$inferSelect

/** Verified, non-expired credential keys a user currently holds. */
export async function getHeldCredentials(userId: string): Promise<Set<string>> {
  const now = Date.now()
  const rows = await db
    .select()
    .from(credentials)
    .where(and(eq(credentials.userId, userId), eq(credentials.status, 'verified')))
  const held = new Set<string>()
  for (const r of rows) {
    if (r.expiresAt && r.expiresAt < now) continue
    held.add(r.type)
  }
  return held
}

/** Full credential records for a user (for display in management UIs). */
export async function getUserCredentials(userId: string): Promise<CredentialRow[]> {
  return db.select().from(credentials).where(eq(credentials.userId, userId))
}

/** Which of `required` the user does not currently hold. */
export async function missingCredentials(userId: string, required: string[]): Promise<string[]> {
  if (required.length === 0) return []
  const held = await getHeldCredentials(userId)
  return required.filter((r) => !held.has(r))
}

export async function grantCredential(input: {
  userId: string
  type: string
  actorId: string
  orgId?: string | null
  note?: string
  expiresAt?: number | null
}): Promise<Result> {
  if (!isCredentialKey(input.type)) return { ok: false, error: 'Unknown credential type.' }
  const now = Date.now()
  await db.transaction(async (tx) => {
    const existing = (
      await tx
        .select()
        .from(credentials)
        .where(and(eq(credentials.userId, input.userId), eq(credentials.type, input.type)))
        .limit(1)
    )[0]
    if (existing) {
      await tx
        .update(credentials)
        .set({
          status: 'verified',
          grantedByUserId: input.actorId,
          grantedByOrgId: input.orgId ?? null,
          note: input.note ?? '',
          expiresAt: input.expiresAt ?? null,
          updatedAt: now,
        })
        .where(eq(credentials.id, existing.id))
    } else {
      await tx.insert(credentials).values({
        id: randomUUID(),
        userId: input.userId,
        type: input.type,
        status: 'verified',
        grantedByUserId: input.actorId,
        grantedByOrgId: input.orgId ?? null,
        note: input.note ?? '',
        expiresAt: input.expiresAt ?? null,
        createdAt: now,
        updatedAt: now,
      })
    }
    await appendEvent(
      tx,
      EventTypes.CREDENTIAL_GRANTED,
      { userId: input.userId, type: input.type, orgId: input.orgId ?? null },
      input.actorId,
    )
  })
  return { ok: true }
}

export async function revokeCredential(input: { userId: string; type: string; actorId: string }): Promise<Result> {
  const existing = (
    await db
      .select()
      .from(credentials)
      .where(and(eq(credentials.userId, input.userId), eq(credentials.type, input.type)))
      .limit(1)
  )[0]
  if (!existing || existing.status !== 'verified') return { ok: false, error: 'No active credential to revoke.' }
  await db.transaction(async (tx) => {
    await tx.update(credentials).set({ status: 'revoked', updatedAt: Date.now() }).where(eq(credentials.id, existing.id))
    await appendEvent(tx, EventTypes.CREDENTIAL_REVOKED, { userId: input.userId, type: input.type }, input.actorId)
  })
  return { ok: true }
}
