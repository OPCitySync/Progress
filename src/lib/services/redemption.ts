import { randomBytes, randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { offerings, redemptions, orgs, users } from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import type { Result } from './identity'

/**
 * Redemption module. Mirrors the two-step Redemption contract flow:
 * request (participant) + finalize (redeemer), burn-on-finalize.
 */

function redemptionCode(): string {
  // 6 chars, unambiguous alphabet (no 0/O/1/I)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(6)
  let out = ''
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

export async function createOffering(input: {
  orgId: string
  actorId: string
  title: string
  description: string
  cost: number
}): Promise<Result<{ id: string }>> {
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' }
  if (!Number.isInteger(input.cost) || input.cost < 1 || input.cost > 1000000) {
    return { ok: false, error: 'Cost must be a whole number of at least 1 credit.' }
  }
  const org = (await db.select().from(orgs).where(eq(orgs.id, input.orgId)).limit(1))[0]
  if (!org || org.status !== 'approved') {
    return { ok: false, error: 'Your organization must be approved before creating offerings.' }
  }

  const id = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(offerings).values({
      id,
      orgId: input.orgId,
      title: input.title.trim(),
      description: input.description.trim(),
      cost: input.cost,
      active: 1,
      createdAt: Date.now(),
    })
    await appendEvent(
      tx,
      EventTypes.OFFERING_CREATED,
      { offeringId: id, orgId: input.orgId, cost: input.cost, title: input.title.trim() },
      input.actorId,
    )
  })
  return { ok: true, id }
}

export async function setOfferingActive(
  offeringId: string,
  orgId: string,
  active: boolean,
  actorId: string,
): Promise<Result> {
  const offering = (await db.select().from(offerings).where(eq(offerings.id, offeringId)).limit(1))[0]
  if (!offering || offering.orgId !== orgId) return { ok: false, error: 'Offering not found.' }

  await db.transaction(async (tx) => {
    await tx.update(offerings).set({ active: active ? 1 : 0 }).where(eq(offerings.id, offeringId))
    await appendEvent(tx, EventTypes.OFFERING_UPDATED, { offeringId, active }, actorId)
  })
  return { ok: true }
}

export async function requestRedemption(
  offeringId: string,
  userId: string,
): Promise<Result<{ code: string }>> {
  const offering = (await db.select().from(offerings).where(eq(offerings.id, offeringId)).limit(1))[0]
  if (!offering || !offering.active) return { ok: false, error: 'Offering not available.' }

  const org = (await db.select().from(orgs).where(eq(orgs.id, offering.orgId)).limit(1))[0]
  if (!org || org.status !== 'approved') return { ok: false, error: 'The redeemer organization is not active.' }

  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0]
  if (!user) return { ok: false, error: 'User not found.' }
  if (user.creditBalance < offering.cost) {
    return { ok: false, error: `You need ${offering.cost} credits but have ${user.creditBalance}.` }
  }

  const id = randomUUID()
  const code = redemptionCode()

  await db.transaction(async (tx) => {
    await tx.insert(redemptions).values({
      id,
      offeringId: offering.id,
      orgId: offering.orgId,
      userId,
      cost: offering.cost,
      code,
      status: 'pending',
      createdAt: Date.now(),
    })
    await appendEvent(
      tx,
      EventTypes.REDEMPTION_REQUESTED,
      { redemptionId: id, offeringId: offering.id, orgId: offering.orgId, cost: offering.cost },
      userId,
    )
  })
  return { ok: true, code }
}

/** Redeemer enters the participant's code; credits burn at this moment. */
export async function finalizeRedemption(code: string, orgId: string, actorId: string): Promise<Result> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return { ok: false, error: 'Enter a redemption code.' }

  const redemption = (
    await db.select().from(redemptions).where(eq(redemptions.code, normalized)).limit(1)
  )[0]
  if (!redemption) return { ok: false, error: 'No redemption found for that code.' }
  if (redemption.orgId !== orgId) return { ok: false, error: 'That code belongs to a different organization.' }
  if (redemption.status !== 'pending') return { ok: false, error: `This redemption is already ${redemption.status}.` }

  const user = (await db.select().from(users).where(eq(users.id, redemption.userId)).limit(1))[0]
  if (!user) return { ok: false, error: 'Participant not found.' }
  if (user.creditBalance < redemption.cost) {
    return { ok: false, error: 'The participant no longer has enough credits.' }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(redemptions)
      .set({ status: 'finalized', finalizedAt: Date.now() })
      .where(eq(redemptions.id, redemption.id))
    await tx
      .update(users)
      .set({ creditBalance: user.creditBalance - redemption.cost })
      .where(eq(users.id, user.id))
    await appendEvent(
      tx,
      EventTypes.CREDITS_BURNED,
      { userId: user.id, amount: redemption.cost, reason: 'redemption', refId: redemption.id },
      actorId,
    )
    await appendEvent(
      tx,
      EventTypes.REDEMPTION_FINALIZED,
      { redemptionId: redemption.id, offeringId: redemption.offeringId, cost: redemption.cost },
      actorId,
    )
  })
  return { ok: true }
}

export async function cancelRedemption(redemptionId: string, userId: string): Promise<Result> {
  const redemption = (
    await db.select().from(redemptions).where(eq(redemptions.id, redemptionId)).limit(1)
  )[0]
  if (!redemption || redemption.userId !== userId) return { ok: false, error: 'Redemption not found.' }
  if (redemption.status !== 'pending') return { ok: false, error: `This redemption is already ${redemption.status}.` }

  await db.transaction(async (tx) => {
    await tx.update(redemptions).set({ status: 'cancelled' }).where(eq(redemptions.id, redemptionId))
    await appendEvent(tx, EventTypes.REDEMPTION_CANCELLED, { redemptionId }, userId)
  })
  return { ok: true }
}
