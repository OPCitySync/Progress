import Link from 'next/link'
import { and, desc, eq } from 'drizzle-orm'
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Heart,
  MapPin,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { db } from '@/lib/db/client'
import { orgProfiles, orgs, tasks } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { aggregateOpportunities, type PublicOpportunity } from '@/lib/services/profile'
import { getLabWorkspace } from '../lab-workspace'
import { LabHeader } from '../LabHeader'
import styles from '../prototype.module.css'

export const dynamic = 'force-dynamic'

type OpportunityRow = { card: PublicOpportunity; orgName: string; isOnboarding: boolean }

function opportunityDate(card: PublicOpportunity) {
  if (!card.nextShiftAt) return { day: 'TBD', date: '—' }
  const date = new Date(card.nextShiftAt)
  return { day: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(), date: String(date.getDate()) }
}

function opportunityTime(card: PublicOpportunity) {
  if (!card.nextShiftAt) return card.nextShiftLabel || 'Time to be confirmed'
  return new Date(card.nextShiftAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

function OpportunityCard({ row, tone }: { row: OpportunityRow; tone: 'mint' | 'blue' | 'coral' }) {
  const date = opportunityDate(row.card)
  return (
    <article className={styles.opportunityCard}>
      <div className={`${styles.opportunityDate} ${styles[tone]}`}><span>{date.day}</span><strong>{date.date}</strong></div>
      <div className={styles.opportunityMain}>
        <p className={styles.orgLine}><Building2 size={14} /> {row.orgName} <CheckCircle2 size={14} /></p>
        <h3>{row.card.title}</h3>
        <p className={styles.opportunityMeta}><Clock3 size={14} /> {opportunityTime(row.card)} <i /> <MapPin size={14} /> {row.card.location || 'Location to be confirmed'}</p>
        <p className={styles.capacityLine}><UsersRound size={14} /> {row.card.totalOpenSlots} spot{row.card.totalOpenSlots === 1 ? '' : 's'} open</p>
      </div>
      <Link href={`/participant/opportunities/${row.card.id}`} className={styles.cardArrow} aria-label={`View ${row.card.title}`}><ArrowUpRight size={19} /></Link>
    </article>
  )
}

export default async function OpportunitiesLabPage() {
  const session = await requireRole('participant')
  const { city, contexts } = await getLabWorkspace(session)
  const [rows, onboardingRows] = city
    ? await Promise.all([
        db
          .select({ task: tasks, org: orgs })
          .from(tasks)
          .innerJoin(orgs, eq(tasks.orgId, orgs.id))
          .where(and(eq(tasks.status, 'open'), eq(orgs.status, 'approved'), eq(tasks.cityId, city.id)))
          .orderBy(desc(tasks.createdAt)),
        db.select({ taskId: orgProfiles.onboardingTaskId }).from(orgProfiles),
      ])
    : [[], []]
  const onboardingTaskIds = new Set(onboardingRows.flatMap((row) => row.taskId ? [row.taskId] : []))
  const aggregate = await aggregateOpportunities(rows.map((row) => row.task))
  const cards: OpportunityRow[] = rows
    .map((row) => ({ card: aggregate.get(row.task.id), orgName: row.org.name, isOnboarding: onboardingTaskIds.has(row.task.id) }))
    .filter((row): row is OpportunityRow => !!row.card && row.card.openShiftCount > 0 && row.card.totalOpenSlots > 0)
    .sort((a, b) => (a.card.nextShiftAt ?? Number.MAX_SAFE_INTEGER) - (b.card.nextShiftAt ?? Number.MAX_SAFE_INTEGER))
  const onboarding = cards.filter((row) => row.isOnboarding)
  const open = cards.filter((row) => !row.isOnboarding)
  const isNewParticipant = city?.participation?.status === 'new'

  return (
    <main className={styles.app}>
      <LabHeader activeSection="opportunities" session={session} city={city} contexts={contexts} />

      <div className={styles.detailLayout}>
        <aside className={styles.leftRail}>
          <section className={styles.cityCard}>
            <div className={styles.cityCardTop}><span className={styles.cityOverline}>Showing opportunities in</span><Link href="/workspace/cities" aria-label="Change city"><ChevronDown size={16} /></Link></div>
            <div className={styles.cityName}><MapPin size={17} /><span>{city?.name ?? 'Choose a city'}</span></div>
            <p>Browse ways to help close to where you live, work, and spend time.</p>
            <Link href="/workspace/cities">Explore city network <ArrowUpRight size={14} /></Link>
          </section>

          <section className={styles.filterCard}>
            <div className={styles.sectionHeading}><p className={styles.eyebrow}>Refine your view</p><SlidersHorizontal size={16} /></div>
            <div className={styles.filterStack}>
              <button type="button" className={styles.filterSelected}>Open this week</button>
              <button type="button">Food access</button>
              <button type="button">Environment</button>
              <button type="button">Youth &amp; learning</button>
            </div>
          </section>
        </aside>

        <section className={styles.primaryColumn} aria-label="Available volunteer opportunities">
          <div className={styles.pageIntro}>
            <p className={styles.eyebrow}>{city?.name ?? 'City/Sync'} volunteer board</p>
            <h1>Find a way to show up.</h1>
            <p>Every opportunity comes from an approved local organization. Choose the time and cause that feel right to you.</p>
          </div>

          <section className={styles.onboardingCallout}>
            <span className={styles.calloutIcon}><Sparkles size={20} /></span>
            <div><p className={styles.eyebrow}>A good first step</p><h2>Start with an onboarding session.</h2><p>{isNewParticipant ? 'Complete one session to become a City Member and unlock local opportunities.' : 'Introductory sessions are always a good way to meet a local organization.'}</p></div>
            <a href="#onboarding">See sessions <ArrowUpRight size={17} /></a>
          </section>

          <div className={styles.listHeading} id="onboarding"><div><p className={styles.eyebrow}>Onboarding opportunities</p><h2>{onboarding.length} session{onboarding.length === 1 ? '' : 's'} available</h2></div><button type="button">Soonest first <ChevronDown size={15} /></button></div>
          <div className={styles.opportunityList}>
            {onboarding.length > 0 ? onboarding.map((row, index) => <OpportunityCard key={row.card.id} row={row} tone={index % 2 === 0 ? 'mint' : 'blue'} />) : <p className={styles.emptyCopy}>No onboarding sessions are open right now. Check back soon or explore local organizations.</p>}
          </div>

          <div className={styles.listHeading}><div><p className={styles.eyebrow}>Open opportunities</p><h2>{open.length} ways to help</h2></div><button type="button">Soonest first <ChevronDown size={15} /></button></div>
          {isNewParticipant ? <section className={styles.calendarEmpty}><Sparkles size={20} /><div><b>Complete onboarding to unlock these opportunities.</b><p>Once an organization verifies your local onboarding attendance, you can reserve any open shift in {city?.name ?? 'your city'}.</p></div></section> : <div className={styles.opportunityList}>{open.length > 0 ? open.map((row, index) => <OpportunityCard key={row.card.id} row={row} tone={index % 3 === 0 ? 'coral' : index % 3 === 1 ? 'blue' : 'mint'} />) : <p className={styles.emptyCopy}>No open opportunities are scheduled right now.</p>}</div>}
        </section>

        <aside className={styles.rightRail}>
          <section className={styles.commitmentCard}>
            <div className={styles.sectionHeading}><p className={styles.eyebrow}>Your commitments</p><CalendarDays size={17} /></div>
            <div className={styles.commitmentEmpty}><span>+ </span><p><b>Your calendar is ready.</b><br />A commitment will appear here once you sign up.</p></div>
            <Link href="/participant?commitmentView=calendar">View calendar <ArrowUpRight size={14} /></Link>
          </section>

          <section className={styles.savedCard}>
            <Heart size={19} fill="currentColor" /><div><p className={styles.eyebrow}>Saved for later</p><strong>Opportunity bookmarks</strong><span>Save a shift and return when you&apos;re ready.</span></div><ArrowUpRight size={16} />
          </section>
        </aside>
      </div>
    </main>
  )
}
