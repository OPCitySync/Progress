import { randomUUID } from 'crypto'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  claims,
  organizationDelegations,
  plannedRecurringAssignments,
  plannedRecurringStaffAssignments,
  recurringEventSchedules,
  shifts,
  shiftStaffAssignments,
  tasks,
  volunteerRosterMembers,
} from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import { notifyShiftAssigned } from '@/lib/services/notifications'
import type { Result } from '@/lib/services/identity'

const MINUTE_MS = 60_000
const DEFAULT_DURATION_MINUTES = 120

function shiftCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let index = 0; index < 6; index += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

function advanceDays(startsAt: number, days: number) {
  const date = new Date(startsAt)
  // Preserve the selected local clock time across daylight-saving changes.
  date.setDate(date.getDate() + days)
  return date.getTime()
}

function twoMonthsFromNow() {
  const date = new Date()
  date.setMonth(date.getMonth() + 2)
  return date.getTime()
}

function isPlannableOccurrence(schedule: typeof recurringEventSchedules.$inferSelect, startsAt: number, now = Date.now()) {
  if (startsAt <= now || startsAt >= twoMonthsFromNow()) return false
  let candidate = schedule.nextStartsAt
  while (candidate < startsAt) candidate = advanceDays(candidate, schedule.intervalDays)
  return candidate === startsAt
}

function recurringLabel(startsAt: number) {
  return `Weekly ${new Date(startsAt).toLocaleDateString('en-US', { weekday: 'long' })} event`
}

function durationFor(shiftsForTemplate: Array<typeof shifts.$inferSelect>) {
  const dated = shiftsForTemplate.find((shift) => (
    shift.startsAt !== null
    && shift.endsAt !== null
    && shift.endsAt > shift.startsAt
  ))
  const startsAt = dated?.startsAt
  const endsAt = dated?.endsAt
  return startsAt !== null && startsAt !== undefined && endsAt !== null && endsAt !== undefined
    ? Math.min(8 * 60, Math.max(30, Math.round((endsAt - startsAt) / MINUTE_MS)))
    : DEFAULT_DURATION_MINUTES
}

/**
 * Save a volunteer against a projected recurring occurrence. This deliberately
 * does not create a claim or send a notification: both happen only when the
 * scheduled occurrence becomes a real published shift.
 */
export async function planVolunteerForRecurringShift(input: {
  taskId: string
  orgId: string
  actorId: string
  occurrenceStartsAt: number
  userId: string
  allowOverCapacity?: boolean
}): Promise<Result<{ assigned: boolean }>> {
  const [task, schedules, publishedShift, staffAccess] = await Promise.all([
    db.select().from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.orgId, input.orgId))).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(recurringEventSchedules).where(and(eq(recurringEventSchedules.taskId, input.taskId), eq(recurringEventSchedules.orgId, input.orgId), eq(recurringEventSchedules.active, 1))),
    db.select().from(shifts).where(and(eq(shifts.taskId, input.taskId), eq(shifts.startsAt, input.occurrenceStartsAt))).limit(1).then((rows) => rows[0] ?? null),
    db.select({ id: organizationDelegations.id }).from(organizationDelegations).where(and(
      eq(organizationDelegations.orgId, input.orgId),
      eq(organizationDelegations.userId, input.userId),
      eq(organizationDelegations.status, 'active'),
    )).limit(1).then((rows) => rows[0] ?? null),
  ])
  if (!task || task.status !== 'open' || task.isOnboarding === 1) return { ok: false, error: 'This recurring volunteer shift is not available for planning.' }
  const schedule = schedules.find((candidate) => isPlannableOccurrence(candidate, input.occurrenceStartsAt))
  if (!schedule || !isPlannableOccurrence(schedule, input.occurrenceStartsAt)) return { ok: false, error: 'Choose a future occurrence from this recurring shift plan.' }
  if (publishedShift) return { ok: false, error: 'This occurrence is already published. Add the volunteer directly to the shift instead.' }
  if (staffAccess) return { ok: false, error: 'Staff members cannot be planned as volunteers within the same organization.' }
  const {programAccessError,scopeOf}=await import('./program-workspace')
  const accessError=await programAccessError(input.orgId,scopeOf(task.programId),input.userId)
  if(accessError)return {ok:false,error:accessError}

  const [rosterMember, priorParticipation] = await Promise.all([
    db.select({ userId: volunteerRosterMembers.userId }).from(volunteerRosterMembers).where(and(eq(volunteerRosterMembers.orgId, input.orgId), eq(volunteerRosterMembers.userId, input.userId))).limit(1),
    db.select({ userId: claims.userId }).from(claims).innerJoin(tasks, eq(claims.taskId, tasks.id)).where(and(eq(tasks.orgId, input.orgId), eq(claims.userId, input.userId), inArray(claims.status, ['claimed', 'submitted', 'verified']))).limit(1),
  ])
  if (!rosterMember[0] && !priorParticipation[0]) return { ok: false, error: 'Only people already in your organization roster can be planned.' }

  const existing = await db.select().from(plannedRecurringAssignments).where(and(
    eq(plannedRecurringAssignments.taskId, input.taskId),
    eq(plannedRecurringAssignments.occurrenceStartsAt, input.occurrenceStartsAt),
    eq(plannedRecurringAssignments.userId, input.userId),
  )).limit(1).then((rows) => rows[0] ?? null)
  if (existing?.status === 'planned') return { ok: true, assigned: false }

  const plannedCount = await db.select({ id: plannedRecurringAssignments.id }).from(plannedRecurringAssignments).where(and(
    eq(plannedRecurringAssignments.taskId, input.taskId),
    eq(plannedRecurringAssignments.occurrenceStartsAt, input.occurrenceStartsAt),
    eq(plannedRecurringAssignments.status, 'planned'),
  ))
  if (!input.allowOverCapacity && plannedCount.length >= schedule.capacity) return { ok: false, error: `Only ${Math.max(0, schedule.capacity - plannedCount.length)} spot${schedule.capacity - plannedCount.length === 1 ? '' : 's'} remain in this planned occurrence.` }

  const now = Date.now()
  await db.insert(plannedRecurringAssignments).values({
    id: existing?.id ?? randomUUID(),
    taskId: input.taskId,
    orgId: input.orgId,
    occurrenceStartsAt: input.occurrenceStartsAt,
    userId: input.userId,
    assignedByUserId: input.actorId,
    status: 'planned',
    shiftId: null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [plannedRecurringAssignments.taskId, plannedRecurringAssignments.occurrenceStartsAt, plannedRecurringAssignments.userId],
    set: { assignedByUserId: input.actorId, status: 'planned', shiftId: null, updatedAt: now },
  })
  return { ok: true, assigned: true }
}

/** Remove an unpublished roster plan without notifying a participant. */
export async function removeVolunteerFromRecurringShiftPlan(input: {
  taskId: string
  orgId: string
  occurrenceStartsAt: number
  userId: string
}): Promise<Result> {
  const assignment = await db.select().from(plannedRecurringAssignments).where(and(
    eq(plannedRecurringAssignments.taskId, input.taskId),
    eq(plannedRecurringAssignments.orgId, input.orgId),
    eq(plannedRecurringAssignments.occurrenceStartsAt, input.occurrenceStartsAt),
    eq(plannedRecurringAssignments.userId, input.userId),
    eq(plannedRecurringAssignments.status, 'planned'),
  )).limit(1).then((rows) => rows[0] ?? null)
  if (!assignment) return { ok: false, error: 'That planned assignment is no longer available.' }
  await db.update(plannedRecurringAssignments).set({ status: 'removed', updatedAt: Date.now() }).where(eq(plannedRecurringAssignments.id, assignment.id))
  return { ok: true }
}

/** Save staff support for an unpublished recurring occurrence. */
export async function planStaffForRecurringShift(input: {
  taskId: string
  orgId: string
  actorId: string
  occurrenceStartsAt: number
  userId: string
}): Promise<Result<{ assigned: boolean }>> {
  const [task, schedules, publishedShift, delegation] = await Promise.all([
    db.select().from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.orgId, input.orgId))).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(recurringEventSchedules).where(and(eq(recurringEventSchedules.taskId, input.taskId), eq(recurringEventSchedules.orgId, input.orgId), eq(recurringEventSchedules.active, 1))),
    db.select().from(shifts).where(and(eq(shifts.taskId, input.taskId), eq(shifts.startsAt, input.occurrenceStartsAt))).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(organizationDelegations).where(and(
      eq(organizationDelegations.orgId, input.orgId),
      eq(organizationDelegations.userId, input.userId),
      eq(organizationDelegations.status, 'active'),
    )).limit(1).then((rows) => rows[0] ?? null),
  ])
  if (!task || task.status !== 'open' || task.isOnboarding === 1) return { ok: false, error: 'This recurring shift is not available for planning.' }
  const schedule = schedules.find((candidate) => isPlannableOccurrence(candidate, input.occurrenceStartsAt))
  if (!schedule || !isPlannableOccurrence(schedule, input.occurrenceStartsAt)) return { ok: false, error: 'Choose a future occurrence from this recurring shift plan.' }
  if (publishedShift) return { ok: false, error: 'This occurrence is already published. Add staff directly to the shift instead.' }
  if (!delegation) return { ok: false, error: 'That person does not have active organization access.' }

  const existing = await db.select().from(plannedRecurringStaffAssignments).where(and(
    eq(plannedRecurringStaffAssignments.taskId, input.taskId),
    eq(plannedRecurringStaffAssignments.orgId, input.orgId),
    eq(plannedRecurringStaffAssignments.occurrenceStartsAt, input.occurrenceStartsAt),
    eq(plannedRecurringStaffAssignments.userId, input.userId),
  )).limit(1).then((rows) => rows[0] ?? null)
  if (existing?.status === 'planned' && existing.delegationId === delegation.id) return { ok: true, assigned: false }

  const now = Date.now()
  await db.insert(plannedRecurringStaffAssignments).values({
    id: existing?.id ?? randomUUID(),
    taskId: input.taskId,
    orgId: input.orgId,
    occurrenceStartsAt: input.occurrenceStartsAt,
    userId: input.userId,
    delegationId: delegation.id,
    assignedByUserId: input.actorId,
    status: 'planned',
    shiftId: null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [plannedRecurringStaffAssignments.taskId, plannedRecurringStaffAssignments.occurrenceStartsAt, plannedRecurringStaffAssignments.userId],
    set: { delegationId: delegation.id, assignedByUserId: input.actorId, status: 'planned', shiftId: null, updatedAt: now },
  })
  return { ok: true, assigned: true }
}

/** Remove staff support from an unpublished recurring occurrence. */
export async function removeStaffFromRecurringShiftPlan(input: {
  taskId: string
  orgId: string
  occurrenceStartsAt: number
  userId: string
}): Promise<Result> {
  const assignment = await db.select().from(plannedRecurringStaffAssignments).where(and(
    eq(plannedRecurringStaffAssignments.taskId, input.taskId),
    eq(plannedRecurringStaffAssignments.orgId, input.orgId),
    eq(plannedRecurringStaffAssignments.occurrenceStartsAt, input.occurrenceStartsAt),
    eq(plannedRecurringStaffAssignments.userId, input.userId),
    eq(plannedRecurringStaffAssignments.status, 'planned'),
  )).limit(1).then((rows) => rows[0] ?? null)
  if (!assignment) return { ok: false, error: 'That planned staff assignment is no longer available.' }
  await db.update(plannedRecurringStaffAssignments).set({ status: 'removed', updatedAt: Date.now() }).where(eq(plannedRecurringStaffAssignments.id, assignment.id))
  return { ok: true }
}

/**
 * Publish a dated occurrence of a reusable opportunity. Each weekly pattern
 * releases one occurrence at a time, then publishes its next date after the
 * current occurrence has ended.
 */
export async function publishTemplateEvent(input: {
  taskId: string
  orgId: string
  cityId: string
  actorId: string
  startsAt: number | null
  recurring: boolean
  visibility?: 'public' | 'private'
  capacity?: number
  durationMinutes?: number
}): Promise<Result<{ mode: 'published' | 'scheduled'; taskId: string; shiftId: string | null; visibility: 'public' | 'private' }>> {
  const startsAt = input.startsAt
  if (!startsAt || startsAt < Date.now() - 5 * MINUTE_MS) {
    return { ok: false, error: 'Choose an event date and time in the future.' }
  }
  const [task, priorSessions] = await Promise.all([
    db.select().from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.orgId, input.orgId))).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(shifts).where(eq(shifts.taskId, input.taskId)).orderBy(desc(shifts.createdAt)),
  ])
  if (!task) return { ok: false, error: 'That opportunity is not available to your organization.' }
  if (task.cityId !== input.cityId) return { ok: false, error: 'Switch to the city where this opportunity belongs before publishing it.' }
  if (task.status !== 'open') return { ok: false, error: 'Reopen this opportunity before publishing an event.' }
  if (task.isOnboarding === 1) return { ok: false, error: 'Publish onboarding dates from the Onboarding section.' }

  const visibility = input.visibility === 'private' ? 'private' : 'public'
  const enrollmentMode = visibility === 'private' ? 'organization_managed' : 'open_claims'

  const capacity = Number.isInteger(input.capacity) && (input.capacity ?? 0) > 0 && (input.capacity ?? 0) <= 10_000
    ? input.capacity as number
    : task.slots
  const requestedDuration = input.durationMinutes
  if (requestedDuration !== undefined && (!Number.isInteger(requestedDuration) || requestedDuration < 15 || requestedDuration > 24 * 60)) {
    return { ok: false, error: 'Shift duration must be between 15 minutes and 24 hours.' }
  }

  const now = Date.now()
  const durationMinutes = requestedDuration ?? task.defaultDurationMinutes ?? durationFor(priorSessions)
  if (!input.recurring) {
    const shiftId = randomUUID()
    await db.transaction(async (tx) => {
      await tx.insert(shifts).values({
        id: shiftId,
        taskId: task.id,
        orgId: input.orgId,
        startsAt,
        endsAt: startsAt + durationMinutes * MINUTE_MS,
        label: '',
        capacity,
        status: 'open',
        visibility,
        enrollmentMode,
        checkInCode: shiftCode(),
        createdAt: now,
      })
      await appendEvent(tx, EventTypes.TEMPLATE_EVENT_PUBLISHED, {
        taskId: task.id,
        orgId: input.orgId,
        cityId: task.cityId,
        shiftId,
        startsAt,
        durationMinutes,
        capacity,
        recurring: false,
        visibility,
        enrollmentMode,
      }, input.actorId)
    })
    return { ok: true, mode: 'published', taskId: task.id, shiftId, visibility }
  }

  const publishedShiftId = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(shifts).values({
      id: publishedShiftId,
      taskId: task.id,
      orgId: input.orgId,
      startsAt,
      endsAt: startsAt + durationMinutes * MINUTE_MS,
      label: recurringLabel(startsAt),
      capacity,
      status: 'open',
      visibility,
      enrollmentMode,
      checkInCode: shiftCode(),
      createdAt: now,
    })
    await tx
      .insert(recurringEventSchedules)
      .values({
        id: randomUUID(),
        taskId: task.id,
        orgId: input.orgId,
        intervalDays: 7,
        nextStartsAt: advanceDays(startsAt, 7),
        durationMinutes,
        capacity,
        visibility,
        enrollmentMode,
        lastPublishedShiftId: publishedShiftId,
        active: 1,
        createdAt: now,
        updatedAt: now,
      })
    await appendEvent(tx, EventTypes.TEMPLATE_EVENT_PUBLISHED, {
      taskId: task.id,
      orgId: input.orgId,
      cityId: task.cityId,
      shiftId: publishedShiftId,
      startsAt,
      durationMinutes,
        capacity,
        recurring: true,
        visibility,
        enrollmentMode,
    }, input.actorId)
    await appendEvent(tx, EventTypes.TEMPLATE_EVENT_RECURRENCE_SET, {
      taskId: task.id,
      orgId: input.orgId,
      cityId: task.cityId,
      nextStartsAt: advanceDays(startsAt, 7),
      waitsForShiftId: publishedShiftId,
    }, input.actorId)
  })

  return { ok: true, mode: 'published', taskId: task.id, shiftId: publishedShiftId, visibility }
}

/** Release the next event only after the prior recurring event has finished. */
export async function publishDueRecurringTemplateEvents(now = Date.now()) {
  const schedules = await db.select().from(recurringEventSchedules).where(eq(recurringEventSchedules.active, 1))
  let published = 0

  for (const schedule of schedules) {
    const [task, lastShift] = await Promise.all([
      db.select().from(tasks).where(and(eq(tasks.id, schedule.taskId), eq(tasks.orgId, schedule.orgId), eq(tasks.status, 'open'))).limit(1).then((rows) => rows[0] ?? null),
      schedule.lastPublishedShiftId ? db.select().from(shifts).where(eq(shifts.id, schedule.lastPublishedShiftId)).limit(1).then((rows) => rows[0] ?? null) : Promise.resolve(null),
    ])
    if (!task || !lastShift?.endsAt || lastShift.endsAt > now) continue

    let startsAt = schedule.nextStartsAt
    while (startsAt <= now + 5 * MINUTE_MS) startsAt = advanceDays(startsAt, schedule.intervalDays)
    const shiftId = randomUUID()
    let plannedVolunteerIds: string[] = []
    await db.transaction(async (tx) => {
      await tx.insert(shifts).values({
        id: shiftId,
        taskId: task.id,
        orgId: schedule.orgId,
        startsAt,
        endsAt: startsAt + schedule.durationMinutes * MINUTE_MS,
        label: recurringLabel(startsAt),
        capacity: schedule.capacity,
        status: 'open',
        visibility: schedule.visibility,
        enrollmentMode: schedule.enrollmentMode,
        checkInCode: shiftCode(),
        createdAt: now,
      })
      const plannedAssignments = await tx
        .select()
        .from(plannedRecurringAssignments)
        .where(and(
          eq(plannedRecurringAssignments.taskId, task.id),
          eq(plannedRecurringAssignments.orgId, schedule.orgId),
          eq(plannedRecurringAssignments.occurrenceStartsAt, startsAt),
          eq(plannedRecurringAssignments.status, 'planned'),
        ))
      const plannedUserIds = plannedAssignments.map((assignment) => assignment.userId)
      const activeStaff = plannedUserIds.length
        ? await tx
            .select({ userId: organizationDelegations.userId })
            .from(organizationDelegations)
            .where(and(
              eq(organizationDelegations.orgId, schedule.orgId),
              inArray(organizationDelegations.userId, plannedUserIds),
              eq(organizationDelegations.status, 'active'),
            ))
        : []
      const staffUserIds = new Set(activeStaff.map(({ userId }) => userId))
      const supersededPlanUserIds = plannedUserIds.filter((userId) => staffUserIds.has(userId))
      if (supersededPlanUserIds.length) {
        await tx
          .update(plannedRecurringAssignments)
          .set({ status: 'removed', updatedAt: now })
          .where(and(
            eq(plannedRecurringAssignments.taskId, task.id),
            eq(plannedRecurringAssignments.orgId, schedule.orgId),
            eq(plannedRecurringAssignments.occurrenceStartsAt, startsAt),
            eq(plannedRecurringAssignments.status, 'planned'),
            inArray(plannedRecurringAssignments.userId, supersededPlanUserIds),
          ))
      }
      // An issuer can deliberately plan above the template capacity after a
      // confirmation. Preserve every such planned assignment as the shift is
      // materialized rather than silently dropping people from the roster.
      // Active staff are the exception: their organization authority always
      // takes precedence over a volunteer plan for this same organization.
      plannedVolunteerIds = plannedUserIds.filter((userId) => !staffUserIds.has(userId))
      for (const userId of plannedVolunteerIds) {
        await tx.insert(claims).values({
          id: randomUUID(),
          taskId: task.id,
          shiftId,
          userId,
          status: 'claimed',
          createdAt: now,
          updatedAt: now,
        })
        await appendEvent(tx, EventTypes.TASK_CLAIMED, {
          taskId: task.id,
          shiftId,
          cityId: task.cityId,
          assignedByOrganization: true,
          plannedInAdvance: true,
        }, 'system')
      }
      if (plannedVolunteerIds.length) {
        await tx
          .update(plannedRecurringAssignments)
          .set({ status: 'applied', shiftId, updatedAt: now })
          .where(and(
            eq(plannedRecurringAssignments.taskId, task.id),
            eq(plannedRecurringAssignments.orgId, schedule.orgId),
            eq(plannedRecurringAssignments.occurrenceStartsAt, startsAt),
            eq(plannedRecurringAssignments.status, 'planned'),
            inArray(plannedRecurringAssignments.userId, plannedVolunteerIds),
          ))
      }
      const plannedStaffAssignments = await tx
        .select({ assignment: plannedRecurringStaffAssignments })
        .from(plannedRecurringStaffAssignments)
        .innerJoin(organizationDelegations, and(
          eq(organizationDelegations.id, plannedRecurringStaffAssignments.delegationId),
          eq(organizationDelegations.orgId, plannedRecurringStaffAssignments.orgId),
          eq(organizationDelegations.userId, plannedRecurringStaffAssignments.userId),
          eq(organizationDelegations.status, 'active'),
        ))
        .where(and(
          eq(plannedRecurringStaffAssignments.taskId, task.id),
          eq(plannedRecurringStaffAssignments.orgId, schedule.orgId),
          eq(plannedRecurringStaffAssignments.occurrenceStartsAt, startsAt),
          eq(plannedRecurringStaffAssignments.status, 'planned'),
        ))
      const plannedStaffUserIds = plannedStaffAssignments.map(({ assignment }) => assignment.userId)
      for (const { assignment } of plannedStaffAssignments) {
        await tx.insert(shiftStaffAssignments).values({
          id: randomUUID(),
          shiftId,
          orgId: schedule.orgId,
          userId: assignment.userId,
          delegationId: assignment.delegationId,
          assignedByUserId: assignment.assignedByUserId,
          createdAt: now,
          updatedAt: now,
        })
      }
      if (plannedStaffUserIds.length) {
        await tx
          .update(plannedRecurringStaffAssignments)
          .set({ status: 'applied', shiftId, updatedAt: now })
          .where(and(
            eq(plannedRecurringStaffAssignments.taskId, task.id),
            eq(plannedRecurringStaffAssignments.orgId, schedule.orgId),
            eq(plannedRecurringStaffAssignments.occurrenceStartsAt, startsAt),
            eq(plannedRecurringStaffAssignments.status, 'planned'),
            inArray(plannedRecurringStaffAssignments.userId, plannedStaffUserIds),
          ))
      }
      // A planned staff member may lose organization access before this future
      // occurrence publishes. Retire any such plan instead of granting support
      // access to the materialized shift from a stale delegation.
      await tx
        .update(plannedRecurringStaffAssignments)
        .set({ status: 'removed', updatedAt: now })
        .where(and(
          eq(plannedRecurringStaffAssignments.taskId, task.id),
          eq(plannedRecurringStaffAssignments.orgId, schedule.orgId),
          eq(plannedRecurringStaffAssignments.occurrenceStartsAt, startsAt),
          eq(plannedRecurringStaffAssignments.status, 'planned'),
        ))
      await tx
        .update(recurringEventSchedules)
        .set({ lastPublishedShiftId: shiftId, nextStartsAt: advanceDays(startsAt, schedule.intervalDays), updatedAt: now })
        .where(eq(recurringEventSchedules.id, schedule.id))
      await appendEvent(tx, EventTypes.TEMPLATE_EVENT_PUBLISHED, {
        taskId: task.id,
        orgId: schedule.orgId,
        cityId: task.cityId,
        shiftId,
        startsAt,
        durationMinutes: schedule.durationMinutes,
        capacity: schedule.capacity,
        recurring: true,
        automated: true,
      }, 'system')
    })
    await Promise.all(plannedVolunteerIds.map((userId) => notifyShiftAssigned(userId, shiftId)))
    published += 1
  }

  return { published }
}
