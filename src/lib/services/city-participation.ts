import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { claims, cityParticipantStatuses, orgProfiles, shifts, tasks } from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import { getCityParticipantStatus } from './city-networks'

const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000
const DEFAULT_SHIFT_DURATION_MS = 6 * 60 * 60 * 1000
const CHECK_IN_GRACE_MS = 2 * 60 * 60 * 1000

type PolicyResult = { ok: true } | { ok: false; error: string }

function noShowCutoff(shift: typeof shifts.$inferSelect): number | null {
  if (!shift.startsAt) return null
  return (shift.endsAt ?? shift.startsAt + DEFAULT_SHIFT_DURATION_MS) + CHECK_IN_GRACE_MS
}

async function isOnboardingTask(taskId: string): Promise<boolean> {
  const profile = (
    await db.select({ onboardingTaskId: orgProfiles.onboardingTaskId }).from(orgProfiles).where(eq(orgProfiles.onboardingTaskId, taskId)).limit(1)
  )[0]
  return !!profile
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
 * Mark unattended, past shifts as no-shows. Only no-shows while someone is
 * still New in that city consume one of their three onboarding attempts.
 */
export async function processOverdueNoShows(now = Date.now()): Promise<{ marked: number; barred: number }> {
  const rows = await db
    .select({ claim: claims, task: tasks, shift: shifts })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .innerJoin(shifts, eq(claims.shiftId, shifts.id))
    .where(and(inArray(claims.status, ['claimed', 'submitted']), isNull(claims.checkedInAt)))

  let marked = 0
  let barred = 0
  for (const row of rows) {
    const cutoff = noShowCutoff(row.shift)
    if (!cutoff || cutoff > now) continue

    const onboarding = await isOnboardingTask(row.task.id)
    const participation = onboarding
      ? await getCityParticipantStatus(row.claim.userId, row.task.cityId)
      : null
    const strikeApplies = participation?.status === 'new'
    const nextCount = strikeApplies ? participation!.noShowCount + 1 : null
    const shouldBar = nextCount !== null && nextCount >= 3
    const barredUntil = shouldBar ? now + SIX_MONTHS_MS : null

    await db.transaction(async (tx) => {
      // A concurrent check-in wins: only an unchecked active claim can become a no-show.
      await tx
        .update(claims)
        .set({ status: 'no_show', noShowAt: now, updatedAt: now })
        .where(and(eq(claims.id, row.claim.id), inArray(claims.status, ['claimed', 'submitted']), isNull(claims.checkedInAt)))

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
        null,
      )
    })
    marked++
    if (shouldBar) barred++
  }
  return { marked, barred }
}
