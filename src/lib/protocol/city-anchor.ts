import { randomUUID } from 'crypto'
import { asc, desc, gt } from 'drizzle-orm'
import { getCityDb } from '@/lib/db/city-client'
import { cityAnchors, cityEvents } from '@/lib/db/city-schema'
import { appendCityEvent } from '@/lib/ledger/city-ledger'
import { EventTypes } from '@/lib/ledger/events'
import { merkleRoot } from '@/lib/ledger/merkle'
import { getAnchorAdapter } from './anchor'

/** Anchor one city's independent hash chain without touching any other city. */
export async function createCityAnchor(cityId: string, actorId: string) {
  const db = getCityDb(cityId)
  const lastAnchor = await db.select().from(cityAnchors).orderBy(desc(cityAnchors.toSeq)).limit(1)
  const fromSeqExclusive = lastAnchor[0]?.toSeq ?? 0
  const pending = await db
    .select({ seq: cityEvents.seq, hash: cityEvents.hash })
    .from(cityEvents)
    .where(gt(cityEvents.seq, fromSeqExclusive))
    .orderBy(asc(cityEvents.seq))
  if (pending.length === 0) return { ok: false as const, error: 'No new events since the last city anchor.' }

  const root = merkleRoot(pending.map((event) => event.hash))
  const fromSeq = pending[0].seq
  const toSeq = pending[pending.length - 1].seq
  const adapter = getAnchorAdapter()
  const { txHash } = await adapter.postRoot(root, { fromSeq, toSeq, eventCount: pending.length })
  const id = randomUUID()
  const createdAt = Date.now()

  await db.transaction(async (tx) => {
    await tx.insert(cityAnchors).values({
      id,
      fromSeq,
      toSeq,
      eventCount: pending.length,
      merkleRoot: root,
      network: adapter.network,
      txHash,
      createdAt,
    })
    await appendCityEvent(
      tx,
      EventTypes.ANCHOR_CREATED,
      { anchorId: id, cityId, fromSeq, toSeq, eventCount: pending.length, merkleRoot: root, network: adapter.network, txHash },
      actorId,
    )
  })
  return { ok: true as const, id, root, fromSeq, toSeq, count: pending.length }
}
