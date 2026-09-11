import { randomUUID } from 'crypto'
import { and, asc, eq, gt, gte, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { claims, onboardingRecurringSchedules, orgProfiles, orgs, shifts, tasks } from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import type { Result } from '@/lib/services/identity'
import { normalizeOrganizationLocation, rememberOrganizationLocation } from './organization-locations'
import { cancelRemindersForShift, notifyOnboardingSessionCancelled } from './notifications'
import { programBelongsToOrganization } from './volunteer-programs'
import type { OnboardingIdentityCheck, OnboardingWaiverMethod } from './waivers'

const MINUTE_MS = 60_000

function shiftCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let index = 0; index < 6; index += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

function weeklyStart(firstStart: number, weekOffset: number) {
  const occurrence = new Date(firstStart)
  // Date#setDate preserves the selected local clock time across daylight-saving changes.
  occurrence.setDate(occurrence.getDate() + weekOffset * 7)
  return occurrence.getTime()
}

/**
 * Creates the public onboarding opportunity and its first public session. The
 * selected task becomes the organization’s onboarding
 * entry point, so completing it joins participants to the organization. A
 * former onboarding designation remains a normal opportunity when replaced.
 */
export async function createRecurringOnboardingSession(input: {
  orgId: string
  cityId: string
  actorId: string
  title: string
  description: string
  location: string
  beforeSession?: string
  bringItems?: string
  credits: number
  firstStartsAt: number | null
  durationMinutes: number
  weeklyCapacity: number
  programId?: string | null
  onboardingWaiverMethod?: OnboardingWaiverMethod | null
  onboardingIdentityCheck?: OnboardingIdentityCheck | null
}): Promise<Result<{ taskId: string }>> {
  const title = input.title.trim()
  const description = input.description.trim()
  const location = normalizeOrganizationLocation(input.location)
  const beforeSession = input.beforeSession?.trim() ?? ''
  const bringItems = input.bringItems?.trim() ?? ''

  if (!title || title.length > 120) return { ok: false, error: 'Enter an onboarding session name of up to 120 characters.' }
  if (location.length > 240) return { ok: false, error: 'Locations are limited to 240 characters.' }
  if (beforeSession.length > 3_000 || bringItems.length > 1_000) {
    return { ok: false, error: 'Keep preparation guidance under 3,000 characters and the bring-items list under 1,000 characters.' }
  }
  if (!input.firstStartsAt || input.firstStartsAt < Date.now() - 5 * MINUTE_MS) {
    return { ok: false, error: 'Choose a first onboarding session that is now or in the future.' }
  }
  if (!Number.isInteger(input.weeklyCapacity) || input.weeklyCapacity < 1 || input.weeklyCapacity > 500) {
    return { ok: false, error: 'Weekly capacity must be a whole number between 1 and 500.' }
  }
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 30 || input.durationMinutes > 8 * 60) {
    return { ok: false, error: 'Session length must be between 30 minutes and 8 hours.' }
  }
  if (!Number.isInteger(input.credits) || input.credits < 1 || input.credits > 100_000) {
    return { ok: false, error: 'Credits must be a whole number between 1 and 100,000.' }
  }
  if (!(await programBelongsToOrganization(input.orgId, input.programId))) {
    return { ok: false, error: 'Choose a volunteer program belonging to your organization.' }
  }

  const org = (await db.select({ status: orgs.status }).from(orgs).where(eq(orgs.id, input.orgId)).limit(1))[0]
  if (!org || org.status !== 'approved') return { ok: false, error: 'Your organization must be approved before creating an onboarding session.' }

  const profile = (await db.select({ onboardingTaskId: orgProfiles.onboardingTaskId }).from(orgProfiles).where(eq(orgProfiles.orgId, input.orgId)).limit(1))[0]

  const taskId = randomUUID()
  const now = Date.now()
  const firstDate = new Date(input.firstStartsAt)
  const weeklyLabel = `Weekly ${firstDate.toLocaleDateString('en-US', { weekday: 'long' })} onboarding`
  const firstShift = {
    id: randomUUID(),
    taskId,
    orgId: input.orgId,
    startsAt: input.firstStartsAt,
    endsAt: input.firstStartsAt + input.durationMinutes * MINUTE_MS,
    label: weeklyLabel,
    capacity: input.weeklyCapacity,
    status: 'open' as const,
    checkInCode: shiftCode(),
    createdAt: now,
  }

  await db.transaction(async (tx) => {
    await tx.insert(tasks).values({
      id: taskId,
      orgId: input.orgId,
      cityId: input.cityId,
      title,
      description,
      location,
      beforeSession,
      bringItems,
      credits: input.credits,
      slots: input.weeklyCapacity,
      startsAt: weeklyLabel,
      status: 'open',
      programId: input.programId || null,
      isOnboarding: 1,
      onboardingWaiverMethod: input.onboardingWaiverMethod ?? null,
      onboardingIdentityCheck: input.onboardingIdentityCheck ?? null,
      requiredCredentials: '[]',
      catalogEntryId: null,
      createdBy: input.actorId,
      createdAt: now,
    })
    await tx.insert(shifts).values(firstShift)
    await rememberOrganizationLocation(tx, { orgId: input.orgId, address: location })

    if (profile?.onboardingTaskId) {
      // The original series remains the compatibility/default pointer. Every
      // series is recognized by tasks.isOnboarding from here forward.
    } else if (profile) {
      await tx
        .update(orgProfiles)
        .set({ onboardingTaskId: taskId, updatedAt: now })
        .where(eq(orgProfiles.orgId, input.orgId))
    } else {
      await tx.insert(orgProfiles).values({ orgId: input.orgId, onboardingTaskId: taskId, updatedAt: now })
    }

    await appendEvent(
      tx,
      EventTypes.ONBOARDING_SESSION_CREATED,
      {
        taskId,
        orgId: input.orgId,
        cityId: input.cityId,
        firstStartsAt: input.firstStartsAt,
        weeklyCapacity: input.weeklyCapacity,
        durationMinutes: input.durationMinutes,
        occurrencesCreated: 1,
      },
      input.actorId,
    )
  })

  return { ok: true, taskId }
}

/**
 * Edit the current recurring onboarding program without disturbing its past
 * records. Changing the timetable is allowed only while future sessions have
 * no reservations; otherwise the organization can still safely edit the
 * description, location, credits, and capacity.
 */
export async function updateRecurringOnboardingSession(input: {
  taskId: string
  orgId: string
  actorId: string
  title: string
  description: string
  location: string
  beforeSession?: string
  bringItems?: string
  credits: number
  nextStartsAt: number | null
  durationMinutes: number
  weeklyCapacity: number
  programId?: string | null
  onboardingWaiverMethod?: OnboardingWaiverMethod | null
  onboardingIdentityCheck?: OnboardingIdentityCheck | null
}): Promise<Result> {
  const title = input.title.trim()
  const description = input.description.trim()
  const location = normalizeOrganizationLocation(input.location)
  const beforeSession = input.beforeSession?.trim() ?? ''
  const bringItems = input.bringItems?.trim() ?? ''
  if (!title || title.length > 120) return { ok: false, error: 'Enter an onboarding session name of up to 120 characters.' }
  if (location.length > 240) return { ok: false, error: 'Locations are limited to 240 characters.' }
  if (beforeSession.length > 3_000 || bringItems.length > 1_000) {
    return { ok: false, error: 'Keep preparation guidance under 3,000 characters and the bring-items list under 1,000 characters.' }
  }
  if (input.nextStartsAt && input.nextStartsAt < Date.now() - 5 * MINUTE_MS) {
    return { ok: false, error: 'Choose a next onboarding session that is now or in the future.' }
  }
  if (!Number.isInteger(input.weeklyCapacity) || input.weeklyCapacity < 1 || input.weeklyCapacity > 500) {
    return { ok: false, error: 'Weekly capacity must be a whole number between 1 and 500.' }
  }
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 30 || input.durationMinutes > 8 * 60) {
    return { ok: false, error: 'Session length must be between 30 minutes and 8 hours.' }
  }
  if (!Number.isInteger(input.credits) || input.credits < 1 || input.credits > 100_000) {
    return { ok: false, error: 'Credits must be a whole number between 1 and 100,000.' }
  }

  const task = await db.select().from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.orgId, input.orgId))).limit(1).then((rows) => rows[0] ?? null)
  if (!task || task.isOnboarding !== 1) return { ok: false, error: 'That onboarding session is not available to your organization.' }
  const programId = input.programId === undefined ? task.programId : input.programId
  if (!(await programBelongsToOrganization(input.orgId, programId))) {
    return { ok: false, error: 'Choose a volunteer program belonging to your organization.' }
  }

  const now = Date.now()
  const futureShifts = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.taskId, input.taskId), gte(shifts.startsAt, now)))
    .orderBy(asc(shifts.startsAt), asc(shifts.createdAt))
  const shiftIds = futureShifts.map((shift) => shift.id)
  const reservationCounts = shiftIds.length
    ? await db
        .select({ shiftId: claims.shiftId, count: sql<number>`count(*)` })
        .from(claims)
        .where(and(inArray(claims.shiftId, shiftIds), inArray(claims.status, ['claimed', 'submitted', 'verified'])))
        .groupBy(claims.shiftId)
    : []
  const reservationsByShift = new Map(reservationCounts.map((row) => [row.shiftId, Number(row.count)]))
  const maxReservations = Math.max(0, ...reservationCounts.map((row) => Number(row.count)))
  if (input.weeklyCapacity < maxReservations) {
    return { ok: false, error: `Weekly capacity cannot be lower than the ${maxReservations} existing reservation${maxReservations === 1 ? '' : 's'} in an upcoming session.` }
  }

  const currentNext = futureShifts[0]
  const currentDuration = currentNext?.startsAt && currentNext.endsAt ? Math.round((currentNext.endsAt - currentNext.startsAt) / MINUTE_MS) : input.durationMinutes
  // The Workspace editor deliberately does not control the next session's
  // date. That is handled by Publish session, so allow session details to be
  // saved even when there is no future occurrence.
  const scheduleChanged = Boolean(
    currentNext
      && input.nextStartsAt
      && (currentNext.startsAt !== input.nextStartsAt || currentDuration !== input.durationMinutes),
  )
  const reservedUpcoming = futureShifts.some((shift) => (reservationsByShift.get(shift.id) ?? 0) > 0)
  if (scheduleChanged && reservedUpcoming) {
    return { ok: false, error: 'Keep the current timetable while upcoming sessions have reservations. You can still edit the other session details.' }
  }

  const firstDate = new Date(input.nextStartsAt ?? currentNext?.startsAt ?? now)
  const weeklyLabel = `Weekly ${firstDate.toLocaleDateString('en-US', { weekday: 'long' })} onboarding`
  await db.transaction(async (tx) => {
    await tx
      .update(tasks)
      .set({
        title,
        description,
        location,
        beforeSession,
        bringItems,
        credits: input.credits,
        slots: input.weeklyCapacity,
        programId,
        onboardingWaiverMethod: input.onboardingWaiverMethod ?? null,
        onboardingIdentityCheck: input.onboardingIdentityCheck ?? null,
        startsAt: weeklyLabel,
      })
      .where(eq(tasks.id, input.taskId))

    if (futureShifts.length > 0) {
      for (const [index, shift] of Array.from(futureShifts.entries())) {
        const startsAt = scheduleChanged ? weeklyStart(input.nextStartsAt!, index) : shift.startsAt
        const endsAt = scheduleChanged && startsAt ? startsAt + input.durationMinutes * MINUTE_MS : shift.endsAt
        await tx
          .update(shifts)
          .set({ startsAt, endsAt, label: weeklyLabel, capacity: input.weeklyCapacity })
          .where(eq(shifts.id, shift.id))
      }
    }
    await tx
      .update(onboardingRecurringSchedules)
      .set({ durationMinutes: input.durationMinutes, capacity: input.weeklyCapacity, updatedAt: now })
      .where(eq(onboardingRecurringSchedules.taskId, input.taskId))
    await rememberOrganizationLocation(tx, { orgId: input.orgId, address: location })
    await appendEvent(
      tx,
      EventTypes.ONBOARDING_SESSION_UPDATED,
      {
        taskId: input.taskId,
        orgId: input.orgId,
        cityId: task.cityId,
        nextStartsAt: input.nextStartsAt,
        weeklyCapacity: input.weeklyCapacity,
        durationMinutes: input.durationMinutes,
      },
      input.actorId,
    )
  })
  return { ok: true }
}

function onboardingLabel(startsAt: number) {
  return `Weekly ${new Date(startsAt).toLocaleDateString('en-US', { weekday: 'long' })} onboarding`
}

function advanceDays(startsAt: number, days: number) {
  const date = new Date(startsAt)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

function onboardingDuration(shift: typeof shifts.$inferSelect | undefined) {
  if (shift?.startsAt && shift.endsAt && shift.endsAt > shift.startsAt) {
    return Math.max(30, Math.round((shift.endsAt - shift.startsAt) / MINUTE_MS))
  }
  return 45
}

/**
 * Manually publishes a single onboarding session. With recurrence enabled,
 * only one future session may already be public; the next one is released by
 * the scheduled processor after that session ends.
 */
export async function publishOnboardingSession(input: {
  taskId: string
  orgId: string
  actorId: string
  startsAt: number | null
  recurring: boolean
}): Promise<Result<{ mode: 'published' | 'scheduled' }>> {
  if (!input.startsAt || !Number.isFinite(input.startsAt) || input.startsAt <= Date.now()) {
    return { ok: false, error: 'Choose a session date and time in the future.' }
  }
  const [task, existingSchedule] = await Promise.all([
    db.select().from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.orgId, input.orgId))).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(onboardingRecurringSchedules).where(eq(onboardingRecurringSchedules.taskId, input.taskId)).limit(1).then((rows) => rows[0] ?? null),
  ])
  if (!task || task.isOnboarding !== 1 || task.status !== 'open') {
    return { ok: false, error: 'That onboarding session is not available to your organization.' }
  }

  const now = Date.now()
  const futureSessions = await db
    .select()
    .from(shifts)
    .where(and(
      eq(shifts.taskId, input.taskId),
      eq(shifts.status, 'open'),
      or(gte(shifts.startsAt, now), gt(shifts.endsAt, now)),
    ))
    .orderBy(asc(shifts.startsAt), asc(shifts.createdAt))
  const activeSession = futureSessions[0]
  const intake = await (await import('./volunteer-intake')).getIntake(task.id)
  const durationMinutes = activeSession ? onboardingDuration(activeSession) : existingSchedule?.durationMinutes ?? (intake ? task.defaultDurationMinutes : 45)
  const capacity = activeSession?.capacity ?? existingSchedule?.capacity ?? task.slots

  if (!input.recurring) {
    if (futureSessions.some(shift => shift.startsAt === input.startsAt)) return { ok: false, error: 'This date and time is already published for this session.' }
    const shiftId = randomUUID()
    await db.transaction(async (tx) => {
      await tx.insert(shifts).values({
        id: shiftId,
        taskId: input.taskId,
        orgId: input.orgId,
        startsAt: input.startsAt!,
        endsAt: input.startsAt! + durationMinutes * MINUTE_MS,
        label: onboardingLabel(input.startsAt!),
        capacity,
        status: 'open',
        checkInCode: shiftCode(),
        createdAt: now,
      })
      await appendEvent(tx, EventTypes.ONBOARDING_SESSION_PUBLISHED, {
        taskId: input.taskId,
        orgId: input.orgId,
        cityId: task.cityId,
        shiftId,
        startsAt: input.startsAt,
        recurring: false,
      }, input.actorId)
    })
    return { ok: true, mode: 'published' }
  }

  if (futureSessions.length > 1) {
    return { ok: false, error: 'This onboarding program already has multiple future sessions published. Finish or close those sessions before switching it to one-at-a-time recurring publication.' }
  }
  if (activeSession?.endsAt && input.startsAt <= activeSession.endsAt) {
    return { ok: false, error: 'Choose a recurring session time after the currently published onboarding session ends.' }
  }

  await db.transaction(async (tx) => {
    if (activeSession?.endsAt && activeSession.endsAt > now) {
      await tx
        .insert(onboardingRecurringSchedules)
        .values({
          taskId: input.taskId,
          orgId: input.orgId,
          intervalDays: 7,
          nextStartsAt: input.startsAt!,
          durationMinutes,
          capacity,
          lastPublishedShiftId: activeSession.id,
          active: 1,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: onboardingRecurringSchedules.taskId,
          set: { intervalDays: 7, nextStartsAt: input.startsAt!, durationMinutes, capacity, lastPublishedShiftId: activeSession.id, active: 1, updatedAt: now },
        })
      await appendEvent(tx, EventTypes.ONBOARDING_SESSION_RECURRENCE_SET, {
        taskId: input.taskId,
        orgId: input.orgId,
        cityId: task.cityId,
        nextStartsAt: input.startsAt,
        waitsForShiftId: activeSession.id,
      }, input.actorId)
      return
    }

    const shiftId = randomUUID()
    const firstStartsAt = input.startsAt!
    await tx.insert(shifts).values({
      id: shiftId,
      taskId: input.taskId,
      orgId: input.orgId,
      startsAt: firstStartsAt,
      endsAt: firstStartsAt + durationMinutes * MINUTE_MS,
      label: onboardingLabel(firstStartsAt),
      capacity,
      status: 'open',
      checkInCode: shiftCode(),
      createdAt: now,
    })
    await tx
      .insert(onboardingRecurringSchedules)
      .values({
        taskId: input.taskId,
        orgId: input.orgId,
        intervalDays: 7,
        nextStartsAt: advanceDays(firstStartsAt, 7),
        durationMinutes,
        capacity,
        lastPublishedShiftId: shiftId,
        active: 1,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: onboardingRecurringSchedules.taskId,
        set: { intervalDays: 7, nextStartsAt: advanceDays(firstStartsAt, 7), durationMinutes, capacity, lastPublishedShiftId: shiftId, active: 1, updatedAt: now },
      })
    await appendEvent(tx, EventTypes.ONBOARDING_SESSION_PUBLISHED, {
      taskId: input.taskId,
      orgId: input.orgId,
      cityId: task.cityId,
      shiftId,
      startsAt: firstStartsAt,
      recurring: true,
    }, input.actorId)
    await appendEvent(tx, EventTypes.ONBOARDING_SESSION_RECURRENCE_SET, {
      taskId: input.taskId,
      orgId: input.orgId,
      cityId: task.cityId,
      nextStartsAt: advanceDays(firstStartsAt, 7),
      waitsForShiftId: shiftId,
    }, input.actorId)
  })

  return { ok: true, mode: activeSession?.endsAt && activeSession.endsAt > now ? 'scheduled' : 'published' }
}

/** Cancel a specific future onboarding occurrence without closing the entire
 * onboarding program. Its reservations are released and every participant is
 * told in-app to choose another available date. */
export async function cancelOnboardingSession(input: {
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
  if (!row || row.task.isOnboarding !== 1) {
    return { ok: false, error: 'That onboarding session is not available to your organization.' }
  }
  if (row.shift.status !== 'open') return { ok: false, error: 'That session has already been closed.' }
  if (!row.shift.startsAt || row.shift.startsAt <= now) {
    return { ok: false, error: 'Only a future onboarding session can be cancelled.' }
  }

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
        reason: 'onboarding_session_cancelled',
        releasedParticipantCount: participantIds.length,
      },
      input.actorId,
    )
  })
  await cancelRemindersForShift(input.shiftId)
  await notifyOnboardingSessionCancelled({
    userIds: participantIds,
    taskId: row.task.id,
    organizationName: row.organizationName,
    startsAt: row.shift.startsAt,
  })
  return { ok: true, notified: participantIds.length }
}

/** The reminder cron invokes this to release exactly one new occurrence after
 * the previous recurring onboarding session has ended. */
export async function publishDueRecurringOnboardingSessions(now = Date.now()) {
  const schedules = await db.select().from(onboardingRecurringSchedules).where(eq(onboardingRecurringSchedules.active, 1))
  let published = 0

  for (const schedule of schedules) {
    const [task, lastShift] = await Promise.all([
      db.select().from(tasks).where(and(eq(tasks.id, schedule.taskId), eq(tasks.orgId, schedule.orgId), eq(tasks.status, 'open'))).limit(1).then((rows) => rows[0] ?? null),
      schedule.lastPublishedShiftId ? db.select().from(shifts).where(eq(shifts.id, schedule.lastPublishedShiftId)).limit(1).then((rows) => rows[0] ?? null) : Promise.resolve(null),
    ])
    if (!task || !lastShift?.endsAt || lastShift.endsAt > now) continue

    const existingFuture = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(and(eq(shifts.taskId, schedule.taskId), eq(shifts.status, 'open'), gte(shifts.startsAt, now)))
      .limit(1)
    if (existingFuture[0]) continue

    let startsAt = schedule.nextStartsAt
    while (startsAt <= now + 5 * MINUTE_MS) startsAt = advanceDays(startsAt, schedule.intervalDays)
    const shiftId = randomUUID()
    await db.transaction(async (tx) => {
      await tx.insert(shifts).values({
        id: shiftId,
        taskId: schedule.taskId,
        orgId: schedule.orgId,
        startsAt,
        endsAt: startsAt + schedule.durationMinutes * MINUTE_MS,
        label: onboardingLabel(startsAt),
        capacity: schedule.capacity,
        status: 'open',
        checkInCode: shiftCode(),
        createdAt: now,
      })
      await tx
        .update(onboardingRecurringSchedules)
        .set({ lastPublishedShiftId: shiftId, nextStartsAt: advanceDays(startsAt, schedule.intervalDays), updatedAt: now })
        .where(eq(onboardingRecurringSchedules.taskId, schedule.taskId))
      await appendEvent(tx, EventTypes.ONBOARDING_SESSION_PUBLISHED, {
        taskId: schedule.taskId,
        orgId: schedule.orgId,
        cityId: task.cityId,
        shiftId,
        startsAt,
        recurring: true,
        automated: true,
      }, 'system')
    })
    published += 1
  }
  return { published }
}
