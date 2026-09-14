import Link from 'next/link'
import { and, desc, eq, inArray } from 'drizzle-orm'
import {
  ArrowUpRight,
  Bookmark,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Heart,
  MapPin,
  Search,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { db } from '@/lib/db/client'
import { claims, orgs, tasks, onboardingIntakes, volunteerPrograms } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { getParticipantOrganizations } from '@/lib/services/participant-workspace'
import { aggregateOpportunities, getPublicApplications, listPublicIssuers, type PublicOpportunity } from '@/lib/services/profile'
import { getMyResume } from '@/lib/services/resume'
import { savedItemIds } from '@/lib/services/saved-items'
import { getLabWorkspace } from '../lab-workspace'
import { LabHeader } from '../LabHeader'
import { SaveTaskButton } from '../SaveTaskButton'
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

function organizationJoinLabel(status: string) {
  if (status === 'verified') return 'Onboarding verified'
  if (status === 'submitted') return 'Attendance awaiting verification'
  return 'Onboarding reserved'
}

function OpportunityTabs({ activeTab, organizationCount }: { activeTab: 'onboarding' | 'organizations'; organizationCount: number }) {
  return <nav className={styles.opportunityTabs} aria-label="Opportunity views">
    <Link data-active={activeTab === 'onboarding'} href="/aesthetic-lab/opportunities">Onboarding</Link>
    <Link data-active={activeTab === 'organizations'} href="/aesthetic-lab/opportunities?tab=organizations">My Organizations <span>{organizationCount}</span></Link>
  </nav>
}

function OpportunityCard({ row, tone, redirectTo }: { row: OpportunityRow; tone: 'mint' | 'blue' | 'coral'; redirectTo: string }) {
  const date = opportunityDate(row.card)
  return (
    <article className={styles.opportunityCard}>
      <div className={`${styles.opportunityDate} ${styles[tone]}`}><span>{date.day}</span><strong>{date.date}</strong></div>
      <div className={styles.opportunityMain}>
        <p className={styles.orgLine}><Building2 size={14} /> {row.orgName} <CheckCircle2 size={14} /></p>
        <h3>{row.card.title}</h3>
        <p className={styles.opportunityMeta}><Clock3 size={14} /> {opportunityTime(row.card)} <i /> <MapPin size={14} /> {row.card.location || 'Location to be confirmed'}</p>
        <p className={styles.capacityLine}><UsersRound size={14} /> {row.card.nextEnrollmentMode === 'organization_managed' ? 'Organization-managed enrollment' : `${row.card.totalOpenSlots} spot${row.card.totalOpenSlots === 1 ? '' : 's'} open`}</p>
      </div>
      <div className={styles.labFormActions}><SaveTaskButton taskId={row.card.id} saved={row.savedByMe} redirectTo={redirectTo} /><Link href={`/aesthetic-lab/opportunities/${row.card.id}`} className={styles.cardArrow} aria-label={`View ${row.card.title}`}><ArrowUpRight size={19} /></Link></div>
    </article>
  )
}

function OrganizationPublishedOpportunities({ opportunities }: { opportunities: PublicOpportunity[] }) {
  return <section className={styles.organizationPublishedOpportunities}>
    <div className={styles.organizationSessionHeading}>
      <span><UsersRound size={16} /> Published opportunities</span>
      <em>{opportunities.length} available</em>
    </div>
    <div className={styles.organizationOpportunityList}>
      {opportunities.length === 0 ? <p>No volunteer opportunities are currently published by this organization.</p> : opportunities.map((opportunity) => (
        <article key={opportunity.id}>
          <div>
            <b>{opportunity.title}</b>
            <small><Clock3 size={13} /> {opportunityTime(opportunity)} <i /> <MapPin size={13} /> {opportunity.location || 'Location to be confirmed'}</small>
            <span><UsersRound size={13} /> {opportunity.totalOpenSlots} spot{opportunity.totalOpenSlots === 1 ? '' : 's'} open</span>
          </div>
          <Link href={`/aesthetic-lab/opportunities/${opportunity.id}`}>Sign up <ArrowUpRight size={14} /></Link>
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

async function OrganizationOnboardingSessions({ opportunities }: { opportunities: PublicOpportunity[] }) {
  const sessions = opportunities.filter((opportunity) => opportunity.isOnboarding)
  const intakeForms = sessions.length ? await db.select({ taskId: onboardingIntakes.taskId }).from(onboardingIntakes).where(and(inArray(onboardingIntakes.taskId,sessions.map(s=>s.id)),eq(onboardingIntakes.applicationRequired,1))) : []
  const applicationIds=new Set(intakeForms.map(f=>f.taskId))
  return <section className={styles.organizationOnboardingSessions}>
    <div className={styles.organizationSessionHeading}>
      <span><Sparkles size={16} /> Onboarding sessions</span>
      <em>{sessions.length} available</em>
    </div>
    <div className={styles.organizationSessionList}>
      {sessions.length === 0 ? <p>This organization does not have an onboarding session published right now.</p> : sessions.map((session) => (
        <details key={session.id} className={styles.organizationSessionDetails}>
          <summary>
            <div>
              <b>{session.title}</b>
              <small><Clock3 size={13} /> {opportunityTime(session)} <i /> <MapPin size={13} /> {session.location || 'Location to be confirmed'}</small>
            </div>
            <span>{session.totalOpenSlots} spot{session.totalOpenSlots === 1 ? '' : 's'} open <ChevronDown size={16} /></span>
          </summary>
          <div>
            <p>{session.description || 'Meet the organization, learn how its volunteer program works, and take the first step toward participating locally.'}</p>
            <Link href={`/aesthetic-lab/opportunities/${session.id}${applicationIds.has(session.id)?'#application':''}`}>{applicationIds.has(session.id)?'Apply':'Reserve a spot'} <ArrowUpRight size={14} /></Link>
          </div>
        </details>
      ))}
    </div>
  </section>
}

export default async function OpportunitiesLabPage({ searchParams }: { searchParams: { saved?: string; q?: string; cause?: string; tab?: string } }) {
  const session = await requireRole('participant')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const savedOnly = searchParams.saved === '1'
  const activeTab = searchParams.tab === 'organizations' ? 'organizations' : 'onboarding'
  const search = searchParams.q?.trim() ?? ''
  const cause = searchParams.cause?.trim() ?? ''
  const [directory, rows, resume, joinedOrganizations, activeClaimRows] = await Promise.all([
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
    city
      ? db
          .select({ id: claims.id })
          .from(claims)
          .innerJoin(tasks, eq(claims.taskId, tasks.id))
          .where(and(eq(claims.userId, session.sub), eq(tasks.cityId, city.id), inArray(claims.status, ['claimed', 'submitted'])))
      : Promise.resolve([]),
  ])
  const filteredOrganizations = directory.filter((organization) => {
    const searchable = `${organization.org.name} ${organization.tagline} ${organization.mission} ${organization.causes.join(' ')}`.toLowerCase()
    return (!cause || organization.causes.includes(cause)) && (!search || searchable.includes(search.toLowerCase()))
  })
  const missionAreas = Array.from(new Set(directory.flatMap((organization) => organization.causes))).slice(0, 8)
  const directoryById = new Map(directory.map((organization) => [organization.org.id, organization]))
  const organizationIds = Array.from(new Set([...directory.map((organization) => organization.org.id), ...joinedOrganizations.map((organization) => organization.id)]))
  const organizationTaskRows = city && organizationIds.length
    ? await db.select().from(tasks).where(and(inArray(tasks.orgId, organizationIds), eq(tasks.cityId, city.id), eq(tasks.status, 'open')))
    : []
  const organizationAggregate = await aggregateOpportunities(organizationTaskRows)
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
  const onboarding = cards.filter((row) => row.isOnboarding)
  const open = cards.filter((row) => !row.isOnboarding)
  const redirectTo = savedOnly ? '/aesthetic-lab/opportunities?saved=1' : '/aesthetic-lab/opportunities'
  const visibleOnboarding = savedOnly ? onboarding.filter((row) => row.savedByMe) : onboarding
  const visibleOpen = savedOnly ? open.filter((row) => row.savedByMe) : open
  const isNewParticipant = city?.participation?.status === 'new'
  const participation = city?.participation?.status
  const cityLabel = city ? (city.id === 'mexico-city' ? 'Mexico City, Mexico' : `${city.name}, California`) : 'Choose a city'

  return (
    <main className={styles.app}>
      <LabHeader activeSection="opportunities" session={session} city={city} cities={cities} contexts={contexts} />

      <div className={`${styles.detailLayout} ${styles.opportunitiesLayout}`}>
        <aside className={styles.leftRail}>
          <section className={styles.profileCard}>
            <div className={styles.profileCover}><i /><i /><i /></div>
            <div className={styles.profileBody}>
              <div className={styles.avatarLarge}>{session.name.slice(0, 1).toUpperCase() || 'U'}</div>
              <div className={styles.profileTitle}><p className={styles.eyebrow}>Civic participant</p><h2>{session.name}</h2><p>{cityLabel}</p></div>
              <div className={styles.membershipStatus}>
                <span><Sparkles size={15} /> {participation === 'active' ? 'City Member' : participation === 'barred' ? 'Participation restricted' : 'New participant'}</span>
                <p>{participation === 'active' ? 'Your local participation is verified.' : participation === 'barred' ? 'Your participation is temporarily paused.' : 'Complete one local onboarding session to become a City Member.'}</p>
                <div><i /><i /><i /></div>
                <Link href="/aesthetic-lab/opportunities">Find onboarding <ArrowUpRight size={14} /></Link>
              </div>
            </div>
          </section>

          <section className={styles.quickLinks}>
            <p className={styles.eyebrow}>Quick Actions</p>
            <Link href="/aesthetic-lab/commitments"><CalendarDays size={17} /> My Commitments</Link>
            <Link href="/aesthetic-lab/organizations"><Building2 size={17} /> Discover organizations</Link>
            <Link href="/aesthetic-lab/opportunities?saved=1"><Heart size={17} /> Saved opportunities</Link>
          </section>

          <section className={styles.impactCard}>
            <p className={styles.eyebrow}>My impact</p>
            <div className={styles.impactGrid}>
              <div><strong>{String(activeClaimRows.length).padStart(2, '0')}</strong><span>Active shifts</span></div>
              <div><strong>{resume?.totals.hours ?? 0}h</strong><span>Service record</span></div>
              <div><strong>{String(joinedOrganizations.length).padStart(2, '0')}</strong><span>Organizations</span></div>
            </div>
            <Link href="/aesthetic-lab/history"><Bookmark size={15} /> View service history</Link>
          </section>
        </aside>

        <section className={styles.primaryColumn} aria-label="Available volunteer opportunities">
          {savedOnly ? <>
            <div className={styles.pageIntro}>
              <p className={styles.eyebrow}>Saved opportunities</p>
              <h1>Keep the work that matters close.</h1>
              <p>These are the sessions you saved while exploring local organizations and their missions.</p>
            </div>
            <OpportunityTabs activeTab="onboarding" organizationCount={joinedOrganizations.length} />
            <div className={styles.listHeading} id="onboarding"><div><p className={styles.eyebrow}>Saved introductions</p><h2>{visibleOnboarding.length} session{visibleOnboarding.length === 1 ? '' : 's'} saved</h2></div><span>Soonest first</span></div>
            <div className={styles.opportunityList}>
              {visibleOnboarding.length > 0 ? visibleOnboarding.map((row, index) => <OpportunityCard key={row.card.id} row={row} redirectTo={redirectTo} tone={index % 2 === 0 ? 'mint' : 'blue'} />) : <p className={styles.emptyCopy}>No saved introduction sessions yet. Explore an organization to find the right place to begin.</p>}
            </div>
            <div className={styles.listHeading}><div><p className={styles.eyebrow}>Saved shifts</p><h2>{visibleOpen.length} way{visibleOpen.length === 1 ? '' : 's'} to help</h2></div><span>Soonest first</span></div>
            <div className={styles.opportunityList}>{visibleOpen.length > 0 ? visibleOpen.map((row, index) => <OpportunityCard key={row.card.id} row={row} redirectTo={redirectTo} tone={index % 3 === 0 ? 'coral' : index % 3 === 1 ? 'blue' : 'mint'} />) : <p className={styles.emptyCopy}>No saved opportunities yet. Save a shift from an organization you would like to support.</p>}</div>
          </> : activeTab === 'organizations' ? <>
            <div className={styles.pageIntro}>
              <p className={styles.eyebrow}>{city?.name ?? 'City/Sync'} volunteer discovery</p>
              <h1>Find a cause worth showing up for.</h1>
              <p>Start with the change you want to help make. Then get to know the local organization and volunteer program behind it.</p>
            </div>
            <OpportunityTabs activeTab="organizations" organizationCount={joinedOrganizations.length} />
            <section className={styles.myOrganizationsSummary}>
              <span><Building2 size={20} /></span>
              <div><p className={styles.eyebrow}>Your local network</p><h2>{joinedOrganizations.length ? `${joinedOrganizations.length} organization${joinedOrganizations.length === 1 ? '' : 's'} in your volunteer network.` : 'Your local volunteer network starts here.'}</h2><p>{joinedOrganizations.length ? 'Each organization can offer its own programs, materials, and volunteer opportunities.' : 'Complete an introduction session with an organization to add it here.'}</p></div>
            </section>
            <div className={styles.listHeading}><div><p className={styles.eyebrow}>Organizations you joined</p><h2>{joinedOrganizations.length} organization{joinedOrganizations.length === 1 ? '' : 's'}</h2></div><span>Onboarding status</span></div>
            <div className={styles.organizationList}>
              {joinedOrganizations.length === 0 ? <section className={styles.calendarEmpty}><Building2 size={20} /><div><b>You have not joined an organization yet.</b><p>Explore a mission that matters to you, then choose an organization’s introduction session to begin.</p></div></section> : joinedOrganizations.map((joined, index) => {
                const organization = directoryById.get(joined.id)
                const href = organization?.org.slug ? `/aesthetic-lab/organizations/${organization.org.slug}` : '/aesthetic-lab/organizations'
                const message = organization?.tagline || organization?.mission || 'This organization is part of your local City/Sync network.'
                return <article className={`${styles.organizationCard} ${styles.organizationCardWithOpportunities}`} key={joined.id}>
                  <div className={styles.organizationCardTop}>
                    <div className={`${styles.organizationArt} ${styles[index % 3 === 0 ? 'foodArt' : index % 3 === 1 ? 'toolArt' : 'creekArt']}`}><span>{initials(joined.name)}</span><i /><i /><i /></div>
                    <div className={styles.organizationDetails}>
                      <p className={styles.organizationCause}>{organization?.causes[0] ?? 'Your organization'}</p>
                      <h3>{joined.name} <CheckCircle2 size={15} /></h3>
                      <p>{message}</p>
                      <div><span><Sparkles size={14} /> {organizationJoinLabel(joined.claimStatus)}</span><Link href={href}>View organization <ArrowUpRight size={14} /></Link></div>
                    </div>
                  </div>
                  <OrganizationVolunteerIntakes intakes={intakesByOrganization.get(joined.id) ?? []} />
                  <OrganizationPublishedOpportunities opportunities={opportunitiesByOrganization.get(joined.id) ?? []} />
                </article>
              })}
            </div>
          </> : <>
            <div className={styles.pageIntro}>
              <p className={styles.eyebrow}>{city?.name ?? 'City/Sync'} volunteer discovery</p>
              <h1>Find a cause worth showing up for.</h1>
              <p>Start with the change you want to help make. Then get to know the local organization and volunteer program behind it.</p>
            </div>
            <OpportunityTabs activeTab="onboarding" organizationCount={joinedOrganizations.length} />

            <section className={styles.missionDiscovery}>
              <div className={styles.missionDiscoveryHeading}>
                <div><p className={styles.eyebrow}>Explore by mission</p><h2>What kind of difference do you want to make?</h2></div>
                {cause ? <Link href="/aesthetic-lab/opportunities">Clear mission <ArrowUpRight size={14} /></Link> : null}
              </div>
              <div className={styles.missionChipList}>
                <Link className={!cause ? styles.missionChipSelected : undefined} href="/aesthetic-lab/opportunities">All missions</Link>
                {missionAreas.map((mission) => <Link className={cause === mission ? styles.missionChipSelected : undefined} href={`/aesthetic-lab/opportunities?cause=${encodeURIComponent(mission)}`} key={mission}>{mission}</Link>)}
              </div>
              <p>Choose an area of work first. City/Sync will show you the organizations doing that work and the best way to begin with them.</p>
            </section>

            <form action="/aesthetic-lab/opportunities" method="get" className={styles.organizationSearch}>
              {cause ? <input type="hidden" name="cause" value={cause} /> : null}
              <Search size={18} aria-hidden="true" />
              <input type="search" name="q" defaultValue={search} placeholder={`Search ${city?.name ?? ''} organizations or missions`} aria-label="Search organizations or missions" />
            </form>

            <div className={styles.listHeading}><div><p className={styles.eyebrow}>{cause || 'Local organizations'}</p><h2>{filteredOrganizations.length} organization{filteredOrganizations.length === 1 ? '' : 's'} to explore</h2></div>{cause ? <span>Mission match</span> : null}</div>
            <div className={styles.organizationList}>
              {filteredOrganizations.length === 0 ? <section className={styles.calendarEmpty}><Building2 size={20} /><div><b>No organizations match this mission yet.</b><p>Try another area of work, or check back as more local partners join your city network.</p></div></section> : filteredOrganizations.map((organization, index) => {
                const href = organization.org.slug ? `/aesthetic-lab/organizations/${organization.org.slug}` : '/aesthetic-lab/organizations'
                const message = organization.tagline || organization.mission || organization.org.description || 'A City/Sync organization helping its local community.'
                return <article className={`${styles.organizationCard} ${styles.organizationCardWithOpportunities}`} key={organization.org.id}>
                  <div className={styles.organizationCardTop}>
                    <div className={`${styles.organizationArt} ${styles[index % 3 === 0 ? 'foodArt' : index % 3 === 1 ? 'toolArt' : 'creekArt']}`}><span>{initials(organization.org.name)}</span><i /><i /><i /></div>
                    <div className={styles.organizationDetails}>
                      <p className={styles.organizationCause}>{organization.causes[0] ?? 'Community organization'}</p>
                      <h3>{organization.org.name} <CheckCircle2 size={15} /></h3>
                      <p>{message}</p>
                      <div><span>{organization.onboardingTaskId ? <><Sparkles size={14} /> New volunteer path</> : <><UsersRound size={14} /> {organization.openCount} open opportunit{organization.openCount === 1 ? 'y' : 'ies'}</>}</span><Link href={href}>{organization.onboardingTaskId && isNewParticipant ? 'Start here' : 'Explore organization'} <ArrowUpRight size={14} /></Link></div>
                    </div>
                  </div>
                  <OrganizationVolunteerIntakes intakes={intakesByOrganization.get(organization.org.id) ?? []} />
                  <OrganizationOnboardingSessions opportunities={opportunitiesByOrganization.get(organization.org.id) ?? []} />
                </article>
              })}
            </div>
          </>}
        </section>
      </div>
    </main>
  )
}
