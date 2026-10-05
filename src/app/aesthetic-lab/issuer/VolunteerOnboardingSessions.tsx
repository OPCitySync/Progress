import Link from 'next/link'
import { and, desc, eq } from 'drizzle-orm'
import { CalendarDays, CheckCircle2, Repeat2, XCircle } from 'lucide-react'
import { cancelOnboardingSessionAction } from '@/app/actions'
import { db } from '@/lib/db/client'
import { tasks } from '@/lib/db/schema'
import {
  attendanceLabel,
  getOnboardingSessionParticipants,
  waiverLabel,
} from '@/lib/services/onboarding-attendance'
import type { OnboardingParticipant } from '@/lib/services/onboarding-attendance'
import { getShiftsWithCounts } from '@/lib/services/opportunities'
import { VolunteerIntakeWizard, IntakeApplicationBuilder, PublishIntakeButton, IntakeReviewTabs } from './VolunteerIntakeControls'
import { ApplicationReviewButton, AdmissionReviewButton } from './VolunteerIntakeReviews'
import { getIntakeForm, intakeIds, intakeQuestions, listIntakeReviews } from '@/lib/services/volunteer-intake'
import { participantDisplayName } from '@/lib/participant-name'
import intakeStyles from './VolunteerIntake.module.css'
import { requireRole } from '@/lib/auth/session'
import { hasOrganizationPermission } from '@/lib/services/identity-access'
import { ManageOnboardingSessionButton } from './ManageOnboardingSessionButton'
import styles from '../prototype.module.css'

type VolunteerProgramOption = {
  id: string
  name: string
  description?: string
}

type OnboardingSessionRow = Awaited<ReturnType<typeof getShiftsWithCounts>>[number]

function OnboardingSessionDetails({
  session,
  participants,
  referenceTime,
  open = false,
}: {
  session: OnboardingSessionRow
  participants: OnboardingParticipant[]
  referenceTime: number
  open?: boolean
}) {
  const { shift, taken } = session
  const isUpcoming = shift.status === 'open' && Boolean(shift.startsAt && shift.startsAt > referenceTime)
  const needsVerification = shift.status === 'open' && !isUpcoming

  return <details id={`event-${shift.id}`} className={styles.onboardingSessionDetails} open={open}>
    <summary>
      <CalendarDays size={16} />
      <b>{shift.startsAt ? new Date(shift.startsAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase() : 'TBD'}</b>
      <span>{shift.startsAt ? new Date(shift.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Time TBD'}</span>
      <em>{taken} of {shift.capacity} reserved</em>
    </summary>
    <div className={styles.onboardingSessionParticipants}>
      {isUpcoming ? <div className={styles.onboardingSessionActions}>
        <span>Cancel this date and everyone signed up will be notified to choose another session.</span>
        <form action={cancelOnboardingSessionAction}>
          <input type="hidden" name="shiftId" value={shift.id} />
          <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/volunteers" />
          <button type="submit"><XCircle size={14} /> Cancel &amp; notify</button>
        </form>
      </div> : needsVerification ? <div className={styles.onboardingSessionActions}>
        <span>Review attendance and close this session.</span>
        <Link className={styles.onboardingWorkspaceAction} href={`/aesthetic-lab/issuer/shifts/${shift.id}/verify`}><CheckCircle2 size={14} /> Verify &amp; Close</Link>
      </div> : null}
      {participants.length === 0 ? <p>No participants have signed up for this session.</p> : participants.map((participant) => <article key={participant.claimId}>
        <div className={styles.onboardingParticipantIdentity}>
          <span>{participant.displayName.slice(0, 2).toUpperCase()}</span>
          <div><b>{participant.displayName}</b><small>{attendanceLabel(participant.attendance)}</small></div>
        </div>
        <div className={styles.onboardingParticipantStates}>
          <span className={participant.identityVerified ? styles.onboardingStateComplete : styles.onboardingStatePending}>{participant.identityVerified ? 'Identity verified' : 'Identity verification pending'}</span>
          <span className={participant.taskEligible ? styles.onboardingStateComplete : styles.onboardingStatePending}>{participant.taskEligible ? 'Eligible to take on tasks' : 'Eligibility to take on tasks pending'}</span>
          <span className={participant.waiver === 'signed' ? styles.onboardingStateComplete : styles.onboardingStatePending}>{waiverLabel(participant.waiver)}</span>
        </div>
        <Link href={`/aesthetic-lab/issuer/volunteers/${participant.userId}`}>View roster profile</Link>
      </article>)}
    </div>
  </details>
}

export async function VolunteerOnboardingSessions({
  orgId,
  cityId,
  defaultLocation,
  programs,
  openEventId,
}: {
  orgId: string
  cityId: string | null
  defaultLocation: string
  programs: VolunteerProgramOption[]
  openEventId?: string
}) {
  const onboardingTasks = cityId
    ? await db.select().from(tasks).where(and(
      eq(tasks.orgId, orgId),
      eq(tasks.cityId, cityId),
      eq(tasks.isOnboarding, 1),
    )).orderBy(desc(tasks.createdAt))
    : []
  const taskShifts = await Promise.all(onboardingTasks.map(async (task) => ({ task, sessions: await getShiftsWithCounts(task.id) })))
  const referenceTime = Date.now()
  const sessionHasEnded = (endsAt: number | null, startsAt: number | null) => {
    const effectiveEnd = endsAt ?? startsAt
    return effectiveEnd !== null && effectiveEnd < referenceTime
  }
  const participantMaps = new Map<string, Map<string, OnboardingParticipant[]>>(
    await Promise.all(taskShifts.map(async ({ task, sessions }) => [
      task.id,
      await getOnboardingSessionParticipants({ orgId, taskId: task.id, shiftIds: sessions.map(({ shift }) => shift.id) }),
    ] as const)),
  )
  const seriesViews = taskShifts.map(({ task, sessions }) => {
    const orderedSessions = [...sessions].sort((a, b) => (b.shift.startsAt ?? 0) - (a.shift.startsAt ?? 0) || b.shift.createdAt - a.shift.createdAt)
    const activeSessions = sessions
      .filter(({ shift }) => shift.status === 'open' && !sessionHasEnded(shift.endsAt, shift.startsAt))
      .sort((a, b) => (a.shift.startsAt ?? 0) - (b.shift.startsAt ?? 0))
    const activeSession = activeSessions[0] ?? null
    return {
      task,
      activeSessions,
      activeSession,
      suggestedStartsAt: activeSession?.shift.startsAt ? activeSession.shift.startsAt + 7 * 24 * 60 * 60 * 1000 : referenceTime + 7 * 24 * 60 * 60 * 1000,
      upcomingSessions: orderedSessions.filter(({ shift }) => shift.status === 'open' && !sessionHasEnded(shift.endsAt, shift.startsAt)),
      pastSessions: orderedSessions.filter(({ shift }) => sessionHasEnded(shift.endsAt, shift.startsAt)),
      participants: participantMaps.get(task.id) ?? new Map<string, OnboardingParticipant[]>(),
    }
  })
  const forms = new Map(await Promise.all(seriesViews.map(async series => [series.task.id, await getIntakeForm(series.task.id)] as const)))
  const actor = await requireRole('issuer')
  const canReview = actor.orgId === orgId && await hasOrganizationPermission(actor, 'participants.manage')
  const reviews = canReview ? await listIntakeReviews(orgId, cityId) : { applications: [], candidates: [] }
  const pastSessions = seriesViews
    .flatMap((series) => series.pastSessions.map((session) => ({
      session,
      participants: series.participants.get(session.shift.id) ?? [],
    })))
    .sort((a, b) => (b.session.shift.startsAt ?? 0) - (a.session.shift.startsAt ?? 0))
  const redirectTo = '/aesthetic-lab/issuer/volunteers'

  const statusLabel = (status: string) => status === 'approved' ? 'Approved' : status === 'needs_paperwork' ? 'Paperwork needed' : status === 'not_approved' ? 'Not approved' : 'Awaiting review'
  function candidateRow(person: typeof reviews.candidates[number]) {
    const { user, task, claim, shift, decision, intake, paperwork } = person
    const name = participantDisplayName(user)
    const missing = [...(paperwork?.waiverItems ?? []), ...(paperwork?.documentItems ?? [])].filter(item => !item.complete)
    const date = shift?.startsAt ? new Date(shift.startsAt).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'}) : 'Attendance verified'
    const programIds = intakeIds(decision?.programIds ?? intake?.programIds ?? JSON.stringify(task.programId ? [task.programId] : []))
    const mode = decision?.assignmentMode ?? intake?.assignmentMode ?? (task.programId ? 'specific' : 'all')
    return <article className={intakeStyles.reviewRow} key={user.id}>
      <div><Link href={'/aesthetic-lab/issuer/volunteers/'+user.id}>{name}</Link><small>{task.title} · {date}</small><small>{decision?.status === 'approved' ? mode === 'all' ? 'All Programs' : programs.filter(p=>programIds.includes(p.id)).map(p=>p.name).join(', ') : missing.length ? missing.map(m=>m.title).join(' · ') : 'Paperwork complete'}</small></div>
      <span className={intakeStyles.reviewState}>{statusLabel(decision?.status ?? 'pending')}</span>
      <AdmissionReviewButton programs={programs} person={{claimId:claim.id,userId:user.id,name,title:task.title,date,status:decision?.status??'pending',assignmentMode:mode,programIds,internalNote:decision?.internalNote??'',waivers:paperwork?.waiverItems??[],documents:paperwork?.documentItems??[]}}/>
    </article>
  }
  function applicationRow(row: typeof reviews.applications[number]) {
    const {user,task,application,form}=row
    let answers: Record<string,string>={}
    try { answers=JSON.parse(application.answers) } catch {}
    return <article className={intakeStyles.reviewRow} key={application.id}><div><Link href={'/aesthetic-lab/issuer/volunteers/'+user.id}>{participantDisplayName(user)}</Link><small>{task.title} · Applied {new Date(application.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</small></div><span className={intakeStyles.reviewState}>{statusLabel(application.status)}</span><ApplicationReviewButton application={{id:application.id,userId:user.id,name:participantDisplayName(user),title:task.title,status:application.status,introduction:form.introduction,questions:intakeQuestions(form.questions),answers,internalNote:application.internalNote,isOnboarding:task.isOnboarding===1}}/></article>
  }
  const pendingPeople=reviews.candidates.filter(p=>!p.decision||p.decision.status==='needs_paperwork')
  const reviewedPeople=reviews.candidates.filter(p=>p.decision&&p.decision.status!=='needs_paperwork')
  const pendingApplications=reviews.applications.filter(a=>a.application.status==='submitted')
  const reviewedApplications=reviews.applications.filter(a=>a.application.status!=='submitted')
  return <section className={styles.volunteerOnboardingWorkspace} aria-label="Onboarding sessions">
    <section className={`${styles.onboardingWorkspaceCard} ${styles.onboardingSessionsOverviewCard}`}>
      <div className={styles.onboardingWorkspaceHeading}>
        <span><Repeat2 size={20} /></span>
        <div><p className={styles.eyebrow}>Onboarding Sessions</p><h2>Welcome and prepare new volunteers.</h2></div>
        <div className={styles.onboardingWorkspaceActions}><VolunteerIntakeWizard defaultLocation={defaultLocation} programs={programs}/></div>
      </div>
      <div className={intakeStyles.sessions}>{seriesViews.map(series=>{
        const setup=forms.get(series.task.id),config=setup?.intake
        const assignment = config?.assignmentMode === 'all' || (!config && !series.task.programId) ? 'All Programs' : programs.filter(p=>intakeIds(config?.programIds ?? JSON.stringify([series.task.programId])).includes(p.id)).map(p=>p.name).join(', ')
        const duration=series.activeSession?.shift.startsAt && series.activeSession.shift.endsAt ? Math.round((series.activeSession.shift.endsAt-series.activeSession.shift.startsAt)/60000) : config ? series.task.defaultDurationMinutes : 45
        return <article key={series.task.id} className={intakeStyles.session}>
          <div className={intakeStyles.sessionTop}><div className={intakeStyles.sessionIdentity}><h3>{series.task.title}</h3><p>{series.task.location || defaultLocation} · {duration} minutes · {config?.flexibleCapacity ? 'Flexible capacity' : series.task.slots+' volunteers'}</p><p>{assignment}</p></div><div className={intakeStyles.actions}>
            <IntakeApplicationBuilder taskId={series.task.id} title={series.task.title} initial={setup?.form ? {introduction:setup.form.introduction,questions:setup.questions,required:Boolean(config?.applicationRequired)} : null}/>
            <PublishIntakeButton taskId={series.task.id} title={series.task.title} suggestedStartsAt={series.suggestedStartsAt} duration={duration}/>
          </div></div>
          <div className={intakeStyles.sessionBody}><details><summary>Session details</summary><div><p className={intakeStyles.preserve}>{series.task.description}</p>{series.task.beforeSession?<p className={intakeStyles.preserve}>{series.task.beforeSession}</p>:null}{!config?<ManageOnboardingSessionButton task={series.task} nextStartsAt={series.activeSession?.shift.startsAt??null} durationMinutes={duration} weeklyCapacity={series.task.slots} programs={programs} redirectTo={redirectTo}/>:null}</div></details></div>
          {series.upcomingSessions.length ? <div className={intakeStyles.sessionDates}>{series.upcomingSessions.map(session=><OnboardingSessionDetails key={session.shift.id} session={session} participants={series.participants.get(session.shift.id)??[]} referenceTime={referenceTime} open={openEventId===session.shift.id}/>)}</div>:null}
        </article>
      })}</div>
    </section>
    {canReview ? <section id="onboarding-approval" className={styles.onboardingWorkspaceCard+' '+intakeStyles.surface}>
      <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Onboarding Approval</p></div></div>
      <IntakeReviewTabs after={<><div className={intakeStyles.reviewList}>{pendingPeople.length?pendingPeople.map(candidateRow):<p className={intakeStyles.empty}>No volunteers are waiting for onboarding approval.</p>}</div>{reviewedPeople.length?<details className={intakeStyles.reviewed}><summary>Reviewed volunteers</summary><div className={intakeStyles.reviewList}>{reviewedPeople.map(candidateRow)}</div></details>:null}</>}
        applications={<><div className={intakeStyles.reviewList}>{pendingApplications.length?pendingApplications.map(applicationRow):<p className={intakeStyles.empty}>No applications are waiting for review.</p>}</div>{reviewedApplications.length?<details className={intakeStyles.reviewed}><summary>Reviewed applications</summary><div className={intakeStyles.reviewList}>{reviewedApplications.map(applicationRow)}</div></details>:null}</>}/>
    </section> : null}

    <section className={`${styles.onboardingWorkspaceCard} ${styles.pastOnboardingSessionsCard}`}>
      <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Past onboarding sessions</p></div></div>
      <div className={styles.onboardingSessionHistory}>
        {pastSessions.length ? pastSessions.map(({ session, participants }) => <OnboardingSessionDetails key={session.shift.id} session={session} participants={participants} referenceTime={referenceTime} open={openEventId === session.shift.id} />) : <p className={styles.onboardingSessionEmpty}>Completed onboarding sessions will appear here.</p>}
      </div>
    </section>
  </section>
}
