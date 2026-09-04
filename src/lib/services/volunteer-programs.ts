import { randomUUID } from 'crypto'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { volunteerPrograms } from '@/lib/db/schema'
import type { Result } from './identity'

export const PROGRAM_ONBOARDING_PREFERENCES = ['optional', 'recommended', 'not_needed'] as const
export type ProgramOnboardingPreference = typeof PROGRAM_ONBOARDING_PREFERENCES[number]

function isOnboardingPreference(value: string): value is ProgramOnboardingPreference {
  return PROGRAM_ONBOARDING_PREFERENCES.includes(value as ProgramOnboardingPreference)
}

export async function getVolunteerPrograms(orgId: string) {
  return db
    .select()
    .from(volunteerPrograms)
    .where(eq(volunteerPrograms.orgId, orgId))
    .orderBy(asc(volunteerPrograms.name), asc(volunteerPrograms.createdAt))
}

export async function programBelongsToOrganization(orgId: string, programId: string | null | undefined) {
  if (!programId) return true
  const program = await db
    .select({ id: volunteerPrograms.id })
    .from(volunteerPrograms)
    .where(and(eq(volunteerPrograms.id, programId), eq(volunteerPrograms.orgId, orgId)))
    .limit(1)
  return Boolean(program[0])
}

export async function createVolunteerProgram(input: {
  orgId: string
  actorId: string
  name: string
  description: string
}): Promise<Result<{ id: string }>> {
  const name = input.name.trim()
  const description = input.description.trim()
  if (!name || name.length > 100) return { ok: false, error: 'Give the program a name of up to 100 characters.' }
  if (description.length > 1_000) return { ok: false, error: 'Keep the program description under 1,000 characters.' }

  const duplicate = await db
    .select({ id: volunteerPrograms.id })
    .from(volunteerPrograms)
    .where(and(eq(volunteerPrograms.orgId, input.orgId), eq(volunteerPrograms.name, name)))
    .limit(1)
  if (duplicate[0]) return { ok: false, error: 'A volunteer program already uses that name.' }

  const now = Date.now()
  const id = randomUUID()
  await db.insert(volunteerPrograms).values({
    id,
    orgId: input.orgId,
    name,
    description,
    operatingMode: 'flexible',
    defaultVisibility: 'public',
    createdByUserId: input.actorId,
    createdAt: now,
    updatedAt: now,
  })
  return { ok: true, id }
}

export async function updateVolunteerProgramSettings(input: {
  orgId: string
  programId: string
  defaultVisibility: string
  defaultLocation: string
  defaultCapacity: number
  defaultDurationMinutes: number
  onboardingPreference: string
}): Promise<Result> {
  const program = await db
    .select({ id: volunteerPrograms.id })
    .from(volunteerPrograms)
    .where(and(eq(volunteerPrograms.id, input.programId), eq(volunteerPrograms.orgId, input.orgId)))
    .limit(1)
  if (!program[0]) return { ok: false, error: 'Volunteer program not found.' }
  if (input.defaultVisibility !== 'public' && input.defaultVisibility !== 'private') {
    return { ok: false, error: 'Choose a default shift access.' }
  }
  const defaultLocation = input.defaultLocation.trim()
  if (defaultLocation.length > 240) return { ok: false, error: 'Locations are limited to 240 characters.' }
  if (!Number.isInteger(input.defaultCapacity) || input.defaultCapacity < 1 || input.defaultCapacity > 10_000) {
    return { ok: false, error: 'Default capacity must be a whole number of at least 1.' }
  }
  if (!Number.isInteger(input.defaultDurationMinutes) || input.defaultDurationMinutes < 15 || input.defaultDurationMinutes > 24 * 60) {
    return { ok: false, error: 'Default duration must be between 15 minutes and 24 hours.' }
  }
  if (!isOnboardingPreference(input.onboardingPreference)) {
    return { ok: false, error: 'Choose how onboarding fits this program.' }
  }

  await db
    .update(volunteerPrograms)
    .set({
      operatingMode: 'flexible',
      defaultVisibility: input.defaultVisibility === 'private' ? 'private' : 'public',
      defaultLocation,
      defaultCapacity: input.defaultCapacity,
      defaultDurationMinutes: input.defaultDurationMinutes,
      onboardingPreference: input.onboardingPreference,
      updatedAt: Date.now(),
    })
    .where(and(eq(volunteerPrograms.id, input.programId), eq(volunteerPrograms.orgId, input.orgId)))
  return { ok: true }
}
