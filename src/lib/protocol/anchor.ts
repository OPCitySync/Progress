import { randomUUID } from 'crypto'
import { asc, desc, gt } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { anchors, events } from '@/lib/db/schema'
import { merkleRoot } from '@/lib/ledger/merkle'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'

/**
 * Anchoring port. The chain integration point: an adapter receives a Merkle
 * root and returns where it was recorded. Swapping `stub` for a real Base
 * adapter changes nothing else in the application.
 */
export interface AnchorAdapter {
  network: string
  postRoot(root: string, meta: { fromSeq: number; toSeq: number; eventCount: number }): Promise<{
    txHash: string | null
  }>
}

class StubAnchorAdapter implements AnchorAdapter {
  network = 'local-stub'
  async postRoot() {
    // No chain call. The root is still computed, stored, and publicly
    // listed on the transparency page — verifiable by anyone with an export.
    return { txHash: null }
  }
}

class BaseAnchorAdapter implements AnchorAdapter {
  network = 'base-mainnet'
  async postRoot(): Promise<{ txHash: string | null }> {
    // Integration point for Phase 1 chain anchoring:
    // 1. Add viem + an ANCHOR_PRIVATE_KEY funded with a few dollars of ETH on Base.
    // 2. Either send the root as calldata in a self-transaction, or deploy the
    //    minimal CitySyncAnchor contract (event-only, ~30 lines) and call
    //    anchor(bytes32 root, uint64 fromSeq, uint64 toSeq).
    // 3. Return the tx hash here.
    throw new Error(
      'Base anchoring not configured. Set ANCHOR_MODE=stub, or implement BaseAnchorAdapter (see comments).',
    )
  }
}

export function getAnchorAdapter(): AnchorAdapter {
  return process.env.ANCHOR_MODE === 'base' ? new BaseAnchorAdapter() : new StubAnchorAdapter()
}

/**
 * Create an anchor covering all events since the previous anchor:
 * compute the Merkle root of their hashes, hand it to the adapter,
 * record the anchor, and append an ANCHOR_CREATED event.
 */
export async function createAnchor(actorId: string) {
  const lastAnchor = await db.select().from(anchors).orderBy(desc(anchors.toSeq)).limit(1)
  const fromSeqExclusive = lastAnchor.length > 0 ? lastAnchor[0].toSeq : 0

  const pending = await db
    .select({ seq: events.seq, hash: events.hash })
    .from(events)
    .where(gt(events.seq, fromSeqExclusive))
    .orderBy(asc(events.seq))

  if (pending.length === 0) {
    return { ok: false as const, error: 'No new events since the last anchor.' }
  }

  const root = merkleRoot(pending.map((e) => e.hash))
  const fromSeq = pending[0].seq
  const toSeq = pending[pending.length - 1].seq
  const adapter = getAnchorAdapter()
  const { txHash } = await adapter.postRoot(root, { fromSeq, toSeq, eventCount: pending.length })

  const id = randomUUID()
  const createdAt = Date.now()

  await db.transaction(async (tx) => {
    await tx.insert(anchors).values({
      id,
      fromSeq,
      toSeq,
      eventCount: pending.length,
      merkleRoot: root,
      network: adapter.network,
      txHash,
      createdAt,
    })
    await appendEvent(
      tx,
      EventTypes.ANCHOR_CREATED,
      { anchorId: id, fromSeq, toSeq, eventCount: pending.length, merkleRoot: root, network: adapter.network, txHash },
      actorId,
    )
  })

  return { ok: true as const, id, root, fromSeq, toSeq, count: pending.length }
}
