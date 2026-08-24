import Link from 'next/link'
import { and, desc, eq, inArray, ne } from 'drizzle-orm'
import {
  CalendarDays,
  CheckCircle2,
  FileText,
  FolderKanban,
  MapPin,
  Repeat2,
  UsersRound,
  XCircle,
} from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { cancelOnboardingSessionAction, cancelShiftAndNotifyAction } from '@/app/actions'
import { db } from '@/lib/db/client'
import { claims, orgs, tasks, users } from '@/lib/db/schema'
import { getShiftsWithCounts } from '@/lib/services/opportunities'
import { getEditorProfile } from '@/lib/services/profile'
import { participantDisplayName } from '@/lib/participant-name'
import { getOnboardingWaiverSetup } from '@/lib/services/waivers'
import {
  attendanceLabel,
  getOnboardingSessionParticipants,
  waiverLabel,
} from '@/lib/services/onboarding-attendance'
import type { OnboardingParticipant } from '@/lib/services/onboarding-attendance'
import {
  getOrganizationDocuments,
  ORGANIZATION_DOCUMENT_CATEGORIES,
  ORGANIZATION_DOCUMENT_CATEGORY_DETAILS,
} from '@/lib/services/organization-documents'
import { getOrganizationResourcePublicationMap, getWaiverTaskIdsByWaiver, resourceKey } from '@/lib/services/organization-resources'
import { LabHeader } from '../../LabHeader'
import { getLabWorkspace } from '../../lab-workspace'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import { IssuerWorkspaceMenu } from '../IssuerWorkspaceMenu'
import { PublishOnboardingSessionButton } from '../PublishOnboardingSessionButton'
import { PublishTemplateEventButton } from '../PublishTemplateEventButton'
import { DocumentCreateButton } from '../DocumentCreateButton'
import { DocumentOverflowActions } from '../DocumentOverflowActions'
import { ManageOnboardingSessionButton } from '../ManageOnboardingSessionButton'
import { AddOnboardingSessionButton } from '../AddOnboardingSessionButton'
import { VolunteerProgramCreateButton } from '../VolunteerProgramCreateButton'
import { getVolunteerPrograms } from '@/lib/services/volunteer-programs'
import { getRoster } from '@/lib/services/roster'
import { ShiftRosterAssignmentButton } from '../ShiftRosterAssignmentButton'
import { CreateOpportunityTemplateButton } from '../CreateOpportunityTemplateButton'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

type EventParticipant = {
  userId: string
  displayName: string
  status: string
  isNoShow: boolean
}

function EventParticipantList({ participants, mode }: { participants: EventParticipant[]; mode: 'upcoming' | 'past' }) {
  const heading = mode === 'upcoming' ? 'Current sign-ups' : 'Past participants'
  const empty = mode === 'upcoming' ? 'No one has signed up for this session yet.' : 'No participant records were created for this event.'
  return <div className={styles.catalogEventParticipants}>
    <div className={styles.catalogEventParticipantsHeading}><b>{heading}</b><span>{participants.length} {participants.length === 1 ? 'person' : 'people'}</span></div>
    {participants.length ? participants.map((participant) => <article key={participant.userId} className={participant.isNoShow ? styles.catalogEventParticipantNoShow : undefined}>
      <span>{participant.displayName.slice(0, 2).toUpperCase()}</span>
      <div><b>{participant.displayName}</b><small>{participant.status}</small></div>
      <Link href={`/aesthetic-lab/issuer/volunteers/${participant.userId}`}>View profile</Link>
    </article>) : <p>{empty}</p>}
  </div>
}

type OnboardingSessionRow = Awaited<ReturnType<typeof getShiftsWithCounts>>[number]

function OnboardingSessionDetails({
  session,
  participants,
  referenceTime,
}: {
  session: OnboardingSessionRow
  participants: OnboardingParticipant[]
  referenceTime: number
}) {
  const { shift, taken } = session
  const isUpcoming = shift.status === 'open' && Boolean(shift.startsAt && shift.startsAt > referenceTime)
  return <details className={styles.onboardingSessionDetails}>
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
          <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/catalog?workspace=onboarding" />
          <button type="submit"><XCircle size={14} /> Cancel &amp; notify</button>
        </form>
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

export default async function IssuerCatalogLabPage({ searchParams }: { searchParams: { workspace?: string; event?: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const [org, taskRows] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    city
      ? db.select().from(tasks).where(and(eq(tasks.orgId, orgId), eq(tasks.cityId, city.id))).orderBy(desc(tasks.createdAt))
      : Promise.resolve([]),
  ])
  const [profile, waiverSetup, documents, waiverTaskIds, resourcePublicationMap, volunteerPrograms, roster] = await Promise.all([
    org ? getEditorProfile(org) : Promise.resolve(null),
    org ? getOnboardingWaiverSetup(org.id) : Promise.resolve({ waiver: null, waivers: [], method: null }),
    org ? getOrganizationDocuments(org.id) : Promise.resolve([]),
    org ? getWaiverTaskIdsByWaiver(org.id) : Promise.resolve(new Map<string, string[]>()),
    org ? getOrganizationResourcePublicationMap(org.id) : Promise.resolve(new Map<string, ('profile' | 'volunteer_resources')[]>()),
    org ? getVolunteerPrograms(org.id) : Promise.resolve([]),
    org ? getRoster(org.id) : Promise.resolve({ volunteers: [], taskGroups: [], counts: { total: 0, active: 0, needsWaiver: 0 } }),
  ])
  const taskShifts = await Promise.all(taskRows.map(async (task) => ({ task, sessions: await getShiftsWithCounts(task.id) })))
  const referenceTime = Date.now()
  const sessionHasEnded = (endsAt: number | null, startsAt: number | null) => {
    const effectiveEnd = endsAt ?? startsAt
    return effectiveEnd !== null && effectiveEnd < referenceTime
  }
  const onboardingSeries = taskShifts.filter(({ task }) => task.isOnboarding === 1)
  const onboardingParticipantMaps = new Map<string, Map<string, OnboardingParticipant[]>>(
    await Promise.all(onboardingSeries.map(async ({ task, sessions }) => [
      task.id,
      await getOnboardingSessionParticipants({ orgId, taskId: task.id, shiftIds: sessions.map(({ shift }) => shift.id) }),
    ] as const)),
  )
  const onboardingSeriesViews = onboardingSeries.map(({ task, sessions }) => {
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
      participants: onboardingParticipantMaps.get(task.id) ?? new Map<string, OnboardingParticipant[]>(),
    }
  })
  const pastOnboardingSessions = onboardingSeriesViews
    .flatMap((series) => series.pastSessions.map((session) => ({
      session,
      participants: series.participants.get(session.shift.id) ?? [],
    })))
    .sort((a, b) => (b.session.shift.startsAt ?? 0) - (a.session.shift.startsAt ?? 0))
  const onboardingProgramAreas = [
    {
      id: null,
      name: 'Organization',
      description: 'Onboarding sessions that welcome volunteers into your organization as a whole.',
      sessions: onboardingSeriesViews.filter((series) => !series.task.programId),
    },
    ...volunteerPrograms.map((program) => ({
      id: program.id,
      name: program.name,
      description: program.description || 'A flexible area for this organization to organize related volunteer work.',
      sessions: onboardingSeriesViews.filter((series) => series.task.programId === program.id),
    })),
  ]
  // Onboarding has its own dedicated workspace area and should not duplicate
  // itself in the reusable opportunity-template library.
  const opportunityTemplates = taskShifts.filter(({ task }) => task.isOnboarding !== 1)
  const publishedSessions = opportunityTemplates
    .flatMap(({ task, sessions }) => sessions
      .filter(({ shift }) => shift.status === 'open' && task.status === 'open' && !sessionHasEnded(shift.endsAt, shift.startsAt))
      .map(({ shift, taken, slotsLeft }) => ({ task, shift, taken, slotsLeft })))
    .sort((a, b) => (a.shift.startsAt ?? Number.MAX_SAFE_INTEGER) - (b.shift.startsAt ?? Number.MAX_SAFE_INTEGER))
  const eventShiftIds = Array.from(new Set(publishedSessions.map(({ shift }) => shift.id)))
  const eventParticipantRows = eventShiftIds.length
    ? await db
        .select({ claim: claims, participant: users })
        .from(claims)
        .innerJoin(users, eq(claims.userId, users.id))
        .where(and(inArray(claims.shiftId, eventShiftIds), ne(claims.status, 'unclaimed')))
    : []
  const eventParticipantsByShift = new Map<string, EventParticipant[]>()
  for (const { claim, participant } of eventParticipantRows) {
    if (!claim.shiftId) continue
    const status = claim.status === 'no_show'
      ? 'No-show'
      : claim.status === 'verified'
        ? 'Attendance verified'
        : claim.status === 'submitted'
          ? 'Completion submitted'
          : claim.checkedInAt
            ? 'Checked in'
            : 'Signed up'
    const list = eventParticipantsByShift.get(claim.shiftId) ?? []
    list.push({ userId: participant.id, displayName: participantDisplayName(participant), status, isNoShow: claim.status === 'no_show' })
    eventParticipantsByShift.set(claim.shiftId, list)
  }
  for (const participants of Array.from(eventParticipantsByShift.values())) {
    participants.sort((a, b) => a.displayName.localeCompare(b.displayName))
  }
  const totalOpenSpots = publishedSessions
    .filter(({ shift }) => shift.visibility === 'public' && shift.enrollmentMode === 'open_claims')
    .reduce((total, item) => total + item.slotsLeft, 0)
  const opportunityProgramViews = [
    {
      id: null,
      name: 'Organization',
      description: 'Templates that have not yet been tagged to a volunteer program.',
      templates: opportunityTemplates.filter(({ task }) => !task.programId),
    },
    ...volunteerPrograms.map((program) => ({
      id: program.id,
      name: program.name,
      description: program.description || 'A flexible area for this organization to organize related volunteer work.',
      templates: opportunityTemplates.filter(({ task }) => task.programId === program.id),
    })),
  ]
  const hasWaiver = Boolean(waiverSetup.waivers.length && waiverSetup.method)
  const volunteerProgramViews = volunteerPrograms.map((program) => {
    const programTaskShifts = taskShifts.filter(({ task }) => task.programId === program.id)
    const opportunityTemplatesForProgram = programTaskShifts.filter(({ task }) => task.isOnboarding !== 1)
    const onboardingForProgram = programTaskShifts.filter(({ task }) => task.isOnboarding === 1)
    const documentsForProgram = documents.filter((document) => document.programId === program.id)
    const waiversForProgram = waiverSetup.waivers.filter((waiver) => waiver.programId === program.id)
    const pastEventsForProgram = programTaskShifts
      .flatMap(({ task, sessions }) => sessions
        .filter(({ shift }) => sessionHasEnded(shift.endsAt, shift.startsAt))
        .map(({ shift }) => ({ task, shift })))
      .sort((a, b) => (b.shift.startsAt ?? 0) - (a.shift.startsAt ?? 0))
    return {
      program,
      opportunityTemplates: opportunityTemplatesForProgram,
      onboarding: onboardingForProgram,
      documents: documentsForProgram,
      waivers: waiversForProgram,
      pastEvents: pastEventsForProgram,
    }
  })
  const initialWorkspaceSection = searchParams.workspace === 'programs' || searchParams.workspace === 'onboarding' || searchParams.workspace === 'opportunities'
    ? searchParams.workspace
    : 'documentation'
  const documentationLibrary = [
    ...waiverSetup.waivers.map((waiver) => ({
      id: waiver.id,
      area: 'Liability waiver',
      title: waiver.title,
      timestamp: waiver.createdAt,
      href: '/aesthetic-lab/issuer/waiver',
      attached: Boolean(waiver.documentUrl),
      taskIds: waiverTaskIds.get(waiver.id) ?? [],
      kind: 'waiver' as const,
      programId: waiver.programId,
      publications: resourcePublicationMap.get(resourceKey('waiver', waiver.id)) ?? [],
    })),
    ...documents.map((document) => ({
      id: document.id,
      area: ORGANIZATION_DOCUMENT_CATEGORY_DETAILS[document.category].label,
      title: document.title,
      timestamp: document.updatedAt,
      href: `/aesthetic-lab/issuer/documents?category=${document.category}`,
      attached: Boolean(document.documentUrl),
      taskIds: document.taskIds,
      kind: 'document' as const,
      programId: document.programId,
      publications: resourcePublicationMap.get(resourceKey('document', document.id)) ?? [],
    })),
  ]
  const documentProgramAreas = [
    {
      id: null,
      name: 'Organization',
      description: 'Documents available across your organization and not assigned to a specific volunteer program.',
      documents: documentationLibrary.filter((document) => !document.programId),
    },
    ...volunteerPrograms.map((program) => ({
      id: program.id,
      name: program.name,
      description: program.description || 'Documents connected to this area of volunteer work.',
      documents: documentationLibrary.filter((document) => document.programId === program.id),
    })),
  ]

  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />

          <section className={styles.issuerMain} aria-label="Workspace">
          <section className={styles.issuerPageHero}>
            <div><p className={styles.eyebrow}>Workspace</p><h1>Make it easy to say yes.</h1><p>Turn repeatable work into clear, shareable opportunities your volunteers can confidently claim.</p></div>
          </section>

          <IssuerWorkspaceMenu
            initialSection={initialWorkspaceSection}
            programs={<>
              <section className={styles.volunteerProgramsOverview}>
                <div><p className={styles.eyebrow}>Volunteer programs</p><h2>Organize the work around your mission.</h2><p>Programs are flexible areas of coordination. Use them for a mission area, location, project family, task group, or any structure that helps your team see the work together.</p></div>
                <VolunteerProgramCreateButton />
              </section>
              {volunteerProgramViews.length ? <div className={styles.volunteerProgramGrid}>{volunteerProgramViews.map(({ program, opportunityTemplates: programTemplates, onboarding: programOnboarding, documents: programDocuments, waivers: programWaivers, pastEvents: programPastEvents }) => <section key={program.id} className={styles.volunteerProgramCard}>
                <div className={styles.volunteerProgramHeading}><span><FolderKanban size={20} /></span><div><p className={styles.eyebrow}>Volunteer program</p><h2>{program.name}</h2><p>{program.description || 'A flexible area for this organization to organize related volunteer work.'}</p></div><Link className={styles.catalogWorkspaceAction} href={`/aesthetic-lab/issuer/programs/${program.id}`}>Program Details</Link></div>
                <div className={styles.volunteerProgramMetrics}>
                  <span><b>{programTemplates.length}</b> task template{programTemplates.length === 1 ? '' : 's'}</span>
                  <span><b>{programOnboarding.length}</b> onboarding session{programOnboarding.length === 1 ? '' : 's'}</span>
                  <span><b>{programDocuments.length + programWaivers.length}</b> document{programDocuments.length + programWaivers.length === 1 ? '' : 's'}</span>
                </div>
                <div className={styles.volunteerProgramDetails}>
                  <section><h3>Task templates</h3>{programTemplates.length ? <ul>{programTemplates.map(({ task }) => <li key={task.id}><Link href={`/aesthetic-lab/issuer/opportunities/${task.id}`}>{task.title}</Link></li>)}</ul> : <p>No opportunity templates tagged to this program yet.</p>}</section>
                  <section><h3>Onboarding</h3>{programOnboarding.length ? <ul>{programOnboarding.map(({ task }) => <li key={task.id}><Link href={`/aesthetic-lab/issuer/catalog?workspace=onboarding`}>{task.title}</Link></li>)}</ul> : <p>No onboarding sessions tagged to this program yet.</p>}</section>
                  <section><h3>Documents</h3>{programDocuments.length || programWaivers.length ? <ul>{programDocuments.map((document) => <li key={document.id}><Link href={`/aesthetic-lab/issuer/documents/${document.id}`}>{document.title}</Link></li>)}{programWaivers.map((waiver) => <li key={waiver.id}><Link href="/aesthetic-lab/issuer/waiver">{waiver.title}</Link></li>)}</ul> : <p>No documents tagged to this program yet.</p>}</section>
                  <section><h3>Program history</h3>{programPastEvents.length ? <ul>{programPastEvents.slice(0, 3).map(({ task, shift }) => <li key={shift.id}><b>{task.title}</b><small>{shift.startsAt ? new Date(shift.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Completed session'}</small></li>)}</ul> : <p>Completed events will collect here as this program grows.</p>}</section>
                </div>
              </section>)}</div> : <section className={styles.volunteerProgramsEmpty}><FolderKanban size={22} /><div><h2>Start with an area of work.</h2><p>Create a volunteer program when you want to organize a set of opportunities, onboarding sessions, and documents around the same purpose.</p></div></section>}
              <p className={styles.volunteerProgramsFootnote}>Existing documents, sessions, and opportunities remain unassigned until your organization chooses to tag them to a program.</p>
            </>}
            documentation={<>
              <section className={styles.workspaceSetupCard}>
              <div className={styles.workspaceSetupHeading}><div><p className={styles.eyebrow}>Organization setup</p><h2>Keep participant documentation ready.</h2><p>Use liability waivers whenever they fit your program, alongside the guides and operational resources your team needs.</p></div></div>
              <div className={styles.workspaceSetupSteps}>
                <article className={hasWaiver ? styles.workspaceSetupStepComplete : undefined}><span>{hasWaiver ? <CheckCircle2 size={18} /> : <FileText size={18} />}</span><div><p>Liability waivers</p><h3>{hasWaiver ? `${waiverSetup.waivers.length} active waiver${waiverSetup.waivers.length === 1 ? '' : 's'} ready` : 'Add a liability waiver'}</h3><small>{hasWaiver ? 'Each active waiver is included automatically with future onboarding sessions.' : 'This is optional. Add one whenever your organization needs participant acknowledgement.'}</small></div><Link className={styles.catalogWorkspaceAction} href="/aesthetic-lab/issuer/waiver">{hasWaiver ? 'Manage waivers' : 'Add waiver'}</Link></article>
                {ORGANIZATION_DOCUMENT_CATEGORIES.map((category) => {
                  const details = ORGANIZATION_DOCUMENT_CATEGORY_DETAILS[category]
                  const count = documents.filter((document) => document.category === category).length
                  const itemName = category === 'guide' ? 'guide' : category === 'safety' ? 'safety plan' : 'additional document'
                  return <article key={category} className={count > 0 ? styles.workspaceSetupStepComplete : undefined}><span>{count > 0 ? <CheckCircle2 size={18} /> : <FileText size={18} />}</span><div><p>{details.label}</p><h3>{count > 0 ? `${count} ${count === 1 ? 'document' : 'documents'} saved` : `Add a ${itemName}`}</h3><small>{details.description}</small></div><DocumentCreateButton category={category} tasks={taskRows.map(({ id, title }) => ({ id, title }))} programs={volunteerPrograms} /></article>
                })}
              </div>
              </section>
              <section className={styles.workspaceDocumentWorkspace}>
                <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Your documents</p><h2>Everything your team has added.</h2></div></div>
                {documentProgramAreas.map((program) => <section key={program.id ?? 'organization'} className={styles.opportunityProgramSection}>
                  <div className={styles.opportunityProgramHeading}><div><p className={styles.eyebrow}>Program area</p><h2>{program.name}</h2><p>{program.description}</p></div></div>
                  {program.documents.length ? <div className={styles.workspaceDocumentProgramList}>{program.documents.map((document) => <article key={document.id}>
                    <span><FileText size={17} /></span>
                    <div><p>{document.area}</p><h3>{document.title}</h3><small>{document.attached ? 'Source file attached · ' : ''}Updated {new Date(document.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</small></div>
                    <div className={styles.workspaceDocumentActions}>
                      <Link className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} href={document.kind === 'waiver' ? document.href : `/aesthetic-lab/issuer/documents/${document.id}`}>Manage</Link>
                      <DocumentOverflowActions
                        resource={{ id: document.id, title: document.title, kind: document.kind, taskIds: document.taskIds, publications: document.publications, programId: document.programId }}
                        tasks={taskRows.map(({ id, title }) => ({ id, title }))}
                        programs={volunteerPrograms}
                      />
                    </div>
                  </article>)}</div> : <div className={styles.workspaceDocumentProgramEmpty}><FileText size={18} /><div><b>No documents in this program yet.</b><p>Add a guide, safety document, waiver, or other resource whenever it supports this area of work.</p></div></div>}
                </section>)}
              </section>
            </>}
            onboarding={<>
              <section className={`${styles.onboardingWorkspaceCard} ${styles.onboardingSessionsOverviewCard}`}>
                <div className={styles.onboardingWorkspaceHeading}>
                  <span><Repeat2 size={20} /></span>
                  <div><p className={styles.eyebrow}>Onboarding sessions</p><h2>Build a welcome around each volunteer program.</h2><p>Create a distinct onboarding session for the programs, locations, or volunteer pathways your organization runs. Each one can have its own recurring schedule and participant history.</p></div>
                  <div className={styles.onboardingWorkspaceActions}><AddOnboardingSessionButton defaultLocation={profile?.location || ''} programs={volunteerPrograms} /></div>
                </div>
                <div className={styles.onboardingSeriesList}>
                  {onboardingSeriesViews.length ? onboardingSeriesViews.map((series) => <article key={series.task.id}>
                    <span><Repeat2 size={15} /></span><div><b>{series.task.title}</b><small>{series.upcomingSessions.length ? `${series.upcomingSessions.length} upcoming session${series.upcomingSessions.length === 1 ? '' : 's'}` : 'No upcoming dates published'}</small></div>
                  </article>) : <p>No onboarding sessions yet. Add one whenever a volunteer program would benefit from a clear first step.</p>}
                </div>
              </section>

              {onboardingProgramAreas.map((program) => <section key={program.id ?? 'organization'} className={styles.opportunityProgramSection}>
                <div className={styles.opportunityProgramHeading}>
                  <div><p className={styles.eyebrow}>Program area</p><h2>{program.name}</h2><p>{program.description}</p></div>
                  <AddOnboardingSessionButton defaultLocation={profile?.location || ''} programs={volunteerPrograms} defaultProgramId={program.id} />
                </div>
                {program.sessions.length ? <div className={styles.onboardingProgramSeriesList}>{program.sessions.map((series) => <section key={series.task.id} className={`${styles.onboardingWorkspaceCard} ${styles.onboardingSeriesCard}`}>
                  <div className={styles.onboardingWorkspaceHeading}>
                    <span><Repeat2 size={20} /></span>
                    <div><p className={styles.eyebrow}>Recurring onboarding</p><h2>{series.task.title}</h2><p>Use this card to manage the recurring dates and defaults for this specific onboarding session.</p></div>
                    <div className={styles.onboardingWorkspaceActions}>
                      <PublishOnboardingSessionButton taskId={series.task.id} redirectTo="/aesthetic-lab/issuer/catalog?workspace=onboarding" suggestedStartsAt={series.suggestedStartsAt} existingFutureSessions={series.activeSessions.length} />
                      <ManageOnboardingSessionButton task={series.task} nextStartsAt={series.activeSession?.shift.startsAt ?? null} durationMinutes={series.activeSession?.shift.startsAt && series.activeSession.shift.endsAt ? Math.max(30, Math.round((series.activeSession.shift.endsAt - series.activeSession.shift.startsAt) / 60_000)) : 45} weeklyCapacity={series.activeSession?.shift.capacity ?? series.task.slots} programs={volunteerPrograms} />
                    </div>
                  </div>
                  <div className={styles.onboardingSessionGrid}>
                    <div><span>Schedule</span><b>{series.activeSession?.shift.startsAt ? new Date(series.activeSession.shift.startsAt).toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' }) : 'No published session'}</b></div>
                    <div><span>Weekly capacity</span><b>{series.activeSession ? `${series.activeSession.shift.capacity} participants` : 'No published session'}</b></div>
                    <div><span>Default location</span><b>{series.activeSession ? series.task.location || profile?.location || 'Location TBD' : 'No published session'}</b></div>
                  </div>
                  <div className={styles.onboardingSessionHistory}>
                    <div className={styles.onboardingSessionHistoryHeading}><span>Upcoming onboarding sessions</span><small>Open a date to review sign-ups</small></div>
                    {series.upcomingSessions.length ? series.upcomingSessions.map((session) => <OnboardingSessionDetails key={session.shift.id} session={session} participants={series.participants.get(session.shift.id) ?? []} referenceTime={referenceTime} />) : <p className={styles.onboardingSessionEmpty}>No upcoming sessions are published yet.</p>}
                  </div>
                </section>)}</div> : <div className={styles.onboardingProgramEmpty}><Repeat2 size={18} /><div><b>No onboarding sessions in this program yet.</b><p>Add one when this area of work would benefit from a dedicated volunteer welcome.</p></div></div>}
              </section>)}
              <section className={`${styles.onboardingWorkspaceCard} ${styles.pastOnboardingSessionsCard}`}>
                <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Past onboarding sessions</p></div></div>
                <div className={styles.onboardingSessionHistory}>
                  {pastOnboardingSessions.length ? pastOnboardingSessions.map(({ session, participants }) => <OnboardingSessionDetails key={session.shift.id} session={session} participants={participants} referenceTime={referenceTime} />) : <p className={styles.onboardingSessionEmpty}>Completed onboarding sessions will appear here.</p>}
                </div>
              </section>
            </>}
            opportunities={<>
              <section className={styles.catalogOpportunityOverview} id="opportunities">
                <div className={styles.issuerPanelHeading}>
                  <div><p className={styles.eyebrow}>Opportunity workspace</p><h2>Organize the work by program, then publish the shifts that make it real.</h2><p>Templates remain reusable. Each dated shift can be public for Civic Participant claims or managed directly by your organization.</p></div>
                </div>
                <div className={styles.catalogOpportunityMetrics}>
                  <article><span>Opportunity templates</span><b>{opportunityTemplates.length}</b><small>reusable volunteer activities</small></article>
                  <article><span>Published shifts</span><b>{publishedSessions.length}</b><small>active across your programs</small></article>
                  <article><span>Public claim spots</span><b>{totalOpenSpots}</b><small>available to Civic Participants</small></article>
                </div>
              </section>

              {opportunityProgramViews.map((program) => <section key={program.id ?? 'organization'} className={styles.opportunityProgramSection}>
                <div className={styles.opportunityProgramHeading}>
                  <div><p className={styles.eyebrow}>Program area</p><h2>{program.name}</h2><p>{program.description}</p></div>
                  <CreateOpportunityTemplateButton programId={program.id} programName={program.name} defaultLocation={profile?.location || ''} />
                </div>
                {program.templates.length ? <div className={styles.opportunityTemplateList}>{program.templates.map(({ task, sessions }) => {
                  const liveShifts = sessions.filter(({ shift }) => shift.status === 'open' && !sessionHasEnded(shift.endsAt, shift.startsAt))
                  return <section key={task.id} className={`${styles.onboardingWorkspaceCard} ${styles.opportunityTemplateCard}`}>
                    <div className={styles.onboardingWorkspaceHeading}>
                      <span><UsersRound size={20} /></span>
                      <div><p className={styles.eyebrow}>Opportunity template</p><h2>{task.title}</h2><p>{task.description || 'No description has been added yet.'}</p></div>
                      <div className={styles.opportunityTemplateActions}><Link className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} href={`/aesthetic-lab/issuer/opportunities/${task.id}`}>Manage template</Link><PublishTemplateEventButton templates={task.status === 'open' ? [{ id: task.id, title: task.title, capacity: task.slots }] : []} volunteers={roster.volunteers} redirectTo="/aesthetic-lab/issuer/catalog?workspace=opportunities" suggestedStartsAt={referenceTime + 24 * 60 * 60 * 1000} /></div>
                    </div>
                    <div className={styles.opportunityTemplateGrid}>
                      <div><span>Default location</span><b>{task.location || profile?.location || 'Location TBD'}</b></div>
                      <div><span>Per-shift capacity</span><b>{task.slots} volunteer{task.slots === 1 ? '' : 's'}</b></div>
                      <div><span>Published shifts</span><b>{liveShifts.length} upcoming</b></div>
                    </div>
                    <section className={styles.opportunityShiftSection}>
                      <div><p className={styles.eyebrow}>Issued opportunities</p><h4>Upcoming shifts</h4></div>
                      {liveShifts.length ? <div className={styles.opportunityShiftList}>{liveShifts.map(({ shift, taken, slotsLeft }) => {
                        const participants = eventParticipantsByShift.get(shift.id) ?? []
                        const isFuture = Boolean(shift.startsAt && shift.startsAt > referenceTime)
                        const access = shift.visibility === 'private' ? 'Private roster' : shift.enrollmentMode === 'organization_managed' ? 'Public · organization-managed' : 'Public · open claims'
                        return <details key={shift.id} className={styles.opportunityShiftDetails}>
                          <summary><span><CalendarDays size={15} /></span><div><b>{shift.startsAt ? new Date(shift.startsAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Date and time to be confirmed'}</b><small>{access} · {taken} of {shift.capacity} filled{shift.visibility === 'public' && shift.enrollmentMode === 'open_claims' ? ` · ${slotsLeft} open` : ''}</small></div><i>{participants.length} rostered</i></summary>
                          <div className={styles.opportunityShiftBody}>
                            <EventParticipantList participants={participants} mode="upcoming" />
                            <div className={styles.opportunityShiftActions}>{shift.visibility === 'private' ? <ShiftRosterAssignmentButton shiftId={shift.id} title={task.title} capacity={shift.capacity} taken={taken} visibility={shift.visibility} volunteers={roster.volunteers} redirectTo="/aesthetic-lab/issuer/catalog?workspace=opportunities" /> : null}{isFuture ? <form action={cancelShiftAndNotifyAction}><input type="hidden" name="shiftId" value={shift.id} /><input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/catalog?workspace=opportunities" /><button type="submit" className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton} ${styles.opportunityShiftCancel}`}><XCircle size={14} /> Cancel &amp; notify</button></form> : null}</div>
                          </div>
                        </details>
                      })}</div> : <p className={styles.opportunityShiftEmpty}>No shifts are published from this template yet. Publish one whenever volunteers can take part.</p>}
                    </section>
                  </section>
                })}</div> : <div className={styles.opportunityProgramEmpty}><UsersRound size={18} /><div><b>No templates in this program yet.</b><p>Create a repeatable opportunity, then publish its individual shifts as your work is ready.</p></div></div>}
              </section>)}
            </>}
          />
        </section>
      </div>
    </main>
  )
}
