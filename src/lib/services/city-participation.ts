import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { claims, cityParticipantStatuses, shifts, tasks } from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import { getCityParticipantStatus } from './city-networks'

const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000

type PolicyResult = { ok: true } | { ok: false; error: string }

async function isOnboardingTask(taskId: string): Promise<boolean> {
  const task = (await db.select({ isOnboarding: tasks.isOnboarding }).from(tasks).where(eq(tasks.id, taskId)).limit(1))[0]
  return task?.isOnboarding === 1
}

/**
 * The city-level reservation rule. New participants may only take one
 * onboarding shift at a time. A successful on-site check-in promotes them to
 * Active; a city bar prevents any new reservation until it expires.
 */
export async function checkCityParticipationGate(input: {
  userId: string
  taskId: string
  cityId: string
}): Promise<PolicyResult> {
  const participation = await getCityParticipantStatus(input.userId, input.cityId)
  if (!participation) {
    return { ok: false, error: 'Add this city network before signing up for its opportunities.' }
  }
  if (participation.status === 'barred') {
    const until = participation.barredUntil
      ? new Date(participation.barredUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'the end of the restriction period'
    return { ok: false, error: `You’re temporarily barred from participating in this city until ${until}.` }
  }
  if (participation.status === 'active') return { ok: true }

  if (!(await isOnboardingTask(input.taskId))) {
    const task=(await db.select().from(tasks).where(eq(tasks.id,input.taskId)).limit(1))[0]
    const {programPolicy,programAccessError,scopeOf}=await import('./program-workspace')
    const policy=task?await programPolicy(task.orgId,scopeOf(task.programId)):null
    // A configured program may use document-only onboarding or explicitly
    // require none. This does not remove city membership or suspension gates.
    if(task&&policy&&(policy.onboardingMode==='none'||!(await programAccessError(task.orgId,scopeOf(task.programId),input.userId))))return {ok:true}
    return { ok: false, error: 'Complete one city onboarding task with a verified check-in before claiming other opportunities.' }
  }

  const activeRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .where(
      and(
        eq(claims.userId, input.userId),
        eq(tasks.cityId, input.cityId),
        inArray(claims.status, ['claimed', 'submitted']),
      ),
    )
  if (Number(activeRows[0]?.count ?? 0) > 0) {
    return { ok: false, error: 'New Participants may hold only one onboarding task at a time in this city.' }
  }

  return { ok: true }
}

/** A verified on-site check-in is the proof that activates city participation. */
export async function activateCityParticipationForCheckIn(taskId: string, userId: string): Promise<void> {
  if (!(await isOnboardingTask(taskId))) return
  const task = (await db.select({ cityId: tasks.cityId }).from(tasks).where(eq(tasks.id, taskId)).limit(1))[0]
  if (!task) return

  const status = await getCityParticipantStatus(userId, task.cityId)
  if (!status || status.status === 'barred') return

  const now = Date.now()
  await db
    .update(cityParticipantStatuses)
    .set({ status: 'active', activatedAt: now, barredUntil: null, updatedAt: now })
    .where(and(eq(cityParticipantStatuses.userId, userId), eq(cityParticipantStatuses.cityId, task.cityId)))
}

/**
 * Resolve remaining reservations when an organizer manually finalizes a
 * shift. Only no-shows while someone is still New in that city consume one
 * of their three onboarding attempts.
 */
export async function markUnverifiedClaimsNoShow(input: {
  shiftId: string
  orgId: string
  actorId: string
  now?: number
}): Promise<{ marked: number; barred: number }> {
  const now = input.now ?? Date.now()
  const rows = await db
    .select({ claim: claims, task: tasks, shift: shifts })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .innerJoin(shifts, eq(claims.shiftId, shifts.id))
    .where(and(
      eq(claims.shiftId, input.shiftId),
      eq(shifts.orgId, input.orgId),
      inArray(claims.status, ['claimed', 'submitted']),
    ))

  let marked = 0
  let barred = 0
  for (const row of rows) {
    const onboarding = row.task.isOnboarding === 1
    const participation = onboarding
      ? await getCityParticipantStatus(row.claim.userId, row.task.cityId)
      : null
    const strikeApplies = participation?.status === 'new'
    const nextCount = strikeApplies ? participation!.noShowCount + 1 : null
    const shouldBar = nextCount !== null && nextCount >= 3
    const barredUntil = shouldBar ? now + SIX_MONTHS_MS : null

    await db.transaction(async (tx) => {
      // Attendance is determined by the organizer's finalized roster. A
      // check-in is useful evidence, but it is not a service verification.
      await tx
        .update(claims)
        .set({ status: 'no_show', noShowAt: now, updatedAt: now })
        .where(and(eq(claims.id, row.claim.id), inArray(claims.status, ['claimed', 'submitted'])))

      if (strikeApplies) {
        await tx
          .update(cityParticipantStatuses)
          .set({
            status: shouldBar ? 'barred' : 'new',
            noShowCount: nextCount!,
            barredUntil,
            updatedAt: now,
          })
          .where(and(eq(cityParticipantStatuses.userId, row.claim.userId), eq(cityParticipantStatuses.cityId, row.task.cityId)))
      }
      await appendEvent(
        tx,
        EventTypes.CLAIM_NO_SHOW,
        {
          claimId: row.claim.id,
          taskId: row.task.id,
          shiftId: row.shift.id,
          participantId: row.claim.userId,
          cityId: row.task.cityId,
          onboarding,
          noShowCount: nextCount,
          barredUntil,
        },
        input.actorId,
      )
    })
    marked++
    if (shouldBar) barred++
  }
  return { marked, barred }
}
