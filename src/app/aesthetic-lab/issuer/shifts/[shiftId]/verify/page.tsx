import Link from 'next/link'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { claims, orgProfiles, orgs, shifts, tasks, users } from '@/lib/db/schema'
import { participantDisplayName } from '@/lib/participant-name'
import { getLabWorkspace } from '../../../../lab-workspace'
import { LabHeader } from '../../../../LabHeader'
import { IssuerLabSidebar } from '../../../IssuerLabSidebar'
import { ShiftVerificationReview } from '../../../ShiftVerificationReview'
import styles from '../../../../prototype.module.css'

export const dynamic = 'force-dynamic'

/** Review a completed shift once, while preserving individual service records. */
export default async function ShiftVerificationPage({ params }: { params: { shiftId: string } }) {
  const session = await requireRole('issuer')
  if (!session.orgId) notFound()
  const orgId = session.orgId
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [shiftRow, profile, org] = await Promise.all([
    db
      .select({ shift: shifts, task: tasks })
      .from(shifts)
      .innerJoin(tasks, eq(shifts.taskId, tasks.id))
      .where(and(eq(shifts.id, params.shiftId), eq(shifts.orgId, orgId), eq(tasks.orgId, orgId)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db.select({ onboardingTaskId: orgProfiles.onboardingTaskId }).from(orgProfiles).where(eq(orgProfiles.orgId, orgId)).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
  ])
  if (!shiftRow) notFound()
  const pendingParticipants = await db
    .select({ claim: claims, participant: users })
    .from(claims)
    .innerJoin(users, eq(claims.userId, users.id))
    .where(and(eq(claims.shiftId, shiftRow.shift.id), inArray(claims.status, ['claimed', 'submitted'])))
    .orderBy(asc(users.name), asc(claims.createdAt))
  const endTime = shiftRow.shift.endsAt ?? shiftRow.shift.startsAt
  const canVerify = shiftRow.shift.status === 'open' && (!endTime || endTime <= Date.now())

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-overview" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerLayout}>
      <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
      <section className={styles.issuerMain} aria-label="Shift verification">
        <section className={styles.issuerPageHero}>
          <div><p className={styles.eyebrow}>Home · Action Queue</p><h1>Verify shift attendance.</h1><p>Confirm the volunteers who were present in one streamlined action. City/Sync keeps a separate, verifiable service record for every selected person.</p></div>
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
            isOnboarding: profile?.onboardingTaskId === shiftRow.task.id,
            canVerify,
          }}
          participants={pendingParticipants.map(({ claim, participant }) => ({
            claimId: claim.id,
            userId: participant.id,
            name: participantDisplayName(participant),
            email: participant.email,
            status: claim.status as 'claimed' | 'submitted',
            checkedInAt: claim.checkedInAt,
            waiverCollectionMethod: claim.waiverCollectionMethod as 'digital' | 'in_person' | null,
            paperWaiverConfirmedAt: claim.paperWaiverConfirmedAt,
          }))}
        />
      </section>
    </div>
  </main>
}
