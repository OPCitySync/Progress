import Link from 'next/link'
import { and, desc, eq, gte } from 'drizzle-orm'
import { Bell, CheckCheck, UserRoundCheck } from 'lucide-react'
import { acknowledgeOrganizationQueueAction, markIssuerNotificationReadAction } from '@/app/actions'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { claims, notifications, organizationQueueAcknowledgements, orgs, shifts, tasks, users } from '@/lib/db/schema'
import { participantDisplayName } from '@/lib/participant-name'
import { LabHeader } from '../../LabHeader'
import { getLabWorkspace } from '../../lab-workspace'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

function formattedDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function isInternalPath(path: string) {
  return path.startsWith('/') && !path.startsWith('//')
}

export default async function IssuerUpdatesPage() {
  const session = await requireRole('issuer')
  const orgId = session.orgId!
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [org, storedNotifications, signupRows, acknowledgementRows] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(notifications).where(eq(notifications.userId, session.sub)).orderBy(desc(notifications.createdAt)).limit(100),
    db
      .select({ claim: claims, shift: shifts, task: tasks, participant: users })
      .from(claims)
      .innerJoin(tasks, eq(claims.taskId, tasks.id))
      .innerJoin(users, eq(claims.userId, users.id))
      .innerJoin(shifts, eq(claims.shiftId, shifts.id))
      .where(and(eq(tasks.orgId, orgId), eq(claims.status, 'claimed'), gte(shifts.endsAt, Date.now())))
      .orderBy(desc(claims.updatedAt))
      .limit(100),
    db
      .select({ actionKey: organizationQueueAcknowledgements.actionKey })
      .from(organizationQueueAcknowledgements)
      .where(eq(organizationQueueAcknowledgements.orgId, orgId)),
  ])
  const acknowledged = new Set(acknowledgementRows.map(({ actionKey }) => actionKey))
  const notificationItems = [
    ...storedNotifications.map((notice) => ({
      id: notice.id,
      actionKey: '',
      kind: 'notification' as const,
      title: notice.title,
      body: notice.body,
      link: notice.link,
      createdAt: notice.createdAt,
      unread: notice.readAt === null,
    })),
    ...signupRows.map(({ claim, shift, task, participant }) => {
      const isOnboarding = task.isOnboarding === 1
      const actionKey = `signup:${claim.id}`
      return {
        id: `signup-${claim.id}`,
        actionKey,
        kind: 'signup' as const,
        title: `${participantDisplayName(participant)} signed up`,
        body: `${isOnboarding ? 'Onboarding session' : 'Volunteer shift'} · ${task.title}${shift.startsAt ? ` · ${new Date(shift.startsAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}`,
        link: isOnboarding
          ? `/aesthetic-lab/issuer/volunteers?event=${shift.id}#event-${shift.id}`
          : `/aesthetic-lab/issuer/programs/${task.programId ?? 'organization'}?section=scheduling`,
        createdAt: claim.updatedAt,
        unread: !acknowledged.has(actionKey),
      }
    }),
  ].sort((left, right) => right.createdAt - left.createdAt)

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-utility" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerLayout}>
      <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
      <section className={styles.issuerMain} aria-label="Organization notifications">
        <section className={styles.issuerNotificationHistory}>
          <div className={styles.issuerNotificationHistoryHeading}>
            <div><p className={styles.eyebrow}>Organization notifications</p><h1>Notifications</h1></div>
          </div>
          <div className={styles.issuerNotificationHistoryList}>
            {notificationItems.length ? notificationItems.map((notice) => <article key={notice.id}>
              <span className={styles.issuerNotificationHistoryIcon}>{notice.kind === 'signup' ? <UserRoundCheck size={16} /> : <Bell size={16} />}</span>
              <div className={styles.issuerNotificationHistoryCopy}>
                <div><b>{notice.title}</b>{notice.unread ? <i>New</i> : <em>Read</em>}</div>
                {notice.body ? <p>{notice.body}</p> : null}
                <time dateTime={new Date(notice.createdAt).toISOString()}>{formattedDate(notice.createdAt)}</time>
              </div>
              <div className={styles.issuerNotificationHistoryActions}>
                {isInternalPath(notice.link) ? <Link href={notice.link}>Open</Link> : null}
                {notice.unread ? notice.kind === 'notification' ? <form action={markIssuerNotificationReadAction}>
                  <input type="hidden" name="notificationId" value={notice.id} />
                  <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/updates" />
                  <button type="submit"><CheckCheck size={13} />Mark read</button>
                </form> : <form action={acknowledgeOrganizationQueueAction}>
                  <input type="hidden" name="actionKey" value={notice.actionKey} />
                  <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/updates" />
                  <button type="submit"><CheckCheck size={13} />Mark read</button>
                </form> : null}
              </div>
            </article>) : <div className={styles.issuerNotificationHistoryEmpty}>
              <Bell size={18} />
              <div><b>No notifications yet.</b></div>
            </div>}
          </div>
        </section>
      </section>
    </div>
  </main>
}
