import Link from 'next/link'
import { and, asc, desc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm'
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
import { ActionQueueCard } from '../ActionQueueCard'
import { getLabWorkspace } from '../lab-workspace'
import { IssuerLabSidebar } from './IssuerLabSidebar'
import { IssuerHeroClock } from './IssuerHeroClock'
import { IssuerSchedulePanel } from './IssuerSchedulePanel'
import styles from '../prototype.module.css'

export const dynamic = 'force-dynamic'

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
  const schedule = scheduleBounds()
  const [
    org,
    scheduledShifts,
    rosterClaimRows,
    pendingShiftClaimRows,
    newSignupRows,
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
          .select({ claim: claims, shift: shifts, task: tasks })
          .from(claims)
          .innerJoin(tasks, eq(claims.taskId, tasks.id))
          .innerJoin(shifts, eq(claims.shiftId, shifts.id))
          .where(and(
            eq(tasks.orgId, orgId),
            eq(tasks.cityId, city.id),
            eq(shifts.status, 'open'),
            inArray(claims.status, ['claimed', 'submitted']),
            or(isNull(shifts.startsAt), lte(shifts.startsAt, now)),
          ))
          .orderBy(desc(shifts.startsAt), desc(claims.updatedAt))
      : Promise.resolve([]),
    city
      ? db
          .select({ claim: claims, shift: shifts, task: tasks, participant: users })
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
  const staffingNeeds = scheduledShifts
    .filter(({ shift }) => Boolean(shift.startsAt && shift.startsAt > now && shift.startsAt <= now + 7 * 24 * 60 * 60 * 1000))
    .map(({ shift, task }) => ({ shift, task, openSpots: Math.max(0, shift.capacity - (activeByShift.get(shift.id) ?? 0)) }))
    .filter(({ openSpots }) => openSpots > 0)
    .slice(0, 3)
  const queue = [
    ...pendingVerificationGroups.map(({ shift, task, participantCount }) => ({
      key: `verify:${shift.id}`,
      kind: 'verify' as const,
      title: `Verify & close · review ${participantCount} reservation${participantCount === 1 ? '' : 's'}`,
      detail: `${task.title} · ${shift.startsAt ? new Date(shift.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Active shift'}`,
      href: `/aesthetic-lab/issuer/shifts/${shift.id}/verify`,
      action: 'Verify & Close',
    })),
    ...staffingNeeds.map(({ shift, task, openSpots }) => ({
      key: `staffing:${shift.id}:${openSpots}`,
      kind: 'staffing' as const,
      title: `${openSpots} open spot${openSpots === 1 ? '' : 's'} · ${task.title}`,
      detail: `${shift.visibility === 'private' ? 'Organization assignment' : 'Open signup'} · ${shift.startsAt ? new Date(shift.startsAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Upcoming shift'}`,
      href: `/aesthetic-lab/issuer/programs/${task.programId ?? 'organization'}#${task.isOnboarding === 1 ? 'program-onboarding' : shift.visibility === 'private' ? 'program-staffing' : 'program-schedule'}`,
      action: task.isOnboarding === 1 ? 'Review session' : shift.visibility === 'private' ? 'Assign' : 'Review',
    })),
    ...newSignupRows.map(({ claim, shift, task, participant }) => {
      const isOnboarding = task.isOnboarding === 1
      return {
        key: `signup:${claim.id}`,
        kind: 'signup' as const,
        title: `${participantDisplayName(participant)} signed up`,
        detail: `${isOnboarding ? 'Onboarding session' : 'Volunteer shift'} · ${task.title}${shift.startsAt ? ` · ${new Date(shift.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}`,
        href: `/aesthetic-lab/issuer/programs/${task.programId ?? 'organization'}#${isOnboarding ? 'program-onboarding' : 'program-schedule'}`,
        action: isOnboarding ? 'View session' : 'View shift',
      }
    }),
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
  const actionItems = queue.filter((item) => item.kind === 'verify' || item.kind === 'staffing')
  const notificationItems = queue.filter((item) => item.kind !== 'verify' && item.kind !== 'staffing')
  const renderQueueItem = (item: typeof queue[number]) => (
    <article key={item.key} data-queue-kind={item.kind}>
      <span className={`${styles.issuerQueueIcon} ${styles[`issuerQueue${item.kind[0].toUpperCase()}${item.kind.slice(1)}`]}`}>{item.kind === 'verify' ? <CheckCircle2 size={17} /> : item.kind === 'staffing' ? <UsersRound size={17} /> : item.kind === 'signup' ? <UserRoundCheck size={17} /> : <Bell size={17} />}</span>
      <div><b>{item.title}</b><small>{item.detail}</small></div>
      <div className={styles.issuerQueueActions}>
        <form action={acknowledgeOrganizationQueueAction}>
          <input type="hidden" name="actionKey" value={item.key} />
          <button type="submit">Acknowledge</button>
        </form>
        <Link href={item.href}>{item.action} <ArrowUpRight size={13} /></Link>
      </div>
    </article>
  )

  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-overview" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />

      <div className={styles.issuerLayout}>
        <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />

        <section className={styles.issuerMain} id="overview" aria-label="Organization workspace">
          <section className={styles.issuerHero}>
            <div>
              <p className={styles.eyebrow}>{org?.name ?? 'Your organization'}</p>
              <h2>Keep today’s work moving.</h2>
              <p>{scheduledShifts.length ? `${scheduledShifts.length} scheduled volunteer event${scheduledShifts.length === 1 ? '' : 's'} are ready for your organization.` : 'Start by creating an opportunity your community can join.'}</p>
            </div>
            <IssuerHeroClock className={styles.issuerHeroClock} />
            <div className={styles.issuerHeroActions}>
              <Link href="/aesthetic-lab/issuer/catalog" className={styles.issuerHomeWorkspaceAction}><ClipboardList size={18} /> Open Workspace</Link>
            </div>
          </section>

          <LabNotice hidden ok={searchParams.ok} error={searchParams.error} />

          <ActionQueueCard historyHref="/aesthetic-lab/issuer/notification-history" historyLabel="Open notification history">
            <div className={styles.issuerQueueList}>
              {queue.length ? <>
                {actionItems.length ? <section className={styles.issuerQueueGroup} data-queue-group="action"><div className={styles.issuerQueueGroupHeading}><b>Action Items ({actionItems.length})</b></div><div className={styles.issuerQueueGroupItems}>{actionItems.map(renderQueueItem)}</div></section> : null}
                {notificationItems.length ? <section className={styles.issuerQueueGroup} data-queue-group="notification"><div className={styles.issuerQueueGroupHeading}><b>Notifications ({notificationItems.length})</b></div><div className={styles.issuerQueueGroupItems}>{notificationItems.map(renderQueueItem)}</div></section> : null}
              </> : <p className={styles.issuerQueueEmpty}><b>Nothing to Review!</b></p>}
            </div>
          </ActionQueueCard>

          <IssuerSchedulePanel entries={scheduleEntries} />
        </section>
      </div>
    </main>
  )
}
