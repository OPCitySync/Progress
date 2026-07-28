import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { cityLedgerOutbox } from '@/lib/db/schema'
import { getCityDb } from '@/lib/db/city-client'
import { appendCityEvent } from './city-ledger'
import type { EventType } from './events'

const BATCH_SIZE = 250

export type CityLedgerDeliveryResult = {
  cityId: string
  delivered: number
  pending: number
  failed: boolean
}

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, 1000)
}

/**
 * Deliver pending control-plane events to one independent city ledger.
 *
 * Delivery is deliberately ordered by the control ledger sequence and stops
 * on the first failure. That preserves a deterministic replay order while
 * retaining the failed item for the next request or scheduled drain.
 */
export async function flushCityLedgerOutbox(cityId: string, limit = BATCH_SIZE): Promise<CityLedgerDeliveryResult> {
  const rows = await db
    .select()
    .from(cityLedgerOutbox)
    .where(and(eq(cityLedgerOutbox.cityId, cityId), isNull(cityLedgerOutbox.deliveredAt)))
    .orderBy(asc(cityLedgerOutbox.eventSeq))
    .limit(limit)

  let delivered = 0
  for (const row of rows) {
    try {
      let payload: Record<string, unknown>
      try {
        const parsed: unknown = JSON.parse(row.payload)
        payload = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
      } catch {
        throw new Error(`Outbox event ${row.eventId} has invalid JSON payload.`)
      }

      const cityDb = getCityDb(cityId)
      await cityDb.transaction(async (tx) => {
        await appendCityEvent(tx, row.type as EventType, payload, row.actorId, { id: row.eventId, ts: row.ts })
      })

      // The conditional protects a concurrent retry from recording a second
      // delivery attempt. appendCityEvent itself remains idempotent if both
      // workers reach the city database at the same time.
      await db
        .update(cityLedgerOutbox)
        .set({ deliveredAt: Date.now(), attempts: sql`${cityLedgerOutbox.attempts} + 1`, lastError: null })
        .where(and(eq(cityLedgerOutbox.eventId, row.eventId), isNull(cityLedgerOutbox.deliveredAt)))
      delivered += 1
    } catch (error) {
      await db
        .update(cityLedgerOutbox)
        .set({ attempts: sql`${cityLedgerOutbox.attempts} + 1`, lastError: errorText(error) })
        .where(eq(cityLedgerOutbox.eventId, row.eventId))
      return { cityId, delivered, pending: rows.length - delivered, failed: true }
    }
  }

  const remaining = await db
    .select({ count: sql<number>`count(*)` })
    .from(cityLedgerOutbox)
    .where(and(eq(cityLedgerOutbox.cityId, cityId), isNull(cityLedgerOutbox.deliveredAt)))
  return { cityId, delivered, pending: Number(remaining[0]?.count ?? 0), failed: false }
}

/** Drain every city represented in the pending outbox. Safe to call from cron. */
export async function flushAllCityLedgerOutbox(): Promise<CityLedgerDeliveryResult[]> {
  const rows = await db
    .select({ cityId: cityLedgerOutbox.cityId })
    .from(cityLedgerOutbox)
    .where(isNull(cityLedgerOutbox.deliveredAt))
    .orderBy(asc(cityLedgerOutbox.cityId), asc(cityLedgerOutbox.eventSeq))
  const cityIds = Array.from(new Set(rows.map((row) => row.cityId)))
  const results: CityLedgerDeliveryResult[] = []
  for (const cityId of cityIds) results.push(await flushCityLedgerOutbox(cityId))
  return results
}
