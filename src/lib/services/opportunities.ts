import { randomUUID } from 'crypto'
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { tasks, shifts, claims, orgs, users, organizationDelegations, shiftStaffAssignments, verificationBatches, volunteerIdentityVerifications, plannedRecurringAssignments, plannedRecurringStaffAssignments, recurringEventSchedules, programRecognitions, orgMessages, messageRecipients } from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import { getOnboardingWaiverSetup, hasSignedWaiver } from './waivers'
import {
  notifyShiftClaimed,
  notifyShiftAssigned,
  notifyShiftAssignmentRemoved,
  notifyShiftCancelled,
  notifyVerifiedShiftReflection,
  cancelRemindersForClaim,
  cancelRemindersForShift,
} from './notifications'
import { missingCredentials } from './credentials'
import { parseCredentialList, credentialLabel, isCredentialKey } from '@/lib/credentials'
import type { Result } from './identity'
import {
  activateCityParticipationForCheckIn,
  checkCityParticipationGate,
  markUnverifiedClaimsNoShow,
} from './city-participation'
import { mintCityCredits } from './city-wallets'
import { normalizeOrganizationLocation, rememberOrganizationLocation } from './organization-locations'
import { programBelongsToOrganization } from './volunteer-programs'
import { programAccessError, programPolicy, registerProgramCandidate, scopeOf } from './program-workspace'
import { getIntake, intakeReservationGate } from './volunteer-intake'
import { getRoster } from './roster'

/**
 * Opportunity module. An opportunity (task) is a template; volunteers claim a
 * specific dated **shift** of it. Mirrors OpportunityManager lifecycle:
 * create opportunity -> add shift(s) -> claim shift -> submit -> verify (mint).
 * Credits are awarded per completion from the parent opportunity's value, so
 * verification/minting/impact keep joining claims -> tasks unchanged.
 */

export type ShiftRow = typeof shifts.$inferSelect
const ACTIVE_CLAIM_STATUSES = ['claimed', 'submitted', 'verified'] as const
const MINUTE_MS = 60_000

function advanceDays(startsAt: number, days: number) {
  const date = new Date(startsAt)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

function recurringShiftLabel(startsAt: number) {
  return `Weekly ${new Date(startsAt).toLocaleDateString('en-US', { weekday: 'long' })} event`
}

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
  defaultDurationMinutes?: number
  startsAt: string
  requiredCredentials?: string[]
  catalogEntryId?: string | null
  programId?: string | null
  initialShift?: {
    startsAt: number
    capacity: number
    durationMinutes: number
    visibility: 'public' | 'private'
    recurring: boolean
  }
  initialShifts?: Array<{
    startsAt: number
    capacity: number
    durationMinutes: number
    visibility: 'public' | 'private'
    recurring: boolean
  }>
}): Promise<Result<{ id: string; shiftId?: string; visibility?: 'public' | 'private' }>> {
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' }
  const location = normalizeOrganizationLocation(input.location)
  if (location.length > 240) return { ok: false, error: 'Locations are limited to 240 characters.' }
  if (!Number.isInteger(input.credits) || input.credits < 1 || input.credits > 100000) {
    return { ok: false, error: 'Credits must be a whole number between 1 and 100,000.' }
  }
  if (!Number.isInteger(input.slots) || input.slots < 1 || input.slots > 10000) {
    return { ok: false, error: 'Slots must be a whole number of at least 1.' }
  }
  const defaultDurationMinutes = input.defaultDurationMinutes ?? 120
  if (!Number.isInteger(defaultDurationMinutes) || defaultDurationMinutes < 15 || defaultDurationMinutes > 24 * 60) {
    return { ok: false, error: 'Default shift duration must be between 15 minutes and 24 hours.' }
  }
  const initialShifts = input.initialShifts ?? (input.initialShift ? [input.initialShift] : [])
  if (initialShifts.length > 21) return { ok: false, error: 'Add no more than 21 shifts while creating a role.' }
  if (new Set(initialShifts.map((shift) => shift.startsAt)).size !== initialShifts.length) {
    return { ok: false, error: 'Each shift must have a different day and start time.' }
  }
  for (const initialShift of initialShifts) {
    if (!initialShift.startsAt || initialShift.startsAt < Date.now() - 5 * MINUTE_MS) {
      return { ok: false, error: 'Choose a shift date and time in the future.' }
    }
    if (!Number.isInteger(initialShift.capacity) || initialShift.capacity < 1 || initialShift.capacity > 10000) {
      return { ok: false, error: 'Shift capacity must be a whole number of at least 1.' }
    }
    if (!Number.isInteger(initialShift.durationMinutes) || initialShift.durationMinutes < 15 || initialShift.durationMinutes > 24 * 60) {
      return { ok: false, error: 'Shift duration must be between 15 minutes and 24 hours.' }
    }
  }

  const org = (await db.select().from(orgs).where(eq(orgs.id, input.orgId)).limit(1))[0]
  if (!org || org.status !== 'approved') {
    return { ok: false, error: 'Your organization must be approved before creating opportunities.' }
  }
  if (!(await programBelongsToOrganization(input.orgId, input.programId))) {
    return { ok: false, error: 'Choose a volunteer program belonging to your organization.' }
  }

  const id = randomUUID()
  const shiftIds = initialShifts.map(() => randomUUID())
  const shiftId = shiftIds[0]
  const now = Date.now()
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
      defaultDurationMinutes,
      startsAt: input.startsAt.trim(),
      status: 'open',
      programId: input.programId || null,
      requiredCredentials: JSON.stringify((input.requiredCredentials ?? []).filter(isCredentialKey)),
      catalogEntryId: input.catalogEntryId ?? null,
      createdBy: input.actorId,
      createdAt: now,
    })
    await rememberOrganizationLocation(tx, { orgId: input.orgId, address: location })
    await appendEvent(
      tx,
      EventTypes.TASK_CREATED,
      { taskId: id, orgId: input.orgId, cityId: input.cityId, credits: input.credits, title: input.title.trim() },
      input.actorId,
    )
    for (let index = 0; index < initialShifts.length; index += 1) {
      const initialShift = initialShifts[index]
      const currentShiftId = shiftIds[index]
      const visibility = initialShift.visibility === 'private' ? 'private' : 'public'
      const enrollmentMode = visibility === 'private' ? 'organization_managed' : 'open_claims'
      const endsAt = initialShift.startsAt + initialShift.durationMinutes * MINUTE_MS
      await tx.insert(shifts).values({
        id: currentShiftId,
        taskId: id,
        orgId: input.orgId,
        startsAt: initialShift.startsAt,
        endsAt,
        label: initialShift.recurring ? recurringShiftLabel(initialShift.startsAt) : '',
        capacity: initialShift.capacity,
        status: 'open',
        visibility,
        enrollmentMode,
        checkInCode: shiftCode(),
        createdAt: now,
      })
      await appendEvent(tx, EventTypes.TEMPLATE_EVENT_PUBLISHED, {
        taskId: id,
        orgId: input.orgId,
        cityId: input.cityId,
        shiftId: currentShiftId,
        startsAt: initialShift.startsAt,
        durationMinutes: initialShift.durationMinutes,
        capacity: initialShift.capacity,
        recurring: initialShift.recurring,
        visibility,
        enrollmentMode,
      }, input.actorId)
      if (initialShift.recurring) {
        const nextStartsAt = advanceDays(initialShift.startsAt, 7)
        await tx.insert(recurringEventSchedules).values({
          id: randomUUID(),
          taskId: id,
          orgId: input.orgId,
          intervalDays: 7,
          nextStartsAt,
          durationMinutes: initialShift.durationMinutes,
          capacity: initialShift.capacity,
          visibility,
          enrollmentMode,
          lastPublishedShiftId: currentShiftId,
          active: 1,
          createdAt: now,
          updatedAt: now,
        })
        await appendEvent(tx, EventTypes.TEMPLATE_EVENT_RECURRENCE_SET, {
          taskId: id,
          orgId: input.orgId,
          cityId: input.cityId,
          nextStartsAt,
          waitsForShiftId: currentShiftId,
        }, input.actorId)
      }
    }
  })
  return { ok: true, id, shiftId, visibility: initialShifts[0]?.visibility }
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
  defaultDurationMinutes?: number
  programId?: string | null
  allowCapacityConflicts?: boolean
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
  if (input.defaultDurationMinutes !== undefined && (!Number.isInteger(input.defaultDurationMinutes) || input.defaultDurationMinutes < 15 || input.defaultDurationMinutes > 24 * 60)) {
    return { ok: false, error: 'Default shift duration must be between 15 minutes and 24 hours.' }
  }

  const task = (await db.select().from(tasks).where(eq(tasks.id, input.taskId)).limit(1))[0]
  if (!task || task.orgId !== input.orgId) return { ok: false, error: 'Opportunity not found.' }
  const credits = input.credits ?? task.credits
  const slots = input.slots ?? task.slots
  const defaultDurationMinutes = input.defaultDurationMinutes ?? task.defaultDurationMinutes
  const programId = input.programId === undefined ? task.programId : input.programId
  if (!(await programBelongsToOrganization(input.orgId, programId))) {
    return { ok: false, error: 'Choose a volunteer program belonging to your organization.' }
  }

  if (slots !== task.slots && !input.allowCapacityConflicts) {
    const conflicts = await getTaskCapacityConflicts({ taskId: task.id, orgId: input.orgId, slots })
    if (!conflicts.ok) return conflicts
    if (conflicts.published.length || conflicts.planned.length) {
      return { ok: false, error: 'Some published or planned shifts already have more volunteers than this new default. Review and confirm the change first.' }
    }
  }

  const now = Date.now()
  await db.transaction(async (tx) => {
    await tx
      .update(tasks)
      .set({
        title: input.title.trim(),
        description: input.description.trim(),
        location,
        credits,
        slots,
        defaultDurationMinutes,
        programId,
      })
      .where(eq(tasks.id, input.taskId))
    // Published shifts keep their own capacity. An active recurring schedule,
    // however, is a future-shift generator and should inherit this new default.
    if (slots !== task.slots) {
      await tx
        .update(recurringEventSchedules)
        .set({ capacity: slots, updatedAt: now })
        .where(and(
          eq(recurringEventSchedules.taskId, task.id),
          eq(recurringEventSchedules.orgId, input.orgId),
          eq(recurringEventSchedules.active, 1),
        ))
    }
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
  allowOverCapacity?: boolean
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

  const staffRows = await db
    .select({ userId: organizationDelegations.userId })
    .from(organizationDelegations)
    .where(and(
      eq(organizationDelegations.orgId, input.orgId),
      inArray(organizationDelegations.userId, userIds),
      eq(organizationDelegations.status, 'active'),
    ))
  if (staffRows.length) {
    return { ok: false, error: 'Staff members cannot be assigned as volunteers within the same organization.' }
  }

  const rosterIds = new Set((await getRoster(input.orgId)).volunteers.map(v=>v.userId))
  if (task.isOnboarding === 1) {
    for (const userId of userIds) {
      const gate = await intakeReservationGate(task.id, userId)
      if (!gate.ok) return gate
    }
  }
  const invalidIds = userIds.filter((userId) => !rosterIds.has(userId))
  if (invalidIds.length) return { ok: false, error: 'Only people already in your organization roster can be assigned.' }
  if(task.isOnboarding!==1){
    for(const userId of userIds){
      const error=await programAccessError(input.orgId,scopeOf(task.programId),userId)
      if(error)return {ok:false,error}
    }
  }

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
  if (!input.allowOverCapacity && activeCount + toAssign.length > shift.capacity) {
    return { ok: false, error: `Only ${Math.max(0, shift.capacity - activeCount)} spot${shift.capacity - activeCount === 1 ? '' : 's'} remain in this shift.` }
  }

  // An organization-added onboarding reservation still carries the same
  // requirement snapshot as a self-service reservation. When paper is
  // allowed, the organization is deliberately choosing the staff-attested
  // path; digital-only sessions cannot be bypassed by manual assignment.
  const onboardingRequirement = task.isOnboarding === 1
    ? await getOnboardingWaiverSetup(task.orgId, task)
    : null
  const assignedCollectionMethod: 'digital' | 'in_person' = onboardingRequirement?.method === 'in_person'
    || onboardingRequirement?.method === 'either'
    ? 'in_person'
    : 'digital'
  if (onboardingRequirement && assignedCollectionMethod === 'digital' && onboardingRequirement.waivers.length) {
    const unsignedAssignments = await Promise.all(toAssign.map(async (userId) => {
      const allSigned = (await Promise.all(onboardingRequirement.waivers.map((waiver) => hasSignedWaiver(userId, waiver.id))).then((signed) => signed.every(Boolean)))
      return allSigned ? null : userId
    }))
    if (unsignedAssignments.some(Boolean)) {
      return { ok: false, error: 'Each assigned participant must digitally sign the current onboarding waiver before they can be added to this session.' }
    }
  }
  const onboardingRequirementFields = onboardingRequirement
    ? {
      waiverVersionId: onboardingRequirement.waivers[0]?.id ?? null,
      waiverCollectionMethod: assignedCollectionMethod,
      identityMatchRequired: onboardingRequirement.identityCheck === 'staff_attested' ? 1 : 0,
    }
    : {}

  const now = Date.now()
  await db.transaction(async (tx) => {
    for (const userId of toAssign) {
      const existing = existingByUserId.get(userId)
      if (existing) {
        await tx.update(claims).set({ status: 'claimed', updatedAt: now, ...onboardingRequirementFields }).where(eq(claims.id, existing.id))
      } else {
        await tx.insert(claims).values({
          id: randomUUID(),
          taskId: task.id,
          shiftId: shift.id,
          userId,
          status: 'claimed',
          ...onboardingRequirementFields,
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

export type TaskCapacityConflicts = {
  published: Array<{
    shiftId: string
    title: string
    startsAt: number | null
    assignedVolunteerCount: number
    currentCapacity: number
  }>
  planned: Array<{
    occurrenceStartsAt: number
    assignedVolunteerCount: number
  }>
}

/**
 * Show an issuer exactly what would sit above a new template capacity before
 * they lower it. Published shifts retain their capacity; recurring plans will
 * use the new capacity once the issuer confirms this intentional exception.
 */
export async function getTaskCapacityConflicts(input: {
  taskId: string
  orgId: string
  slots: number
}): Promise<Result<TaskCapacityConflicts>> {
  if (!Number.isInteger(input.slots) || input.slots < 1 || input.slots > 10000) {
    return { ok: false, error: 'Default capacity must be a whole number of at least 1.' }
  }
  const task = (await db.select().from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.orgId, input.orgId))).limit(1))[0]
  if (!task) return { ok: false, error: 'Opportunity not found.' }

  const [shiftCounts, plannedAssignments] = await Promise.all([
    getShiftsWithCounts(task.id),
    db.select().from(plannedRecurringAssignments).where(and(
      eq(plannedRecurringAssignments.taskId, task.id),
      eq(plannedRecurringAssignments.orgId, input.orgId),
      eq(plannedRecurringAssignments.status, 'planned'),
    )),
  ])
  const now = Date.now()
  const published = shiftCounts
    .filter(({ shift, taken }) => {
      const endsAt = shift.endsAt ?? shift.startsAt
      return shift.status === 'open' && (endsAt === null || endsAt >= now) && taken > input.slots
    })
    .map(({ shift, taken }) => ({
      shiftId: shift.id,
      title: shift.label.trim() || task.title,
      startsAt: shift.startsAt,
      assignedVolunteerCount: taken,
      currentCapacity: shift.capacity,
    }))

  const plannedCounts = new Map<number, number>()
  plannedAssignments.forEach((assignment) => {
    if (assignment.occurrenceStartsAt >= now) {
      plannedCounts.set(assignment.occurrenceStartsAt, (plannedCounts.get(assignment.occurrenceStartsAt) ?? 0) + 1)
    }
  })
  const planned = Array.from(plannedCounts.entries())
    .filter(([, assignedVolunteerCount]) => assignedVolunteerCount > input.slots)
    .sort(([left], [right]) => left - right)
    .map(([occurrenceStartsAt, assignedVolunteerCount]) => ({ occurrenceStartsAt, assignedVolunteerCount }))

  return { ok: true, published, planned }
}

/**
 * Retire an opportunity template from an issuer workspace. This is a
 * user-facing deletion, but the ledger and completed service records remain
 * intact: open future shifts are cancelled and the template is closed rather
 * than physically removing historical rows.
 */
export async function deleteOpportunityTemplate(input: {
  taskId: string
  orgId: string
  actorId: string
}): Promise<Result<{ cancelledShiftCount: number; notifiedParticipantCount: number }>> {
  const now = Date.now()
  const row = await db
    .select({ task: tasks, organizationName: orgs.name })
    .from(tasks)
    .innerJoin(orgs, eq(tasks.orgId, orgs.id))
    .where(and(eq(tasks.id, input.taskId), eq(tasks.orgId, input.orgId)))
    .limit(1)
    .then((rows) => rows[0] ?? null)
  if (!row) return { ok: false, error: 'Opportunity template not found.' }
  if (row.task.isOnboarding === 1) return { ok: false, error: 'Onboarding sessions are managed from their own workspace.' }
  if (row.task.status === 'closed') return { ok: true, cancelledShiftCount: 0, notifiedParticipantCount: 0 }

  const openShifts = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.taskId, input.taskId), eq(shifts.status, 'open')))
  const inProgressShifts = openShifts.filter((shift) => {
    if (shift.startsAt === null || shift.startsAt > now) return false
    const endsAt = shift.endsAt ?? shift.startsAt + row.task.defaultDurationMinutes * 60_000
    return endsAt > now
  })
  if (inProgressShifts.length) {
    return { ok: false, error: 'Verify and close the shift that is currently in progress before deleting this template.' }
  }

  const shiftIds = openShifts.map((shift) => shift.id)
  const [activeClaims, plannedAssignments, plannedStaffAssignments] = await Promise.all([
    shiftIds.length
      ? db.select({ shiftId: claims.shiftId, userId: claims.userId }).from(claims).where(and(
        inArray(claims.shiftId, shiftIds),
        inArray(claims.status, ['claimed', 'submitted']),
      ))
      : Promise.resolve([]),
    db.select().from(plannedRecurringAssignments).where(and(
      eq(plannedRecurringAssignments.taskId, input.taskId),
      eq(plannedRecurringAssignments.orgId, input.orgId),
      eq(plannedRecurringAssignments.status, 'planned'),
    )),
    db.select().from(plannedRecurringStaffAssignments).where(and(
      eq(plannedRecurringStaffAssignments.taskId, input.taskId),
      eq(plannedRecurringStaffAssignments.orgId, input.orgId),
      eq(plannedRecurringStaffAssignments.status, 'planned'),
    )),
  ])
  const participantsByShift = new Map<string, string[]>()
  activeClaims.forEach((claim) => {
    if (!claim.shiftId) return
    participantsByShift.set(claim.shiftId, [...(participantsByShift.get(claim.shiftId) ?? []), claim.userId])
  })

  await db.transaction(async (tx) => {
    await tx.update(tasks).set({ status: 'closed' }).where(eq(tasks.id, input.taskId))
    await tx.update(recurringEventSchedules).set({ active: 0, updatedAt: now }).where(and(
      eq(recurringEventSchedules.taskId, input.taskId),
      eq(recurringEventSchedules.orgId, input.orgId),
      eq(recurringEventSchedules.active, 1),
    ))
    if (plannedAssignments.length) {
      await tx.update(plannedRecurringAssignments).set({ status: 'removed', updatedAt: now }).where(and(
        eq(plannedRecurringAssignments.taskId, input.taskId),
        eq(plannedRecurringAssignments.orgId, input.orgId),
        eq(plannedRecurringAssignments.status, 'planned'),
      ))
    }
    if (plannedStaffAssignments.length) {
      await tx.update(plannedRecurringStaffAssignments).set({ status: 'removed', updatedAt: now }).where(and(
        eq(plannedRecurringStaffAssignments.taskId, input.taskId),
        eq(plannedRecurringStaffAssignments.orgId, input.orgId),
        eq(plannedRecurringStaffAssignments.status, 'planned'),
      ))
    }
    if (shiftIds.length) {
      await tx.update(shifts).set({ status: 'closed' }).where(inArray(shifts.id, shiftIds))
      await tx.update(claims).set({ status: 'unclaimed', updatedAt: now }).where(and(
        inArray(claims.shiftId, shiftIds),
        inArray(claims.status, ['claimed', 'submitted']),
      ))
      for (const shift of openShifts) {
        await appendEvent(tx, EventTypes.SHIFT_CLOSED, {
          taskId: row.task.id,
          shiftId: shift.id,
          cityId: row.task.cityId,
          reason: 'template_deleted',
          releasedParticipantCount: participantsByShift.get(shift.id)?.length ?? 0,
        }, input.actorId)
      }
    }
    await appendEvent(tx, EventTypes.TASK_CLOSED, {
      taskId: row.task.id,
      cityId: row.task.cityId,
      reason: 'template_deleted',
      cancelledShiftCount: shiftIds.length,
      removedPlannedAssignmentCount: plannedAssignments.length + plannedStaffAssignments.length,
    }, input.actorId)
  })

  for (const shift of openShifts) {
    await cancelRemindersForShift(shift.id)
    const userIds = participantsByShift.get(shift.id) ?? []
    if (userIds.length && shift.startsAt && shift.startsAt > now) {
      await notifyShiftCancelled({
        userIds,
        taskId: row.task.id,
        taskTitle: row.task.title,
        organizationName: row.organizationName,
        startsAt: shift.startsAt,
      })
    }
  }
  return {
    ok: true,
    cancelledShiftCount: shiftIds.length,
    notifiedParticipantCount: Array.from(new Set(activeClaims.filter((claim) => {
      const shift = openShifts.find((candidate) => candidate.id === claim.shiftId)
      return Boolean(shift?.startsAt && shift.startsAt > now)
    }).map((claim) => claim.userId))).length,
  }
}

/** Remove one roster-managed commitment before the shift begins. The claim is
 * retained as unclaimed for audit/history purposes and the volunteer is told
 * that their schedule changed. */
export async function removeVolunteerFromShift(input: {
  shiftId: string
  orgId: string
  actorId: string
  userId: string
}): Promise<Result> {
  const row = await db
    .select({ claim: claims, shift: shifts, task: tasks })
    .from(claims)
    .innerJoin(shifts, eq(claims.shiftId, shifts.id))
    .innerJoin(tasks, eq(shifts.taskId, tasks.id))
    .where(and(
      eq(claims.shiftId, input.shiftId),
      eq(claims.userId, input.userId),
      eq(shifts.orgId, input.orgId),
    ))
    .limit(1)
    .then((rows) => rows[0] ?? null)

  if (!row || row.task.orgId !== input.orgId) return { ok: false, error: 'That scheduled volunteer was not found.' }
  if (row.shift.visibility !== 'private' || row.shift.enrollmentMode !== 'organization_managed') {
    return { ok: false, error: 'Only roster-managed private assignments can be removed here.' }
  }
  if (row.shift.status !== 'open' || (row.shift.startsAt && row.shift.startsAt <= Date.now())) {
    return { ok: false, error: 'Assignments cannot be changed after a shift begins.' }
  }
  if (row.claim.status !== 'claimed') return { ok: false, error: 'That volunteer no longer has an active assignment.' }

  const now = Date.now()
  await db.transaction(async (tx) => {
    await tx.update(claims).set({ status: 'unclaimed', updatedAt: now }).where(eq(claims.id, row.claim.id))
    await appendEvent(
      tx,
      EventTypes.CLAIM_UNCLAIMED,
      {
        taskId: row.task.id,
        shiftId: row.shift.id,
        claimId: row.claim.id,
        cityId: row.task.cityId,
        removedByOrganization: true,
      },
      input.actorId,
    )
  })
  await cancelRemindersForClaim(input.userId, row.shift.id)
  await notifyShiftAssignmentRemoved(input.userId, row.shift.id)
  return { ok: true }
}

/**
 * Schedule an active organization authority to support a shift. Staff support
 * intentionally lives outside `claims`: it never consumes a volunteer slot,
 * creates service history, or affects civic-credit verification.
 */
export async function assignStaffToShift(input: {
  shiftId: string
  orgId: string
  actorId: string
  userId: string
}): Promise<Result<{ assigned: boolean }>> {
  const row = await db
    .select({ shift: shifts, task: tasks })
    .from(shifts)
    .innerJoin(tasks, eq(shifts.taskId, tasks.id))
    .where(and(eq(shifts.id, input.shiftId), eq(shifts.orgId, input.orgId)))
    .limit(1)
    .then((rows) => rows[0] ?? null)
  if (!row || row.task.orgId !== input.orgId) return { ok: false, error: 'Published shift not found.' }
  if (row.shift.status !== 'open' || (row.shift.startsAt && row.shift.startsAt <= Date.now())) {
    return { ok: false, error: 'Staff can be scheduled only before a shift begins.' }
  }

  const delegation = await db
    .select()
    .from(organizationDelegations)
    .where(and(
      eq(organizationDelegations.orgId, input.orgId),
      eq(organizationDelegations.userId, input.userId),
      eq(organizationDelegations.status, 'active'),
    ))
    .limit(1)
    .then((rows) => rows[0] ?? null)
  if (!delegation) return { ok: false, error: 'That person does not have active organization access.' }

  const existing = await db
    .select({ id: shiftStaffAssignments.id })
    .from(shiftStaffAssignments)
    .where(and(eq(shiftStaffAssignments.shiftId, input.shiftId), eq(shiftStaffAssignments.userId, input.userId)))
    .limit(1)
    .then((rows) => rows[0] ?? null)
  if (existing) return { ok: true, assigned: false }

  const now = Date.now()
  await db.insert(shiftStaffAssignments).values({
    id: randomUUID(),
    shiftId: input.shiftId,
    orgId: input.orgId,
    userId: input.userId,
    delegationId: delegation.id,
    assignedByUserId: input.actorId,
    createdAt: now,
    updatedAt: now,
  })
  return { ok: true, assigned: true }
}

/** Remove a staff-support placement without altering any volunteer claim. */
export async function removeStaffFromShift(input: {
  shiftId: string
  orgId: string
  userId: string
}): Promise<Result> {
  const shift = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.id, input.shiftId), eq(shifts.orgId, input.orgId)))
    .limit(1)
    .then((rows) => rows[0] ?? null)
  if (!shift) return { ok: false, error: 'Published shift not found.' }
  if (shift.status !== 'open' || (shift.startsAt && shift.startsAt <= Date.now())) {
    return { ok: false, error: 'Staff assignments cannot be changed after a shift begins.' }
  }
  await db.delete(shiftStaffAssignments).where(and(
    eq(shiftStaffAssignments.shiftId, input.shiftId),
    eq(shiftStaffAssignments.orgId, input.orgId),
    eq(shiftStaffAssignments.userId, input.userId),
  ))
  return { ok: true }
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
  | {
    ok: true
    onboardingRequirement?: {
      waiverVersionIds: string[]
      collectionMethod: 'digital' | 'in_person'
      identityMatchRequired: boolean
    }
  }
  | { ok: false; reason: 'waiver_required'; waiverVersionIds: string[] }
  | { ok: false; reason: 'credentials_required'; missing: string[] }
  | { ok: false; reason: 'error'; error: string }

/** Everything that must be true before a participant can claim a shift. */
export async function checkClaimGate(
  shiftId: string,
  userId: string,
  requestedWaiverMethod?: 'digital' | 'in_person',
): Promise<ClaimGate> {
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

  const staffAccess = (
    await db
      .select({ id: organizationDelegations.id })
      .from(organizationDelegations)
      .where(and(
        eq(organizationDelegations.orgId, task.orgId),
        eq(organizationDelegations.userId, userId),
        eq(organizationDelegations.status, 'active'),
      ))
      .limit(1)
  )[0]
  if (staffAccess) {
    return { ok: false, reason: 'error', error: 'You have staff access to this organization, so you cannot claim one of its volunteer shifts.' }
  }
  if(task.isOnboarding!==1){
    const error=await programAccessError(task.orgId,scopeOf(task.programId),userId)
    if(error)return {ok:false,reason:'error',error}
  }

  const cityGate = await checkCityParticipationGate({ userId, taskId: task.id, cityId: task.cityId })
  if ((await getIntake(task.id))?.applicationRequired) {
    const intakeGate = await intakeReservationGate(task.id, userId)
    if (!intakeGate.ok) return { ok: false, reason: 'error', error: intakeGate.error }
  }
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

  const isOnboarding = task.isOnboarding === 1
  if (isOnboarding) {
    const waiverSetup = await getOnboardingWaiverSetup(task.orgId, task)
    const configuredMethod = waiverSetup.method ?? 'digital'
    // Paper collection is only selectable when the organization offered it.
    // A client cannot use this field to bypass a digital-only session.
    const collectionMethod: 'digital' | 'in_person' = configuredMethod === 'in_person'
      || (configuredMethod === 'either' && requestedWaiverMethod === 'in_person')
      ? 'in_person'
      : 'digital'

    if (collectionMethod === 'digital') {
      const unacceptedWaiverIds = (
        await Promise.all(waiverSetup.waivers.map(async (waiver) => (
          (await hasSignedWaiver(userId, waiver.id)) ? null : waiver.id
        )))
      ).filter((id): id is string => Boolean(id))
      if (unacceptedWaiverIds.length > 0) {
        return { ok: false, reason: 'waiver_required', waiverVersionIds: unacceptedWaiverIds }
      }
    }
    return {
      ok: true,
      onboardingRequirement: {
        waiverVersionIds: waiverSetup.waivers.map((waiver) => waiver.id),
        collectionMethod,
        identityMatchRequired: waiverSetup.identityCheck === 'staff_attested',
      },
    }
  }

  return { ok: true }
}

export async function claimShift(
  shiftId: string,
  userId: string,
  requestedWaiverMethod?: 'digital' | 'in_person',
): Promise<Result> {
  const gate = await checkClaimGate(shiftId, userId, requestedWaiverMethod)
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
  const task = (await db.select().from(tasks).where(eq(tasks.id, shift.taskId)).limit(1))[0]
  if (!task) return { ok: false, error: 'Opportunity not found.' }
  const welcomePolicy=task.isOnboarding===1 && !(await getIntake(task.id))?await programPolicy(task.orgId,scopeOf(task.programId)):null

  const existing = (
    await db.select().from(claims).where(and(eq(claims.shiftId, shiftId), eq(claims.userId, userId))).limit(1)
  )[0]

  const now = Date.now()
  // The existing claim record retains the first required waiver as a backwards
  // compatible audit pointer. The full active set is enforced before a digital
  // reservation, and a paper confirmation attests receipt of the attached set.
  const onboardingRequirementFields = gate.onboardingRequirement
    ? {
      waiverVersionId: gate.onboardingRequirement.waiverVersionIds[0] ?? null,
      waiverCollectionMethod: gate.onboardingRequirement.collectionMethod,
      identityMatchRequired: gate.onboardingRequirement.identityMatchRequired ? 1 : 0,
    }
    : {}
  await db.transaction(async (tx) => {
    if (existing) {
      await tx.update(claims).set({ status: 'claimed', updatedAt: now, ...onboardingRequirementFields }).where(eq(claims.id, existing.id))
    } else {
      await tx.insert(claims).values({
        id: randomUUID(),
        taskId: shift.taskId,
        shiftId,
        userId,
        status: 'claimed',
        ...onboardingRequirementFields,
        createdAt: now,
        updatedAt: now,
      })
    }
    await appendEvent(tx, EventTypes.TASK_CLAIMED, { taskId: shift.taskId, shiftId, cityId: task.cityId }, userId)
    if(welcomePolicy&&welcomePolicy.onboardingMode!=='none')await registerProgramCandidate(tx,task.orgId,welcomePolicy.scope,userId)
  })
  // Confirmation + pre-shift reminder (best-effort, outside the ledger).
  await notifyShiftClaimed(userId, shiftId)
  return { ok: true }
}

export async function unclaimClaim(claimId: string, userId: string, withdrawalNote = ''): Promise<Result> {
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
  const note = withdrawalNote.trim().slice(0, 600)
  await db.transaction(async (tx) => {
    await tx.update(claims).set({ status: 'unclaimed', updatedAt: Date.now() }).where(eq(claims.id, existing.id))
    await appendEvent(
      tx,
      EventTypes.CLAIM_UNCLAIMED,
      { taskId: existing.taskId, shiftId: existing.shiftId, claimId: existing.id, cityId: task.cityId, ...(note ? { withdrawalNote: note } : {}) },
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
  identityMatchConfirmed = false,
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
  const identityMatch = claim.identityMatchRequired === 1
    ? (await db
        .select({ id: volunteerIdentityVerifications.id })
        .from(volunteerIdentityVerifications)
        .where(and(
          eq(volunteerIdentityVerifications.orgId, orgId),
          eq(volunteerIdentityVerifications.userId, participant.id),
          eq(volunteerIdentityVerifications.status, 'verified'),
        ))
        .limit(1))[0]
    : null
  const identityMatchNeedsConfirmation = claim.identityMatchRequired === 1 && !identityMatch
  if (identityMatchNeedsConfirmation && !identityMatchConfirmed) {
    return { ok: false, error: 'Confirm that the participant matches their City/Sync account before verifying this onboarding session.' }
  }

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
    if (identityMatchNeedsConfirmation) {
      await tx
        .insert(volunteerIdentityVerifications)
        .values({
          id: randomUUID(),
          orgId,
          userId: participant.id,
          status: 'verified',
          verifiedByUserId: actorId,
          verifiedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [volunteerIdentityVerifications.orgId, volunteerIdentityVerifications.userId],
          set: {
            status: 'verified',
            verifiedByUserId: actorId,
            verifiedAt: now,
            revokedByUserId: null,
            revokedAt: null,
            updatedAt: now,
          },
        })
      await appendEvent(
        tx,
        EventTypes.IDENTITY_MATCH_ATTESTED,
        { orgId, taskId: task.id, shiftId: claim.shiftId, participantId: participant.id },
        actorId,
        task.cityId,
      )
    }
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
    if (paperWaiverNeedsConfirmation) {
      await appendEvent(
        tx,
        EventTypes.WAIVER_RECEIPT_ATTESTED,
        {
          claimId,
          taskId: task.id,
          shiftId: claim.shiftId,
          orgId,
          participantId: participant.id,
        },
        actorId,
        task.cityId,
      )
    }
    await appendEvent(
      tx,
      EventTypes.COMPLETION_VERIFIED,
      {
        claimId,
        taskId: task.id,
        shiftId: claim.shiftId,
        participantId: participant.id,
        cityId: task.cityId,
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
 * Staff end a shift by confirming everyone who attended in one operation.
 * Every selected attendee still receives an individual check-in, verified
 * claim, credit mint, and ledger event. Remaining active reservations are
 * explicitly resolved as no-shows before the shift is closed.
 */
export async function verifyShiftAttendance(input: {
  shiftId: string
  claimIds: string[]
  orgId: string
  actorId: string
  note?: string
  thankYouLetter?: string
  paperWaiverReceived?: boolean
  identityMatchesConfirmed?: boolean
}): Promise<Result<{ batchId: string | null; verifiedCount: number; noShowCount: number; thankYouLetterSent: boolean }>> {
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
  if (shiftRow.shift.startsAt && shiftRow.shift.startsAt > now) {
    return { ok: false, error: 'A shift can be finalized once its scheduled start time has arrived.' }
  }

  const selectedIds = Array.from(new Set(input.claimIds.filter(Boolean)))
  const selectedClaims = selectedIds.length
    ? await db
        .select()
        .from(claims)
        .where(and(eq(claims.shiftId, input.shiftId), inArray(claims.id, selectedIds), inArray(claims.status, ['claimed', 'submitted'])))
    : []
  if (selectedClaims.length !== selectedIds.length) {
    return { ok: false, error: 'One or more selected sign-ups have already been resolved. Refresh the shift roster and try again.' }
  }
  const thankYouLetter = input.thankYouLetter?.trim() ?? ''
  if (thankYouLetter.length > 3_000) {
    return { ok: false, error: 'Keep the thank-you letter to 3,000 characters or fewer.' }
  }
  if (thankYouLetter && !selectedClaims.length) {
    return { ok: false, error: 'Select at least one attendee before sending a thank-you letter.' }
  }
  const selectedParticipants = selectedClaims.length
    ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, selectedClaims.map((claim) => claim.userId)))
    : []
  if (selectedParticipants.length !== new Set(selectedClaims.map((claim) => claim.userId)).size) {
    return { ok: false, error: 'One or more selected attendee profiles could not be found.' }
  }
  const needsPaperWaiver = selectedClaims.some((claim) => claim.waiverCollectionMethod === 'in_person' && !claim.paperWaiverConfirmedAt)
  if (needsPaperWaiver && !input.paperWaiverReceived) {
    return { ok: false, error: 'Confirm that the selected attendees provided their signed paper waivers before verifying this onboarding shift.' }
  }

  // Identity is a separate staff attestation, never an uploaded ID document.
  // An organization-local confirmation from an earlier session can satisfy a
  // later session, while the claim snapshot above preserves why it was needed.
  const identityRequiredUserIds = selectedClaims
    .filter((claim) => claim.identityMatchRequired === 1)
    .map((claim) => claim.userId)
  const existingIdentityMatches = identityRequiredUserIds.length
    ? await db
        .select({ userId: volunteerIdentityVerifications.userId })
        .from(volunteerIdentityVerifications)
        .where(and(
          eq(volunteerIdentityVerifications.orgId, input.orgId),
          inArray(volunteerIdentityVerifications.userId, identityRequiredUserIds),
          eq(volunteerIdentityVerifications.status, 'verified'),
        ))
    : []
  const verifiedIdentityUserIds = new Set(existingIdentityMatches.map((row) => row.userId))
  const missingIdentityUserIds = identityRequiredUserIds.filter((userId) => !verifiedIdentityUserIds.has(userId))
  if (missingIdentityUserIds.length > 0 && !input.identityMatchesConfirmed) {
    return { ok: false, error: 'Confirm that the selected attendees match their City/Sync accounts before verifying this onboarding shift.' }
  }

  if (missingIdentityUserIds.length > 0) {
    await db.transaction(async (tx) => {
      for (const userId of missingIdentityUserIds) {
        await tx
          .insert(volunteerIdentityVerifications)
          .values({
            id: randomUUID(),
            orgId: input.orgId,
            userId,
            status: 'verified',
            verifiedByUserId: input.actorId,
            verifiedAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [volunteerIdentityVerifications.orgId, volunteerIdentityVerifications.userId],
            set: {
              status: 'verified',
              verifiedByUserId: input.actorId,
              verifiedAt: now,
              revokedByUserId: null,
              revokedAt: null,
              updatedAt: now,
            },
          })
        await appendEvent(
          tx,
          EventTypes.IDENTITY_MATCH_ATTESTED,
          {
            orgId: input.orgId,
            taskId: shiftRow.task.id,
            shiftId: shiftRow.shift.id,
            participantId: userId,
          },
          input.actorId,
          shiftRow.task.cityId,
        )
      }
    })
  }

  const batchId = selectedClaims.length ? randomUUID() : null
  const note = input.note?.trim().slice(0, 2_000) ?? ''
  if (batchId) {
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
  }

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
      batchId ?? undefined,
      Boolean(input.identityMatchesConfirmed),
    )
    if (!verified.ok) return verified
  }

  const noShows = await markUnverifiedClaimsNoShow({
    shiftId: shiftRow.shift.id,
    orgId: input.orgId,
    actorId: input.actorId,
    now,
  })

  await db.transaction(async (tx) => {
    if (thankYouLetter) {
      const recognitionId = randomUUID()
      const messageId = randomUUID()
      await tx.insert(programRecognitions).values({
        id: recognitionId,
        orgId: input.orgId,
        scope: scopeOf(shiftRow.task.programId),
        shiftId: shiftRow.shift.id,
        userId: null,
        kind: 'letter',
        message: thankYouLetter,
        recipientNames: selectedParticipants.map((participant) => participant.name).join(', '),
        actorId: input.actorId,
        createdAt: now,
      })
      await tx.insert(orgMessages).values({
        id: messageId,
        orgId: input.orgId,
        senderUserId: input.actorId,
        scope: 'members',
        taskId: shiftRow.task.id,
        groupId: null,
        subject: `Thank you — ${shiftRow.task.title}`,
        body: thankYouLetter,
        recipientCount: selectedParticipants.length,
        createdAt: now,
      })
      await tx.insert(messageRecipients).values(selectedParticipants.map((participant) => ({
        id: randomUUID(),
        messageId,
        userId: participant.id,
        readAt: null,
        createdAt: now,
      })))
      await appendEvent(
        tx,
        EventTypes.PROGRAM_RECOGNITION_CREATED,
        {
          orgId: input.orgId,
          programId: scopeOf(shiftRow.task.programId),
          recognitionId,
          shiftId: shiftRow.shift.id,
          taskId: shiftRow.task.id,
          kind: 'letter',
          recipientIds: selectedParticipants.map((participant) => participant.id),
          messageId,
        },
        input.actorId,
        shiftRow.task.cityId,
      )
    }
    await tx
      .update(shifts)
      .set({ status: 'closed' })
      .where(and(eq(shifts.id, shiftRow.shift.id), eq(shifts.status, 'open')))
    await appendEvent(
      tx,
      EventTypes.SHIFT_ATTENDANCE_FINALIZED,
      {
        batchId,
        taskId: shiftRow.task.id,
        shiftId: shiftRow.shift.id,
        orgId: input.orgId,
        verifiedCount: selectedClaims.length,
        noShowCount: noShows.marked,
        finalizedAt: now,
      },
      input.actorId,
      shiftRow.task.cityId,
    )
  })
  await cancelRemindersForShift(shiftRow.shift.id)
  return { ok: true, batchId, verifiedCount: selectedClaims.length, noShowCount: noShows.marked, thankYouLetterSent: Boolean(thankYouLetter) }
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
