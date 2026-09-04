import Link from 'next/link'
import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm'
import { ArrowLeft, CalendarDays, CheckCircle2, FileText, Repeat2, UsersRound, XCircle } from 'lucide-react'
import { cancelOnboardingSessionAction, cancelShiftAndNotifyAction } from '@/app/actions'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { claims, orgs, plannedRecurringAssignments, recurringEventSchedules, shiftStaffAssignments, tasks } from '@/lib/db/schema'
import { getShiftsWithCounts } from '@/lib/services/opportunities'
import { getOrganizationDocuments } from '@/lib/services/organization-documents'
import { getOnboardingWaiverSetup } from '@/lib/services/waivers'
import { getVolunteerPrograms } from '@/lib/services/volunteer-programs'
import { getRoster } from '@/lib/services/roster'
import { listOrganizationDelegations } from '@/lib/services/identity-access'
import { LabHeader } from '../../../LabHeader'
import { getLabWorkspace } from '../../../lab-workspace'
import { IssuerLabSidebar } from '../../IssuerLabSidebar'
import { AddOnboardingSessionButton } from '../../AddOnboardingSessionButton'
import { CreateOpportunityTemplateButton } from '../../CreateOpportunityTemplateButton'
import { DocumentCreateButton } from '../../DocumentCreateButton'
import { ManageOnboardingSessionButton } from '../../ManageOnboardingSessionButton'
import { ManageOpportunityTemplateButton } from '../../ManageOpportunityTemplateButton'
import { PublishOnboardingSessionButton } from '../../PublishOnboardingSessionButton'
import { PublishTemplateEventButton } from '../../PublishTemplateEventButton'
import { CollapsibleShiftPlanningCard } from '../../CollapsibleShiftPlanningCard'
import { ProgramRosterScheduler } from '../../ProgramRosterScheduler'
import { ProgramSettingsButton } from '../../ProgramSettingsButton'
import { ShiftRosterAssignmentButton } from '../../ShiftRosterAssignmentButton'
import { WaiverCreateButton } from '../../WaiverCreateButton'
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

export default async function IssuerVolunteerProgramDetailsPage({ params }: { params: { id: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const isOrganizationArea = params.id === 'organization'
  const [org, programs, taskRows, documents, waiverSetup, roster, delegations] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    getVolunteerPrograms(orgId),
    city
      ? db.select().from(tasks).where(and(
        eq(tasks.orgId, orgId),
        eq(tasks.cityId, city.id),
        isOrganizationArea ? isNull(tasks.programId) : eq(tasks.programId, params.id),
      )).orderBy(desc(tasks.createdAt))
      : Promise.resolve([]),
    getOrganizationDocuments(orgId),
    getOnboardingWaiverSetup(orgId),
    getRoster(orgId),
    listOrganizationDelegations(orgId),
  ])
  const program = isOrganizationArea
    ? {
      id: null,
      name: 'Organization',
      description: 'Shared templates, onboarding sessions, and resources available across your organization.',
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
  const onboardingTemplates = taskShifts.filter(({ task }) => task.isOnboarding === 1)
  const recurringShiftSchedules = standardTemplates.length
    ? await db.select().from(recurringEventSchedules).where(and(
      eq(recurringEventSchedules.orgId, orgId),
      eq(recurringEventSchedules.active, 1),
      inArray(recurringEventSchedules.taskId, standardTemplates.map(({ task }) => task.id)),
    ))
    : []
  const plannedRecurringVolunteers = recurringShiftSchedules.length
    ? await db.select({ taskId: plannedRecurringAssignments.taskId, occurrenceStartsAt: plannedRecurringAssignments.occurrenceStartsAt, userId: plannedRecurringAssignments.userId })
      .from(plannedRecurringAssignments)
      .where(and(
        eq(plannedRecurringAssignments.orgId, orgId),
        eq(plannedRecurringAssignments.status, 'planned'),
        inArray(plannedRecurringAssignments.taskId, recurringShiftSchedules.map((schedule) => schedule.taskId)),
      ))
    : []
  const publishedEvents = taskShifts.flatMap(({ task, sessions }) => sessions
    .filter(({ shift }) => shift.status === 'open' && !hasEnded(shift.endsAt, shift.startsAt))
    .map(({ shift, taken, slotsLeft }) => ({ task, shift, taken, slotsLeft })))
    .sort((a, b) => (a.shift.startsAt ?? Number.MAX_SAFE_INTEGER) - (b.shift.startsAt ?? Number.MAX_SAFE_INTEGER))
  const pastEvents = taskShifts.flatMap(({ task, sessions }) => sessions
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
  const programDocuments = documents.filter((document) => document.programId === program.id)
  const programWaivers = waiverSetup.waivers.filter((waiver) => waiver.programId === program.id)
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
  const planningShiftCount = planningShiftIds.length
  const programCapabilities = [
    {
      label: 'Resources',
      detail: programDocuments.length + programWaivers.length ? `${programDocuments.length + programWaivers.length} available` : 'Not configured',
      active: programDocuments.length + programWaivers.length > 0,
      href: '#program-resources',
      icon: FileText,
      primary: false,
    },
    {
      label: 'Onboarding',
      detail: onboardingTemplates.length ? `${onboardingTemplates.length} pathway${onboardingTemplates.length === 1 ? '' : 's'}` : 'Optional',
      active: onboardingTemplates.length > 0,
      href: '#program-onboarding',
      icon: Repeat2,
      primary: false,
    },
    {
      label: 'Opportunity templates',
      detail: standardTemplates.length ? `${standardTemplates.length} template${standardTemplates.length === 1 ? '' : 's'}` : 'Not configured',
      active: standardTemplates.length > 0,
      href: '#program-opportunities',
      icon: UsersRound,
      primary: false,
    },
    {
      label: 'Shift planning',
      detail: planningShiftCount ? `${planningShiftCount} published shift${planningShiftCount === 1 ? '' : 's'}` : 'Ready when needed',
      active: planningShiftCount > 0,
      href: '#program-staffing',
      icon: UsersRound,
      primary: false,
    },
    {
      label: 'Active schedule',
      detail: publishedEvents.length ? `${publishedEvents.length} upcoming` : 'Nothing published',
      active: publishedEvents.length > 0,
      href: '#program-schedule',
      icon: CalendarDays,
      primary: false,
    },
  ]
  const nextProgramAction = !standardTemplates.length
    ? { label: 'Create an opportunity template', detail: 'Define repeatable work before publishing a dated shift.', href: '#program-opportunities' }
    : !publishedEvents.length
      ? { label: 'Publish the next shift', detail: 'Your templates are ready. Add the next date volunteers can participate.', href: '#program-opportunities' }
      : programDocuments.length + programWaivers.length === 0
        ? { label: 'Add program resources', detail: 'Attach the guidance volunteers need before they arrive.', href: '#program-resources' }
        : {
          label: 'Review upcoming work',
          detail: `${publishedEvents.length} upcoming event${publishedEvents.length === 1 ? ' is' : 's are'} ready for coordination.`,
          href: '#program-schedule',
        }
  const defaultLocation = program.defaultLocation || standardTemplates[0]?.task.location || onboardingTemplates[0]?.task.location || ''
  const taskOptions = taskRows.map((task) => ({ id: task.id, title: task.title }))
  const rosterSchedulingShifts = publishedEvents
    .filter(({ task, shift }) => task.isOnboarding !== 1 && Boolean(shift.startsAt && shift.startsAt > now))
    .map(({ task, shift }) => ({
      id: shift.id,
      taskId: task.id,
      title: task.title,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      location: task.location,
      capacity: task.slots,
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
      taskId: task.id,
      title: task.title,
      location: task.location,
      capacity: task.slots,
      visibility: schedule.visibility,
      intervalDays: schedule.intervalDays,
      nextStartsAt: schedule.nextStartsAt,
      durationMinutes: schedule.durationMinutes,
    }]
  })
  const impactMetrics = [
    { label: 'Verified contributions', value: verifiedContributions, detail: 'Completed participation recorded' },
    { label: 'Volunteers involved', value: participatingVolunteers, detail: 'People who signed up or participated' },
    { label: 'Events completed', value: pastEvents.length, detail: 'Past sessions retained' },
    { label: 'Upcoming events', value: publishedEvents.length, detail: 'Currently visible to volunteers' },
  ]

  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
        <section className={styles.issuerMain} aria-label={`${program.name} details`}>
          <section className={styles.issuerPageHero}>
            <div><p className={styles.eyebrow}>Workspace · Volunteer Programs</p><h1>{program.name}</h1><p>{program.description || 'This program brings its volunteer work, resources, and participation history together in one place.'}</p></div>
            <Link href={workspaceHref} className={styles.catalogWorkspaceAction}><ArrowLeft size={15} /> Workspace</Link>
          </section>

          <section className={styles.programControlCenterCard}>
            <div className={styles.programControlCenterHeading}>
              <div><p className={styles.eyebrow}>Program control center</p><h2>Build, schedule, and grow this program in one place.</h2><p>Use this Program to keep its templates, staffing, volunteer welcome, resources, schedule, and history together.</p></div>
              <div className={styles.programControlCenterActions}>
                {!isOrganizationArea ? <ProgramSettingsButton program={{
                  id: program.id!,
                  name: program.name,
                  defaultVisibility: program.defaultVisibility,
                  defaultLocation: program.defaultLocation,
                  defaultCapacity: program.defaultCapacity,
                  defaultDurationMinutes: program.defaultDurationMinutes,
                  onboardingPreference: program.onboardingPreference,
                }} redirectTo={programHref} /> : null}
                <Link className={styles.catalogWorkspaceAction} href={nextProgramAction.href}>{nextProgramAction.label}</Link>
              </div>
            </div>
            <div className={styles.programCapabilityGrid}>
              {programCapabilities.map((capability) => {
                const Icon = capability.icon
                return <Link href={capability.href} key={capability.label} data-active={capability.active} data-primary={capability.primary}>
                  <span><Icon size={16} /></span>
                  <div><b>{capability.label}</b><small>{capability.detail}</small></div>
                  {capability.active ? <CheckCircle2 size={15} /> : null}
                </Link>
              })}
            </div>
            <div className={styles.programLifecycle} aria-label="Standard volunteer-work lifecycle">
              <span><b>1</b> Prepare a template</span><i aria-hidden="true">→</i><span><b>2</b> Schedule a shift</span><i aria-hidden="true">→</i><span><b>3</b> Fill or assign spots</span><i aria-hidden="true">→</i><span><b>4</b> Verify participation</span>
            </div>
            <div className={styles.programNextStep}>
              <div><p className={styles.eyebrow}>Recommended next step</p><h3>{nextProgramAction.label}</h3><span>{nextProgramAction.detail}</span></div>
              {publishedEvents[0] ? <Link href="#program-schedule"><CalendarDays size={16} /><span><b>{publishedEvents[0].task.title}</b><small>{formatDate(publishedEvents[0].shift.startsAt)}</small></span></Link> : null}
            </div>
          </section>

          <div className={styles.programOperationsLayout}>
          <div className={styles.programDetailGrid}>
            <section id="program-opportunities" className={styles.programDetailSection}>
              <div className={styles.programDetailHeading}>
                <div><p className={styles.eyebrow}>Opportunity templates</p><h2>Work this program makes possible</h2></div>
                <div className={styles.programDetailHeadingActions}><CreateOpportunityTemplateButton programId={program.id} programName={program.name} defaultLocation={defaultLocation} defaultCapacity={program.defaultCapacity} defaultDurationMinutes={program.defaultDurationMinutes} redirectTo={programHref} /></div>
              </div>
              {standardTemplates.length ? <div className={styles.programDetailList}>{standardTemplates.map(({ task, sessions }) => {
                const upcoming = sessions.filter(({ shift }) => shift.status === 'open' && !hasEnded(shift.endsAt, shift.startsAt)).length
              return <article key={task.id}><CalendarDays size={17} /><div><b>{task.title}</b><p>{task.description || 'Volunteer opportunity template'}</p><small>{upcoming} upcoming shift{upcoming === 1 ? '' : 's'}</small></div><div className={styles.programDetailItemActions}><ManageOpportunityTemplateButton task={task} program={program} redirectTo={programHref} /><PublishTemplateEventButton templates={task.status === 'open' ? [{ id: task.id, title: task.title, capacity: task.slots, defaultDurationMinutes: task.defaultDurationMinutes }] : []} volunteers={roster.volunteers} redirectTo={programHref} suggestedStartsAt={now + 24 * 60 * 60 * 1000} defaultVisibility={program.defaultVisibility} defaultDurationMinutes={program.defaultDurationMinutes} /></div></article>
              })}</div> : <p className={styles.programDetailEmpty}>No opportunity templates are assigned to this program yet. Create one here when the work becomes repeatable.</p>}
            </section>

            <section id="program-onboarding" className={styles.programDetailSection}>
              <div className={styles.programDetailHeading}>
                <div><p className={styles.eyebrow}>Onboarding</p><h2>Welcome pathways</h2></div>
                <div className={styles.programDetailHeadingActions}><AddOnboardingSessionButton defaultLocation={defaultLocation} programs={programs} defaultProgramId={program.id} lockProgramContext={isOrganizationArea} activeProgramName={program.name} redirectTo={programHref} /></div>
              </div>
              {onboardingTemplates.length ? <div className={styles.programDetailList}>{onboardingTemplates.map(({ task, sessions }) => {
                const activeSessions = sessions.filter(({ shift }) => shift.status === 'open' && !hasEnded(shift.endsAt, shift.startsAt)).sort((a, b) => (a.shift.startsAt ?? 0) - (b.shift.startsAt ?? 0))
                const activeSession = activeSessions[0] ?? null
                const durationMinutes = activeSession?.shift.startsAt && activeSession.shift.endsAt ? Math.max(30, Math.round((activeSession.shift.endsAt - activeSession.shift.startsAt) / 60_000)) : 45
                const suggestedStartsAt = activeSession?.shift.startsAt ? activeSession.shift.startsAt + 7 * 24 * 60 * 60 * 1000 : now + 7 * 24 * 60 * 60 * 1000
                return <article key={task.id}><Repeat2 size={17} /><div><b>{task.title}</b><p>{activeSessions.length ? 'An active onboarding date is available.' : 'No active onboarding date is published.'}</p><small>{sessions.length} total session{sessions.length === 1 ? '' : 's'} retained</small></div><div className={styles.programDetailItemActions}><ManageOnboardingSessionButton task={task} nextStartsAt={activeSession?.shift.startsAt ?? null} durationMinutes={durationMinutes} weeklyCapacity={activeSession?.shift.capacity ?? task.slots} programs={programs} redirectTo={programHref} lockedProgram={program} /><PublishOnboardingSessionButton taskId={task.id} redirectTo={programHref} suggestedStartsAt={suggestedStartsAt} existingFutureSessions={activeSessions.length} /></div></article>
              })}</div> : <p className={styles.programDetailEmpty}>{program.onboardingPreference === 'not_needed' ? 'This program is configured without onboarding. You can still add a welcome pathway at any time.' : program.onboardingPreference === 'recommended' ? 'Onboarding is recommended for this program. Add the welcome pathway volunteers should complete first.' : 'Onboarding is optional. Add a welcome pathway here if this program needs one.'}</p>}
            </section>
          </div>

          <CollapsibleShiftPlanningCard actions={<PublishTemplateEventButton
            templates={standardTemplates.filter(({ task }) => task.status === 'open').map(({ task }) => ({ id: task.id, title: task.title, capacity: task.slots, defaultDurationMinutes: task.defaultDurationMinutes }))}
            volunteers={roster.volunteers}
            redirectTo={programHref}
            suggestedStartsAt={now + 24 * 60 * 60 * 1000}
            buttonLabel="Schedule shift"
            defaultVisibility="private"
            defaultDurationMinutes={program.defaultDurationMinutes}
          />}>
            <ProgramRosterScheduler volunteers={roster.volunteers} staff={activeStaff} shifts={rosterSchedulingShifts} recurringShifts={recurringShiftPlans} plannedRecurringVolunteers={plannedRecurringVolunteers} programName={program.name} programId={params.id} />
          </CollapsibleShiftPlanningCard>

          <section id="program-schedule" className={`${styles.programDetailSection} ${styles.programDetailSchedule}`}>
            <div className={styles.programDetailHeading}><div><p className={styles.eyebrow}>Active schedule</p><h2>Upcoming program work</h2></div></div>
            {publishedEvents.length ? <div className={styles.programScheduleList}>{publishedEvents.map(({ task, shift, taken, slotsLeft }) => {
              const isFuture = Boolean(shift.startsAt && shift.startsAt > now)
              const access = shift.visibility === 'private' ? 'Private roster' : 'Public signup'
              return <article key={shift.id}>
                <span><CalendarDays size={17} /></span>
                <div><b>{task.title}</b><p>{formatDateTime(shift.startsAt)} · {access}</p><small>{taken} of {shift.capacity} filled{shift.visibility === 'public' ? ` · ${slotsLeft} open` : ''}</small></div>
                <div className={styles.programScheduleActions}>
                  {shift.visibility === 'private' && task.isOnboarding !== 1 ? <ShiftRosterAssignmentButton shiftId={shift.id} title={task.title} capacity={shift.capacity} taken={taken} visibility={shift.visibility} volunteers={roster.volunteers} redirectTo={programHref} /> : null}
                  {isFuture ? <form action={task.isOnboarding === 1 ? cancelOnboardingSessionAction : cancelShiftAndNotifyAction}><input type="hidden" name="shiftId" value={shift.id} /><input type="hidden" name="redirectTo" value={programHref} /><button type="submit" className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton} ${styles.opportunityShiftCancel}`}><XCircle size={14} /> Cancel &amp; notify</button></form> : <Link className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton} ${styles.opportunityShiftVerify}`} href={`/aesthetic-lab/issuer/shifts/${shift.id}/verify`}><CheckCircle2 size={14} /> Verify &amp; Close</Link>}
                </div>
              </article>
              })}</div> : <p className={styles.programDetailEmpty}>No upcoming work is published. Use a template above to publish the next shift.</p>}
          </section>

          <div className={styles.programDetailGrid}>
            <section id="program-resources" className={styles.programDetailSection}>
              <div className={styles.programDetailHeading}>
                <div><p className={styles.eyebrow}>Program resources</p><h2>Documents and waivers</h2></div>
                <div className={`${styles.programDetailHeadingActions} ${styles.programResourceActions}`}>
                  <DocumentCreateButton tasks={taskOptions} programs={programs} defaultProgramId={program.id} lockProgramContext={isOrganizationArea} activeProgramName={program.name} redirectTo={programHref} buttonLabel="Add Document" />
                  <WaiverCreateButton programs={programs} defaultProgramId={program.id} lockProgramContext={isOrganizationArea} activeProgramName={program.name} redirectTo={programHref} buttonLabel="Add Waiver" />
                </div>
              </div>
              {programDocuments.length || programWaivers.length ? <div className={styles.programDetailList}>{programDocuments.map((document) => <article key={document.id}><FileText size={17} /><div><b>{document.title}</b><p>{document.category === 'guide' ? 'Volunteer guide' : document.category === 'safety' ? 'Safety & operations document' : 'Additional document'}</p><small>Updated {formatDate(document.updatedAt)}</small></div><Link href={`/aesthetic-lab/issuer/documents/${document.id}`}>View</Link></article>)}{programWaivers.map((waiver) => <article key={waiver.id}><FileText size={17} /><div><b>{waiver.title}</b><p>Liability waiver</p><small>Added {formatDate(waiver.createdAt)}</small></div><Link href="/aesthetic-lab/issuer/waiver">View</Link></article>)}</div> : <p className={styles.programDetailEmpty}>No documents or waivers are assigned to this program.</p>}
            </section>

            <section className={styles.programDetailSection}>
              <div className={styles.programDetailHeading}><div><p className={styles.eyebrow}>Program history</p><h2>Completed events</h2></div></div>
              {pastEvents.length ? <div className={styles.programDetailList}>{pastEvents.slice(0, 8).map(({ task, shift, taken }) => <article key={shift.id}><CheckCircle2 size={17} /><div><b>{task.title}</b><p>{formatDate(shift.startsAt)} · {taken} participant{taken === 1 ? '' : 's'} recorded</p><small>{shift.label || 'Completed volunteer event'}</small></div><Link href={`/aesthetic-lab/issuer/opportunities/${task.id}`}>View</Link></article>)}</div> : <p className={styles.programDetailEmpty}>Completed events will collect here as this program grows.</p>}
            </section>
          </div>
          </div>

          <section className={styles.programDetailImpactCard}>
            <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Program impact</p><h2>Progress at a glance</h2><p>This summary is specific to {program.name} in {city?.name ?? 'your active city'}.</p></div><CheckCircle2 size={19} /></div>
            <div className={styles.programDetailMetricGrid}>{impactMetrics.map((metric) => <article key={metric.label}><strong>{metric.value.toLocaleString()}</strong><b>{metric.label}</b><span>{metric.detail}</span></article>)}</div>
          </section>
        </section>
      </div>
    </main>
  )
}
