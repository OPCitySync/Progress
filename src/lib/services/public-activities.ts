import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  cities,
  claims,
  orgProfiles,
  orgs,
  shifts,
  tasks,
  volunteerPrograms,
} from '@/lib/db/schema'
import { checkClaimGate, type ClaimGate } from './opportunities'
import { getWaiversAttachedToTask } from './organization-resources'
import { getWaiverSignatures } from './waivers'

const ACTIVE_CLAIM_STATUSES = ['claimed', 'submitted', 'verified'] as const

export type PublicActivityAvailability =
  | 'open'
  | 'full'
  | 'started'
  | 'ended'
  | 'closed'

/**
 * Resolve one shareable public event without exposing private or
 * organization-managed shifts. The activity page and the reservation action
 * intentionally read the same shift record, so a shared URL cannot weaken an
 * organization's enrollment choice.
 */
export async function getPublicActivity(shiftId: string, viewerUserId?: string) {
  const row = await db
    .select({
      shift: shifts,
      task: tasks,
      organization: orgs,
      profile: orgProfiles,
      city: cities,
      program: volunteerPrograms,
    })
    .from(shifts)
    .innerJoin(tasks, eq(shifts.taskId, tasks.id))
    .innerJoin(orgs, eq(tasks.orgId, orgs.id))
    .innerJoin(cities, eq(tasks.cityId, cities.id))
    .leftJoin(orgProfiles, eq(orgProfiles.orgId, orgs.id))
    .leftJoin(volunteerPrograms, and(eq(volunteerPrograms.id, tasks.programId), eq(volunteerPrograms.orgId, tasks.orgId)))
    .where(and(eq(shifts.id, shiftId), eq(shifts.orgId, tasks.orgId)))
    .limit(1)
    .then((rows) => rows[0] ?? null)

  if (
    !row ||
    row.organization.status !== 'approved' ||
    row.shift.visibility !== 'public' ||
    row.shift.enrollmentMode !== 'open_claims'
  ) {
    return null
  }

  const [countRows, waivers, viewerClaim] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(claims)
      .where(and(eq(claims.shiftId, shiftId), inArray(claims.status, [...ACTIVE_CLAIM_STATUSES]))),
    getWaiversAttachedToTask(row.task.id),
    viewerUserId
      ? db
          .select()
          .from(claims)
          .where(and(eq(claims.shiftId, shiftId), eq(claims.userId, viewerUserId)))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ])

  const taken = Number(countRows[0]?.count ?? 0)
  const spotsLeft = Math.max(0, row.shift.capacity - taken)
  const now = Date.now()
  const activityEnd = row.shift.endsAt ?? row.shift.startsAt
  let availability: PublicActivityAvailability = 'open'
  if (row.task.status !== 'open' || row.shift.status !== 'open') availability = 'closed'
  else if (activityEnd && activityEnd <= now) availability = 'ended'
  else if (row.shift.startsAt && row.shift.startsAt <= now) availability = 'started'
  else if (spotsLeft === 0) availability = 'full'

  let signedWaiverIds = new Set<string>()
  let claimGate: ClaimGate | null = null
  const hasActiveClaim = Boolean(
    viewerClaim && ACTIVE_CLAIM_STATUSES.includes(viewerClaim.status as (typeof ACTIVE_CLAIM_STATUSES)[number]),
  )

  if (viewerUserId) {
    const signatures = await getWaiverSignatures(viewerUserId, waivers.map((waiver) => waiver.id))
    signedWaiverIds = new Set(signatures.keys())
    if (!hasActiveClaim && availability === 'open') {
      claimGate = await checkClaimGate(shiftId, viewerUserId, 'digital')
    }
  }

  return {
    ...row,
    taken,
    spotsLeft,
    availability,
    waivers,
    signedWaiverIds,
    viewerClaim,
    hasActiveClaim,
    claimGate,
  }
}
