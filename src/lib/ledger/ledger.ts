import { randomUUID } from 'crypto'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { cityLedgerOutbox, events, offerings, orgs, redemptions, tasks, users } from '@/lib/db/schema'
import { sha256Hex, canonicalJson } from './hash'
import type { EventType } from './events'

/** Either the root db or a drizzle transaction handle. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
export type DbOrTx = typeof db | Tx

export const GENESIS_HASH = '0'.repeat(64)

async function inferCityId(
  tx: DbOrTx,
  payload: Record<string, unknown>,
  actorId: string | null | undefined,
  explicitCityId: string | null | undefined,
): Promise<string | null> {
  const explicit = explicitCityId?.trim() || (typeof payload.cityId === 'string' ? payload.cityId.trim() : '')
  if (explicit) return explicit

  const taskId = typeof payload.taskId === 'string' ? payload.taskId : null
  if (taskId) {
    const task = (await tx.select({ cityId: tasks.cityId }).from(tasks).where(eq(tasks.id, taskId)).limit(1))[0]
    if (task?.cityId) return task.cityId
  }

  const offeringId = typeof payload.offeringId === 'string' ? payload.offeringId : null
  if (offeringId) {
    const offering = (await tx.select({ cityId: offerings.cityId }).from(offerings).where(eq(offerings.id, offeringId)).limit(1))[0]
    if (offering?.cityId) return offering.cityId
  }

  const redemptionId = typeof payload.redemptionId === 'string' ? payload.redemptionId : null
  if (redemptionId) {
    const redemption = (await tx.select({ cityId: redemptions.cityId }).from(redemptions).where(eq(redemptions.id, redemptionId)).limit(1))[0]
    if (redemption?.cityId) return redemption.cityId
  }

  const orgId = typeof payload.orgId === 'string' ? payload.orgId : null
  if (orgId) {
    const org = (await tx.select({ cityId: orgs.requestedCityId }).from(orgs).where(eq(orgs.id, orgId)).limit(1))[0]
    if (org?.cityId) return org.cityId
  }

  // A participant-level event belongs to the participant's home city unless
  // the service supplied a more specific city above.
  const userId = typeof payload.userId === 'string' ? payload.userId : actorId
  if (userId) {
    const user = (await tx.select({ cityId: users.homeCityId }).from(users).where(eq(users.id, userId)).limit(1))[0]
    if (user?.cityId) return user.cityId
  }

  return null
}

/**
 * Append an event to the hash-chained ledger.
 *
 * hash = sha256(prevHash | type | ts | actorId | canonicalJson(payload))
 *
 * Always call inside the same transaction as the projection-table writes it
 * describes, so the ledger and the projections can never disagree.
 */
export async function appendEvent(
  tx: DbOrTx,
  type: EventType,
  payload: Record<string, unknown>,
  actorId?: string | null,
  cityId?: string | null,
): Promise<{ id: string; hash: string }> {
  const last = await tx
    .select({ hash: events.hash })
    .from(events)
    .orderBy(desc(events.seq))
    .limit(1)

  const prevHash = last.length > 0 ? last[0].hash : GENESIS_HASH
  const ts = Date.now()
  const id = randomUUID()
  const body = canonicalJson(payload)
  const hash = sha256Hex(`${prevHash}|${type}|${ts}|${actorId ?? ''}|${body}`)

  const inserted = await tx.insert(events).values({
    id,
    type,
    payload: body,
    actorId: actorId ?? null,
    ts,
    prevHash,
    hash,
  }).returning({ seq: events.seq })

  // A city id can be supplied explicitly by the service that owns the
  // action. When an established source event predates that convention, use
  // its task/offering/redemption/organization/person relationship instead of
  // silently leaving it out of the public city ledger.
  const targetCityId = await inferCityId(tx, payload, actorId, cityId)
  if (targetCityId) {
    const eventSeq = inserted[0]?.seq
    if (eventSeq === undefined) throw new Error('Ledger event sequence was not returned.')
    await tx.insert(cityLedgerOutbox).values({
      eventId: id,
      cityId: targetCityId,
      eventSeq,
      type,
      payload: body,
      actorId: actorId ?? null,
      ts,
      attempts: 0,
      createdAt: ts,
    })
  }

  return { id, hash }
}

export type VerifiedEvent = {
  seq: number
  type: string
  payload: string
  actorId: string | null
  ts: number
  prevHash: string
  hash: string
  /** recomputed hash matches the stored hash */
  hashValid: boolean
  /** prevHash matches the previous event's hash (genesis for seq 1) */
  linkValid: boolean
}

/**
 * Verify every event in the chain and return the full per-event audit:
 * each event's hash is recomputed from its contents, and each link to the
 * previous event is checked. This is what the public verification log shows.
 */
export async function verifyChainDetailed(): Promise<{
  events: VerifiedEvent[]
  intact: boolean
  firstBrokenSeq: number | null
}> {
  const all = await db
    .select({
      seq: events.seq,
      type: events.type,
      payload: events.payload,
      actorId: events.actorId,
      ts: events.ts,
      prevHash: events.prevHash,
      hash: events.hash,
    })
    .from(events)
    .orderBy(events.seq)

  let prev = GENESIS_HASH
  let firstBrokenSeq: number | null = null
  const verified: VerifiedEvent[] = all.map((e) => {
    const linkValid = e.prevHash === prev
    const expected = sha256Hex(`${e.prevHash}|${e.type}|${e.ts}|${e.actorId ?? ''}|${e.payload}`)
    const hashValid = expected === e.hash
    if ((!linkValid || !hashValid) && firstBrokenSeq === null) firstBrokenSeq = e.seq
    prev = e.hash
    return { ...e, hashValid, linkValid }
  })

  return { events: verified, intact: firstBrokenSeq === null, firstBrokenSeq }
}

/**
 * Verify the integrity of the entire chain. Returns the first broken seq,
 * or null if the chain is intact.
 */
export async function verifyChain(): Promise<number | null> {
  const all = await db
    .select({
      seq: events.seq,
      type: events.type,
      payload: events.payload,
      actorId: events.actorId,
      ts: events.ts,
      prevHash: events.prevHash,
      hash: events.hash,
    })
    .from(events)
    .orderBy(events.seq)

  let prev = GENESIS_HASH
  for (const e of all) {
    if (e.prevHash !== prev) return e.seq
    const expected = sha256Hex(`${e.prevHash}|${e.type}|${e.ts}|${e.actorId ?? ''}|${e.payload}`)
    if (expected !== e.hash) return e.seq
    prev = e.hash
  }
  return null
}
