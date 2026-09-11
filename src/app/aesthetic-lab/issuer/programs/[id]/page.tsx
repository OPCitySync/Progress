import Link from 'next/link'
import { and, desc, eq, gt, inArray, isNull, ne } from 'drizzle-orm'
import { ArrowLeft, CalendarDays, CheckCircle2, XCircle } from 'lucide-react'
import { cancelShiftAndNotifyAction } from '@/app/actions'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { claims, onboardingApplicationForms, onboardingApplications, orgs, plannedRecurringAssignments, plannedRecurringStaffAssignments, recurringEventSchedules, shiftStaffAssignments, tasks, users } from '@/lib/db/schema'
import { getShiftsWithCounts } from '@/lib/services/opportunities'
import { getVolunteerPrograms } from '@/lib/services/volunteer-programs'
import { getRoster } from '@/lib/services/roster'
import { listOrganizationDelegations } from '@/lib/services/identity-access'
import { LabHeader } from '../../../LabHeader'
import { getLabWorkspace } from '../../../lab-workspace'
import { IssuerLabSidebar } from '../../IssuerLabSidebar'
import { ScheduleNewShiftButton } from '../../ScheduleNewShiftButton'
import { VolunteerRoleWorkspace } from '../../VolunteerRoleWorkspace'
import { ProgramRosterScheduler } from '../../ProgramRosterScheduler'
import { ShiftRosterAssignmentButton } from '../../ShiftRosterAssignmentButton'
import { ProgramNavigation } from '../../ProgramWorkspace'
import { ProgramOnboardingPanel, ProgramOverviewPanel, ProgramRecognitionPanel } from '../../ProgramWorkspacePanels'
import { programPolicy } from '@/lib/services/program-workspace'
import { getOrganizationLocations } from '@/lib/services/organization-locations'
import { getIntakeForm, intakeQuestions } from '@/lib/services/volunteer-intake'
import styles from '../../../prototype.module.css'

export const dynamic = 'force-dynamic'

function formatDate(timestamp: number | null) {
  return timestamp
    ? new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Date to be confirmed'
}

function formatDateTime(timestamp: number | null) {
  return timestamp
    ? new Date(timestamp).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Date and time to be confirmed'
}

function shiftDisplayName(label: string, startsAt: number | null) {
  const savedLabel = label.trim()
  if (savedLabel) return savedLabel
  return startsAt
    ? `${new Date(startsAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} shift`
    : 'Scheduled shift'
}

export default async function IssuerVolunteerProgramDetailsPage({ params, searchParams }: { params: { id: string }; searchParams: {section?:string} }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const isOrganizationArea = params.id === 'organization'
  const [org, programs, taskRows, roster, approvedRoleRows, delegations, organizationLocations] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    getVolunteerPrograms(orgId),
    city
      ? db.select().from(tasks).where(and(
        eq(tasks.orgId, orgId),
        eq(tasks.cityId, city.id),
        isOrganizationArea ? isNull(tasks.programId) : eq(tasks.programId, params.id),
      )).orderBy(desc(tasks.createdAt))
      : Promise.resolve([]),
    getRoster(orgId),
    db.select({
      userId: onboardingApplications.userId,
      roleTitle: tasks.title,
    }).from(onboardingApplications)
      .innerJoin(tasks, eq(onboardingApplications.taskId, tasks.id))
      .where(and(
        eq(onboardingApplications.orgId, orgId),
        eq(onboardingApplications.status, 'approved'),
        eq(tasks.orgId, orgId),
        eq(tasks.isOnboarding, 0),
        eq(tasks.status, 'open'),
      )),
    listOrganizationDelegations(orgId),
    getOrganizationLocations(orgId),
  ])
  const program = isOrganizationArea
    ? {
      id: null,
      name: 'Organization',
      description: 'The shared work, welcome, and progress of your organization.',
      defaultVisibility: 'public' as const,
      defaultLocation: '',
      defaultCapacity: 8,
      defaultDurationMinutes: 120,
      onboardingPreference: 'optional' as const,
    }
    : programs.find((item) => item.id === params.id)
  const workspaceHref = '/aesthetic-lab/issuer/catalog'
  const programHref = `/aesthetic-lab/issuer/programs/${params.id}`

  if (!program) {
    return (
      <main className={styles.app}>
        <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
        <div className={styles.issuerLayout}>
          <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
          <section className={styles.issuerMain} aria-label="Volunteer program">
            <section className={styles.issuerPageHero}>
              <div><p className={styles.eyebrow}>Volunteer programs</p><h1>Program unavailable.</h1><p>This volunteer program may have been removed or belongs to another organization.</p></div>
              <Link href={workspaceHref} className={styles.catalogWorkspaceAction}><ArrowLeft size={15} /> Workspace</Link>
            </section>
          </section>
        </div>
      </main>
    )
  }

  const taskShifts = await Promise.all(taskRows.map(async (task) => ({ task, sessions: await getShiftsWithCounts(task.id) })))
  const now = Date.now()
  const hasEnded = (endsAt: number | null, startsAt: number | null) => (endsAt ?? startsAt ?? Number.MAX_SAFE_INTEGER) < now
  const standardTemplates = taskShifts.filter(({ task }) => task.isOnboarding !== 1 && task.status === 'open')
  const roleApplications = new Map(await Promise.all(standardTemplates.map(async ({ task }) => [task.id, await getIntakeForm(task.id)] as const)))
  const roleApplicationTemplates = standardTemplates.length ? await db.select({
    id:onboardingApplicationForms.id,
    taskId:onboardingApplicationForms.taskId,
    version:onboardingApplicationForms.version,
    introduction:onboardingApplicationForms.introduction,
    questions:onboardingApplicationForms.questions,
    createdAt:onboardingApplicationForms.createdAt,
    roleTitle:tasks.title,
  }).from(onboardingApplicationForms)
    .innerJoin(tasks,eq(onboardingApplicationForms.taskId,tasks.id))
    .where(and(eq(onboardingApplicationForms.orgId,orgId),gt(onboardingApplicationForms.version,0),isNull(onboardingApplicationForms.archivedAt),inArray(onboardingApplicationForms.taskId,standardTemplates.map(({task})=>task.id))))
    .orderBy(desc(onboardingApplicationForms.createdAt)) : []
  const unreviewedRoleApplicants = standardTemplates.length ? await db.select({
    id:onboardingApplications.id,
    userId:users.id,
    name:users.name,
    email:users.email,
    roleTitle:tasks.title,
    appliedAt:onboardingApplications.createdAt,
    introduction:onboardingApplicationForms.introduction,
    questions:onboardingApplicationForms.questions,
    answers:onboardingApplications.answers,
    internalNote:onboardingApplications.internalNote,
  }).from(onboardingApplications)
    .innerJoin(onboardingApplicationForms,eq(onboardingApplications.formId,onboardingApplicationForms.id))
    .innerJoin(users,eq(onboardingApplications.userId,users.id))
    .innerJoin(tasks,eq(onboardingApplications.taskId,tasks.id))
    .where(and(eq(onboardingApplications.orgId,orgId),eq(onboardingApplications.status,'submitted'),inArray(onboardingApplications.taskId,standardTemplates.map(({task})=>task.id))))
    .orderBy(desc(onboardingApplications.createdAt)) : []
  const recurringShiftSchedules = standardTemplates.length
    ? await db.select().from(recurringEventSchedules).where(and(
      eq(recurringEventSchedules.orgId, orgId),
      eq(recurringEventSchedules.active, 1),
      inArray(recurringEventSchedules.taskId, standardTemplates.map(({ task }) => task.id)),
    ))
    : []
  const [plannedRecurringVolunteers, plannedRecurringStaff] = recurringShiftSchedules.length
    ? await Promise.all([
      db.select({ taskId: plannedRecurringAssignments.taskId, occurrenceStartsAt: plannedRecurringAssignments.occurrenceStartsAt, userId: plannedRecurringAssignments.userId })
        .from(plannedRecurringAssignments)
        .where(and(
          eq(plannedRecurringAssignments.orgId, orgId),
          eq(plannedRecurringAssignments.status, 'planned'),
          inArray(plannedRecurringAssignments.taskId, recurringShiftSchedules.map((schedule) => schedule.taskId)),
        )),
      db.select({ taskId: plannedRecurringStaffAssignments.taskId, occurrenceStartsAt: plannedRecurringStaffAssignments.occurrenceStartsAt, userId: plannedRecurringStaffAssignments.userId })
        .from(plannedRecurringStaffAssignments)
        .where(and(
          eq(plannedRecurringStaffAssignments.orgId, orgId),
          eq(plannedRecurringStaffAssignments.status, 'planned'),
          inArray(plannedRecurringStaffAssignments.taskId, recurringShiftSchedules.map((schedule) => schedule.taskId)),
        )),
    ])
    : [[], []]
  const publishedEvents = standardTemplates.flatMap(({ task, sessions }) => sessions
    .filter(({ shift }) => shift.status === 'open' && Boolean(shift.startsAt && shift.startsAt > now))
    .map(({ shift, taken, slotsLeft }) => ({ task, shift, taken, slotsLeft })))
    .sort((a, b) => (a.shift.startsAt ?? Number.MAX_SAFE_INTEGER) - (b.shift.startsAt ?? Number.MAX_SAFE_INTEGER))
  const pastEvents = standardTemplates.flatMap(({ task, sessions }) => sessions
    .filter(({ shift }) => hasEnded(shift.endsAt, shift.startsAt))
    .map(({ shift, taken }) => ({ task, shift, taken })))
    .sort((a, b) => (b.shift.startsAt ?? 0) - (a.shift.startsAt ?? 0))
  const shiftIds = [...publishedEvents, ...pastEvents].map(({ shift }) => shift.id)
  const programClaims = shiftIds.length
    ? await db.select({ userId: claims.userId, shiftId: claims.shiftId, status: claims.status }).from(claims)
      .where(and(inArray(claims.shiftId, shiftIds), ne(claims.status, 'unclaimed')))
    : []
  const verifiedContributions = programClaims.filter((claim) => claim.status === 'verified').length
  const participatingVolunteers = new Set(programClaims.filter((claim) => claim.status !== 'no_show').map((claim) => claim.userId)).size
  const planningShiftIds = publishedEvents
    .filter(({ task, shift }) => task.isOnboarding !== 1 && Boolean(shift.startsAt && shift.startsAt > now))
    .map(({ shift }) => shift.id)
  const staffAssignments = planningShiftIds.length
    ? await db.select({ shiftId: shiftStaffAssignments.shiftId, userId: shiftStaffAssignments.userId }).from(shiftStaffAssignments)
      .where(inArray(shiftStaffAssignments.shiftId, planningShiftIds))
    : []
  const assignedStaffByShift = new Map<string, string[]>()
  for (const assignment of staffAssignments) {
    const assigned = assignedStaffByShift.get(assignment.shiftId) ?? []
    assigned.push(assignment.userId)
    assignedStaffByShift.set(assignment.shiftId, assigned)
  }
  const activeStaff = delegations
    .filter(({ delegation }) => delegation.status === 'active')
    .map(({ delegation, user, role }) => ({
      userId: user.id,
      delegationId: delegation.id,
      name: user.username?.trim() || user.name,
      email: user.email,
      roleLabel: role?.name || (delegation.role === 'owner' ? 'Organization owner' : delegation.role === 'manager' ? 'Organization manager' : 'Organization staff'),
    }))
  const activeStaffUserIds = new Set(activeStaff.map((person) => person.userId))
  const roleTitlesByUserId = new Map<string, string[]>()
  for (const role of approvedRoleRows) {
    const titles = roleTitlesByUserId.get(role.userId) ?? []
    if (!titles.includes(role.roleTitle)) titles.push(role.roleTitle)
    roleTitlesByUserId.set(role.userId, titles)
  }
  const schedulingVolunteers = roster.volunteers.map((person) => ({
    ...person,
    roleTitles: (roleTitlesByUserId.get(person.userId) ?? []).sort((a, b) => a.localeCompare(b)),
  }))
  const activePlannedRecurringStaff = plannedRecurringStaff.filter((assignment) => activeStaffUserIds.has(assignment.userId))
  const onboardingPolicy = await programPolicy(orgId, params.id)
  const nextProgramAction = !onboardingPolicy
    ? { label: 'Plan your volunteer welcome', detail: 'Choose shared onboarding, a program-specific welcome, or no onboarding requirements.', href: programHref+'?section=onboarding' }
    : !standardTemplates.length
    ? { label: 'Create a volunteer role', detail: 'Define the work before you decide when it happens or who will join it.', href: programHref+'?section=positions' }
    : null
  const defaultLocation = program.defaultLocation || standardTemplates[0]?.task.location || ''
  const organizationAddress = organizationLocations.find((location) => location.isDefault)?.address
    || organizationLocations[0]?.address
    || defaultLocation
  const rosterSchedulingShifts = publishedEvents
    .filter(({ task, shift }) => task.isOnboarding !== 1 && Boolean(shift.startsAt && shift.startsAt > now))
    .map(({ task, shift }) => ({
      id: shift.id,
      taskId: task.id,
      title: task.title,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      location: task.location,
      capacity: shift.capacity,
      visibility: shift.visibility,
      assignedUserIds: programClaims
        .filter((claim) => claim.shiftId === shift.id && (claim.status === 'claimed' || claim.status === 'submitted' || claim.status === 'verified'))
        .map((claim) => claim.userId),
      assignedStaffUserIds: assignedStaffByShift.get(shift.id) ?? [],
    }))
  const taskById = new Map(taskRows.map((task) => [task.id, task]))
  const recurringShiftPlans = recurringShiftSchedules.flatMap((schedule) => {
    const task = taskById.get(schedule.taskId)
    if (!task) return []
    return [{
      scheduleId: schedule.id,
      taskId: task.id,
      title: task.title,
      location: task.location,
      capacity: schedule.capacity,
      visibility: schedule.visibility,
      intervalDays: schedule.intervalDays,
      nextStartsAt: schedule.nextStartsAt,
      durationMinutes: schedule.durationMinutes,
    }]
  })
  const impactMetrics = [
    { label: 'Verified contributions', value: verifiedContributions, detail: 'Completed participation recorded' },
    { label: 'Volunteers involved', value: participatingVolunteers, detail: 'People who signed up or participated' },
    { label: 'Verified shifts', value: new Set(programClaims.filter(c=>c.status==='verified').map(c=>c.shiftId)).size, detail: 'Shifts with verified participation' },
    { label: 'Upcoming events', value: publishedEvents.length, detail: 'Public and private scheduled shifts' },
  ]

  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
        <section className={styles.issuerMain} aria-label={`${program.name} details`}>
          <section className={styles.issuerPageHero}>
            <div><p className={styles.eyebrow}>Workspace · Volunteer Programs</p><h1>{program.name}</h1><p>{program.description || 'This program brings its volunteer work and participation history together in one place.'}</p></div>
            <Link href={workspaceHref} className={styles.catalogWorkspaceAction}><ArrowLeft size={15} /> Workspace</Link>
          </section>

          <div className={styles.programControlCenterShell}>
          <section className={styles.programControlCenterCard}>
            <div className={styles.programControlCenterHeading}>
              <div><p className={styles.eyebrow}>Program control center</p><h2>Build, schedule, and grow this program in one place.</h2><p>Welcome people, define their work, plan together, and recognize what they make possible.</p></div>
              <div className={styles.programControlCenterActions}>
                {nextProgramAction ? <Link className={styles.catalogWorkspaceAction} href={nextProgramAction.href}>{nextProgramAction.label}</Link> : null}
              </div>
            </div>
          </section>

          <ProgramNavigation initialSection={searchParams.section} panels={{
            overview: <ProgramOverviewPanel orgId={orgId} scope={params.id} positions={standardTemplates.map(r=>r.task)} history={          <section className={styles.programDetailSection}>
            <div className={styles.programDetailHeading}><div><p className={styles.eyebrow}>Program history</p><h2>Participation history</h2></div></div>
            {pastEvents.length ? <div className={styles.programDetailList}>{pastEvents.slice(0, 8).map(({ task, shift, taken }) => <article key={shift.id}><CheckCircle2 size={17} /><div><b>{task.title}</b><p>{formatDate(shift.startsAt)} · {taken} participant{taken === 1 ? '' : 's'} recorded</p><small>{shift.status === 'closed' ? 'Closed shift' : 'Awaiting verification'}</small></div><Link href={`/aesthetic-lab/issuer/opportunities/${task.id}`}>View</Link></article>)}</div> : <p className={styles.programDetailEmpty}>Completed events will collect here as this program grows.</p>}
          </section>} impact={          <section className={styles.programDetailImpactCard}>
            <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Program impact</p><h2>Progress at a glance</h2><p>This summary is specific to {program.name} in {city?.name ?? 'your active city'}.</p></div><CheckCircle2 size={19} /></div>
            <div className={styles.programDetailMetricGrid}>{impactMetrics.map((metric) => <article key={metric.label}><strong>{metric.value.toLocaleString()}</strong><b>{metric.label}</b><span>{metric.detail}</span></article>)}</div>
          </section>}/>,
            onboarding: <ProgramOnboardingPanel orgId={orgId} scope={params.id} programName={program.name} programs={programs} location={defaultLocation}/>,
            positions: <VolunteerRoleWorkspace
              roles={standardTemplates.map(({task,sessions})=>{
                const application=roleApplications.get(task.id)
                return {
                  task,
                  upcoming:sessions.filter(({shift})=>shift.status==='open'&&!hasEnded(shift.endsAt,shift.startsAt)).length,
                  application:application?.form?{introduction:application.form.introduction,questions:application.questions,required:Boolean(application.intake?.applicationRequired)}:null,
                  published:Boolean(application?.intake?.applicationPublic),
                }
              })}
              applicationTemplates={roleApplicationTemplates.map(template=>({
                ...template,
                questions:intakeQuestions(template.questions),
                published:Boolean(roleApplications.get(template.taskId)?.intake?.applicationPublic&&roleApplications.get(template.taskId)?.intake?.activeFormId===template.id),
              }))}
              applicants={unreviewedRoleApplicants.map(applicant=>{
                let answers:Record<string,string>={}
                try{answers=JSON.parse(applicant.answers)}catch{}
                return {...applicant,questions:intakeQuestions(applicant.questions),answers,organizationName:org?.name??'Our organization'}
              })}
              program={{id:program.id,name:program.name}}
              scope={params.id}
              organizationAddress={organizationAddress}
              defaultDurationMinutes={program.defaultDurationMinutes}
              defaultVisibility={program.defaultVisibility}
              redirectTo={programHref+'?section=positions'}
            />,
            scheduling: <>          <ProgramRosterScheduler
            volunteers={schedulingVolunteers}
            staff={activeStaff}
            shifts={rosterSchedulingShifts}
            recurringShifts={recurringShiftPlans}
            plannedRecurringVolunteers={plannedRecurringVolunteers}
            plannedRecurringStaff={activePlannedRecurringStaff}
            programName={program.name}
            programId={params.id}
            headerActions={<ScheduleNewShiftButton
              programId={program.id}
              redirectTo={programHref+'?section=scheduling'}
              suggestedStartsAt={now + 24 * 60 * 60 * 1000}
              defaultLocation={organizationAddress}
              defaultCapacity={2}
              buttonLabel="Schedule shift"
              defaultVisibility={program.defaultVisibility}
              defaultDurationMinutes={program.defaultDurationMinutes}
              templates={standardTemplates.map(({task,sessions})=>({
                id:task.id,
                title:task.title,
                description:task.description,
                location:task.location,
                capacity:task.slots,
                durationMinutes:task.defaultDurationMinutes,
                visibility:sessions.find(({shift})=>shift.status==='open')?.shift.visibility??program.defaultVisibility,
              }))}
            />}
          />

          <section id="program-schedule" className={`${styles.programDetailSection} ${styles.programDetailSchedule}`}>
            <div className={styles.programDetailHeading}><div><p className={styles.eyebrow}>Active schedule</p><h2>Upcoming program work</h2></div></div>
            {publishedEvents.length ? <div className={styles.programScheduleList}>{publishedEvents.map(({ shift, taken, slotsLeft }) => {
              const access = shift.visibility === 'private' ? 'Private roster' : 'Public signup'
              const shiftName = shiftDisplayName(shift.label, shift.startsAt)
              return <article key={shift.id}>
                <span><CalendarDays size={17} /></span>
                <div><b>{shiftName}</b><p>{formatDateTime(shift.startsAt)} · {access}</p><small>{taken} of {shift.capacity} filled{shift.visibility === 'public' ? ` · ${slotsLeft} open` : ''}</small></div>
                <div className={styles.programScheduleActions}>
                  {shift.visibility === 'private' ? <ShiftRosterAssignmentButton shiftId={shift.id} title={shiftName} capacity={shift.capacity} taken={taken} visibility={shift.visibility} volunteers={roster.volunteers} redirectTo={programHref+'?section=scheduling'} /> : null}
                  <form action={cancelShiftAndNotifyAction}><input type="hidden" name="shiftId" value={shift.id} /><input type="hidden" name="redirectTo" value={programHref+'?section=scheduling'} /><button type="submit" className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton} ${styles.opportunityShiftCancel}`}><XCircle size={14} /> Cancel &amp; notify</button></form>
                </div>
              </article>
              })}</div> : <p className={styles.programDetailEmpty}>No upcoming work is scheduled. Use the Schedule Shift button when the next date is ready.</p>}
          </section>

</>,
            recognition: <ProgramRecognitionPanel orgId={orgId} scope={params.id} taskIds={standardTemplates.map(({ task })=>task.id)}/>,
          }}/>
          </div>

        </section>
      </div>
    </main>
  )
}
