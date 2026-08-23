import Link from 'next/link'
import { ArrowLeft, BadgeCheck, CalendarDays, ShieldCheck, UserRound } from 'lucide-react'
import { and, desc, eq, ne } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { claims, tasks, users, volunteerEligibilityRecords, volunteerIdentityVerifications, volunteerTaskEligibilityGrants } from '@/lib/db/schema'
import { participantDisplayName } from '@/lib/participant-name'
import { attendanceLabel, eligibilityLabel } from '@/lib/services/onboarding-attendance'
import { setVolunteerIdentityVerificationAction, setVolunteerTaskEligibilityAction } from '@/app/actions'
import { getLabWorkspace } from '../../../lab-workspace'
import { LabHeader } from '../../../LabHeader'
import { LabNotice } from '../../../LabNotice'
import { IssuerLabSidebar } from '../../IssuerLabSidebar'
import styles from '../../../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function IssuerVolunteerProfilePage({ params, searchParams }: { params: { userId: string }; searchParams: { ok?: string; error?: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const [participant, history, eligibility, identityVerification, taskTemplates, taskEligibilityGrants] = await Promise.all([
    db.select().from(users).where(eq(users.id, params.userId)).limit(1).then((rows) => rows[0] ?? null),
    db
      .select({ claim: claims, task: tasks })
      .from(claims)
      .innerJoin(tasks, eq(claims.taskId, tasks.id))
      .where(and(eq(tasks.orgId, orgId), eq(claims.userId, params.userId), ne(claims.status, 'unclaimed')))
      .orderBy(desc(claims.updatedAt)),
    db
      .select()
      .from(volunteerEligibilityRecords)
      .where(and(eq(volunteerEligibilityRecords.orgId, orgId), eq(volunteerEligibilityRecords.userId, params.userId)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(volunteerIdentityVerifications)
      .where(and(eq(volunteerIdentityVerifications.orgId, orgId), eq(volunteerIdentityVerifications.userId, params.userId)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db.select({ id: tasks.id, title: tasks.title, status: tasks.status }).from(tasks).where(eq(tasks.orgId, orgId)).orderBy(desc(tasks.createdAt)),
    db
      .select()
      .from(volunteerTaskEligibilityGrants)
      .where(and(eq(volunteerTaskEligibilityGrants.orgId, orgId), eq(volunteerTaskEligibilityGrants.userId, params.userId), eq(volunteerTaskEligibilityGrants.status, 'active'))),
  ])
  const isRosterMember = Boolean(participant && history.length)
  const identityVerifier = identityVerification?.status === 'verified'
    ? (await db.select().from(users).where(eq(users.id, identityVerification.verifiedByUserId)).limit(1))[0] ?? null
    : null
  const identityVerified = identityVerification?.status === 'verified'
  const allTaskEligibility = taskEligibilityGrants.find((grant) => grant.scope === 'all') ?? null
  const specificTaskEligibility = taskEligibilityGrants.filter((grant) => grant.scope === 'task')
  const taskTitleById = new Map(taskTemplates.map((task) => [task.id, task.title]))

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-volunteers" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerLayout}>
      <IssuerLabSidebar cityName={city?.name} />
      <section className={styles.issuerMain} aria-label="Volunteer profile">
        {!isRosterMember ? <section className={styles.labPanel}><p className={styles.emptyCopy}>This volunteer is not available in your organization roster.</p><Link href="/aesthetic-lab/issuer/volunteers">Back to volunteers</Link></section> : <>
          <Link className={styles.volunteerProfileBack} href="/aesthetic-lab/issuer/volunteers"><ArrowLeft size={15} /> Volunteer roster</Link>
          <section className={styles.volunteerProfileHero}>
            <span><UserRound size={22} /></span>
            <div><p className={styles.eyebrow}>Volunteer profile</p><h1>{participantDisplayName(participant!)}</h1><p>{participant!.email}</p></div>
          </section>
          <LabNotice hidden ok={searchParams.ok} error={searchParams.error} />
          <section className={styles.volunteerProfileGrid}>
            <div className={styles.volunteerProfileInfoStack}>
              <section className={styles.volunteerEligibilityCard}>
                <span><ShieldCheck size={19} /></span>
                <div><p className={styles.eyebrow}>Eligibility record</p><h2>{eligibilityLabel(eligibility?.status ?? 'pending')}</h2><p>{eligibility?.verifiedAt ? `Recorded ${new Date(eligibility.verifiedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.` : 'No age-eligibility outcome has been recorded for this organization.'}</p></div>
                <small>Only the outcome is stored—never an ID, date of birth, or guardian document.</small>
              </section>
              <section className={styles.volunteerIdentityVerificationCard}>
                <span><BadgeCheck size={19} /></span>
                <div><p className={styles.eyebrow}>Identity verification</p><h2>{identityVerified ? 'In-person identity match recorded' : 'No in-person identity match recorded'}</h2><p>{identityVerified && identityVerification ? `Recorded ${new Date(identityVerification.verifiedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}${identityVerifier ? ` by ${participantDisplayName(identityVerifier)}` : ''}.` : 'Record this only after an authorized staff member confirms that the person who appeared matches this City/Sync account.'}</p></div>
                {identityVerified ? <form action={setVolunteerIdentityVerificationAction}><input type="hidden" name="userId" value={participant!.id} /><input type="hidden" name="operation" value="revoke" /><input type="hidden" name="redirectTo" value={`/aesthetic-lab/issuer/volunteers/${participant!.id}`} /><button type="submit">Remove record</button></form> : <form action={setVolunteerIdentityVerificationAction}><input type="hidden" name="userId" value={participant!.id} /><input type="hidden" name="operation" value="verify" /><input type="hidden" name="redirectTo" value={`/aesthetic-lab/issuer/volunteers/${participant!.id}`} /><label><input type="checkbox" name="identityConfirmed" required /> I confirmed this person in person.</label><button type="submit">Record identity match</button></form>}
                <small>City/Sync stores the staff attestation only—never an ID image, ID number, or source document.</small>
              </section>
              <section className={styles.volunteerTaskEligibilityCard}>
                <span><ShieldCheck size={19} /></span>
                <div><p className={styles.eyebrow}>Task eligibility</p><h2>{allTaskEligibility ? 'Eligible for all task templates' : `${specificTaskEligibility.length} specific task template${specificTaskEligibility.length === 1 ? '' : 's'} approved`}</h2><p>Grant organization approval for every task template or only the work this volunteer is cleared to perform.</p></div>
                <div className={styles.volunteerTaskEligibilityActions}>
                  {allTaskEligibility ? <form action={setVolunteerTaskEligibilityAction}><input type="hidden" name="userId" value={participant!.id} /><input type="hidden" name="operation" value="revoke" /><input type="hidden" name="grantId" value={allTaskEligibility.id} /><input type="hidden" name="redirectTo" value={`/aesthetic-lab/issuer/volunteers/${participant!.id}`} /><button type="submit">Revoke all-template approval</button></form> : <form action={setVolunteerTaskEligibilityAction}><input type="hidden" name="userId" value={participant!.id} /><input type="hidden" name="operation" value="grant" /><input type="hidden" name="scope" value="all" /><input type="hidden" name="redirectTo" value={`/aesthetic-lab/issuer/volunteers/${participant!.id}`} /><button type="submit">Mark eligible for all templates</button></form>}
                  <form action={setVolunteerTaskEligibilityAction} className={styles.volunteerTaskEligibilitySelect}><input type="hidden" name="userId" value={participant!.id} /><input type="hidden" name="operation" value="grant" /><input type="hidden" name="scope" value="task" /><input type="hidden" name="redirectTo" value={`/aesthetic-lab/issuer/volunteers/${participant!.id}`} /><select name="taskId" required defaultValue=""><option value="" disabled>Select a task template…</option>{taskTemplates.map((task) => <option value={task.id} key={task.id}>{task.title}{task.status === 'open' ? '' : ' (closed)'}</option>)}</select><button type="submit">Add template</button></form>
                </div>
                {specificTaskEligibility.length > 0 ? <div className={styles.volunteerTaskEligibilityList}>{specificTaskEligibility.map((grant) => <article key={grant.id}><span>{taskTitleById.get(grant.taskId) ?? 'Archived task template'}</span><form action={setVolunteerTaskEligibilityAction}><input type="hidden" name="userId" value={participant!.id} /><input type="hidden" name="operation" value="revoke" /><input type="hidden" name="grantId" value={grant.id} /><input type="hidden" name="redirectTo" value={`/aesthetic-lab/issuer/volunteers/${participant!.id}`} /><button type="submit">Revoke</button></form></article>)}</div> : null}
                <small>These are organization-local approvals. Revoke any approval at any time.</small>
              </section>
            </div>
            <section className={styles.volunteerHistoryCard}>
              <div><p className={styles.eyebrow}>Activity with your organization</p><h2>Participation history</h2></div>
              <div>{history.map(({ claim, task }) => {
                const attendance = claim.status === 'no_show' ? 'no_show' : claim.status === 'verified' ? 'verified' : claim.checkedInAt ? 'checked_in' : 'signed_up'
                return <article key={claim.id}><CalendarDays size={16} /><div><b>{task.title}</b><small>{attendanceLabel(attendance)} · {new Date(claim.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</small></div><Link href={`/aesthetic-lab/issuer/opportunities/${task.id}`}>Opportunity</Link></article>
              })}</div>
            </section>
          </section>
        </>}
      </section>
    </div>
  </main>
}
