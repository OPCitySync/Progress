import { randomUUID } from 'crypto'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { tasks, shifts, claims, orgs, users } from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import { getActiveWaiver, hasAcceptedWaiver } from './waivers'
import {
  notifyShiftClaimed,
  cancelRemindersForClaim,
  cancelRemindersForShift,
  cancelRemindersForTask,
} from './notifications'
import { missingCredentials } from './credentials'
import { parseCredentialList, credentialLabel, isCredentialKey } from '@/lib/credentials'
import type { Result } from './identity'

/**
 * Opportunity module. An opportunity (task) is a template; volunteers claim a
 * specific dated **shift** of it. Mirrors OpportunityManager lifecycle:
 * create opportunity -> add shift(s) -> claim shift -> submit -> verify (mint).
 * Credits are awarded per completion from the parent opportunity's value, so
 * verification/minting/impact keep joining claims -> tasks unchanged.
 */

export type ShiftRow = typeof shifts.$inferSelect
const ACTIVE_CLAIM_STATUSES = ['claimed', 'submitted', 'verified'] as const

// Unambiguous code alphabet (no 0/O/1/I).
function shiftCode(): string {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]
  return s
}

/** Whether self check-in is allowed for a shift right now. */
export function checkInOpen(shift: ShiftRow, now = Date.now()): boolean {
  if (shift.status !== 'open') return false
  if (!shift.startsAt) return true // undated shift: allow while open
  const start = shift.startsAt
  const end = shift.endsAt ?? start + 6 * 60 * 60 * 1000
  return now >= start - 60 * 60 * 1000 && now <= end + 2 * 60 * 60 * 1000
}

export async function createTask(input: {
  orgId: string
  actorId: string
  title: string
  description: string
  location: string
  credits: number
  slots: number
  startsAt: string
  requiredCredentials?: string[]
  catalogEntryId?: string | null
}): Promise<Result<{ id: string }>> {
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' }
  if (!Number.isInteger(input.credits) || input.credits < 1 || input.credits > 100000) {
    return { ok: false, error: 'Credits must be a whole number between 1 and 100,000.' }
  }
  if (!Number.isInteger(input.slots) || input.slots < 1 || input.slots > 10000) {
    return { ok: false, error: 'Slots must be a whole number of at least 1.' }
  }

  const org = (await db.select().from(orgs).where(eq(orgs.id, input.orgId)).limit(1))[0]
  if (!org || org.status !== 'approved') {
    return { ok: false, error: 'Your organization must be approved before creating opportunities.' }
  }

  const id = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(tasks).values({
      id,
      orgId: input.orgId,
      title: input.title.trim(),
      description: input.description.trim(),
      location: input.location.trim(),
      credits: input.credits,
      slots: input.slots,
      startsAt: input.startsAt.trim(),
      status: 'open',
      requiredCredentials: JSON.stringify((input.requiredCredentials ?? []).filter(isCredentialKey)),
      catalogEntryId: input.catalogEntryId ?? null,
      createdBy: input.actorId,
      createdAt: Date.now(),
    })
    await appendEvent(
      tx,
      EventTypes.TASK_CREATED,
      { taskId: id, orgId: input.orgId, credits: input.credits, title: input.title.trim() },
      input.actorId,
    )
  })
  return { ok: true, id }
}

export async function createShift(input: {
  taskId: string
  orgId: string
  actorId: string
  startsAt: number | null
  endsAt: number | null
  label: string
  capacity: number
}): Promise<Result<{ id: string }>> {
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 10000) {
    return { ok: false, error: 'Capacity must be a whole number of at least 1.' }
  }
  const task = (await db.select().from(tasks).where(eq(tasks.id, input.taskId)).limit(1))[0]
  if (!task || task.orgId !== input.orgId) return { ok: false, error: 'Opportunity not found.' }

  const id = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(shifts).values({
      id,
      taskId: input.taskId,
      orgId: input.orgId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      label: input.label.trim(),
      capacity: input.capacity,
      status: 'open',
      checkInCode: shiftCode(),
      createdAt: Date.now(),
    })
    await appendEvent(
      tx,
      EventTypes.SHIFT_CREATED,
      { shiftId: id, taskId: input.taskId, capacity: input.capacity, startsAt: input.startsAt },
      input.actorId,
    )
  })
  return { ok: true, id }
}

export async function setTaskCredentials(
  taskId: string,
  orgId: string,
  creds: string[],
): Promise<Result> {
  const task = (await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1))[0]
  if (!task || task.orgId !== orgId) return { ok: false, error: 'Opportunity not found.' }
  await db
    .update(tasks)
    .set({ requiredCredentials: JSON.stringify(creds.filter(isCredentialKey)) })
    .where(eq(tasks.id, taskId))
  return { ok: true }
}

export async function closeShift(shiftId: string, orgId: string, actorId: string): Promise<Result> {
  const shift = (await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1))[0]
  if (!shift || shift.orgId !== orgId) return { ok: false, error: 'Shift not found.' }
  if (shift.status === 'closed') return { ok: true }
  await db.transaction(async (tx) => {
    await tx.update(shifts).set({ status: 'closed' }).where(eq(shifts.id, shiftId))
    await appendEvent(tx, EventTypes.SHIFT_CLOSED, { shiftId, taskId: shift.taskId }, actorId)
  })
  await cancelRemindersForShift(shiftId)
  return { ok: true }
}

export async function closeTask(taskId: string, orgId: string, actorId: string): Promise<Result> {
  const task = (await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1))[0]
  if (!task || task.orgId !== orgId) return { ok: false, error: 'Task not found.' }
  if (task.status === 'closed') return { ok: true }

  await db.transaction(async (tx) => {
    await tx.update(tasks).set({ status: 'closed' }).where(eq(tasks.id, taskId))
    // Closing an opportunity closes its still-open shifts.
    await tx.update(shifts).set({ status: 'closed' }).where(and(eq(shifts.taskId, taskId), eq(shifts.status, 'open')))
    await appendEvent(tx, EventTypes.TASK_CLOSED, { taskId }, actorId)
  })
  await cancelRemindersForTask(taskId)
  return { ok: true }
}

export async function reopenTask(taskId: string, orgId: string, actorId: string): Promise<Result> {
  const task = (await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1))[0]
  if (!task || task.orgId !== orgId) return { ok: false, error: 'Task not found.' }
  if (task.status === 'open') return { ok: true }

  const now = Date.now()
  await db.transaction(async (tx) => {
    await tx.update(tasks).set({ status: 'open' }).where(eq(tasks.id, taskId))
    // Reopen upcoming/undated shifts only — never resurrect past-dated shifts.
    await tx
      .update(shifts)
      .set({ status: 'open' })
      .where(
        and(
          eq(shifts.taskId, taskId),
          eq(shifts.status, 'closed'),
          sql`(${shifts.startsAt} is null or ${shifts.startsAt} >= ${now})`,
        ),
      )
    await appendEvent(tx, EventTypes.TASK_REOPENED, { taskId }, actorId)
  })
  return { ok: true }
}

export async function activeClaimCount(shiftId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(claims)
    .where(and(eq(claims.shiftId, shiftId), inArray(claims.status, [...ACTIVE_CLAIM_STATUSES])))
  return Number(rows[0]?.count ?? 0)
}

/** Shifts of an opportunity with their active-claim counts and remaining slots. */
export async function getShiftsWithCounts(
  taskId: string,
): Promise<{ shift: ShiftRow; taken: number; slotsLeft: number }[]> {
  const rows = await db
    .select()
    .from(shifts)
    .where(eq(shifts.taskId, taskId))
    .orderBy(asc(shifts.startsAt), asc(shifts.createdAt))
  if (rows.length === 0) return []
  const counts = await db
    .select({ shiftId: claims.shiftId, n: sql<number>`count(*)` })
    .from(claims)
    .where(and(eq(claims.taskId, taskId), inArray(claims.status, [...ACTIVE_CLAIM_STATUSES])))
    .groupBy(claims.shiftId)
  const taken = new Map(counts.map((c) => [c.shiftId, Number(c.n)]))
  return rows.map((shift) => {
    const t = taken.get(shift.id) ?? 0
    return { shift, taken: t, slotsLeft: Math.max(0, shift.capacity - t) }
  })
}

export type ClaimGate =
  | { ok: true }
  | { ok: false; reason: 'waiver_required'; waiverVersionId: string }
  | { ok: false; reason: 'credentials_required'; missing: string[] }
  | { ok: false; reason: 'error'; error: string }

/** Everything that must be true before a participant can claim a shift. */
export async function checkClaimGate(shiftId: string, userId: string): Promise<ClaimGate> {
  const shift = (await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1))[0]
  if (!shift) return { ok: false, reason: 'error', error: 'Shift not found.' }
  if (shift.status !== 'open') return { ok: false, reason: 'error', error: 'This shift is closed.' }

  const task = (await db.select().from(tasks).where(eq(tasks.id, shift.taskId)).limit(1))[0]
  if (!task || task.status !== 'open') return { ok: false, reason: 'error', error: 'This opportunity is closed.' }

  const org = (await db.select().from(orgs).where(eq(orgs.id, task.orgId)).limit(1))[0]
  if (!org || org.status !== 'approved') {
    return { ok: false, reason: 'error', error: 'The issuing organization is not active.' }
  }

  const existing = (
    await db.select().from(claims).where(and(eq(claims.shiftId, shiftId), eq(claims.userId, userId))).limit(1)
  )[0]
  if (existing && existing.status !== 'unclaimed') {
    return { ok: false, reason: 'error', error: 'You have already signed up for this shift.' }
  }

  if ((await activeClaimCount(shiftId)) >= shift.capacity) {
    return { ok: false, reason: 'error', error: 'This shift is full.' }
  }

  const required = parseCredentialList(task.requiredCredentials)
  if (required.length > 0) {
    const missing = await missingCredentials(userId, required)
    if (missing.length > 0) return { ok: false, reason: 'credentials_required', missing }
  }

  const waiver = await getActiveWaiver(task.orgId)
  if (waiver && !(await hasAcceptedWaiver(userId, waiver.id))) {
    return { ok: false, reason: 'waiver_required', waiverVersionId: waiver.id }
  }

  return { ok: true }
}

export async function claimShift(shiftId: string, userId: string): Promise<Result> {
  const gate = await checkClaimGate(shiftId, userId)
  if (!gate.ok) {
    let error: string
    if (gate.reason === 'waiver_required') {
      error = 'You must accept the organization’s liability waiver before signing up.'
    } else if (gate.reason === 'credentials_required') {
      error = `This opportunity requires: ${gate.missing.map(credentialLabel).join(', ')}. Contact the organization to get verified.`
    } else {
      error = gate.error
    }
    return { ok: false, error }
  }

  const shift = (await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1))[0]
  if (!shift) return { ok: false, error: 'Shift not found.' }

  const existing = (
    await db.select().from(claims).where(and(eq(claims.shiftId, shiftId), eq(claims.userId, userId))).limit(1)
  )[0]

  const now = Date.now()
  await db.transaction(async (tx) => {
    if (existing) {
      await tx.update(claims).set({ status: 'claimed', updatedAt: now }).where(eq(claims.id, existing.id))
    } else {
      await tx.insert(claims).values({
        id: randomUUID(),
        taskId: shift.taskId,
        shiftId,
        userId,
        status: 'claimed',
        createdAt: now,
        updatedAt: now,
      })
    }
    await appendEvent(tx, EventTypes.TASK_CLAIMED, { taskId: shift.taskId, shiftId }, userId)
  })
  // Confirmation + pre-shift reminder (best-effort, outside the ledger).
  await notifyShiftClaimed(userId, shiftId)
  return { ok: true }
}

export async function unclaimClaim(claimId: string, userId: string): Promise<Result> {
  const existing = (
    await db.select().from(claims).where(and(eq(claims.id, claimId), eq(claims.userId, userId))).limit(1)
  )[0]
  if (!existing || existing.status !== 'claimed') {
    return { ok: false, error: 'No active sign-up to withdraw.' }
  }
  await db.transaction(async (tx) => {
    await tx.update(claims).set({ status: 'unclaimed', updatedAt: Date.now() }).where(eq(claims.id, existing.id))
    await appendEvent(
      tx,
      EventTypes.CLAIM_UNCLAIMED,
      { taskId: existing.taskId, shiftId: existing.shiftId, claimId: existing.id },
      userId,
    )
  })
  if (existing.shiftId) await cancelRemindersForClaim(userId, existing.shiftId)
  return { ok: true }
}

export async function submitCompletion(claimId: string, userId: string, note: string): Promise<Result> {
  const existing = (
    await db.select().from(claims).where(and(eq(claims.id, claimId), eq(claims.userId, userId))).limit(1)
  )[0]
  if (!existing || existing.status !== 'claimed') {
    return { ok: false, error: 'You need an active sign-up before submitting completion.' }
  }
  await db.transaction(async (tx) => {
    await tx
      .update(claims)
      .set({ status: 'submitted', note: note.trim(), updatedAt: Date.now() })
      .where(eq(claims.id, existing.id))
    await appendEvent(
      tx,
      EventTypes.COMPLETION_SUBMITTED,
      { taskId: existing.taskId, shiftId: existing.shiftId, claimId: existing.id },
      userId,
    )
  })
  return { ok: true }
}

/** Issuer verifies a completion: claim -> verified, credits minted. */
export async function verifyCompletion(claimId: string, orgId: string, actorId: string): Promise<Result> {
  const claim = (await db.select().from(claims).where(eq(claims.id, claimId)).limit(1))[0]
  if (!claim) return { ok: false, error: 'Claim not found.' }
  if (claim.status !== 'submitted' && claim.status !== 'claimed') {
    return { ok: false, error: `Claim is already ${claim.status}.` }
  }
  const task = (await db.select().from(tasks).where(eq(tasks.id, claim.taskId)).limit(1))[0]
  if (!task || task.orgId !== orgId) return { ok: false, error: 'This claim does not belong to your organization.' }

  const participant = (await db.select().from(users).where(eq(users.id, claim.userId)).limit(1))[0]
  if (!participant) return { ok: false, error: 'Participant not found.' }

  await db.transaction(async (tx) => {
    await tx.update(claims).set({ status: 'verified', updatedAt: Date.now() }).where(eq(claims.id, claimId))
    await tx
      .update(users)
      .set({
        creditBalance: participant.creditBalance + task.credits,
        lifetimeEarned: participant.lifetimeEarned + task.credits,
      })
      .where(eq(users.id, participant.id))
    await appendEvent(
      tx,
      EventTypes.COMPLETION_VERIFIED,
      { claimId, taskId: task.id, shiftId: claim.shiftId, participantId: participant.id, credits: task.credits },
      actorId,
    )
    await appendEvent(
      tx,
      EventTypes.CREDITS_MINTED,
      { userId: participant.id, amount: task.credits, reason: 'task_completion', refId: claimId },
      actorId,
    )
  })
  return { ok: true }
}

/**
 * Self check-in: the volunteer enters the shift's code on-site. Records
 * attendance and advances the sign-up to `submitted` (the verification queue).
 */
export async function selfCheckIn(shiftId: string, userId: string, code: string): Promise<Result> {
  const shift = (await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1))[0]
  if (!shift) return { ok: false, error: 'Shift not found.' }
  if (!checkInOpen(shift)) return { ok: false, error: 'Check-in isn’t open for this shift right now.' }
  if (!code.trim() || code.trim().toUpperCase() !== (shift.checkInCode || '').toUpperCase()) {
    return { ok: false, error: 'That check-in code doesn’t match.' }
  }
  const claim = (
    await db.select().from(claims).where(and(eq(claims.shiftId, shiftId), eq(claims.userId, userId))).limit(1)
  )[0]
  if (!claim || claim.status === 'unclaimed') return { ok: false, error: 'You’re not signed up for this shift.' }
  if (claim.checkedInAt) return { ok: true }
  if (claim.status !== 'claimed' && claim.status !== 'submitted') {
    return { ok: false, error: `This sign-up is already ${claim.status}.` }
  }

  const now = Date.now()
  await db.transaction(async (tx) => {
    await tx.update(claims).set({ checkedInAt: now, status: 'submitted', updatedAt: now }).where(eq(claims.id, claim.id))
    await appendEvent(
      tx,
      EventTypes.CLAIM_CHECKED_IN,
      { taskId: claim.taskId, shiftId, claimId: claim.id, method: 'self' },
      userId,
    )
  })
  await cancelRemindersForClaim(userId, shiftId)
  return { ok: true }
}

/** Issuer/lead marks a volunteer present from the shift roster. */
export async function issuerCheckIn(claimId: string, orgId: string, actorId: string): Promise<Result> {
  const claim = (await db.select().from(claims).where(eq(claims.id, claimId)).limit(1))[0]
  if (!claim) return { ok: false, error: 'Sign-up not found.' }
  const task = (await db.select().from(tasks).where(eq(tasks.id, claim.taskId)).limit(1))[0]
  if (!task || task.orgId !== orgId) return { ok: false, error: 'This sign-up does not belong to your organization.' }
  if (claim.checkedInAt) return { ok: true }
  if (claim.status !== 'claimed' && claim.status !== 'submitted') {
    return { ok: false, error: `This sign-up is already ${claim.status}.` }
  }

  const now = Date.now()
  await db.transaction(async (tx) => {
    await tx.update(claims).set({ checkedInAt: now, status: 'submitted', updatedAt: now }).where(eq(claims.id, claim.id))
    await appendEvent(
      tx,
      EventTypes.CLAIM_CHECKED_IN,
      { taskId: claim.taskId, shiftId: claim.shiftId, claimId: claim.id, method: 'issuer' },
      actorId,
    )
  })
  if (claim.shiftId) await cancelRemindersForClaim(claim.userId, claim.shiftId)
  return { ok: true }
}

export async function rejectCompletion(claimId: string, orgId: string, actorId: string): Promise<Result> {
  const claim = (await db.select().from(claims).where(eq(claims.id, claimId)).limit(1))[0]
  if (!claim) return { ok: false, error: 'Claim not found.' }
  if (claim.status !== 'submitted' && claim.status !== 'claimed') {
    return { ok: false, error: `Claim is already ${claim.status}.` }
  }
  const task = (await db.select().from(tasks).where(eq(tasks.id, claim.taskId)).limit(1))[0]
  if (!task || task.orgId !== orgId) return { ok: false, error: 'This claim does not belong to your organization.' }

  await db.transaction(async (tx) => {
    await tx.update(claims).set({ status: 'rejected', updatedAt: Date.now() }).where(eq(claims.id, claimId))
    await appendEvent(
      tx,
      EventTypes.COMPLETION_REJECTED,
      { claimId, taskId: task.id, shiftId: claim.shiftId, participantId: claim.userId },
      actorId,
    )
  })
  return { ok: true }
}
