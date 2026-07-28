import { desc, eq } from 'drizzle-orm'
import { cityEvents } from '@/lib/db/city-schema'
import { getCityDb, type CityDatabase } from '@/lib/db/city-client'
import { sha256Hex, canonicalJson } from './hash'
import type { EventType } from './events'
import { randomUUID } from 'crypto'

type CityTx = Parameters<Parameters<CityDatabase['transaction']>[0]>[0]
type CityDbOrTx = CityDatabase | CityTx

const GENESIS_HASH = '0'.repeat(64)

export async function appendCityEvent(
  tx: CityDbOrTx,
  type: EventType,
  payload: Record<string, unknown>,
  actorId?: string | null,
  source?: { id: string; ts: number },
): Promise<{ id: string; hash: string }> {
  // Outbox delivery may be retried after a network failure. The source event
  // id is the idempotency key, so a retry never forks or duplicates a city
  // chain.
  if (source) {
    const existing = (
      await tx.select({ id: cityEvents.id, hash: cityEvents.hash }).from(cityEvents).where(eq(cityEvents.id, source.id)).limit(1)
    )[0]
    if (existing) return { id: existing.id, hash: existing.hash }
  }
  const last = await tx.select({ hash: cityEvents.hash }).from(cityEvents).orderBy(desc(cityEvents.seq)).limit(1)
  const prevHash = last[0]?.hash ?? GENESIS_HASH
  const ts = source?.ts ?? Date.now()
  const id = source?.id ?? randomUUID()
  const body = canonicalJson(payload)
  const hash = sha256Hex(`${prevHash}|${type}|${ts}|${actorId ?? ''}|${body}`)
  await tx.insert(cityEvents).values({ id, type, payload: body, actorId: actorId ?? null, ts, prevHash, hash })
  return { id, hash }
}

export type CityVerifiedEvent = {
  seq: number
  type: string
  payload: string
  actorId: string | null
  ts: number
  prevHash: string
  hash: string
  hashValid: boolean
  linkValid: boolean
}

export async function verifyCityChainDetailed(cityId: string): Promise<{
  events: CityVerifiedEvent[]
  intact: boolean
  firstBrokenSeq: number | null
}> {
  const all = await getCityDb(cityId).select().from(cityEvents).orderBy(cityEvents.seq)
  let prev = GENESIS_HASH
  let firstBrokenSeq: number | null = null
  const events = all.map((event) => {
    const expected = sha256Hex(`${event.prevHash}|${event.type}|${event.ts}|${event.actorId ?? ''}|${event.payload}`)
    const hashValid = expected === event.hash
    const linkValid = event.prevHash === prev
    if ((!hashValid || !linkValid) && firstBrokenSeq === null) firstBrokenSeq = event.seq
    prev = event.hash
    return { ...event, hashValid, linkValid }
  })
  return { events, intact: firstBrokenSeq === null, firstBrokenSeq }
}

export async function verifyCityChain(cityId: string): Promise<number | null> {
  return (await verifyCityChainDetailed(cityId)).firstBrokenSeq
}
