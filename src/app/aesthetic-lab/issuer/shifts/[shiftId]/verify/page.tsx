import type { CSSProperties } from 'react'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { claims, orgs, shifts, tasks, users, volunteerIdentityVerifications } from '@/lib/db/schema'
import { participantDisplayName } from '@/lib/participant-name'
import { organizationBannerPalette } from '@/lib/profile/organization-appearance'
import { getProfile } from '@/lib/services/profile'
import { getLabWorkspace } from '../../../../lab-workspace'
import { HistoryBackButton } from '../../../../HistoryBackButton'
import { LabHeader } from '../../../../LabHeader'
import { IssuerLabSidebar } from '../../../IssuerLabSidebar'
import { ShiftVerificationReview } from '../../../ShiftVerificationReview'
import styles from '../../../../prototype.module.css'

export const dynamic = 'force-dynamic'

type ShiftVerificationPaletteVariables = CSSProperties & {
  '--shift-verification-deep': string
  '--shift-verification-mid': string
  '--shift-verification-accent': string
  '--shift-verification-accent-deep': string
}

/** End a shift once, while preserving individual service records. */
export default async function ShiftVerificationPage({ params }: { params: { shiftId: string } }) {
  const session = await requireRole('issuer')
  if (!session.orgId) notFound()
  const orgId = session.orgId
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [shiftRow, org, profile] = await Promise.all([
    db
      .select({ shift: shifts, task: tasks })
      .from(shifts)
      .innerJoin(tasks, eq(shifts.taskId, tasks.id))
      .where(and(eq(shifts.id, params.shiftId), eq(shifts.orgId, orgId), eq(tasks.orgId, orgId)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    getProfile(orgId),
  ])
  if (!shiftRow) notFound()
  const pendingParticipants = await db
    .select({ claim: claims, participant: users })
    .from(claims)
    .innerJoin(users, eq(claims.userId, users.id))
    .where(and(eq(claims.shiftId, shiftRow.shift.id), inArray(claims.status, ['claimed', 'submitted'])))
    .orderBy(asc(users.name), asc(claims.createdAt))
  const canFinalize = shiftRow.shift.status === 'open' && (!shiftRow.shift.startsAt || shiftRow.shift.startsAt <= Date.now())
  const pendingParticipantIds = pendingParticipants.map(({ participant }) => participant.id)
  const identityMatches = pendingParticipantIds.length
    ? await db
        .select({ userId: volunteerIdentityVerifications.userId })
        .from(volunteerIdentityVerifications)
        .where(and(
          eq(volunteerIdentityVerifications.orgId, orgId),
          inArray(volunteerIdentityVerifications.userId, pendingParticipantIds),
          eq(volunteerIdentityVerifications.status, 'verified'),
        ))
    : []
  const verifiedIdentityUserIds = new Set(identityMatches.map((row) => row.userId))
  const organizationPalette = organizationBannerPalette(profile?.bannerPalette)
  const verificationPalette: ShiftVerificationPaletteVariables = {
    '--shift-verification-deep': organizationPalette.colors[0],
    '--shift-verification-mid': organizationPalette.colors[1],
    '--shift-verification-accent': organizationPalette.colors[2],
    '--shift-verification-accent-deep': organizationPalette.colors[3],
  }

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-overview" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerLayout}>
      <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
      <section className={styles.issuerMain} aria-label="Shift attendance" style={verificationPalette}>
        <ShiftVerificationReview
          headerAction={<HistoryBackButton fallback="/aesthetic-lab/issuer" />}
          shift={{
            id: shiftRow.shift.id,
            title: shiftRow.task.title,
            label: shiftRow.shift.label,
            startsAt: shiftRow.shift.startsAt,
            endsAt: shiftRow.shift.endsAt,
            location: shiftRow.task.location,
            isOnboarding: shiftRow.task.isOnboarding === 1,
            canFinalize,
          }}
          participants={pendingParticipants.map(({ claim, participant }) => ({
            claimId: claim.id,
            userId: participant.id,
            name: participantDisplayName(participant),
            email: participant.email,
            waiverCollectionMethod: claim.waiverCollectionMethod as 'digital' | 'in_person' | null,
            paperWaiverConfirmedAt: claim.paperWaiverConfirmedAt,
            identityMatchRequired: claim.identityMatchRequired === 1,
            identityMatchConfirmed: verifiedIdentityUserIds.has(participant.id),
          }))}
        />
      </section>
    </div>
  </main>
}
