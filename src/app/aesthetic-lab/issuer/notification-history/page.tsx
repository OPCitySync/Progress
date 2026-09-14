import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { Bell, CheckCheck } from 'lucide-react'
import { markIssuerNotificationReadAction } from '@/app/actions'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { notifications, organizationQueueAcknowledgements, orgs, users } from '@/lib/db/schema'
import { participantDisplayName } from '@/lib/participant-name'
import { LabHeader } from '../../LabHeader'
import { HistoryBackButton } from '../../HistoryBackButton'
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

function acknowledgementLabel(actionKey: string) {
  const [kind] = actionKey.split(':', 1)
  if (kind === 'verify') return 'Attendance verification acknowledged'
  if (kind === 'review') return 'Volunteer request acknowledged'
  if (kind === 'updates') return 'Organization updates acknowledged'
  return 'Organization action acknowledged'
}

export default async function IssuerNotificationHistoryPage() {
  const session = await requireRole('issuer')
  const orgId = session.orgId!
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [org, history, acknowledgements] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, session.sub))
      .orderBy(desc(notifications.createdAt)),
    db
      .select({ acknowledgement: organizationQueueAcknowledgements, user: users })
      .from(organizationQueueAcknowledgements)
      .innerJoin(users, eq(organizationQueueAcknowledgements.acknowledgedByUserId, users.id))
      .where(eq(organizationQueueAcknowledgements.orgId, orgId))
      .orderBy(desc(organizationQueueAcknowledgements.acknowledgedAt)),
  ])
  const notificationHistory = [
    ...history.map((notice) => ({
      kind: 'notification' as const,
      id: notice.id,
      title: notice.title,
      body: notice.body,
      link: notice.link,
      createdAt: notice.createdAt,
      readAt: notice.readAt,
    })),
    ...acknowledgements.map(({ acknowledgement, user }) => ({
      kind: 'acknowledgement' as const,
      id: acknowledgement.id,
      title: acknowledgementLabel(acknowledgement.actionKey),
      body: `${participantDisplayName(user)} removed this item from the Action Queue.`,
      link: '',
      createdAt: acknowledgement.acknowledgedAt,
      readAt: acknowledgement.acknowledgedAt,
    })),
  ].sort((left, right) => right.createdAt - left.createdAt)

  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-utility" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
        <section className={styles.issuerMain} aria-label="Organization notification history">
          <section className={styles.issuerNotificationHistory}>
            <div className={styles.issuerNotificationHistoryHeading}>
              <div>
                <p className={styles.eyebrow}>Notification history</p>
              </div>
              <HistoryBackButton fallback="/aesthetic-lab/issuer" className={styles.issuerHistoryBack} />
            </div>

            <div className={styles.issuerNotificationHistoryList}>
              {notificationHistory.length ? notificationHistory.map((notice) => {
                const canOpen = isInternalPath(notice.link)
                return <article key={notice.id}>
                  <span className={styles.issuerNotificationHistoryIcon}><Bell size={16} /></span>
                  <div className={styles.issuerNotificationHistoryCopy}>
                    <div>
                      <b>{notice.title}</b>
                      {notice.kind === 'acknowledgement' ? <em>Acknowledged</em> : !notice.readAt ? <i>New</i> : <em>Read</em>}
                    </div>
                    {notice.body ? <p>{notice.body}</p> : null}
                    <time dateTime={new Date(notice.createdAt).toISOString()}>{formattedDate(notice.createdAt)}</time>
                  </div>
                  <div className={styles.issuerNotificationHistoryActions}>
                    {canOpen ? <Link href={notice.link}>Open</Link> : null}
                    {notice.kind === 'notification' && !notice.readAt ? <form action={markIssuerNotificationReadAction}>
                      <input type="hidden" name="notificationId" value={notice.id} />
                      <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/notification-history" />
                      <button type="submit"><CheckCheck size={13} />Mark read</button>
                    </form> : null}
                  </div>
                </article>
              }) : <div className={styles.issuerNotificationHistoryEmpty}>
                <Bell size={18} />
                <div><b>No notifications yet.</b><p>Internal updates, reminders, and volunteer insights will appear here as they arrive.</p></div>
              </div>}
            </div>
          </section>
        </section>
      </div>
    </main>
  )
}
