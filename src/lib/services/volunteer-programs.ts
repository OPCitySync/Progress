import { randomUUID } from 'crypto'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { volunteerPrograms } from '@/lib/db/schema'
import type { Result } from './identity'

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
    createdByUserId: input.actorId,
    createdAt: now,
    updatedAt: now,
  })
  return { ok: true, id }
}
