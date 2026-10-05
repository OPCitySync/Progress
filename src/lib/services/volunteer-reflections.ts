import { randomUUID } from 'crypto'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  claims,
  orgs,
  shifts,
  tasks,
  users,
  volunteerReflections,
} from '@/lib/db/schema'
import { participantDisplayName } from '@/lib/participant-name'
import { notifyOrganizationVolunteerReflection } from './notifications'
import type { Result } from './identity'

export type VolunteerReflectionPrompt = {
  claim: typeof claims.$inferSelect
  task: typeof tasks.$inferSelect
  shift: typeof shifts.$inferSelect
  organization: typeof orgs.$inferSelect
  participant: typeof users.$inferSelect
  reflection: typeof volunteerReflections.$inferSelect | null
}

export type OrganizationVolunteerReflection = {
  reflection: typeof volunteerReflections.$inferSelect
  participantName: string
}

/**
 * A reflection can only be opened by the participant whose attendance was
 * verified. It is intentionally a post-event, post-verification experience.
 */
export async function getVolunteerReflectionPrompt(
  claimId: string,
  userId: string,
): Promise<VolunteerReflectionPrompt | null> {
  const row = (
    await db
      .select({
        claim: claims,
        task: tasks,
        shift: shifts,
        organization: orgs,
        participant: users,
        reflection: volunteerReflections,
      })
      .from(claims)
      .innerJoin(tasks, eq(claims.taskId, tasks.id))
      .innerJoin(orgs, eq(tasks.orgId, orgs.id))
      .innerJoin(shifts, eq(claims.shiftId, shifts.id))
      .innerJoin(users, eq(claims.userId, users.id))
      .leftJoin(volunteerReflections, eq(volunteerReflections.claimId, claims.id))
      .where(and(eq(claims.id, claimId), eq(claims.userId, userId)))
      .limit(1)
  )[0]

  if (!row || row.claim.status !== 'verified') return null
  return row
}

/**
 * Private participant reflection. It has no public or city-ledger projection:
 * the organization receives an in-app insight notice, not a reply thread.
 */
export async function submitVolunteerReflection(input: {
  claimId: string
  userId: string
  shiftNote: string
  organizationIdea: string
}): Promise<Result<{ id: string }>> {
  const prompt = await getVolunteerReflectionPrompt(input.claimId, input.userId)
  if (!prompt) return { ok: false, error: 'This reflection is only available after your participation has been verified.' }
  if (prompt.reflection) return { ok: false, error: 'You have already shared a reflection for this shift.' }

  const shiftNote = input.shiftNote.trim().slice(0, 1_000)
  const organizationIdea = input.organizationIdea.trim().slice(0, 1_000)
  if (!shiftNote && !organizationIdea) {
    return { ok: false, error: 'Add a shift note, an idea for the organization, or both.' }
  }

  const id = randomUUID()
  const submittedAt = Date.now()
  await db.insert(volunteerReflections).values({
    id,
    claimId: prompt.claim.id,
    shiftId: prompt.shift.id,
    taskId: prompt.task.id,
    orgId: prompt.organization.id,
    userId: input.userId,
    verificationBatchId: prompt.claim.verificationBatchId,
    shiftNote,
    organizationIdea,
    submittedAt,
  })

  // The reflection itself stays in the organization’s private application
  // data. Delivery is deliberately best-effort and must never undo it.
  try {
    await notifyOrganizationVolunteerReflection({
      orgId: prompt.organization.id,
      shiftId: prompt.shift.id,
      taskTitle: prompt.task.title,
      participantName: participantDisplayName(prompt.participant),
    })
  } catch (error) {
    console.error('notifyOrganizationVolunteerReflection failed', error)
  }

  return { ok: true, id }
}

/** Private, read-only reflections displayed in an organization’s past event record. */
export async function getOrganizationVolunteerReflections(
  orgId: string,
  shiftIds: string[],
): Promise<OrganizationVolunteerReflection[]> {
  if (shiftIds.length === 0) return []
  const rows = await db
    .select({ reflection: volunteerReflections, participant: users })
    .from(volunteerReflections)
    .innerJoin(users, eq(volunteerReflections.userId, users.id))
    .where(and(eq(volunteerReflections.orgId, orgId), inArray(volunteerReflections.shiftId, shiftIds)))
    .orderBy(desc(volunteerReflections.submittedAt))

  return rows.map(({ reflection, participant }) => ({
    reflection,
    participantName: participantDisplayName(participant),
  }))
}
