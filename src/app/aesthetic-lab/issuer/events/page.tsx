import Link from 'next/link'
import { and, asc, eq, gte, lt } from 'drizzle-orm'
import { ArrowLeft, CalendarDays, Clock3, MapPin, UsersRound } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs, shifts, tasks } from '@/lib/db/schema'
import { LabHeader } from '../../LabHeader'
import { getLabWorkspace } from '../../lab-workspace'
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

function timeLabel(timestamp: number | null) {
  if (!timestamp) return 'Time TBD'
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** City-wide, read-only operational context reached from the Events Today metric. */
export default async function IssuerCityEventsPage() {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const range = todayBounds()
  const [org, events] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, session.orgId!)).limit(1).then((rows) => rows[0] ?? null),
    city
      ? db
          .select({ shift: shifts, task: tasks, org: orgs })
          .from(shifts)
          .innerJoin(tasks, eq(shifts.taskId, tasks.id))
          .innerJoin(orgs, eq(tasks.orgId, orgs.id))
          .where(and(eq(tasks.cityId, city.id), eq(shifts.status, 'open'), eq(shifts.visibility, 'public'), gte(shifts.startsAt, range.start), lt(shifts.startsAt, range.end)))
          .orderBy(asc(shifts.startsAt), asc(orgs.name))
      : Promise.resolve([]),
  ])

  const cityLabel = city?.name ?? 'your city'
  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-overview" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
        <section className={styles.issuerMain} aria-label="Today’s city events">
          <section className={styles.issuerPageHero}>
            <div><p className={styles.eyebrow}>City-wide schedule</p><h1>Events in {cityLabel}</h1></div>
            <Link href="/aesthetic-lab/issuer/feed" className={styles.issuerHistoryBack}><ArrowLeft size={15} /> Back to MyCity Feed</Link>
          </section>

          <section className={styles.issuerEventsCard}>
            <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Today’s events</p><h2>{events.length === 0 ? 'No Scheduled Events' : `${events.length} scheduled event${events.length === 1 ? '' : 's'}`}</h2></div><CalendarDays size={19} /></div>
            <div className={styles.issuerCityEventsList}>
              {events.length === 0 ? null : events.map(({ shift, task, org }) => <article key={shift.id}>
                <span>{timeLabel(shift.startsAt)}</span>
                <div><b>{task.title}</b><small>{org.name}</small></div>
                <p><MapPin size={14} /> {task.location || 'Location TBD'}</p>
                <em><UsersRound size={14} /> {shift.capacity} slots</em>
              </article>)}
            </div>
          </section>
        </section>
      </div>
    </main>
  )
}
