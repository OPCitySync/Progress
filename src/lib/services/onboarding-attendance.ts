import { and, eq, inArray, ne } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { claims, users, volunteerEligibilityRecords, volunteerIdentityVerifications, volunteerTaskEligibilityGrants, waiverAcceptances } from '@/lib/db/schema'
import { participantDisplayName } from '@/lib/participant-name'

export type EligibilityStatus = 'pending' | 'adult_verified' | 'minor_consent_verified'

export type OnboardingParticipant = {
  claimId: string
  userId: string
  displayName: string
  attendance: 'signed_up' | 'checked_in' | 'verified' | 'no_show'
  waiver: 'signed' | 'pending' | 'not_required'
  eligibility: EligibilityStatus
  eligibilityVerifiedAt: number | null
  eligibilityVerifiedByUserId: string | null
  eligibilityVerifiedByName: string | null
  identityVerified: boolean
  taskEligible: boolean
}

export function eligibilityLabel(status: EligibilityStatus) {
  if (status === 'adult_verified') return '18+ verified'
  if (status === 'minor_consent_verified') return 'Under 18 — guardian consent verified'
  return 'Age eligibility not recorded'
}

export function attendanceLabel(status: OnboardingParticipant['attendance']) {
  if (status === 'checked_in') return 'Checked in'
  if (status === 'verified') return 'Attendance verified'
  if (status === 'no_show') return 'No-show'
  return 'Signed up'
}

export function waiverLabel(status: OnboardingParticipant['waiver']) {
  if (status === 'signed') return 'Waiver signed'
  if (status === 'pending') return 'Waiver pending'
  return 'No waiver required'
}

/**
 * Build a private organization-facing view of each onboarding session.
 * Eligibility deliberately records only the outcome of an in-person review;
 * this function never reads or exposes an ID, birth date, or consent document.
 */
export async function getOnboardingSessionParticipants(input: {
  orgId: string
  taskId: string
  shiftIds: string[]
}): Promise<Map<string, OnboardingParticipant[]>> {
  const result = new Map<string, OnboardingParticipant[]>()
  if (input.shiftIds.length === 0) return result

  const rows = await db
    .select({ claim: claims, participant: users })
    .from(claims)
    .innerJoin(users, eq(claims.userId, users.id))
    .where(
      and(
        eq(claims.taskId, input.taskId),
        inArray(claims.shiftId, input.shiftIds),
        ne(claims.status, 'unclaimed'),
      ),
    )

  if (rows.length === 0) return result

  const userIds = Array.from(new Set(rows.map(({ participant }) => participant.id)))
  const waiverVersionIds = Array.from(
    new Set(rows.map(({ claim }) => claim.waiverVersionId).filter((id): id is string => Boolean(id))),
  )
  const [eligibilityRows, identityRows, taskEligibilityRows, acceptanceRows] = await Promise.all([
    db
      .select()
      .from(volunteerEligibilityRecords)
      .where(and(eq(volunteerEligibilityRecords.orgId, input.orgId), inArray(volunteerEligibilityRecords.userId, userIds))),
    db
      .select({ userId: volunteerIdentityVerifications.userId, status: volunteerIdentityVerifications.status })
      .from(volunteerIdentityVerifications)
      .where(and(eq(volunteerIdentityVerifications.orgId, input.orgId), inArray(volunteerIdentityVerifications.userId, userIds))),
    db
      .select({ userId: volunteerTaskEligibilityGrants.userId })
      .from(volunteerTaskEligibilityGrants)
      .where(and(eq(volunteerTaskEligibilityGrants.orgId, input.orgId), inArray(volunteerTaskEligibilityGrants.userId, userIds), eq(volunteerTaskEligibilityGrants.status, 'active'))),
    waiverVersionIds.length
      ? db
          .select({ userId: waiverAcceptances.userId, waiverVersionId: waiverAcceptances.waiverVersionId })
          .from(waiverAcceptances)
          .where(and(
            eq(waiverAcceptances.orgId, input.orgId),
            inArray(waiverAcceptances.waiverVersionId, waiverVersionIds),
            eq(waiverAcceptances.signatureMethod, 'typed_electronic'),
          ))
      : Promise.resolve([]),
  ])

  const verifierIds = Array.from(
    new Set(eligibilityRows.map((record) => record.verifiedByUserId).filter((id): id is string => Boolean(id))),
  )
  const verifierRows = verifierIds.length
    ? await db.select().from(users).where(inArray(users.id, verifierIds))
    : []
  const verifierNames = new Map(verifierRows.map((user) => [user.id, participantDisplayName(user)]))
  const eligibilityByUser = new Map(eligibilityRows.map((record) => [record.userId, record]))
  const identityVerifiedByUser = new Map(identityRows.map((record) => [record.userId, record.status === 'verified']))
  const taskEligibleUsers = new Set(taskEligibilityRows.map((record) => record.userId))
  const acceptedWaivers = new Set(acceptanceRows.map((record) => `${record.userId}:${record.waiverVersionId}`))

  for (const { claim, participant } of rows) {
    if (!claim.shiftId) continue
    const eligibility = eligibilityByUser.get(participant.id)
    const attendance: OnboardingParticipant['attendance'] = claim.status === 'no_show'
      ? 'no_show'
      : claim.status === 'verified'
        ? 'verified'
        : claim.checkedInAt
          ? 'checked_in'
          : 'signed_up'
    const waiver: OnboardingParticipant['waiver'] = !claim.waiverVersionId
      ? 'not_required'
      : claim.waiverCollectionMethod === 'in_person'
        ? claim.paperWaiverConfirmedAt ? 'signed' : 'pending'
        : acceptedWaivers.has(`${participant.id}:${claim.waiverVersionId}`) ? 'signed' : 'pending'
    const list = result.get(claim.shiftId) ?? []
    list.push({
      claimId: claim.id,
      userId: participant.id,
      displayName: participantDisplayName(participant),
      attendance,
      waiver,
      eligibility: eligibility?.status ?? 'pending',
      eligibilityVerifiedAt: eligibility?.verifiedAt ?? null,
      eligibilityVerifiedByUserId: eligibility?.verifiedByUserId ?? null,
      eligibilityVerifiedByName: eligibility?.verifiedByUserId ? verifierNames.get(eligibility.verifiedByUserId) ?? null : null,
      identityVerified: identityVerifiedByUser.get(participant.id) ?? false,
      taskEligible: taskEligibleUsers.has(participant.id),
    })
    result.set(claim.shiftId, list)
  }

  for (const list of Array.from(result.values())) {
    list.sort((a, b) => a.displayName.localeCompare(b.displayName))
  }
  return result
}
