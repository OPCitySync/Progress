import Link from 'next/link'
import { and, asc, eq, gte, lt } from 'drizzle-orm'
import { ArrowUpRight, CalendarDays } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs, shifts, tasks } from '@/lib/db/schema'
import { getFeed } from '@/lib/services/feed'
import { getCityImpact } from '@/lib/services/leaderboard'
import { savedItemIds } from '@/lib/services/saved-items'
import { LabHeader } from '../../LabHeader'
import { MyCityFeedContent, type LabFeedPost } from '../../MyCityFeedContent'
import { getLabWorkspace } from '../../lab-workspace'
import { IssuerFeedComposer } from '../IssuerFeedComposer'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

function todayBounds() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.getTime(), end: end.getTime() }
}

function shortTime(timestamp: number | null) {
  if (!timestamp) return 'TBD'
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** The organization sees the same city conversation as a participant, with
 * one additional control: it can publish an update under its organization. */
export default async function IssuerMyCityFeedPage() {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const today = todayBounds()
  const [org, feed, impact, todayEvents] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, session.orgId!)).limit(1).then((rows) => rows[0] ?? null),
    getFeed(session.sub),
    getCityImpact(city?.id),
    city
      ? db
          .select({ shift: shifts, task: tasks, org: orgs })
          .from(shifts)
          .innerJoin(tasks, eq(shifts.taskId, tasks.id))
          .innerJoin(orgs, eq(tasks.orgId, orgs.id))
          .where(and(eq(tasks.cityId, city.id), eq(shifts.status, 'open'), eq(shifts.visibility, 'public'), gte(shifts.startsAt, today.start), lt(shifts.startsAt, today.end)))
          .orderBy(asc(shifts.startsAt), asc(orgs.name))
      : Promise.resolve([]),
  ])
  const savedPostIds = await savedItemIds(session.sub, 'post', feed.map(({ post }) => post.id))
  const posts: LabFeedPost[] = feed.map(({ post, org: postOrganization, hearts, heartedByMe }) => ({
    id: post.id,
    body: post.body,
    imageUrl: post.imageUrl,
    createdAt: post.createdAt,
    organization: postOrganization.name,
    organizationType: postOrganization.type,
    hearts,
    heartedByMe,
    savedByMe: savedPostIds.has(post.id),
  }))

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-utility" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={`${styles.issuerLayout} ${styles.issuerFeedLayout}`}>
      <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} isMyCityFeed />
      <section className={styles.feed} aria-label="MyCity Feed">
        <section className={`${styles.issuerHero} ${styles.issuerFeedHero}`}>
          <div><p className={`${styles.eyebrow} ${styles.myCityFeedLabel}`}>MyCity Feed</p><h2>There are good things happening today.</h2></div>
        </section>
        <MyCityFeedContent posts={posts} commitments={[]} redirectTo="/aesthetic-lab/issuer/feed" composer={<IssuerFeedComposer organizationName={org?.name ?? 'City/Sync'} />} />
      </section>
      <aside className={styles.issuerFeedRightRail} aria-label="City context">
        <section className={styles.issuerFeedTodayCard}>
          <div className={styles.issuerFeedRailHeading}><div><p className={styles.eyebrow}>Today’s Events</p><h2>Across {city?.name ?? 'your city'}</h2></div><CalendarDays size={18} /></div>
          <div className={styles.issuerFeedTodayList}>
            {todayEvents.length === 0 ? <p>No public volunteer events are scheduled today.</p> : todayEvents.slice(0, 4).map(({ shift, task, org: eventOrganization }) => <Link key={shift.id} href="/aesthetic-lab/issuer/events"><time>{shortTime(shift.startsAt)}</time><div><b>{task.title}</b><small>{eventOrganization.name}</small></div><ArrowUpRight size={14} /></Link>)}
          </div>
          <Link className={styles.issuerFeedRailLink} href="/aesthetic-lab/issuer/events">View city schedule <ArrowUpRight size={14} /></Link>
        </section>

        <section className={styles.issuerFeedPulseCard}>
          <div className={styles.issuerFeedRailHeading}><div><p className={styles.eyebrow}>City Pulse</p><h2>Collective Impact</h2></div><span>Live</span></div>
          <div className={styles.issuerFeedPulseList}>
            <div><i className={styles.blue} /><span><b>Verified volunteers</b><small>{impact.volunteers} people have completed local work</small></span><strong>{impact.volunteers}</strong></div>
            <div><i className={styles.sun} /><span><b>Verified contributions</b><small>Recognized across the network</small></span><strong>{impact.contributions}</strong></div>
            <div><i className={styles.coral} /><span><b>Local organizations</b><small>Current City Network partners</small></span><strong>{impact.organizations}</strong></div>
            <div><i className={styles.mint} /><span><b>Service hours</b><small>Documented by local teams</small></span><strong>{impact.hours}h</strong></div>
          </div>
        </section>
      </aside>
    </div>
  </main>
}
