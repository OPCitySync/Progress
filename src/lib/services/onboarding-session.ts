import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orgProfiles, orgs, shifts, tasks } from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import type { Result } from '@/lib/services/identity'
import { normalizeOrganizationLocation, rememberOrganizationLocation } from './organization-locations'

const OCCURRENCES_TO_CREATE = 52
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
 * Creates the public onboarding opportunity and one year of weekly, capacity-
 * bounded shifts. The selected task becomes the organization’s onboarding
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
  credits: number
  firstStartsAt: number | null
  durationMinutes: number
  weeklyCapacity: number
}): Promise<Result<{ taskId: string }>> {
  const title = input.title.trim()
  const description = input.description.trim()
  const location = normalizeOrganizationLocation(input.location)

  if (!title || title.length > 120) return { ok: false, error: 'Enter an onboarding session name of up to 120 characters.' }
  if (location.length > 240) return { ok: false, error: 'Locations are limited to 240 characters.' }
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

  const org = (await db.select({ status: orgs.status }).from(orgs).where(eq(orgs.id, input.orgId)).limit(1))[0]
  if (!org || org.status !== 'approved') return { ok: false, error: 'Your organization must be approved before creating an onboarding session.' }

  const profile = (await db.select({ onboardingTaskId: orgProfiles.onboardingTaskId }).from(orgProfiles).where(eq(orgProfiles.orgId, input.orgId)).limit(1))[0]

  const taskId = randomUUID()
  const now = Date.now()
  const firstDate = new Date(input.firstStartsAt)
  const weeklyLabel = `Weekly ${firstDate.toLocaleDateString('en-US', { weekday: 'long' })} onboarding`
  const generatedShifts = Array.from({ length: OCCURRENCES_TO_CREATE }, (_, index) => {
    const startsAt = weeklyStart(input.firstStartsAt!, index)
    return {
      id: randomUUID(),
      taskId,
      orgId: input.orgId,
      startsAt,
      endsAt: startsAt + input.durationMinutes * MINUTE_MS,
      label: weeklyLabel,
      capacity: input.weeklyCapacity,
      status: 'open' as const,
      checkInCode: shiftCode(),
      createdAt: now,
    }
  })

  await db.transaction(async (tx) => {
    await tx.insert(tasks).values({
      id: taskId,
      orgId: input.orgId,
      cityId: input.cityId,
      title,
      description,
      location,
      credits: input.credits,
      slots: input.weeklyCapacity,
      startsAt: weeklyLabel,
      status: 'open',
      requiredCredentials: '[]',
      catalogEntryId: null,
      createdBy: input.actorId,
      createdAt: now,
    })
    await tx.insert(shifts).values(generatedShifts)
    await rememberOrganizationLocation(tx, { orgId: input.orgId, address: location })

    if (profile) {
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
        occurrencesCreated: OCCURRENCES_TO_CREATE,
      },
      input.actorId,
    )
  })

  return { ok: true, taskId }
}
