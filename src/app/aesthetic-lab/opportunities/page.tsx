import Link from 'next/link'
import type { CSSProperties } from 'react'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import {
  ArrowUpRight,
  Bookmark,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Compass,
  Heart,
  MapPin,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { db } from '@/lib/db/client'
import { cities as cityNetworks, claims, orgs, shifts, tasks, users, volunteerPrograms } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { organizationBannerPalette } from '@/lib/profile/organization-appearance'
import { getParticipantOrganizations } from '@/lib/services/participant-workspace'
import { aggregateOpportunities, getPublicApplications, listPublicIssuers, type PublicOpportunity } from '@/lib/services/profile'
import { getMyResume } from '@/lib/services/resume'
import { savedItemIds } from '@/lib/services/saved-items'
import { getLabWorkspace } from '../lab-workspace'
import { LabHeader } from '../LabHeader'
import { ParticipantIdentityCard } from '../ParticipantIdentityCard'
import { SaveTaskButton } from '../SaveTaskButton'
import { VolunteerProfileTab } from '../profile/VolunteerProfileTab'
import styles from '../prototype.module.css'

export const dynamic = 'force-dynamic'

type OpportunityRow = { card: PublicOpportunity; orgName: string; isOnboarding: boolean; savedByMe: boolean }
type PublishedVolunteerIntake = {
  id: string
  orgId: string
  programName: string
  roles: {id:string;title:string;description:string}[]
  hasApplicationQuestions: boolean
  requirements:string[]
}
type AssignedPrivateShift = {
  claimId: string
  claimStatus: string
  orgId: string
  taskId: string
  taskTitle: string
  taskLocation: string
  shiftId: string
  startsAt: number | null
  endsAt: number | null
  label: string
}
type OpenRosterShift = {
  orgId: string
  taskId: string
  taskTitle: string
  taskLocation: string
  shiftId: string
  startsAt: number | null
  endsAt: number | null
  label: string
  capacity: number
  taken: number
}
type OpportunityControlStyle = CSSProperties & {
  '--program-palette-deep': string
  '--program-palette-mid': string
  '--program-palette-accent': string
  '--program-palette-accent-deep': string
}

function opportunityDate(card: PublicOpportunity) {
  if (!card.nextShiftAt) return { day: 'TBD', date: '—' }
  const date = new Date(card.nextShiftAt)
  return { day: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(), date: String(date.getDate()) }
}

function opportunityTime(card: PublicOpportunity) {
  if (!card.nextShiftAt) return card.nextShiftLabel || 'Time to be confirmed'
  return new Date(card.nextShiftAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

function initials(name: string) {
  return name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()
}

function assignedShiftTime(startsAt: number | null, endsAt: number | null) {
  if (!startsAt) return 'Time to be confirmed'
  const start = new Date(startsAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const end = endsAt ? new Date(endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
  return end ? `${start}–${end}` : start
}

function commitmentState(status: 'claimed' | 'submitted') {
  return status === 'submitted'
    ? { label: 'Awaiting verification', detail: 'The organization is reviewing your completed shift.' }
    : { label: 'Reserved', detail: 'Your place is held for this scheduled session.' }
}

function OpportunityCard({ row, tone, redirectTo }: { row: OpportunityRow; tone: 'mint' | 'blue' | 'coral'; redirectTo: string }) {
  const date = opportunityDate(row.card)
  const detailHref = `/aesthetic-lab/opportunities/${row.card.id}${row.card.nextShiftId ? `?shift=${row.card.nextShiftId}` : ''}`
  return (
    <article className={styles.opportunityCard}>
      <div className={`${styles.opportunityDate} ${styles[tone]}`}><span>{date.day}</span><strong>{date.date}</strong></div>
      <div className={styles.opportunityMain}>
        <p className={styles.orgLine}><Building2 size={14} /> {row.orgName} <CheckCircle2 size={14} /></p>
        <h3>{row.card.title}</h3>
        <p className={styles.opportunityMeta}><Clock3 size={14} /> {opportunityTime(row.card)} <i /> <MapPin size={14} /> {row.card.location || 'Location to be confirmed'}</p>
        <p className={styles.capacityLine}><UsersRound size={14} /> {row.card.nextEnrollmentMode === 'organization_managed' ? 'Organization-managed enrollment' : `${row.card.totalOpenSlots} spot${row.card.totalOpenSlots === 1 ? '' : 's'} open`}</p>
      </div>
      <div className={styles.labFormActions}><SaveTaskButton taskId={row.card.id} saved={row.savedByMe} redirectTo={redirectTo} /><Link href={detailHref} className={styles.cardArrow} aria-label={`View ${row.card.title}`}><ArrowUpRight size={19} /></Link></div>
    </article>
  )
}

function OrganizationPublishedOpportunities({ opportunities, publicDiscoveryOnly = false }: { opportunities: PublicOpportunity[]; publicDiscoveryOnly?: boolean }) {
  const visibleOpportunities = publicDiscoveryOnly
    ? opportunities.filter((opportunity) => !opportunity.isOnboarding && opportunity.nextEnrollmentMode === 'open_claims')
    : opportunities
  if (publicDiscoveryOnly && visibleOpportunities.length === 0) return null
  const availableShiftCount = visibleOpportunities.reduce((count, opportunity) => count + opportunity.openShiftCount, 0)

  return <section className={styles.organizationPublishedOpportunities}>
    <div className={styles.organizationSessionHeading}>
      <span><UsersRound size={16} /> {publicDiscoveryOnly ? 'Public shifts' : 'Organization shifts'}</span>
      <em>{availableShiftCount} available</em>
    </div>
    <div className={styles.organizationOpportunityList}>
      {visibleOpportunities.length === 0 ? <p>No volunteer opportunities are currently published by this organization.</p> : visibleOpportunities.map((opportunity) => (
        <article key={opportunity.id}>
          <div>
            <b>{opportunity.title}</b>
            <small><Clock3 size={13} /> {opportunityTime(opportunity)} <i /> <MapPin size={13} /> {opportunity.location || 'Location to be confirmed'}</small>
            <span><UsersRound size={13} /> {opportunity.totalOpenSlots} spot{opportunity.totalOpenSlots === 1 ? '' : 's'} open</span>
          </div>
          <Link href={`/aesthetic-lab/opportunities/${opportunity.id}${opportunity.nextShiftId ? `?shift=${opportunity.nextShiftId}` : ''}`}>Sign up <ArrowUpRight size={14} /></Link>
        </article>
      ))}
    </div>
  </section>
}

function OrganizationVolunteerIntakes({ intakes }: { intakes: PublishedVolunteerIntake[] }) {
  if (intakes.length === 0) return null

  return <section className={styles.organizationPublishedOpportunities}>
    <div className={styles.organizationSessionHeading}>
      <span><UsersRound size={16} /> Volunteer applications</span>
      <em>{intakes.length} open</em>
    </div>
    <div className={styles.organizationOpportunityList}>
      {intakes.map((intake) => (
        <article key={intake.id}>
          <div>
            <b>{intake.programName}</b>
            <small>{intake.roles.length?`Roles include ${intake.roles.map(role=>role.title).join(', ')}.`:'Tell the organization how you would like to help.'}</small>
            <span>{intake.requirements.length?intake.requirements.join(' · '):intake.hasApplicationQuestions?'Answer a few questions and apply':'One-click application with organization review'}</span>
          </div>
          <Link href={`/aesthetic-lab/opportunities/${intake.id}#application`}>Apply <ArrowUpRight size={14} /></Link>
        </article>
      ))}
    </div>
  </section>
}

function OrganizationRosterOpportunities({ openRosterShifts, privateShifts }: { openRosterShifts: OpenRosterShift[]; privateShifts: AssignedPrivateShift[] }) {
  const availableCount = privateShifts.length + openRosterShifts.length

  return <details className={styles.organizationOpportunityAccordion}>
    <summary>
      <span><CalendarDays size={16} /> Opportunities</span>
      <em>{availableCount} available <ChevronDown size={16} /></em>
    </summary>
    <div className={styles.organizationOpportunityList}>
      {privateShifts.map((shift) => <article key={shift.shiftId}>
        <div>
          <b>{shift.taskTitle}</b>
          <small><Clock3 size={13} /> {assignedShiftTime(shift.startsAt, shift.endsAt)} <i /> <MapPin size={13} /> {shift.taskLocation || 'Location to be confirmed'}</small>
          <span><UsersRound size={13} /> Private shift · assigned to you</span>
        </div>
        <Link href={`/aesthetic-lab/opportunities/${shift.taskId}/sessions/${shift.shiftId}`}>View shift <ArrowUpRight size={14} /></Link>
      </article>)}
      {openRosterShifts.map((shift) => {
        const spotsLeft = Math.max(0, shift.capacity - Number(shift.taken))
        return <article key={shift.shiftId}>
        <div>
          <b>{shift.taskTitle}</b>
          <small><Clock3 size={13} /> {assignedShiftTime(shift.startsAt, shift.endsAt)} <i /> <MapPin size={13} /> {shift.taskLocation || 'Location to be confirmed'}</small>
          <span><UsersRound size={13} /> Open to roster · {spotsLeft} spot{spotsLeft === 1 ? '' : 's'} open</span>
        </div>
        <Link href={`/aesthetic-lab/opportunities/${shift.taskId}?shift=${shift.shiftId}`}>View shift <ArrowUpRight size={14} /></Link>
      </article>
      })}
      {!availableCount ? <p>No private or roster opportunities are currently available.</p> : null}
    </div>
  </details>
}

export default async function OpportunitiesLabPage({ searchParams }: { searchParams: { saved?: string; tab?: string } }) {
  const session = await requireRole('participant')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const savedOnly = searchParams.saved === '1'
  const activeTab = searchParams.tab === 'organizations'
    ? 'organizations'
    : searchParams.tab === 'commitments'
      ? 'commitments'
      : searchParams.tab === 'profile'
        ? 'profile'
      : 'opportunities'
  const [directory, rows, resume, joinedOrganizations, commitmentRows, participantAppearance, assignedPrivateShifts, openRosterShifts] = await Promise.all([
    listPublicIssuers({ cityId: city?.id }),
    savedOnly && city
      ? db
        .select({ task: tasks, org: orgs })
        .from(tasks)
        .innerJoin(orgs, eq(tasks.orgId, orgs.id))
        .where(and(eq(tasks.status, 'open'), eq(orgs.status, 'approved'), eq(tasks.cityId, city.id)))
        .orderBy(desc(tasks.createdAt))
      : Promise.resolve([]),
    getMyResume(session.sub),
    getParticipantOrganizations(session.sub),
    db
      .select({ claim: claims, task: tasks, organization: orgs, shift: shifts, city: cityNetworks })
      .from(claims)
      .innerJoin(tasks, eq(claims.taskId, tasks.id))
      .innerJoin(orgs, eq(tasks.orgId, orgs.id))
      .innerJoin(shifts, eq(claims.shiftId, shifts.id))
      .leftJoin(cityNetworks, eq(tasks.cityId, cityNetworks.id))
      .where(and(eq(claims.userId, session.sub), inArray(claims.status, ['claimed', 'submitted'])))
      .orderBy(asc(shifts.startsAt), asc(shifts.createdAt)),
    db
      .select({ bannerPalette: users.bannerPalette })
      .from(users)
      .where(eq(users.id, session.sub))
      .limit(1)
      .then((records) => records[0] ?? null),
    city
      ? db
        .select({
          claimId: claims.id,
          claimStatus: claims.status,
          orgId: tasks.orgId,
          taskId: tasks.id,
          taskTitle: tasks.title,
          taskLocation: tasks.location,
          shiftId: shifts.id,
          startsAt: shifts.startsAt,
          endsAt: shifts.endsAt,
          label: shifts.label,
        })
        .from(claims)
        .innerJoin(shifts, eq(claims.shiftId, shifts.id))
        .innerJoin(tasks, eq(claims.taskId, tasks.id))
        .where(and(
          eq(claims.userId, session.sub),
          inArray(claims.status, ['claimed', 'submitted']),
          eq(tasks.cityId, city.id),
          eq(tasks.status, 'open'),
          eq(tasks.isOnboarding, 0),
          eq(shifts.status, 'open'),
          eq(shifts.visibility, 'private'),
        ))
        .orderBy(asc(shifts.startsAt), asc(shifts.createdAt))
      : Promise.resolve([]),
    city
      ? db
        .select({
          orgId: tasks.orgId,
          taskId: tasks.id,
          taskTitle: tasks.title,
          taskLocation: tasks.location,
          shiftId: shifts.id,
          startsAt: shifts.startsAt,
          endsAt: shifts.endsAt,
          label: shifts.label,
          capacity: shifts.capacity,
          taken: sql<number>`count(${claims.id})`,
        })
        .from(shifts)
        .innerJoin(tasks, eq(shifts.taskId, tasks.id))
        .leftJoin(claims, and(eq(claims.shiftId, shifts.id), inArray(claims.status, ['claimed', 'submitted', 'verified'])))
        .where(and(
          eq(tasks.cityId, city.id),
          eq(tasks.status, 'open'),
          eq(tasks.isOnboarding, 0),
          eq(shifts.status, 'open'),
          eq(shifts.visibility, 'public'),
          eq(shifts.enrollmentMode, 'open_claims'),
        ))
        .groupBy(shifts.id)
        .orderBy(asc(shifts.startsAt), asc(shifts.createdAt))
      : Promise.resolve([]),
  ])
  const directoryById = new Map(directory.map((organization) => [organization.org.id, organization]))
  const organizationIds = Array.from(new Set([...directory.map((organization) => organization.org.id), ...joinedOrganizations.map((organization) => organization.id)]))
  const organizationTaskRows = city && organizationIds.length
    ? await db.select().from(tasks).where(and(inArray(tasks.orgId, organizationIds), eq(tasks.cityId, city.id), eq(tasks.status, 'open')))
    : []
  const organizationAggregate = await aggregateOpportunities(organizationTaskRows)
  const privateShiftsByOrganization = new Map<string, AssignedPrivateShift[]>()
  for (const shift of assignedPrivateShifts) {
    privateShiftsByOrganization.set(shift.orgId, [...(privateShiftsByOrganization.get(shift.orgId) ?? []), shift])
  }
  const openRosterShiftsByOrganization = new Map<string, OpenRosterShift[]>()
  for (const shift of openRosterShifts) {
    openRosterShiftsByOrganization.set(shift.orgId, [...(openRosterShiftsByOrganization.get(shift.orgId) ?? []), shift])
  }
  const opportunitiesByOrganization = new Map<string, PublicOpportunity[]>()
  for (const task of organizationTaskRows) {
    const opportunity = organizationAggregate.get(task.id)
    if (!opportunity || opportunity.openShiftCount === 0 || opportunity.totalOpenSlots === 0) continue
    const list = opportunitiesByOrganization.get(task.orgId) ?? []
    list.push(opportunity)
    opportunitiesByOrganization.set(task.orgId, list)
  }
  for (const opportunities of Array.from(opportunitiesByOrganization.values())) opportunities.sort((a, b) => (a.nextShiftAt ?? Number.MAX_SAFE_INTEGER) - (b.nextShiftAt ?? Number.MAX_SAFE_INTEGER))
  const intakesByOrganization = new Map<string, PublishedVolunteerIntake[]>()
  await Promise.all(organizationIds.map(async orgId=>{
    const applications=await getPublicApplications(orgId)
    intakesByOrganization.set(orgId,applications.map(application=>({id:application.taskId,orgId,programName:application.title,roles:application.roleTitles.map(title=>({id:title,title,description:''})),hasApplicationQuestions:application.hasQuestions,requirements:[application.resumePolicy!=='none'?`Resume ${application.resumePolicy}`:null,application.coverLetterPolicy!=='none'?`Cover letter ${application.coverLetterPolicy}`:null].filter((item):item is string=>Boolean(item))})))
  }))
  const aggregate = await aggregateOpportunities(rows.map((row) => row.task))
  const savedTaskIds = await savedItemIds(session.sub, 'task', rows.map((row) => row.task.id))
  const cards: OpportunityRow[] = rows
    .map((row) => ({ card: aggregate.get(row.task.id), orgName: row.org.name, isOnboarding: row.task.isOnboarding === 1, savedByMe: savedTaskIds.has(row.task.id) }))
    .filter((row): row is OpportunityRow => !!row.card && row.card.openShiftCount > 0 && row.card.totalOpenSlots > 0)
    .sort((a, b) => (a.card.nextShiftAt ?? Number.MAX_SAFE_INTEGER) - (b.card.nextShiftAt ?? Number.MAX_SAFE_INTEGER))
  const open = cards.filter((row) => !row.isOnboarding && row.card.nextEnrollmentMode === 'open_claims')
  const redirectTo = savedOnly
    ? '/aesthetic-lab/opportunities?saved=1'
    : activeTab === 'commitments'
      ? '/aesthetic-lab/opportunities?tab=commitments'
      : activeTab === 'profile'
        ? '/aesthetic-lab/opportunities?tab=profile'
      : activeTab === 'organizations'
        ? '/aesthetic-lab/opportunities?tab=organizations'
        : '/aesthetic-lab/opportunities'
  const visibleOpen = savedOnly ? open.filter((row) => row.savedByMe) : open
  const participantPalette = organizationBannerPalette(participantAppearance?.bannerPalette)
  const opportunityControlStyle: OpportunityControlStyle = {
    '--program-palette-deep': participantPalette.colors[0],
    '--program-palette-mid': participantPalette.colors[1],
    '--program-palette-accent': participantPalette.colors[2],
    '--program-palette-accent-deep': participantPalette.colors[3],
  }

  return (
    <main className={styles.app}>
      <LabHeader activeSection="opportunities" session={session} city={city} cities={cities} contexts={contexts} />

      <div className={`${styles.detailLayout} ${styles.opportunitiesLayout}`} style={opportunityControlStyle}>
        <aside className={styles.leftRail}>
          <ParticipantIdentityCard session={session} city={city} redirectTo={redirectTo} />

          <section className={styles.quickLinks}>
            <p className={styles.eyebrow}>Quick Actions</p>
            <Link href="/aesthetic-lab/opportunities?tab=commitments"><CalendarDays size={17} /> My Commitments</Link>
            <Link href="/aesthetic-lab/opportunities"><Building2 size={17} /> Discover organizations</Link>
            <Link href="/aesthetic-lab/opportunities?saved=1"><Heart size={17} /> Saved opportunities</Link>
          </section>

          <section className={styles.impactCard}>
            <p className={styles.eyebrow}>My impact</p>
            <div className={styles.impactGrid}>
              <div><strong>{String(commitmentRows.length).padStart(2, '0')}</strong><span>Active shifts</span></div>
              <div><strong>{resume?.totals.hours ?? 0}h</strong><span>Service record</span></div>
              <div><strong>{String(joinedOrganizations.length).padStart(2, '0')}</strong><span>Organizations</span></div>
            </div>
            <Link href="/aesthetic-lab/opportunities?tab=profile"><Bookmark size={15} /> View service history</Link>
          </section>
        </aside>

        <section className={styles.primaryColumn} aria-label="Available volunteer opportunities">
          <div className={`${styles.programControlCenterShell} ${styles.participantOpportunityControl}`}>
            <section className={styles.programControlCenterCard}>
              <div className={styles.programControlCenterHeading}>
                <div>
                  <p className={styles.eyebrow}>Discover</p>
                  <h1>Explore Opportunities in {city?.name ?? 'Your City'}</h1>
                  <p>Find local organizations and volunteer work that fit how you want to contribute.</p>
                </div>
              </div>
            </section>
            <nav className={styles.participantOpportunityTabs} aria-label="Volunteer opportunity workspace">
              <Link data-active={activeTab === 'opportunities'} aria-current={activeTab === 'opportunities' ? 'page' : undefined} href="/aesthetic-lab/opportunities"><Compass size={15} /> Opportunities</Link>
              <Link data-active={activeTab === 'organizations'} aria-current={activeTab === 'organizations' ? 'page' : undefined} href="/aesthetic-lab/opportunities?tab=organizations"><Building2 size={15} /> My Organizations</Link>
              <Link data-active={activeTab === 'commitments'} aria-current={activeTab === 'commitments' ? 'page' : undefined} href="/aesthetic-lab/opportunities?tab=commitments"><CalendarDays size={15} /> My Commitments</Link>
              <Link data-active={activeTab === 'profile'} aria-current={activeTab === 'profile' ? 'page' : undefined} href="/aesthetic-lab/opportunities?tab=profile"><UserRound size={15} /> Volunteer Profile</Link>
            </nav>
          </div>
          {savedOnly ? <>
            <div className={styles.pageIntro}>
              <p className={styles.eyebrow}>Saved opportunities</p>
              <h1>Keep the work that matters close.</h1>
              <p>These are the sessions you saved while exploring local organizations and their missions.</p>
            </div>
            <div className={styles.listHeading}><div><p className={styles.eyebrow}>Saved shifts</p><h2>{visibleOpen.length} way{visibleOpen.length === 1 ? '' : 's'} to help</h2></div><span>Soonest first</span></div>
            <div className={styles.opportunityList}>{visibleOpen.length > 0 ? visibleOpen.map((row, index) => <OpportunityCard key={row.card.id} row={row} redirectTo={redirectTo} tone={index % 3 === 0 ? 'coral' : index % 3 === 1 ? 'blue' : 'mint'} />) : <p className={styles.emptyCopy}>No saved opportunities yet. Save a shift from an organization you would like to support.</p>}</div>
          </> : activeTab === 'commitments' ? <>
            <section className={`${styles.commitmentsWorkspaceCard} ${styles.paletteTreatmentCard}`}>
              <div className={`${styles.commitmentsWorkspaceHeading} ${styles.paletteTreatmentHeader} ${styles.applicationOpportunityHeader}`}>
                <p className={styles.eyebrow}>Current Commitments</p>
              </div>
              <div className={styles.commitmentsList}>
                {commitmentRows.length ? commitmentRows.map(({ claim, task, organization, shift, city: commitmentCity }) => {
                  const state = commitmentState(claim.status as 'claimed' | 'submitted')
                  return <article key={claim.id}>
                    <span className={styles.commitmentDateIcon}><CalendarDays size={18} /></span>
                    <div className={styles.commitmentDetails}>
                      <p>{organization.name}{commitmentCity ? ` · ${commitmentCity.name}` : ''}</p>
                      <h3>{task.title}</h3>
                      <small><CalendarDays size={13} /> {assignedShiftTime(shift.startsAt, shift.endsAt)} <i /> <MapPin size={13} /> {task.location || 'Location to be confirmed'}</small>
                      <em>{state.label}</em>
                      <span>{state.detail}</span>
                    </div>
                    <Link className={styles.commitmentStatusButton} href={`/aesthetic-lab/opportunities/${task.id}/sessions/${shift.id}`}>Open Status Page <ArrowUpRight size={14} /></Link>
                  </article>
                }) : <div className={styles.commitmentsEmpty}><UsersRound size={21} /><div><b>You have no current commitments.</b><p>Choose a volunteer shift when you are ready to get involved.</p><Link href="/aesthetic-lab/opportunities">Explore opportunities <ArrowUpRight size={14} /></Link></div></div>}
              </div>
            </section>
          </> : activeTab === 'profile' ? <VolunteerProfileTab
            userId={session.sub}
            resumeToken={resume?.token ?? null}
            resumeIsPublic={resume?.isPublic ?? false}
            resumeTotals={resume?.totals ?? { contributions: 0, hours: 0, organizations: 0 }}
          /> : activeTab === 'organizations' ? <>
            <div className={styles.organizationList}>
              {joinedOrganizations.length === 0 ? <section className={styles.calendarEmpty}><Building2 size={20} /><div><b>You have not joined an organization yet.</b><p>Explore a mission that matters to you, then choose an organization’s introduction session to begin.</p></div></section> : joinedOrganizations.map((joined, index) => {
                const organization = directoryById.get(joined.id)
                const href = organization?.org.slug ? `/orgs/${organization.org.slug}` : '/orgs'
                const message = organization?.tagline || organization?.mission || 'This organization is part of your local City/Sync network.'
                return <article className={`${styles.organizationCard} ${styles.organizationCardWithOpportunities}`} key={joined.id}>
                  <div className={styles.organizationCardTop}>
                    <div className={`${styles.organizationArt} ${styles[index % 3 === 0 ? 'foodArt' : index % 3 === 1 ? 'toolArt' : 'creekArt']} ${organization?.logoUrl ? styles.organizationArtWithImage : ''}`}>
                      {organization?.logoUrl
                        ? <img className={styles.organizationArtImage} src={organization.logoUrl} alt={`${joined.name} profile`} />
                        : <><span>{initials(joined.name)}</span><i /><i /><i /></>}
                    </div>
                    <div className={styles.organizationDetails}>
                      <p className={styles.organizationCause}>{organization?.causes[0] ?? 'Your organization'}</p>
                      <h3>{joined.name} <CheckCircle2 size={15} /></h3>
                      <p>{message}</p>
                      <div><span><UsersRound size={14} /> Organization roster</span><Link className={styles.organizationProfileButton} href={href}>View organization <ArrowUpRight size={14} /></Link></div>
                    </div>
                  </div>
                  <OrganizationRosterOpportunities openRosterShifts={openRosterShiftsByOrganization.get(joined.id) ?? []} privateShifts={privateShiftsByOrganization.get(joined.id) ?? []} />
                </article>
              })}
            </div>
          </> : <>
            <div className={styles.organizationList}>
              {directory.length === 0 ? <section className={styles.calendarEmpty}><Building2 size={20} /><div><b>No organizations are available yet.</b><p>Check back as more local partners join your city network.</p></div></section> : directory.map((organization, index) => {
                const href = organization.org.slug ? `/orgs/${organization.org.slug}` : '/orgs'
                const message = organization.tagline || organization.mission || organization.org.description || 'A City/Sync organization helping its local community.'
                const organizationOpportunities = opportunitiesByOrganization.get(organization.org.id) ?? []
                const publicShiftCount = organizationOpportunities
                  .filter((opportunity) => !opportunity.isOnboarding && opportunity.nextEnrollmentMode === 'open_claims')
                  .reduce((count, opportunity) => count + opportunity.openShiftCount, 0)
                const publicApplications = intakesByOrganization.get(organization.org.id) ?? []
                return <article className={`${styles.organizationCard} ${styles.organizationCardWithOpportunities}`} key={organization.org.id}>
                  <div className={styles.organizationCardTop}>
                    <div className={`${styles.organizationArt} ${styles[index % 3 === 0 ? 'foodArt' : index % 3 === 1 ? 'toolArt' : 'creekArt']} ${organization.logoUrl ? styles.organizationArtWithImage : ''}`}>
                      {organization.logoUrl
                        ? <img className={styles.organizationArtImage} src={organization.logoUrl} alt={`${organization.org.name} profile`} />
                        : <><span>{initials(organization.org.name)}</span><i /><i /><i /></>}
                    </div>
                    <div className={styles.organizationDetails}>
                      <p className={styles.organizationCause}>{organization.causes[0] ?? 'Community organization'}</p>
                      <h3>{organization.org.name} <CheckCircle2 size={15} /></h3>
                      <p>{message}</p>
                      <div><span><UsersRound size={14} /> {publicShiftCount} public shift{publicShiftCount === 1 ? '' : 's'} · {publicApplications.length} application{publicApplications.length === 1 ? '' : 's'}</span><Link className={styles.organizationProfileButton} href={href}>Explore organization <ArrowUpRight size={14} /></Link></div>
                    </div>
                  </div>
                  <OrganizationVolunteerIntakes intakes={publicApplications} />
                  <OrganizationPublishedOpportunities opportunities={organizationOpportunities} publicDiscoveryOnly />
                </article>
              })}
            </div>
          </>}
        </section>
      </div>
    </main>
  )
}
