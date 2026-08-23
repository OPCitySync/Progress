import Link from 'next/link'
import { and, desc, eq, inArray, ne } from 'drizzle-orm'
import {
  CalendarDays,
  CheckCircle2,
  Edit3,
  FileText,
  Heart,
  Lightbulb,
  MapPin,
  MoreHorizontal,
  Plus,
  Repeat2,
  UsersRound,
  XCircle,
} from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { archiveOrganizationDocumentAction, attachOrganizationDocumentAction, cancelOnboardingSessionAction } from '@/app/actions'
import { db } from '@/lib/db/client'
import { claims, orgs, tasks, users } from '@/lib/db/schema'
import { getShiftsWithCounts } from '@/lib/services/opportunities'
import { getOrganizationVolunteerReflections, type OrganizationVolunteerReflection } from '@/lib/services/volunteer-reflections'
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
import { LabHeader } from '../../LabHeader'
import { getLabWorkspace } from '../../lab-workspace'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import { IssuerWorkspaceMenu } from '../IssuerWorkspaceMenu'
import { PublishOnboardingSessionButton } from '../PublishOnboardingSessionButton'
import { PublishTemplateEventButton } from '../PublishTemplateEventButton'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

type EventParticipant = {
  userId: string
  displayName: string
  status: string
  isNoShow: boolean
}

function VolunteerReflectionList({ reflections }: { reflections: OrganizationVolunteerReflection[] }) {
  return <section className={styles.eventReflectionList}>
    <div className={styles.eventReflectionHeading}>
      <div><p className={styles.eyebrow}>From the people who were there</p><h3>Volunteer Notes &amp; Ideas</h3></div>
      <span>{reflections.length} shared</span>
    </div>
    {reflections.length ? <div className={styles.eventReflectionItems}>{reflections.map(({ reflection, participantName }) => <article key={reflection.id}>
      <div className={styles.eventReflectionAuthor}><span>{participantName.slice(0, 2).toUpperCase()}</span><div><b>{participantName}</b><small>Shared {new Date(reflection.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small></div></div>
      <div className={styles.eventReflectionCopy}>
        {reflection.shiftNote ? <section><p><Heart size={14} /> Shift Notes</p><blockquote>{reflection.shiftNote}</blockquote></section> : null}
        {reflection.organizationIdea ? <section><p><Lightbulb size={14} /> Ideas for the organization</p><blockquote>{reflection.organizationIdea}</blockquote></section> : null}
      </div>
    </article>)}</div> : <p className={styles.eventReflectionEmpty}>No volunteer notes have been shared for this event yet.</p>}
  </section>
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
  const [profile, waiverSetup, documents] = await Promise.all([
    org ? getEditorProfile(org) : Promise.resolve(null),
    org ? getOnboardingWaiverSetup(org.id) : Promise.resolve({ waiver: null, method: null }),
    org ? getOrganizationDocuments(org.id) : Promise.resolve([]),
  ])
  const taskShifts = await Promise.all(taskRows.map(async (task) => ({ task, sessions: await getShiftsWithCounts(task.id) })))
  const onboarding = profile?.onboardingTaskId ? taskShifts.find(({ task }) => task.id === profile.onboardingTaskId) : taskShifts.find(({ task }) => /onboard|orientation/i.test(task.title))
  const referenceTime = Date.now()
  const onboardingSessions = onboarding
    ? [...onboarding.sessions].sort((a, b) => (b.shift.startsAt ?? 0) - (a.shift.startsAt ?? 0) || b.shift.createdAt - a.shift.createdAt)
    : []
  // The summary is about the current public occurrence, not the first item
  // from the complete session history. An in-progress session remains active
  // until its end time has passed.
  const activePublishedOnboardingSessions = onboarding
    ? onboarding.sessions
        .filter(({ shift }) => shift.status === 'open' && ((shift.startsAt ?? 0) >= referenceTime || (shift.endsAt ?? 0) > referenceTime))
        .sort((a, b) => (a.shift.startsAt ?? 0) - (b.shift.startsAt ?? 0))
    : []
  const activePublishedOnboardingSession = activePublishedOnboardingSessions[0] ?? null
  const suggestedOnboardingStart = activePublishedOnboardingSession?.shift.startsAt
    ? activePublishedOnboardingSession.shift.startsAt + 7 * 24 * 60 * 60 * 1000
    : referenceTime + 7 * 24 * 60 * 60 * 1000
  const onboardingParticipants = onboarding
    ? await getOnboardingSessionParticipants({
        orgId,
        taskId: onboarding.task.id,
        shiftIds: onboardingSessions.map(({ shift }) => shift.id),
      })
    : new Map<string, OnboardingParticipant[]>()
  const visibleTaskShifts = taskShifts
  // Onboarding has its own dedicated workspace area and should not duplicate
  // itself in the reusable opportunity-template library.
  const opportunityTemplates = taskShifts.filter(({ task }) => task.id !== onboarding?.task.id)
  const publishableTemplates = opportunityTemplates
    .filter(({ task }) => task.status === 'open')
    .map(({ task }) => ({ id: task.id, title: task.title }))
  const sessionHasEnded = (endsAt: number | null, startsAt: number | null) => {
    const effectiveEnd = endsAt ?? startsAt
    return effectiveEnd !== null && effectiveEnd < referenceTime
  }
  const publishedSessions = taskShifts
    .flatMap(({ task, sessions }) => sessions
      .filter(({ shift }) => shift.status === 'open' && task.status === 'open' && !sessionHasEnded(shift.endsAt, shift.startsAt))
      .map(({ shift, taken, slotsLeft }) => ({ task, shift, taken, slotsLeft })))
    .sort((a, b) => (a.shift.startsAt ?? Number.MAX_SAFE_INTEGER) - (b.shift.startsAt ?? Number.MAX_SAFE_INTEGER))
  const pastSessions = taskShifts
    .flatMap(({ task, sessions }) => sessions
      .filter(({ shift }) => sessionHasEnded(shift.endsAt, shift.startsAt))
      .map(({ shift, taken }) => ({ task, shift, taken })))
    .sort((a, b) => (b.shift.startsAt ?? 0) - (a.shift.startsAt ?? 0))
  const eventShiftIds = Array.from(new Set([...publishedSessions, ...pastSessions].map(({ shift }) => shift.id)))
  const eventParticipantRows = eventShiftIds.length
    ? await db
        .select({ claim: claims, participant: users })
        .from(claims)
        .innerJoin(users, eq(claims.userId, users.id))
        .where(and(inArray(claims.shiftId, eventShiftIds), ne(claims.status, 'unclaimed')))
    : []
  const organizationReflections = await getOrganizationVolunteerReflections(
    orgId,
    pastSessions.map(({ shift }) => shift.id),
  )
  const eventParticipantsByShift = new Map<string, EventParticipant[]>()
  const eventReflectionsByShift = new Map<string, OrganizationVolunteerReflection[]>()
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
  for (const reflection of organizationReflections) {
    const list = eventReflectionsByShift.get(reflection.reflection.shiftId) ?? []
    list.push(reflection)
    eventReflectionsByShift.set(reflection.reflection.shiftId, list)
  }
  const totalOpenSpots = publishedSessions.reduce((total, item) => total + item.slotsLeft, 0)
  const nextPublishedSession = publishedSessions.find(({ shift }) => !shift.startsAt || shift.startsAt >= referenceTime) ?? null
  const hasWaiver = Boolean(waiverSetup.waiver && waiverSetup.method)
  const initialWorkspaceSection = searchParams.workspace === 'onboarding' || searchParams.workspace === 'opportunities'
    ? searchParams.workspace
    : 'documentation'
  const documentationLibrary = [
    ...(waiverSetup.waiver ? [{
      id: waiverSetup.waiver.id,
      area: 'Liability waiver',
      title: waiverSetup.waiver.title,
      timestamp: waiverSetup.waiver.createdAt,
      href: '/aesthetic-lab/issuer/waiver',
      attached: Boolean(waiverSetup.waiver.documentUrl),
      taskIds: [] as string[],
      kind: 'waiver' as const,
    }] : []),
    ...documents.map((document) => ({
      id: document.id,
      area: ORGANIZATION_DOCUMENT_CATEGORY_DETAILS[document.category].label,
      title: document.title,
      timestamp: document.updatedAt,
      href: `/aesthetic-lab/issuer/documents?category=${document.category}`,
      attached: Boolean(document.documentUrl),
      taskIds: document.taskIds,
      kind: 'document' as const,
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
            documentation={<>
              <section className={styles.workspaceSetupCard}>
              <div className={styles.workspaceSetupHeading}><div><p className={styles.eyebrow}>Organization setup</p><h2>Keep participant documentation ready.</h2><p>Use a liability waiver whenever it fits your program, alongside the guides and operational resources your team needs.</p></div><span>{hasWaiver ? 'Waiver active' : 'Optional tool'}</span></div>
              <div className={styles.workspaceSetupSteps}>
                <article className={hasWaiver ? styles.workspaceSetupStepComplete : undefined}><span>{hasWaiver ? <CheckCircle2 size={18} /> : <FileText size={18} />}</span><div><p>Liability waiver</p><h3>{hasWaiver ? 'Current waiver ready' : 'Add a liability waiver'}</h3><small>{hasWaiver ? 'A current version is available for participants.' : 'This is optional. Add one whenever your organization needs participant acknowledgement.'}</small></div><Link className={styles.catalogWorkspaceAction} href="/aesthetic-lab/issuer/waiver">{hasWaiver ? 'Manage waiver' : 'Add waiver'}</Link></article>
                {ORGANIZATION_DOCUMENT_CATEGORIES.map((category) => {
                  const details = ORGANIZATION_DOCUMENT_CATEGORY_DETAILS[category]
                  const count = documents.filter((document) => document.category === category).length
                  const itemName = category === 'guide' ? 'guide' : category === 'safety' ? 'safety plan' : 'template'
                  return <article key={category} className={count > 0 ? styles.workspaceSetupStepComplete : undefined}><span>{count > 0 ? <CheckCircle2 size={18} /> : <FileText size={18} />}</span><div><p>{details.label}</p><h3>{count > 0 ? `${count} ${count === 1 ? 'document' : 'documents'} saved` : `Add a ${itemName}`}</h3><small>{details.description}</small></div><Link className={styles.catalogWorkspaceAction} href={`/aesthetic-lab/issuer/documents?category=${category}`}>Add Document</Link></article>
                })}
              </div>
              </section>
              <section className={styles.workspaceDocumentList}>
                <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Your documents</p><h2>Everything your team has added.</h2></div><span>{documentationLibrary.length} saved</span></div>
                {documentationLibrary.length > 0 ? <div>{documentationLibrary.map((document) => {
                  const attachableTasks = visibleTaskShifts.filter(({ task }) => document.kind === 'document' && !document.taskIds.includes(task.id))
                  return <article key={document.id}><span><FileText size={17} /></span><div><p>{document.area}</p><h3>{document.title}</h3><small>{document.attached ? 'Source file attached · ' : ''}Updated {new Date(document.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</small></div><div className={styles.workspaceDocumentActions}><Link className={styles.catalogWorkspaceAction} href={document.kind === 'waiver' ? document.href : `/aesthetic-lab/issuer/documents/${document.id}`}>Manage</Link>{document.kind === 'document' ? <details className={styles.workspaceDocumentOverflow}><summary aria-label={`More actions for ${document.title}`}><MoreHorizontal size={17} /></summary><div><form action={attachOrganizationDocumentAction}><input type="hidden" name="documentId" value={document.id} /><input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/catalog" />{attachableTasks.length > 0 ? <><select name="taskId" defaultValue=""><option value="" disabled>Attach to opportunity…</option>{attachableTasks.map(({ task }) => <option key={task.id} value={task.id}>{task.title}</option>)}</select><button type="submit">Attach</button></> : <p>Attached to all current opportunities.</p>}</form><form action={archiveOrganizationDocumentAction}><input type="hidden" name="documentId" value={document.id} /><input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/catalog" /><button type="submit">Delete document</button></form></div></details> : null}</div></article>
                })}</div> : <p className={styles.workspaceDocumentEmpty}>No documents added yet. Begin with the optional tools above whenever they fit your organization.</p>}
              </section>
            </>}
            onboarding={onboarding ? <section className={styles.onboardingWorkspaceCard}>
            <div className={styles.onboardingWorkspaceHeading}><span><Repeat2 size={20} /></span><div><p className={styles.eyebrow}>Recurring onboarding</p><h2>{onboarding?.task.title ?? 'No onboarding session yet'}</h2><p>{onboarding ? 'This is the first step for prospective City Members.' : 'Create a recurring orientation so new participants have a clear first step.'}</p></div>{onboarding ? <div className={styles.onboardingWorkspaceActions}><PublishOnboardingSessionButton taskId={onboarding.task.id} redirectTo="/aesthetic-lab/issuer/catalog?workspace=onboarding" suggestedStartsAt={suggestedOnboardingStart} existingFutureSessions={activePublishedOnboardingSessions.length} /><Link className={styles.onboardingWorkspaceAction} href={`/aesthetic-lab/issuer/onboarding?taskId=${onboarding.task.id}`}><Edit3 size={15} /> Manage session</Link></div> : <Link className={styles.onboardingWorkspaceAction} href="/aesthetic-lab/issuer/onboarding"><Edit3 size={15} /> Create session</Link>}</div>
            {onboarding ? <>
              <div className={styles.onboardingSessionGrid}>
                <div><span>Schedule</span><b>{activePublishedOnboardingSession?.shift.startsAt ? new Date(activePublishedOnboardingSession.shift.startsAt).toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' }) : 'No published session'}</b></div>
                <div><span>Weekly capacity</span><b>{activePublishedOnboardingSession ? `${activePublishedOnboardingSession.shift.capacity} participants` : 'No published session'}</b></div>
                <div><span>Default location</span><b>{activePublishedOnboardingSession ? onboarding.task.location || profile?.location || 'Location TBD' : 'No published session'}</b></div>
              </div>
              <div className={styles.onboardingSessionHistory}>
                <div className={styles.onboardingSessionHistoryHeading}><span>Session history</span><small>Newest first · Open a date to review participants</small></div>
                {onboardingSessions.map(({ shift, taken }) => {
                  const participants = onboardingParticipants.get(shift.id) ?? []
                  const isFuturePublishedSession = shift.status === 'open' && Boolean(shift.startsAt && shift.startsAt > referenceTime)
                  return <details className={styles.onboardingSessionDetails} key={shift.id}>
                    <summary>
                      <CalendarDays size={16} />
                      <b>{shift.startsAt ? new Date(shift.startsAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase() : 'TBD'}</b>
                      <span>{shift.startsAt ? new Date(shift.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Time TBD'}</span>
                      <em>{taken} of {shift.capacity} reserved</em>
                      <i>{participants.length} participant{participants.length === 1 ? '' : 's'}</i>
                    </summary>
                    <div className={styles.onboardingSessionParticipants}>
                      {isFuturePublishedSession ? <div className={styles.onboardingSessionActions}>
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
                })}
              </div>
            </> : null}
          </section> : <section className={styles.workspaceSetupCard}>
            <div className={styles.workspaceSetupHeading}><div><p className={styles.eyebrow}>Optional onboarding</p><h2>Welcome new volunteers on your terms.</h2><p>Create a recurring session when an orientation makes participation clearer. Skip it entirely if your organization does not need one.</p></div><span>Optional tool</span></div>
            <div className={styles.workspaceSetupSteps}><article><span><Repeat2 size={18} /></span><div><p>Recurring session</p><h3>No onboarding session yet</h3><small>Set a schedule, capacity, location, and any participant instructions when you are ready.</small></div><Link className={styles.catalogWorkspaceAction} href="/aesthetic-lab/issuer/onboarding">Create session</Link></article></div>
          </section>}
            opportunities={<>
              <section className={styles.catalogOpportunityOverview} id="opportunities">
                <div className={styles.issuerPanelHeading}>
                  <div><p className={styles.eyebrow}>Opportunity library</p><h2>Plan work first. Publish sessions when you’re ready.</h2><p>Your reusable opportunities stay in this workspace until you give volunteers a time to join.</p></div>
                </div>
                <div className={styles.catalogOpportunityMetrics}>
                  <article><span>Opportunity plans</span><b>{opportunityTemplates.length}</b><small>reusable volunteer activities</small></article>
                  <article><span>Published sessions</span><b>{publishedSessions.length}</b><small>currently visible to volunteers</small></article>
                  <article><span>Open volunteer spots</span><b>{totalOpenSpots}</b><small>across published sessions</small></article>
                </div>
              </section>

              <section className={styles.catalogWorkspaceCard}>
                <div className={styles.issuerPanelHeading}>
                  <div><p className={styles.eyebrow}>Your opportunities</p><h2>Reusable volunteer plans</h2></div>
                  <div className={styles.templateLibraryActions}><span>{opportunityTemplates.length} saved</span><Link href="/aesthetic-lab/issuer/new" className={styles.catalogWorkspaceAction}><Plus size={15} /> New template</Link></div>
                </div>
                <div className={styles.templateGrid}>
                  {opportunityTemplates.length === 0 ? <p className={styles.emptyCopy}>No opportunities yet. Create the volunteer work first, then publish sessions when the timing is right.</p> : opportunityTemplates.map(({ task }) => {
                    return <article key={task.id} className={`${styles.templateCard} ${styles.templateCardSimple}`}>
                      <h3>{task.title}</h3><p>{task.description || 'No description has been added yet.'}</p>
                      <div className={styles.templateMeta}><span><MapPin size={13} /> {task.location || profile?.location || 'Location TBD'}</span></div>
                      <Link className={styles.templateCardManage} href={`/aesthetic-lab/issuer/opportunities/${task.id}`}>Manage template</Link>
                    </article>
                  })}
                </div>
              </section>

              <section className={styles.catalogPublishedSchedule}>
                <div className={styles.issuerPanelHeading}>
                  <div><p className={styles.eyebrow}>Published schedule</p><h2>What volunteers can join now.</h2></div>
                  <div className={styles.publishedScheduleActions}>
                    <span>{publishedSessions.length} live</span>
                    <PublishTemplateEventButton templates={publishableTemplates} redirectTo="/aesthetic-lab/issuer/catalog?workspace=opportunities" suggestedStartsAt={referenceTime + 24 * 60 * 60 * 1000} />
                  </div>
                </div>
                {publishedSessions.length ? <div className={styles.catalogPublishedSessionList}>{publishedSessions.slice(0, 8).map(({ task, shift, taken, slotsLeft }) => {
                  const isNext = shift.id === nextPublishedSession?.shift.id
                  const participants = eventParticipantsByShift.get(shift.id) ?? []
                  return <details key={shift.id} className={`${styles.catalogEventDetails} ${isNext ? styles.catalogPublishedSessionNext : ''}`}>
                    <summary><span><CalendarDays size={16} /></span><div><p>{task.title}{isNext ? <em>Next up</em> : null}</p><h3>{shift.startsAt ? new Date(shift.startsAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Date and time to be confirmed'}</h3><small>{taken} reserved · {slotsLeft} spot{slotsLeft === 1 ? '' : 's'} open</small></div><i>{participants.length} signup{participants.length === 1 ? '' : 's'}</i></summary>
                    <EventParticipantList participants={participants} mode="upcoming" />
                    <Link className={styles.catalogEventManageLink} href={`/aesthetic-lab/issuer/opportunities/${task.id}`}>Manage opportunity</Link>
                  </details>
                })}</div> : <div className={styles.catalogPublishedEmpty}><CalendarDays size={19} /><div><b>No sessions are live yet.</b><p>Saved opportunities will appear here after you publish a date and time for volunteers.</p></div></div>}
              </section>

              <section className={styles.catalogPastEvents}>
                <div className={styles.issuerPanelHeading}>
                  <div><p className={styles.eyebrow}>Past events</p><h2>Sessions your organization has already held.</h2></div>
                  <span>{pastSessions.length} total</span>
                </div>
                {pastSessions.length ? <div className={styles.catalogPastEventList}>{pastSessions.slice(0, 8).map(({ task, shift, taken }) => {
                  const participants = eventParticipantsByShift.get(shift.id) ?? []
                  const reflections = eventReflectionsByShift.get(shift.id) ?? []
                  return <details key={shift.id} open={searchParams.event === shift.id} className={`${styles.catalogEventDetails} ${styles.catalogPastEventDetails}`}>
                    <summary><span><CalendarDays size={16} /></span><div><p>{task.title}</p><h3>{shift.startsAt ? new Date(shift.startsAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Date and time not recorded'}</h3><small>{taken} volunteer{taken === 1 ? '' : 's'} reserved{shift.label ? ` · ${shift.label}` : ''}{reflections.length ? ` · ${reflections.length} volunteer note${reflections.length === 1 ? '' : 's'}` : ''}</small></div><i>{participants.length} record{participants.length === 1 ? '' : 's'}</i></summary>
                    <EventParticipantList participants={participants} mode="past" />
                    <VolunteerReflectionList reflections={reflections} />
                    <Link className={styles.catalogEventManageLink} href={`/aesthetic-lab/issuer/opportunities/${task.id}`}>Manage opportunity</Link>
                  </details>
                })}</div> : <div className={styles.catalogPastEmpty}><CalendarDays size={19} /><div><b>No past events yet.</b><p>Once a session’s end time has passed, it will be collected here for your organization’s reference.</p></div></div>}
              </section>
            </>}
          />
        </section>
      </div>
    </main>
  )
}
