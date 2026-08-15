import Link from 'next/link'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileBarChart2,
  MapPin,
  MoreHorizontal,
  Plus,
  Send,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { db } from '@/lib/db/client'
import { claims, orgs, shifts, tasks, users } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { aggregateOpportunities } from '@/lib/services/profile'
import { participantDisplayName } from '@/lib/participant-name'
import { LabHeader } from '../LabHeader'
import { getLabWorkspace } from '../lab-workspace'
import { IssuerLabSidebar } from './IssuerLabSidebar'
import styles from '../prototype.module.css'

export const dynamic = 'force-dynamic'

function shortTime(timestamp: number | null) {
  if (!timestamp) return 'Time TBD'
  return new Date(timestamp).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

export default async function IssuerAestheticLabPage() {
  const session = await requireRole('issuer')
  const orgId = session.orgId!
  const { city, contexts } = await getLabWorkspace(session)
  const [org, taskRows, scheduledShifts, activeClaimRows, rosterRows, verifiedStats] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    city
      ? db.select().from(tasks).where(and(eq(tasks.orgId, orgId), eq(tasks.cityId, city.id))).orderBy(desc(tasks.createdAt))
      : Promise.resolve([]),
    city
      ? db
          .select({ shift: shifts, task: tasks })
          .from(shifts)
          .innerJoin(tasks, eq(shifts.taskId, tasks.id))
          .where(and(eq(shifts.orgId, orgId), eq(tasks.cityId, city.id), eq(shifts.status, 'open')))
          .orderBy(asc(shifts.startsAt), asc(shifts.createdAt))
      : Promise.resolve([]),
    city
      ? db
          .select({ claim: claims })
          .from(claims)
          .innerJoin(tasks, eq(claims.taskId, tasks.id))
          .where(and(eq(tasks.orgId, orgId), eq(tasks.cityId, city.id), inArray(claims.status, ['claimed', 'submitted', 'verified'])))
      : Promise.resolve([]),
    city
      ? db
          .select({ claim: claims, task: tasks, participant: users })
          .from(claims)
          .innerJoin(tasks, eq(claims.taskId, tasks.id))
          .innerJoin(users, eq(claims.userId, users.id))
          .where(and(eq(tasks.orgId, orgId), eq(tasks.cityId, city.id), inArray(claims.status, ['claimed', 'submitted'])))
          .orderBy(desc(claims.updatedAt))
          .limit(3)
      : Promise.resolve([]),
    city
      ? db
          .select({ verified: sql<number>`count(*)` })
          .from(claims)
          .innerJoin(tasks, eq(claims.taskId, tasks.id))
          .where(and(eq(tasks.orgId, orgId), eq(tasks.cityId, city.id), eq(claims.status, 'verified')))
      : Promise.resolve([]),
  ])
  const aggregate = await aggregateOpportunities(taskRows)
  const activeByShift = new Map<string | null, number>()
  for (const { claim } of activeClaimRows) activeByShift.set(claim.shiftId, (activeByShift.get(claim.shiftId) ?? 0) + 1)
  const openSpots = scheduledShifts.reduce((total, { shift }) => total + Math.max(0, shift.capacity - (activeByShift.get(shift.id) ?? 0)), 0)
  const activeVolunteers = new Set(activeClaimRows.map(({ claim }) => claim.userId)).size
  const verifiedCount = Number(verifiedStats[0]?.verified ?? 0)
  const displayShifts = scheduledShifts.slice(0, 3)

  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-overview" workspace="issuer" session={session} city={city} contexts={contexts} />

      <div className={styles.issuerLayout}>
        <IssuerLabSidebar active="overview" organizationName={org?.name} cityName={city?.name} />

        <section className={styles.issuerMain} id="overview" aria-label="Organization workspace">
          <section className={styles.issuerHero}>
            <div>
              <p className={styles.eyebrow}>Organization workspace</p>
              <h2>Keep the good work moving.</h2>
              <p>{scheduledShifts.length > 0 ? `${scheduledShifts.length} upcoming shift${scheduledShifts.length === 1 ? '' : 's'} need your attention this week.` : 'Start by creating an opportunity your community can join.'}</p>
            </div>
            <div className={styles.issuerHeroActions}>
              <Link href="/issuer/catalog" className={styles.issuerPrimaryAction}><Plus size={18} /> Post opportunity</Link>
              <Link href="/issuer/volunteers" className={styles.issuerSecondaryAction}><Send size={17} /> Message roster</Link>
            </div>
          </section>

          <section className={styles.issuerMetricGrid} aria-label="Organization metrics">
            <article><span>{openSpots}</span><div><b>Open volunteer spots</b><small>Across {taskRows.filter((task) => task.status === 'open').length} published opportunities</small></div><ArrowUpRight size={16} /></article>
            <article><span>{activeVolunteers}</span><div><b>Active volunteers</b><small>With an active or submitted commitment</small></div><ArrowUpRight size={16} /></article>
            <article><span>{verifiedCount}</span><div><b>Verified contributions</b><small>Recognized in this city</small></div><ArrowUpRight size={16} /></article>
          </section>

          <section className={styles.issuerScheduleCard}>
            <div className={styles.issuerPanelHeading}>
              <div><p className={styles.eyebrow}>This week</p><h2>Volunteer schedule</h2></div>
              <Link href="/issuer"><span>Open calendar</span> <ArrowUpRight size={14} /></Link>
            </div>
            <div className={styles.issuerScheduleTrack}>
              {displayShifts.length === 0 ? <p className={styles.emptyCopy}>No upcoming shifts are scheduled. Create an opportunity to begin building your calendar.</p> : displayShifts.map(({ shift, task }) => (
                <article key={shift.id} className={`${styles.issuerShift} ${styles[task.title.toLowerCase().includes('onboard') ? 'gold' : 'blue']}`}>
                  <div><span>{shift.startsAt ? new Date(shift.startsAt).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() : 'TBD'}</span><strong>{shift.startsAt ? new Date(shift.startsAt).getDate() : '—'}</strong></div>
                  <p><b>{task.title}</b><small><Clock3 size={13} /> {shortTime(shift.startsAt)}</small></p>
                  <span className={styles.shiftCount}>{activeByShift.get(shift.id) ?? 0} / {shift.capacity}</span>
                </article>
              ))}
            </div>
            {displayShifts.some(({ task }) => task.title.toLowerCase().includes('onboard')) ? <div className={styles.issuerScheduleNote}><Sparkles size={17} /><span><b>You have an onboarding session on the calendar.</b> Keep its capacity current so new participants can reliably find a first step.</span><Link href="/issuer/catalog">Manage <ChevronRight size={15} /></Link></div> : null}
          </section>

          <section className={styles.issuerCatalogCard} id="catalog">
            <div className={styles.issuerPanelHeading}>
              <div><p className={styles.eyebrow}>Opportunity catalog</p><h2>Published opportunities</h2></div>
              <Link href="/issuer/catalog" className={styles.issuerTextButton}>Manage templates <ArrowUpRight size={14} /></Link>
            </div>
            <div className={styles.issuerOpportunityList}>
              {taskRows.length === 0 ? <p className={styles.emptyCopy}>Your published opportunities will appear here.</p> : taskRows.slice(0, 4).map((task) => {
                const card = aggregate.get(task.id)
                const isOnboarding = task.title.toLowerCase().includes('onboard')
                return <article key={task.id}>
                  <span className={`${styles.issuerStatus} ${styles[isOnboarding ? 'onboarding' : task.status === 'open' ? 'open' : 'closed']}`}>{isOnboarding ? 'Onboarding' : task.status}</span>
                  <div><h3>{task.title}</h3><p><CalendarDays size={14} /> {card?.nextShiftAt ? shortTime(card.nextShiftAt) : 'No scheduled shift'} <i /> <UsersRound size={14} /> {card?.totalOpenSlots ?? 0} spot{card?.totalOpenSlots === 1 ? '' : 's'} open</p></div>
                  <Link href={`/issuer/tasks/${task.id}`} aria-label={`Manage ${task.title}`}><MoreHorizontal size={20} /></Link>
                </article>
              })}
            </div>
          </section>

          <section className={styles.issuerManagementGrid} aria-label="Organization management">
            <section className={styles.issuerRosterCard} id="volunteers">
              <div className={styles.issuerPanelHeading}>
                <div><p className={styles.eyebrow}>Volunteer roster</p><h2>People to know today</h2></div>
                <UsersRound size={18} />
              </div>
              <div className={styles.issuerRosterList}>
                {rosterRows.length === 0 ? <p className={styles.emptyCopy}>Volunteer commitments will appear here as people sign up.</p> : rosterRows.map(({ claim, task, participant }) => (
                  <Link href="/issuer/volunteers" key={claim.id}>
                    <span className={styles.rosterAvatar}>{participantDisplayName(participant).slice(0, 2).toUpperCase()}</span>
                    <div><b>{participantDisplayName(participant)}</b><small>{task.title}</small></div>
                    <em>{claim.status === 'submitted' ? 'Awaiting verification' : 'Confirmed'}</em>
                  </Link>
                ))}
              </div>
              <Link className={styles.issuerFooterLink} href="/issuer/volunteers">View full roster <ArrowUpRight size={14} /></Link>
            </section>

            <section className={styles.issuerMessageCard}>
              <span><Send size={19} /></span>
              <div><p className={styles.eyebrow}>Roster note</p><h2>Send a helpful reminder.</h2><p>Reach your full roster or a saved volunteer grouping from one place.</p></div>
              <Link href="/issuer/volunteers">Message volunteers <ArrowUpRight size={14} /></Link>
            </section>

            <section className={styles.issuerReportCard} id="reports">
              <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Impact snapshot</p><h2>Made visible</h2></div><FileBarChart2 size={18} /></div>
              <div className={styles.issuerImpactBars}>
                <div><span>Verified contributions</span><strong>{verifiedCount}</strong><i><b /></i></div>
                <div><span>Active volunteers</span><strong>{activeVolunteers}</strong><i><b /></i></div>
                <div><span>Open spaces</span><strong>{openSpots}</strong><i><b /></i></div>
              </div>
              <Link href="/issuer/reports">Open reporting view <ArrowUpRight size={14} /></Link>
            </section>

            <section className={styles.issuerPublicProfileCard} id="profile">
              <div><MapPin size={17} /><span>Public profile</span></div>
              <h2>What people see before they join you.</h2>
              <p>Mission, opportunities, onboarding, and how to get involved—clear and ready to share.</p>
              <Link href="/issuer/profile">Preview profile <ArrowUpRight size={14} /></Link>
            </section>
          </section>
        </section>
      </div>
    </main>
  )
}
