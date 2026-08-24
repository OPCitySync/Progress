import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, asc, desc, eq } from 'drizzle-orm'
import {
  ArrowUpRight,
  Bookmark,
  Building2,
  CalendarDays,
  ChevronDown,
  Heart,
  MapPin,
  Sparkles,
} from 'lucide-react'
import { claims, orgs, shifts, tasks } from '@/lib/db/schema'
import { db } from '@/lib/db/client'
import { requireSession } from '@/lib/auth/session'
import { getFeed } from '@/lib/services/feed'
import { getCityImpact } from '@/lib/services/leaderboard'
import { getParticipantOrganizations } from '@/lib/services/participant-workspace'
import { getMyResume } from '@/lib/services/resume'
import { savedItemIds } from '@/lib/services/saved-items'
import { LabHeader } from './LabHeader'
import { MyCityFeedContent, type LabFeedPost, type LabCommitment } from './MyCityFeedContent'
import { getLabWorkspace } from './lab-workspace'
import styles from './prototype.module.css'

export const dynamic = 'force-dynamic'

function shortTime(timestamp: number | null) {
  if (!timestamp) return 'Time TBD'
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** The participant Home experience using the same session and records as the functional application. */
export default async function AestheticLabPage() {
  const session = await requireSession('/aesthetic-lab')
  if (session.role === 'issuer') redirect('/aesthetic-lab/issuer')
  if (session.role !== 'participant') redirect('/participant')

  const { city, cities, contexts } = await getLabWorkspace(session)
  const [resume, joinedOrganizations, feed, impact, claimRows, cityEvents] = await Promise.all([
    getMyResume(session.sub),
    getParticipantOrganizations(session.sub),
    getFeed(session.sub),
    getCityImpact(city?.id),
    city
      ? db
          .select({ claim: claims, task: tasks, org: orgs, shift: shifts })
          .from(claims)
          .innerJoin(tasks, eq(claims.taskId, tasks.id))
          .innerJoin(orgs, eq(tasks.orgId, orgs.id))
          .leftJoin(shifts, eq(claims.shiftId, shifts.id))
          .where(and(eq(claims.userId, session.sub), eq(tasks.cityId, city.id)))
          .orderBy(desc(claims.updatedAt))
      : Promise.resolve([]),
    city
      ? db
          .select({ task: tasks, org: orgs, shift: shifts })
          .from(shifts)
          .innerJoin(tasks, eq(shifts.taskId, tasks.id))
          .innerJoin(orgs, eq(tasks.orgId, orgs.id))
          .where(and(eq(tasks.cityId, city.id), eq(tasks.status, 'open'), eq(shifts.status, 'open'), eq(shifts.visibility, 'public')))
          .orderBy(asc(shifts.startsAt), asc(shifts.createdAt))
          .limit(3)
      : Promise.resolve([]),
  ])
  const savedPostIds = await savedItemIds(session.sub, 'post', feed.map(({ post }) => post.id))

  const activeClaims = claimRows.filter((row) => row.claim.status === 'claimed' || row.claim.status === 'submitted')
  const feedPosts: LabFeedPost[] = feed.map(({ post, org, hearts, heartedByMe }) => ({
    id: post.id,
    body: post.body,
    createdAt: post.createdAt,
    organization: org.name,
    organizationType: org.type,
    hearts,
    heartedByMe,
    savedByMe: savedPostIds.has(post.id),
  }))
  const commitments: LabCommitment[] = activeClaims.map(({ claim, task, org, shift }) => ({
    id: claim.id,
    title: task.title,
    organization: org.name,
    startsAt: shift?.startsAt ?? null,
    location: task.location,
    isOnboarding: false,
  }))
  const participation = city?.participation?.status
  const cityLabel = city ? (city.id === 'mexico-city' ? 'Mexico City, Mexico' : `${city.name}, California`) : 'Choose a city'

  return (
    <main className={styles.app}>
      <LabHeader activeSection="feed" session={session} city={city} cities={cities} contexts={contexts} />

      <div className={styles.layout}>
        <aside className={styles.leftRail}>
          <section className={styles.cityCard}>
            <div className={styles.cityCardTop}>
              <span className={styles.cityOverline}>My City is:</span>
            </div>
            <div className={styles.cityName}><MapPin size={17} /><span>{cityLabel}</span></div>
            <p>{city ? 'This is your active City/Sync network.' : 'Choose a City/Sync network to find local opportunities.'}</p>
            <Link href="/aesthetic-lab/cities">Explore other cities <ArrowUpRight size={14} /></Link>
          </section>

          <section className={styles.cityPulse}>
            <div className={styles.sectionHeading}><p className={styles.eyebrow}>{city?.name ?? 'City'} Pulse</p><span>Live</span></div>
            {[
              { label: 'Active volunteers', detail: `${impact.volunteers} people participating`, color: 'sun' },
              { label: 'Contributions', detail: `${impact.contributions} verified locally`, color: 'blue' },
              { label: 'Organizations', detail: `${impact.organizations} local partners`, color: 'coral' },
            ].map((note) => <div key={note.label} className={styles.pulseItem}><i className={styles[note.color]} /><span><b>{note.label}</b><small>{note.detail}</small></span></div>)}
          </section>

          <section className={styles.quickLinks}>
            <Link href="/aesthetic-lab/organizations"><Building2 size={17} /> Discover organizations</Link>
            <Link href="/aesthetic-lab/opportunities?saved=1"><Heart size={17} /> Saved opportunities</Link>
          </section>
        </aside>

        <section className={styles.feed} aria-label="MyCity Feed">
          <section className={`${styles.issuerHero} ${styles.participantFeedHero}`}>
            <div><p className={styles.eyebrow}>MyCity Feed</p><h2>There are good things happening today.</h2></div>
          </section>
          <MyCityFeedContent posts={feedPosts} commitments={commitments} />
        </section>

        <aside className={styles.rightRail}>
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

          <section className={styles.todayEventsCard}>
            <div className={styles.sectionHeading}><p className={styles.eyebrow}>My Calendar</p><CalendarDays size={17} /></div>
            <div className={styles.todayEventList}>
              {cityEvents.length === 0 ? <p className={styles.emptyCopy}>No upcoming public shifts are scheduled yet.</p> : cityEvents.map(({ task, org, shift }) => (
                <Link href={`/aesthetic-lab/opportunities/${task.id}`} key={shift.id}><span>{shortTime(shift.startsAt)}</span><div><b>{task.title}</b><p>{task.location || org.name}</p></div><ArrowUpRight size={14} /></Link>
              ))}
            </div>
            <Link className={styles.viewEventsLink} href="/aesthetic-lab/opportunities">View city calendar <ArrowUpRight size={14} /></Link>
          </section>

          <section className={styles.impactCard}>
            <p className={styles.eyebrow}>My impact</p>
            <div className={styles.impactGrid}>
              <div><strong>{String(activeClaims.length).padStart(2, '0')}</strong><span>Active shifts</span></div>
              <div><strong>{resume?.totals.hours ?? 0}h</strong><span>Service record</span></div>
              <div><strong>{String(joinedOrganizations.length).padStart(2, '0')}</strong><span>Organizations</span></div>
            </div>
            <Link href="/aesthetic-lab/history"><Bookmark size={15} /> View service history</Link>
          </section>
        </aside>
      </div>
    </main>
  )
}
