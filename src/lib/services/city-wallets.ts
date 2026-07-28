import { randomUUID } from 'crypto'
import { and, eq, sql } from 'drizzle-orm'
import { getCityDb } from '@/lib/db/city-client'
import { cityAnchors, cityCreditEntries, cityEvents, cityWallets } from '@/lib/db/city-schema'
import { appendCityEvent } from '@/lib/ledger/city-ledger'
import { EventTypes } from '@/lib/ledger/events'

export type CityWallet = {
  creditBalance: number
  lifetimeEarned: number
}

async function readWallet(cityId: string, userId: string): Promise<CityWallet> {
  const row = (await getCityDb(cityId).select().from(cityWallets).where(eq(cityWallets.userId, userId)).limit(1))[0]
  return { creditBalance: row?.creditBalance ?? 0, lifetimeEarned: row?.lifetimeEarned ?? 0 }
}

export async function getCityWallet(cityId: string, userId: string): Promise<CityWallet> {
  return readWallet(cityId, userId)
}

export async function mintCityCredits(input: {
  cityId: string
  userId: string
  amount: number
  refId: string
  reason: string
  actorId: string
}): Promise<CityWallet> {
  const db = getCityDb(input.cityId)
  if (!Number.isInteger(input.amount) || input.amount < 1) throw new Error('Credit amount must be a positive whole number.')

  await db.transaction(async (tx) => {
    const existing = (
      await tx.select({ id: cityCreditEntries.id }).from(cityCreditEntries).where(eq(cityCreditEntries.refId, input.refId)).limit(1)
    )[0]
    if (existing) return

    const wallet = (await tx.select().from(cityWallets).where(eq(cityWallets.userId, input.userId)).limit(1))[0]
    const now = Date.now()
    if (wallet) {
      await tx
        .update(cityWallets)
        .set({
          creditBalance: wallet.creditBalance + input.amount,
          lifetimeEarned: wallet.lifetimeEarned + input.amount,
          updatedAt: now,
        })
        .where(eq(cityWallets.userId, input.userId))
    } else {
      await tx.insert(cityWallets).values({
        userId: input.userId,
        creditBalance: input.amount,
        lifetimeEarned: input.amount,
        updatedAt: now,
      })
    }
    await tx.insert(cityCreditEntries).values({
      id: randomUUID(),
      refId: input.refId,
      userId: input.userId,
      amount: input.amount,
      kind: 'mint',
      reason: input.reason,
      createdAt: now,
    })
    await appendCityEvent(
      tx,
      EventTypes.CREDITS_MINTED,
      { userId: input.userId, amount: input.amount, reason: input.reason, refId: input.refId, cityId: input.cityId },
      input.actorId,
    )
  })
  return readWallet(input.cityId, input.userId)
}

export async function burnCityCredits(input: {
  cityId: string
  userId: string
  amount: number
  refId: string
  reason: string
  actorId: string
}): Promise<{ ok: true; wallet: CityWallet } | { ok: false; error: string }> {
  const db = getCityDb(input.cityId)
  if (!Number.isInteger(input.amount) || input.amount < 1) return { ok: false, error: 'Credit amount must be a positive whole number.' }

  let error: string | null = null
  await db.transaction(async (tx) => {
    const existing = (
      await tx.select({ id: cityCreditEntries.id }).from(cityCreditEntries).where(eq(cityCreditEntries.refId, input.refId)).limit(1)
    )[0]
    if (existing) return

    const wallet = (await tx.select().from(cityWallets).where(eq(cityWallets.userId, input.userId)).limit(1))[0]
    if (!wallet || wallet.creditBalance < input.amount) {
      error = 'The participant no longer has enough credits in this city.'
      return
    }
    const now = Date.now()
    await tx
      .update(cityWallets)
      .set({ creditBalance: wallet.creditBalance - input.amount, updatedAt: now })
      .where(eq(cityWallets.userId, input.userId))
    await tx.insert(cityCreditEntries).values({
      id: randomUUID(),
      refId: input.refId,
      userId: input.userId,
      amount: input.amount,
      kind: 'burn',
      reason: input.reason,
      createdAt: now,
    })
    await appendCityEvent(
      tx,
      EventTypes.CREDITS_BURNED,
      { userId: input.userId, amount: input.amount, reason: input.reason, refId: input.refId, cityId: input.cityId },
      input.actorId,
    )
  })
  if (error) return { ok: false, error }
  return { ok: true, wallet: await readWallet(input.cityId, input.userId) }
}

export async function getCityFinanceStats(cityId: string) {
  const db = getCityDb(cityId)
  const [wallets, minted, burned, events, anchors] = await Promise.all([
    db.select({ n: sql<number>`count(*)`, outstanding: sql<number>`coalesce(sum(${cityWallets.creditBalance}), 0)` }).from(cityWallets),
    db.select({ total: sql<number>`coalesce(sum(${cityCreditEntries.amount}), 0)` }).from(cityCreditEntries).where(eq(cityCreditEntries.kind, 'mint')),
    db.select({ total: sql<number>`coalesce(sum(${cityCreditEntries.amount}), 0)` }).from(cityCreditEntries).where(eq(cityCreditEntries.kind, 'burn')),
    db.select({ n: sql<number>`count(*)` }).from(cityEvents),
    db.select().from(cityAnchors).orderBy(cityAnchors.createdAt),
  ])
  return {
    wallets: Number(wallets[0]?.n ?? 0),
    creditsOutstanding: Number(wallets[0]?.outstanding ?? 0),
    creditsMinted: Number(minted[0]?.total ?? 0),
    creditsBurned: Number(burned[0]?.total ?? 0),
    ledgerEvents: Number(events[0]?.n ?? 0),
    anchors,
  }
}
