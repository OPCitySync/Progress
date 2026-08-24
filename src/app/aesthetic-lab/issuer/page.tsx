import Link from 'next/link'
import { and, asc, desc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm'
import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ClipboardList,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react'
import { db } from '@/lib/db/client'
import { claims, organizationQueueAcknowledgements, orgs, shifts, tasks, users } from '@/lib/db/schema'
import { acknowledgeOrganizationQueueAction } from '@/app/actions'
import { requireRole } from '@/lib/auth/session'
import { participantDisplayName } from '@/lib/participant-name'
import { getUnreadMessageCount } from '@/lib/services/roster'
import { getUnreadNotificationCount } from '@/lib/services/notifications'
import { getOrganizationCalendarEntries } from '@/lib/services/organization-calendar'
import { LabHeader } from '../LabHeader'
import { LabNotice } from '../LabNotice'
import { getLabWorkspace } from '../lab-workspace'
import { IssuerLabSidebar } from './IssuerLabSidebar'
import { IssuerSchedulePanel } from './IssuerSchedulePanel'
import styles from '../prototype.module.css'

export const dynamic = 'force-dynamic'

function dayBounds() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.getTime(), end: end.getTime() }
}

function scheduleBounds() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  // The calendar's month grid begins with the prior Monday. Looking back a
  // little further keeps multi-day private notes visible at the boundary.
  from.setDate(from.getDate() - 7)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 8)
  return { from: from.getTime(), to: to.getTime() }
}

export default async function IssuerAestheticLabPage({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const session = await requireRole('issuer')
  const orgId = session.orgId!
  const { city, cities, contexts } = await getLabWorkspace(session)
  const now = Date.now()
  const today = dayBounds()
  const schedule = scheduleBounds()
  const [
    org,
    scheduledShifts,
    rosterClaimRows,
    verifiedStats,
    cityEvents,
    pendingShiftClaimRows,
    pendingVolunteerRows,
    unreadNotificationCount,
    unreadMessageCount,
    calendarEntries,
    acknowledgedQueueRows,
  ] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
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
          .select({ verified: sql<number>`count(*)` })
          .from(claims)
          .innerJoin(tasks, eq(claims.taskId, tasks.id))
          .where(and(eq(tasks.orgId, orgId), eq(tasks.cityId, city.id), eq(claims.status, 'verified')))
      : Promise.resolve([]),
    city
      ? db
          .select({ shift: shifts, task: tasks, org: orgs })
          .from(shifts)
          .innerJoin(tasks, eq(shifts.taskId, tasks.id))
          .innerJoin(orgs, eq(tasks.orgId, orgs.id))
          .where(and(eq(tasks.cityId, city.id), eq(shifts.status, 'open'), eq(shifts.visibility, 'public'), gte(shifts.startsAt, today.start), lt(shifts.startsAt, today.end)))
          .orderBy(asc(shifts.startsAt), asc(orgs.name))
      : Promise.resolve([]),
    city
      ? db
          .select({ claim: claims, shift: shifts, task: tasks })
          .from(claims)
          .innerJoin(tasks, eq(claims.taskId, tasks.id))
          .innerJoin(shifts, eq(claims.shiftId, shifts.id))
          .where(and(eq(tasks.orgId, orgId), eq(tasks.cityId, city.id), inArray(claims.status, ['claimed', 'submitted']), lte(shifts.endsAt, now)))
          .orderBy(desc(shifts.endsAt), desc(claims.updatedAt))
      : Promise.resolve([]),
    city
      ? db
          .select({ claim: claims, task: tasks, participant: users })
          .from(claims)
          .innerJoin(tasks, eq(claims.taskId, tasks.id))
          .innerJoin(users, eq(claims.userId, users.id))
          .innerJoin(shifts, eq(claims.shiftId, shifts.id))
          .where(and(eq(tasks.orgId, orgId), eq(tasks.cityId, city.id), eq(claims.status, 'claimed'), gte(shifts.endsAt, now)))
          .orderBy(desc(claims.updatedAt))
          .limit(3)
      : Promise.resolve([]),
    getUnreadNotificationCount(session.sub),
    getUnreadMessageCount(session.sub),
    city ? getOrganizationCalendarEntries(orgId, city.id, schedule.from, schedule.to) : Promise.resolve([]),
    db.select({ actionKey: organizationQueueAcknowledgements.actionKey }).from(organizationQueueAcknowledgements).where(eq(organizationQueueAcknowledgements.orgId, orgId)),
  ])
  const activeByShift = new Map<string | null, number>()
  for (const { claim } of rosterClaimRows) activeByShift.set(claim.shiftId, (activeByShift.get(claim.shiftId) ?? 0) + 1)
  const rosterVolunteerCount = new Set(rosterClaimRows.map(({ claim }) => claim.userId)).size
  const verifiedCount = Number(verifiedStats[0]?.verified ?? 0)
  const unreadUpdates = unreadNotificationCount + unreadMessageCount
  const pendingVerificationGroups = Array.from(
    pendingShiftClaimRows.reduce((groups, row) => {
      const current = groups.get(row.shift.id)
      if (current) current.participantCount += 1
      else groups.set(row.shift.id, { shift: row.shift, task: row.task, participantCount: 1 })
      return groups
    }, new Map<string, { shift: typeof shifts.$inferSelect; task: typeof tasks.$inferSelect; participantCount: number }>()),
  ).map(([, group]) => group).slice(0, 3)
  const scheduleEntries = [
    ...scheduledShifts.map(({ shift, task }) => ({
      id: shift.id,
      taskId: task.id,
      title: task.title,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      capacity: shift.capacity,
      reserved: activeByShift.get(shift.id) ?? 0,
      isOnboarding: /onboard|orientation/i.test(task.title),
      color: /onboard|orientation/i.test(task.title) ? 'gold' as const : 'blue' as const,
    })),
    ...calendarEntries.map((entry) => ({
      id: `calendar-${entry.id}`,
      taskId: null,
      title: entry.title,
      startsAt: entry.startsAt,
      endsAt: entry.endsAt,
      capacity: null,
      reserved: null,
      isOnboarding: false,
      color: entry.color as 'blue' | 'gold' | 'mint' | 'coral',
    })),
  ]
  const acknowledgedQueueKeys = new Set(acknowledgedQueueRows.map(({ actionKey }) => actionKey))
  const queue = [
    ...pendingVerificationGroups.map(({ shift, task, participantCount }) => ({
      key: `verify:${shift.id}`,
      kind: 'verify' as const,
      title: `Verify ${participantCount} attendee${participantCount === 1 ? '' : 's'}`,
      detail: `${task.title} · ${shift.startsAt ? new Date(shift.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Completed shift'}`,
      href: `/aesthetic-lab/issuer/shifts/${shift.id}/verify`,
      action: 'Review',
    })),
    ...pendingVolunteerRows.map(({ claim, task, participant }) => ({
      key: `review:${claim.id}`,
      kind: 'review' as const,
      title: `Review ${participantDisplayName(participant)}’s volunteer request`,
      detail: task.title,
      href: '/aesthetic-lab/issuer/volunteers',
      action: 'Review',
    })),
    ...(unreadUpdates
      ? [{
          key: `updates:${unreadNotificationCount}:${unreadMessageCount}`,
          kind: 'update' as const,
          title: `${unreadUpdates} unread update${unreadUpdates === 1 ? '' : 's'}`,
          detail: unreadMessageCount ? 'Messages and City/Sync updates need your attention.' : 'A City/Sync update needs your attention.',
          href: '/aesthetic-lab/issuer/notifications',
          action: 'Open',
        }]
      : []),
  ].filter((item) => !acknowledgedQueueKeys.has(item.key)).slice(0, 6)

  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-overview" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />

      <div className={styles.issuerLayout}>
        <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />

        <section className={styles.issuerMain} id="overview" aria-label="Organization workspace">
          <section className={styles.issuerHero}>
            <div>
              <p className={styles.eyebrow}>Organization workspace</p>
              <h2>Keep today’s work moving.</h2>
              <p>{scheduledShifts.length ? `${scheduledShifts.length} scheduled volunteer event${scheduledShifts.length === 1 ? '' : 's'} are ready for your organization.` : 'Start by creating an opportunity your community can join.'}</p>
            </div>
            <div className={styles.issuerHeroActions}>
              <Link href="/aesthetic-lab/issuer/catalog" className={styles.issuerPrimaryAction}><ClipboardList size={18} /> Open Workspace</Link>
            </div>
          </section>

          <LabNotice hidden ok={searchParams.ok} error={searchParams.error} />

          <section className={styles.issuerMetricGrid} aria-label="Organization metrics">
            <article><span>{rosterVolunteerCount}</span><div><b>Volunteers</b><small>People in your organization’s roster</small></div><UsersRound size={16} /></article>
            <article><span>{verifiedCount}</span><div><b>Verified contributions</b><small>Recognized in this city</small></div><CheckCircle2 size={16} /></article>
            <Link href="/aesthetic-lab/issuer/events" className={styles.issuerMetricLink}><span>{cityEvents.length}</span><div><b>Events today</b><small>Across every organization in {city?.name ?? 'your city'}</small></div><ArrowUpRight size={16} /></Link>
          </section>

          <section className={styles.issuerTaskQueue} aria-label="Organization action queue">
            <div className={styles.issuerPanelHeading}>
              <div><p className={styles.eyebrow}>Action queue</p><h2>What needs attention.</h2></div>
              <Link className={styles.issuerQueueHistoryLink} href="/aesthetic-lab/issuer/notification-history" aria-label="Open notification history" title="Notification history">
                <ClipboardList size={19} />
              </Link>
            </div>
            <p className={styles.issuerQueueIntro}>Verification, volunteer review, and incoming updates are collected here so the next step is always clear.</p>
            <div className={styles.issuerQueueList}>
              {queue.length ? queue.map((item) => <article key={item.key}>
                <span className={`${styles.issuerQueueIcon} ${styles[`issuerQueue${item.kind[0].toUpperCase()}${item.kind.slice(1)}`]}`}>{item.kind === 'verify' ? <CheckCircle2 size={17} /> : item.kind === 'review' ? <UserRoundCheck size={17} /> : <Bell size={17} />}</span>
                <div><b>{item.title}</b><small>{item.detail}</small></div>
                <div className={styles.issuerQueueActions}>
                  <form action={acknowledgeOrganizationQueueAction}>
                    <input type="hidden" name="actionKey" value={item.key} />
                    <button type="submit">Acknowledge</button>
                  </form>
                  <Link href={item.href}>{item.action} <ArrowUpRight size={13} /></Link>
                </div>
              </article>) : <p className={styles.issuerQueueEmpty}>You’re caught up. New verifications, volunteer reviews, messages, and notifications will appear here.</p>}
            </div>
          </section>

          <IssuerSchedulePanel entries={scheduleEntries} />
        </section>
      </div>
    </main>
  )
}
