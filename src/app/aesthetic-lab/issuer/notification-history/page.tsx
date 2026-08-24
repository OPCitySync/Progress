import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { ArrowLeft, Bell, BookOpenCheck, CheckCheck } from 'lucide-react'
import { markIssuerNotificationReadAction } from '@/app/actions'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { notifications, organizationQueueAcknowledgements, orgs, users } from '@/lib/db/schema'
import { participantDisplayName } from '@/lib/participant-name'
import { listOrganizationActivity } from '@/lib/services/organization-activity'
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

function actionLabel(type: string) {
  return type
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function detailLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/Id$/i, ' ID')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase())
}

function ledgerPayloadEntries(payload: string) {
  try {
    const parsed: unknown = JSON.parse(payload)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []
    return Object.entries(parsed as Record<string, unknown>)
  } catch {
    return []
  }
}

function ledgerValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === '') return 'Not recorded'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number' && /(?:at|timestamp)$/i.test(key) && value > 1_000_000_000_000) return formattedDate(value)
  if (typeof value === 'string') return value.replace(/_/g, ' ')
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function acknowledgementLabel(actionKey: string) {
  const [kind] = actionKey.split(':', 1)
  if (kind === 'verify') return 'Attendance verification acknowledged'
  if (kind === 'review') return 'Volunteer request acknowledged'
  if (kind === 'updates') return 'Organization updates acknowledged'
  return 'Organization action acknowledged'
}

export default async function IssuerNotificationHistoryPage({ searchParams }: { searchParams: { tab?: string } }) {
  const session = await requireRole('issuer')
  const orgId = session.orgId!
  const activeTab = searchParams.tab === 'ledger' ? 'ledger' : 'notifications'
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [org, history, acknowledgements, activity] = await Promise.all([
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
    activeTab === 'ledger' ? listOrganizationActivity(orgId) : Promise.resolve([]),
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
                <p className={styles.eyebrow}>Organization record</p>
                <h1>{activeTab === 'ledger' ? 'Organizational ledger' : 'Notification history'}</h1>
                <p>{activeTab === 'ledger' ? 'A permanent record of actions taken for this organization, newest first.' : 'Every in-app notice and acknowledged action for this organization, including completed work, newest first.'}</p>
              </div>
              <Link className={styles.issuerHistoryBack} href="/aesthetic-lab/issuer"><ArrowLeft size={15} />Home</Link>
            </div>

            <nav className={styles.issuerRecordTabs} aria-label="Organization record views">
              <Link href="/aesthetic-lab/issuer/notification-history" data-active={activeTab === 'notifications'}><Bell size={15} />Notification history</Link>
              <Link href="/aesthetic-lab/issuer/notification-history?tab=ledger" data-active={activeTab === 'ledger'}><BookOpenCheck size={15} />Organizational ledger</Link>
            </nav>

            {activeTab === 'notifications' ? <div className={styles.issuerNotificationHistoryList}>
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
            </div> : <div className={styles.issuerOrganizationLedgerList}>
              {activity.length ? activity.map((entry) => {
                const details = ledgerPayloadEntries(entry.payload)
                return <article key={entry.hash}>
                  <span><BookOpenCheck size={16} /></span>
                  <div>
                    <b>{actionLabel(entry.type)}</b>
                    <p>Action taken by <strong>{entry.actorName}</strong></p>
                    <time dateTime={new Date(entry.ts).toISOString()}>{formattedDate(entry.ts)} · Ledger record #{entry.seq}</time>
                  </div>
                  <details className={styles.issuerLedgerDetails}>
                    <summary>View recorded details</summary>
                    <div className={styles.issuerLedgerDetailBody}>
                      {details.length ? <dl className={styles.issuerLedgerPayload}>
                        {details.map(([key, value]) => <div key={key}>
                          <dt>{detailLabel(key)}</dt>
                          <dd>{ledgerValue(key, value)}</dd>
                        </div>)}
                      </dl> : <p className={styles.issuerLedgerNoPayload}>No additional action fields were recorded for this entry.</p>}
                      <dl className={styles.issuerLedgerIntegrity}>
                        <div><dt>Ledger record</dt><dd>#{entry.seq}</dd></div>
                        <div><dt>Record hash</dt><dd><code>{entry.hash}</code></dd></div>
                      </dl>
                    </div>
                  </details>
                </article>
              }) : <div className={styles.issuerNotificationHistoryEmpty}>
                <BookOpenCheck size={18} />
                <div><b>No organizational actions recorded yet.</b><p>Actions such as publishing opportunities, managing sessions, and updating organization records will appear here.</p></div>
              </div>}
            </div>}
          </section>
        </section>
      </div>
    </main>
  )
}
