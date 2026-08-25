import { randomUUID } from 'crypto'
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { tasks, shifts, claims, orgs, users, verificationBatches } from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import { getOnboardingWaiverSetup, hasSignedWaiver } from './waivers'
import {
  notifyShiftClaimed,
  notifyShiftAssigned,
  notifyShiftCancelled,
  notifyVerifiedShiftReflection,
  cancelRemindersForClaim,
  cancelRemindersForShift,
  cancelRemindersForTask,
} from './notifications'
import { missingCredentials } from './credentials'
import { parseCredentialList, credentialLabel, isCredentialKey } from '@/lib/credentials'
import type { Result } from './identity'
import {
  activateCityParticipationForCheckIn,
  checkCityParticipationGate,
  processOverdueNoShows,
} from './city-participation'
import { mintCityCredits } from './city-wallets'
import { normalizeOrganizationLocation, rememberOrganizationLocation } from './organization-locations'
import { programBelongsToOrganization } from './volunteer-programs'

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
  cityId: string
  actorId: string
  title: string
  description: string
  location: string
  credits: number
  slots: number
  startsAt: string
  requiredCredentials?: string[]
  catalogEntryId?: string | null
  programId?: string | null
}): Promise<Result<{ id: string }>> {
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' }
  const location = normalizeOrganizationLocation(input.location)
  if (location.length > 240) return { ok: false, error: 'Locations are limited to 240 characters.' }
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
  if (!(await programBelongsToOrganization(input.orgId, input.programId))) {
    return { ok: false, error: 'Choose a volunteer program belonging to your organization.' }
  }

  const id = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(tasks).values({
      id,
      orgId: input.orgId,
      cityId: input.cityId,
      title: input.title.trim(),
      description: input.description.trim(),
      location,
      credits: input.credits,
      slots: input.slots,
      startsAt: input.startsAt.trim(),
      status: 'open',
      programId: input.programId || null,
      requiredCredentials: JSON.stringify((input.requiredCredentials ?? []).filter(isCredentialKey)),
      catalogEntryId: input.catalogEntryId ?? null,
      createdBy: input.actorId,
      createdAt: Date.now(),
    })
    await rememberOrganizationLocation(tx, { orgId: input.orgId, address: location })
    await appendEvent(
      tx,
      EventTypes.TASK_CREATED,
      { taskId: id, orgId: input.orgId, cityId: input.cityId, credits: input.credits, title: input.title.trim() },
      input.actorId,
    )
  })
  return { ok: true, id }
}

/**
 * Update the reusable definition of an opportunity. Scheduled shifts retain
 * their own dates and capacity; these fields become the defaults for future
 * shifts and the public context volunteers see.
 */
export async function updateTask(input: {
  taskId: string
  orgId: string
  actorId: string
  title: string
  description: string
  location: string
  credits?: number
  slots?: number
  programId?: string | null
}): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' }
  const location = normalizeOrganizationLocation(input.location)
  if (location.length > 240) return { ok: false, error: 'Locations are limited to 240 characters.' }
  if (input.credits !== undefined && (!Number.isInteger(input.credits) || input.credits < 1 || input.credits > 100000)) {
    return { ok: false, error: 'Credits must be a whole number between 1 and 100,000.' }
  }
  if (input.slots !== undefined && (!Number.isInteger(input.slots) || input.slots < 1 || input.slots > 10000)) {
    return { ok: false, error: 'Default capacity must be a whole number of at least 1.' }
  }

  const task = (await db.select().from(tasks).where(eq(tasks.id, input.taskId)).limit(1))[0]
  if (!task || task.orgId !== input.orgId) return { ok: false, error: 'Opportunity not found.' }
  const credits = input.credits ?? task.credits
  const slots = input.slots ?? task.slots
  const programId = input.programId === undefined ? task.programId : input.programId
  if (!(await programBelongsToOrganization(input.orgId, programId))) {
    return { ok: false, error: 'Choose a volunteer program belonging to your organization.' }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(tasks)
      .set({
        title: input.title.trim(),
        description: input.description.trim(),
        location,
        credits,
        slots,
        programId,
      })
      .where(eq(tasks.id, input.taskId))
    await rememberOrganizationLocation(tx, { orgId: input.orgId, address: location })
    await appendEvent(
      tx,
      EventTypes.TASK_UPDATED,
      { taskId: input.taskId, cityId: task.cityId, credits, title: input.title.trim() },
      input.actorId,
    )
  })
  return { ok: true }
}

export async function createShift(input: {
  taskId: string
  orgId: string
  actorId: string
  startsAt: number | null
  endsAt: number | null
  label: string
  capacity: number
  visibility?: 'public' | 'private'
}): Promise<Result<{ id: string }>> {
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 10000) {
    return { ok: false, error: 'Capacity must be a whole number of at least 1.' }
  }
  const task = (await db.select().from(tasks).where(eq(tasks.id, input.taskId)).limit(1))[0]
  if (!task || task.orgId !== input.orgId) return { ok: false, error: 'Opportunity not found.' }
  if (task.status !== 'open') return { ok: false, error: 'Reopen this opportunity before publishing another session.' }
  const visibility = input.visibility === 'private' ? 'private' : 'public'
  const enrollmentMode = visibility === 'private' ? 'organization_managed' : 'open_claims'

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
      visibility,
      enrollmentMode,
      checkInCode: shiftCode(),
      createdAt: Date.now(),
    })
    await appendEvent(
      tx,
      EventTypes.SHIFT_CREATED,
      { shiftId: id, taskId: input.taskId, cityId: task.cityId, capacity: input.capacity, startsAt: input.startsAt, visibility, enrollmentMode },
      input.actorId,
    )
  })
  return { ok: true, id }
}

/**
 * Add existing roster members to a published shift. An assignment creates the
 * same durable commitment record as a self-service claim, but the participant
 * receives a distinct notification explaining that the organization scheduled
 * them. This works for both public and private shifts.
 */
export async function assignVolunteersToShift(input: {
  shiftId: string
  orgId: string
  actorId: string
  userIds: string[]
}): Promise<Result<{ assigned: number; alreadyAssigned: number }>> {
  const userIds = Array.from(new Set(input.userIds.filter(Boolean)))
  if (!userIds.length) return { ok: false, error: 'Choose at least one volunteer to assign.' }

  const row = await db
    .select({ shift: shifts, task: tasks })
    .from(shifts)
    .innerJoin(tasks, eq(shifts.taskId, tasks.id))
    .where(and(eq(shifts.id, input.shiftId), eq(shifts.orgId, input.orgId)))
    .limit(1)
    .then((rows) => rows[0] ?? null)
  if (!row) return { ok: false, error: 'Published shift not found.' }
  const { shift, task } = row
  if (task.orgId !== input.orgId || task.status !== 'open' || shift.status !== 'open') return { ok: false, error: 'This shift is not accepting roster assignments.' }
  if (shift.startsAt && shift.startsAt <= Date.now()) return { ok: false, error: 'Roster assignments are available only before the shift begins.' }

  const rosterRows = await db
    .select({ userId: claims.userId })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .where(and(eq(tasks.orgId, input.orgId), inArray(claims.userId, userIds), ne(claims.status, 'unclaimed')))
  const rosterIds = new Set(rosterRows.map(({ userId }) => userId))
  const invalidIds = userIds.filter((userId) => !rosterIds.has(userId))
  if (invalidIds.length) return { ok: false, error: 'Only people already in your organization roster can be assigned.' }

  const existingRows = await db
    .select()
    .from(claims)
    .where(and(eq(claims.shiftId, input.shiftId), inArray(claims.userId, userIds)))
  const existingByUserId = new Map(existingRows.map((claim) => [claim.userId, claim]))
  const toAssign = userIds.filter((userId) => {
    const existing = existingByUserId.get(userId)
    return !existing || existing.status === 'unclaimed'
  })
  const alreadyAssigned = userIds.length - toAssign.length
  const activeCount = await activeClaimCount(input.shiftId)
  if (activeCount + toAssign.length > shift.capacity) {
    return { ok: false, error: `Only ${Math.max(0, shift.capacity - activeCount)} spot${shift.capacity - activeCount === 1 ? '' : 's'} remain in this shift.` }
  }

  const now = Date.now()
  await db.transaction(async (tx) => {
    for (const userId of toAssign) {
      const existing = existingByUserId.get(userId)
      if (existing) {
        await tx.update(claims).set({ status: 'claimed', updatedAt: now }).where(eq(claims.id, existing.id))
      } else {
        await tx.insert(claims).values({
          id: randomUUID(),
          taskId: task.id,
          shiftId: shift.id,
          userId,
          status: 'claimed',
          createdAt: now,
          updatedAt: now,
        })
      }
      await appendEvent(
        tx,
        EventTypes.TASK_CLAIMED,
        { taskId: task.id, shiftId: shift.id, cityId: task.cityId, assignedByOrganization: true },
        input.actorId,
      )
    }
  })
  await Promise.all(toAssign.map((userId) => notifyShiftAssigned(userId, shift.id)))
  return { ok: true, assigned: toAssign.length, alreadyAssigned }
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
  const task = (await db.select({ cityId: tasks.cityId }).from(tasks).where(eq(tasks.id, shift.taskId)).limit(1))[0]
  if (!task) return { ok: false, error: 'Opportunity not found.' }
  if (shift.status === 'closed') return { ok: true }
  await db.transaction(async (tx) => {
    await tx.update(shifts).set({ status: 'closed' }).where(eq(shifts.id, shiftId))
    await appendEvent(tx, EventTypes.SHIFT_CLOSED, { shiftId, taskId: shift.taskId, cityId: task.cityId }, actorId)
  })
  await cancelRemindersForShift(shiftId)
  return { ok: true }
}

/** Cancel one future volunteer event, release reservations, and notify every
 * affected participant without closing the underlying opportunity template. */
export async function cancelUpcomingShiftAndNotify(input: {
  shiftId: string
  orgId: string
  actorId: string
}): Promise<Result<{ notified: number }>> {
  const now = Date.now()
  const row = await db
    .select({ shift: shifts, task: tasks, organizationName: orgs.name })
    .from(shifts)
    .innerJoin(tasks, eq(shifts.taskId, tasks.id))
    .innerJoin(orgs, eq(tasks.orgId, orgs.id))
    .where(and(eq(shifts.id, input.shiftId), eq(shifts.orgId, input.orgId)))
    .limit(1)
    .then((rows) => rows[0] ?? null)

  if (!row) return { ok: false, error: 'Event not found.' }
  if (row.shift.status !== 'open') return { ok: false, error: 'That event has already been closed.' }
  if (!row.shift.startsAt || row.shift.startsAt <= now) return { ok: false, error: 'Only a future event can be cancelled.' }

  const activeClaims = await db
    .select({ userId: claims.userId })
    .from(claims)
    .where(and(eq(claims.shiftId, input.shiftId), inArray(claims.status, ['claimed', 'submitted'])))
  const participantIds = Array.from(new Set(activeClaims.map((claim) => claim.userId)))

  await db.transaction(async (tx) => {
    await tx.update(shifts).set({ status: 'closed' }).where(eq(shifts.id, input.shiftId))
    if (participantIds.length > 0) {
      await tx
        .update(claims)
        .set({ status: 'unclaimed', updatedAt: now })
        .where(and(eq(claims.shiftId, input.shiftId), inArray(claims.status, ['claimed', 'submitted'])))
    }
    await appendEvent(
      tx,
      EventTypes.SHIFT_CLOSED,
      {
        shiftId: input.shiftId,
        taskId: row.task.id,
        cityId: row.task.cityId,
        reason: 'organization_event_cancelled',
        releasedParticipantCount: participantIds.length,
      },
      input.actorId,
    )
  })
  await cancelRemindersForShift(input.shiftId)
  await notifyShiftCancelled({
    userIds: participantIds,
    taskId: row.task.id,
    taskTitle: row.task.title,
    organizationName: row.organizationName,
    startsAt: row.shift.startsAt,
  })
  return { ok: true, notified: participantIds.length }
}

export async function closeTask(taskId: string, orgId: string, actorId: string): Promise<Result> {
  const task = (await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1))[0]
  if (!task || task.orgId !== orgId) return { ok: false, error: 'Task not found.' }
  if (task.status === 'closed') return { ok: true }

  await db.transaction(async (tx) => {
    await tx.update(tasks).set({ status: 'closed' }).where(eq(tasks.id, taskId))
    // Closing an opportunity closes its still-open shifts.
    await tx.update(shifts).set({ status: 'closed' }).where(and(eq(shifts.taskId, taskId), eq(shifts.status, 'open')))
    await appendEvent(tx, EventTypes.TASK_CLOSED, { taskId, cityId: task.cityId }, actorId)
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
    await appendEvent(tx, EventTypes.TASK_REOPENED, { taskId, cityId: task.cityId }, actorId)
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
  | { ok: true; inPersonWaiver?: { waiverVersionIds: string[] } }
  | { ok: false; reason: 'waiver_required'; waiverVersionIds: string[] }
  | { ok: false; reason: 'credentials_required'; missing: string[] }
  | { ok: false; reason: 'error'; error: string }

/** Everything that must be true before a participant can claim a shift. */
export async function checkClaimGate(shiftId: string, userId: string): Promise<ClaimGate> {
  const shift = (await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1))[0]
  if (!shift) return { ok: false, reason: 'error', error: 'Shift not found.' }
  if (shift.status !== 'open') return { ok: false, reason: 'error', error: 'This shift is closed.' }
  if (shift.visibility === 'private') return { ok: false, reason: 'error', error: 'This is a private shift. The organization manages its roster directly.' }
  if (shift.enrollmentMode === 'organization_managed') return { ok: false, reason: 'error', error: 'This shift is managed by the organization. Contact them to be added.' }

  const task = (await db.select().from(tasks).where(eq(tasks.id, shift.taskId)).limit(1))[0]
  if (!task || task.status !== 'open') return { ok: false, reason: 'error', error: 'This opportunity is closed.' }

  const org = (await db.select().from(orgs).where(eq(orgs.id, task.orgId)).limit(1))[0]
  if (!org || org.status !== 'approved') {
    return { ok: false, reason: 'error', error: 'The issuing organization is not active.' }
  }

  const cityGate = await checkCityParticipationGate({ userId, taskId: task.id, cityId: task.cityId })
  if (!cityGate.ok) return { ok: false, reason: 'error', error: cityGate.error }

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

  const waiverSetup = await getOnboardingWaiverSetup(task.orgId)
  const isOnboarding = task.isOnboarding === 1
  if (isOnboarding && waiverSetup.method === 'in_person' && waiverSetup.waivers.length > 0) {
    return { ok: true, inPersonWaiver: { waiverVersionIds: waiverSetup.waivers.map((waiver) => waiver.id) } }
  }
  if (isOnboarding) {
    const unacceptedWaiverIds = (
      await Promise.all(waiverSetup.waivers.map(async (waiver) => (
        (await hasSignedWaiver(userId, waiver.id)) ? null : waiver.id
      )))
    ).filter((id): id is string => Boolean(id))
    if (unacceptedWaiverIds.length > 0) {
      return { ok: false, reason: 'waiver_required', waiverVersionIds: unacceptedWaiverIds }
    }
  }

  return { ok: true }
}

export async function claimShift(shiftId: string, userId: string): Promise<Result> {
  // The scheduled job does this continuously in production. Running a sweep
  // here as well prevents an overdue claim from bypassing the reservation rule
  // between cron runs.
  await processOverdueNoShows()
  const gate = await checkClaimGate(shiftId, userId)
  if (!gate.ok) {
    let error: string
    if (gate.reason === 'waiver_required') {
      error = 'You must digitally sign the organization’s liability waiver before signing up.'
    } else if (gate.reason === 'credentials_required') {
      error = `This opportunity requires: ${gate.missing.map(credentialLabel).join(', ')}. Contact the organization to get verified.`
    } else {
      error = gate.error
    }
    return { ok: false, error }
  }

  const shift = (await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1))[0]
  if (!shift) return { ok: false, error: 'Shift not found.' }
  const task = (await db.select({ cityId: tasks.cityId }).from(tasks).where(eq(tasks.id, shift.taskId)).limit(1))[0]
  if (!task) return { ok: false, error: 'Opportunity not found.' }

  const existing = (
    await db.select().from(claims).where(and(eq(claims.shiftId, shiftId), eq(claims.userId, userId))).limit(1)
  )[0]

  const now = Date.now()
  // The existing claim record retains the first required waiver as a backwards
  // compatible audit pointer. The full active set is enforced before a digital
  // reservation, and a paper confirmation attests receipt of the attached set.
  const inPersonWaiverFields = gate.inPersonWaiver
    ? { waiverVersionId: gate.inPersonWaiver.waiverVersionIds[0], waiverCollectionMethod: 'in_person' as const }
    : {}
  await db.transaction(async (tx) => {
    if (existing) {
      await tx.update(claims).set({ status: 'claimed', updatedAt: now, ...inPersonWaiverFields }).where(eq(claims.id, existing.id))
    } else {
      await tx.insert(claims).values({
        id: randomUUID(),
        taskId: shift.taskId,
        shiftId,
        userId,
        status: 'claimed',
        ...inPersonWaiverFields,
        createdAt: now,
        updatedAt: now,
      })
    }
    await appendEvent(tx, EventTypes.TASK_CLAIMED, { taskId: shift.taskId, shiftId, cityId: task.cityId }, userId)
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
  const task = (await db.select({ cityId: tasks.cityId }).from(tasks).where(eq(tasks.id, existing.taskId)).limit(1))[0]
  if (!task) return { ok: false, error: 'Opportunity not found.' }
  if (existing.shiftId) {
    const shift = (await db.select().from(shifts).where(eq(shifts.id, existing.shiftId)).limit(1))[0]
    const cancellationDeadline = shift?.startsAt ? shift.startsAt - 24 * 60 * 60 * 1000 : null
    if (cancellationDeadline && Date.now() > cancellationDeadline) {
      return { ok: false, error: 'The 24-hour cancellation window has closed. Please contact the organization if you need help.' }
    }
  }
  await db.transaction(async (tx) => {
    await tx.update(claims).set({ status: 'unclaimed', updatedAt: Date.now() }).where(eq(claims.id, existing.id))
    await appendEvent(
      tx,
      EventTypes.CLAIM_UNCLAIMED,
      { taskId: existing.taskId, shiftId: existing.shiftId, claimId: existing.id, cityId: task.cityId },
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
  const task = (await db.select({ cityId: tasks.cityId }).from(tasks).where(eq(tasks.id, existing.taskId)).limit(1))[0]
  if (!task) return { ok: false, error: 'Opportunity not found.' }
  await db.transaction(async (tx) => {
    await tx
      .update(claims)
      .set({ status: 'submitted', note: note.trim(), updatedAt: Date.now() })
      .where(eq(claims.id, existing.id))
    await appendEvent(
      tx,
      EventTypes.COMPLETION_SUBMITTED,
      { taskId: existing.taskId, shiftId: existing.shiftId, claimId: existing.id, cityId: task.cityId },
      userId,
    )
  })
  return { ok: true }
}

/** Issuer verifies a completion: claim -> verified, credits minted. */
export async function verifyCompletion(
  claimId: string,
  orgId: string,
  actorId: string,
  paperWaiverReceived = false,
  verificationBatchId?: string,
): Promise<Result> {
  const claim = (await db.select().from(claims).where(eq(claims.id, claimId)).limit(1))[0]
  if (!claim) return { ok: false, error: 'Claim not found.' }
  if (claim.status !== 'submitted' && claim.status !== 'claimed') {
    return { ok: false, error: `Claim is already ${claim.status}.` }
  }
  const task = (await db.select().from(tasks).where(eq(tasks.id, claim.taskId)).limit(1))[0]
  if (!task || task.orgId !== orgId) return { ok: false, error: 'This claim does not belong to your organization.' }
  if (task.isOnboarding === 1 && !claim.checkedInAt) {
    return { ok: false, error: 'Check the participant in before verifying an onboarding task.' }
  }
  const paperWaiverNeedsConfirmation = claim.waiverCollectionMethod === 'in_person' && !claim.paperWaiverConfirmedAt
  if (paperWaiverNeedsConfirmation && !paperWaiverReceived) {
    return { ok: false, error: 'Confirm that you received the participant’s signed paper waiver at check-in before verifying onboarding.' }
  }

  const participant = (await db.select().from(users).where(eq(users.id, claim.userId)).limit(1))[0]
  if (!participant) return { ok: false, error: 'Participant not found.' }

  // The wallet and credit journal are authoritative in the task's city
  // database. The reference makes this safe to retry if the control-plane
  // claim update needs to be replayed after a transient failure.
  await mintCityCredits({
    cityId: task.cityId,
    userId: participant.id,
    amount: task.credits,
    refId: `claim:${claimId}`,
    reason: 'task_completion',
    actorId,
  })

  await db.transaction(async (tx) => {
    const now = Date.now()
    await tx
      .update(claims)
      .set({
        status: 'verified',
        updatedAt: now,
        verifiedByUserId: actorId,
        verifiedAt: now,
        ...(verificationBatchId ? { verificationBatchId } : {}),
        ...(paperWaiverNeedsConfirmation ? { paperWaiverConfirmedAt: now, paperWaiverConfirmedBy: actorId } : {}),
      })
      .where(eq(claims.id, claimId))
    await appendEvent(
      tx,
      EventTypes.COMPLETION_VERIFIED,
      {
        claimId,
        taskId: task.id,
        shiftId: claim.shiftId,
        participantId: participant.id,
        cityId: task.cityId,
        credits: task.credits,
        ...(verificationBatchId ? { verificationBatchId } : {}),
      },
      actorId,
    )
  })

  // A reflection invitation appears only after verified service is durable.
  // Notification delivery is non-authoritative and must not affect the result.
  try {
    const organization = (await db.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, task.orgId)).limit(1))[0]
    await notifyVerifiedShiftReflection({
      userId: participant.id,
      claimId,
      taskTitle: task.title,
      organizationName: organization?.name ?? 'the organization',
    })
  } catch (error) {
    console.error('notifyVerifiedShiftReflection failed', error)
  }

  return { ok: true }
}

/**
 * Staff can confirm an entire completed shift in one operation. Every selected
 * attendee still receives an individual check-in, verified claim, credit mint,
 * and ledger event; the shared batch only removes repeated administrative work.
 */
export async function verifyShiftAttendance(input: {
  shiftId: string
  claimIds: string[]
  orgId: string
  actorId: string
  note?: string
  paperWaiverReceived?: boolean
}): Promise<Result<{ batchId: string; verifiedCount: number }>> {
  const now = Date.now()
  const shiftRow = (await db
    .select({ shift: shifts, task: tasks })
    .from(shifts)
    .innerJoin(tasks, eq(shifts.taskId, tasks.id))
    .where(and(eq(shifts.id, input.shiftId), eq(shifts.orgId, input.orgId)))
    .limit(1))[0]
  if (!shiftRow || shiftRow.task.orgId !== input.orgId) {
    return { ok: false, error: 'That shift is not available to your organization.' }
  }
  if (shiftRow.shift.status !== 'open') {
    return { ok: false, error: 'Only an active shift can be verified.' }
  }
  if ((shiftRow.shift.endsAt ?? shiftRow.shift.startsAt) && (shiftRow.shift.endsAt ?? shiftRow.shift.startsAt)! > now) {
    return { ok: false, error: 'Wait until the shift has ended before confirming attendance.' }
  }

  const selectedIds = Array.from(new Set(input.claimIds.filter(Boolean)))
  if (selectedIds.length === 0) return { ok: false, error: 'Select at least one attendee to verify.' }
  const selectedClaims = await db
    .select()
    .from(claims)
    .where(and(eq(claims.shiftId, input.shiftId), inArray(claims.id, selectedIds), inArray(claims.status, ['claimed', 'submitted'])))
  if (selectedClaims.length !== selectedIds.length) {
    return { ok: false, error: 'One or more selected sign-ups have already been resolved. Refresh the shift roster and try again.' }
  }
  const needsPaperWaiver = selectedClaims.some((claim) => claim.waiverCollectionMethod === 'in_person' && !claim.paperWaiverConfirmedAt)
  if (needsPaperWaiver && !input.paperWaiverReceived) {
    return { ok: false, error: 'Confirm that the selected attendees provided their signed paper waivers before verifying this onboarding shift.' }
  }

  const batchId = randomUUID()
  const note = input.note?.trim().slice(0, 2_000) ?? ''
  await db.insert(verificationBatches).values({
    id: batchId,
    orgId: input.orgId,
    taskId: shiftRow.task.id,
    shiftId: shiftRow.shift.id,
    verifiedByUserId: input.actorId,
    note,
    participantCount: selectedClaims.length,
    verifiedAt: now,
    createdAt: now,
  })

  // Keep these operations sequential: both the organization ledger and the
  // city credit ledger are hash-chained, and each participant needs a durable
  // individual record even though staff confirmed them together.
  for (const claim of selectedClaims) {
    if (!claim.checkedInAt) {
      const checkIn = await issuerCheckIn(claim.id, input.orgId, input.actorId)
      if (!checkIn.ok) return checkIn
    }
    const verified = await verifyCompletion(
      claim.id,
      input.orgId,
      input.actorId,
      Boolean(input.paperWaiverReceived),
      batchId,
    )
    if (!verified.ok) return verified
  }

  await db.transaction(async (tx) => {
    await appendEvent(
      tx,
      EventTypes.SHIFT_ATTENDANCE_BATCH_VERIFIED,
      {
        batchId,
        taskId: shiftRow.task.id,
        shiftId: shiftRow.shift.id,
        orgId: input.orgId,
        participantCount: selectedClaims.length,
        verifiedAt: now,
      },
      input.actorId,
      shiftRow.task.cityId,
    )
  })
  return { ok: true, batchId, verifiedCount: selectedClaims.length }
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
  const task = (await db.select({ cityId: tasks.cityId }).from(tasks).where(eq(tasks.id, claim.taskId)).limit(1))[0]
  if (!task) return { ok: false, error: 'Opportunity not found.' }

  const now = Date.now()
  await db.transaction(async (tx) => {
    await tx.update(claims).set({ checkedInAt: now, status: 'submitted', updatedAt: now }).where(eq(claims.id, claim.id))
    await appendEvent(
      tx,
      EventTypes.CLAIM_CHECKED_IN,
      { taskId: claim.taskId, shiftId, claimId: claim.id, cityId: task.cityId, method: 'self' },
      userId,
    )
  })
  await cancelRemindersForClaim(userId, shiftId)
  await activateCityParticipationForCheckIn(claim.taskId, claim.userId)
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
      { taskId: claim.taskId, shiftId: claim.shiftId, claimId: claim.id, cityId: task.cityId, method: 'issuer' },
      actorId,
    )
  })
  if (claim.shiftId) await cancelRemindersForClaim(claim.userId, claim.shiftId)
  await activateCityParticipationForCheckIn(claim.taskId, claim.userId)
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
      { claimId, taskId: task.id, shiftId: claim.shiftId, participantId: claim.userId, cityId: task.cityId },
      actorId,
    )
  })
  return { ok: true }
}
