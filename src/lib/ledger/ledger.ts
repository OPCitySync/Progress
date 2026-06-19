import { randomUUID } from 'crypto'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { events } from '@/lib/db/schema'
import { sha256Hex, canonicalJson } from './hash'
import type { EventType } from './events'

/** Either the root db or a drizzle transaction handle. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
export type DbOrTx = typeof db | Tx

export const GENESIS_HASH = '0'.repeat(64)

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

  await tx.insert(events).values({
    id,
    type,
    payload: body,
    actorId: actorId ?? null,
    ts,
    prevHash,
    hash,
  })

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
