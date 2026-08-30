import Link from 'next/link'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { claims, orgs, shifts, tasks, users, volunteerIdentityVerifications } from '@/lib/db/schema'
import { participantDisplayName } from '@/lib/participant-name'
import { getLabWorkspace } from '../../../../lab-workspace'
import { LabHeader } from '../../../../LabHeader'
import { IssuerLabSidebar } from '../../../IssuerLabSidebar'
import { ShiftVerificationReview } from '../../../ShiftVerificationReview'
import styles from '../../../../prototype.module.css'

export const dynamic = 'force-dynamic'

/** End a shift once, while preserving individual service records. */
export default async function ShiftVerificationPage({ params }: { params: { shiftId: string } }) {
  const session = await requireRole('issuer')
  if (!session.orgId) notFound()
  const orgId = session.orgId
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [shiftRow, org] = await Promise.all([
    db
      .select({ shift: shifts, task: tasks })
      .from(shifts)
      .innerJoin(tasks, eq(shifts.taskId, tasks.id))
      .where(and(eq(shifts.id, params.shiftId), eq(shifts.orgId, orgId), eq(tasks.orgId, orgId)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
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

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-overview" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerLayout}>
      <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
      <section className={styles.issuerMain} aria-label="Shift attendance">
        <section className={styles.issuerPageHero}>
          <div><h1>Shift Verification</h1></div>
          <Link href="/aesthetic-lab/issuer" className={styles.catalogWorkspaceAction}><ArrowLeft size={15} /> Back to Home</Link>
        </section>
        <ShiftVerificationReview
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
