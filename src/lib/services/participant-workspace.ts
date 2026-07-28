import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { claims, orgProfiles, orgs, tasks } from '@/lib/db/schema'

/**
 * Organizations a participant has joined by claiming the organization's
 * designated onboarding opportunity. This is derived from the claim record:
 * completing onboarding never needs a second membership store.
 */
export async function getParticipantOrganizations(userId: string) {
  const rows = await db
    .select({
      id: orgs.id,
      name: orgs.name,
      slug: orgs.slug,
      onboardingTask: tasks.title,
      claimStatus: claims.status,
    })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .innerJoin(orgs, eq(tasks.orgId, orgs.id))
    .innerJoin(orgProfiles, eq(orgProfiles.onboardingTaskId, tasks.id))
    .where(
      and(
        eq(claims.userId, userId),
        inArray(claims.status, ['claimed', 'submitted', 'verified']),
        eq(orgs.status, 'approved'),
      ),
    )

  // A recurring onboarding task can have several claimed shifts. One sidebar
  // entry per organization is clearer than repeating the same organization.
  return Array.from(new Map(rows.map((row) => [row.id, row])).values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
}
