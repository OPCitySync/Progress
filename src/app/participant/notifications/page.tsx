import Link from 'next/link'
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  markOrganizationMessageReadAction,
} from '@/app/actions'
import { requireRole } from '@/lib/auth/session'
import { getNotifications } from '@/lib/services/notifications'
import { getMessagesForUser } from '@/lib/services/roster'
import { fmtDateTime } from '@/lib/format'
import { Badge, Button, Card, EmptyState, Flash, PageHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

/** A focused participant notification center—separate from daily Home. */
export default async function ParticipantNotificationsPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const session = await requireRole('participant')
  const [notifications, messages] = await Promise.all([
    getNotifications(session.sub, 100),
    getMessagesForUser(session.sub, 100),
  ])
  const unreadCount = notifications.filter((notification) => !notification.readAt).length + messages.filter((message) => message.unread).length

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}.` : 'You’re all caught up.'}
        action={
          unreadCount > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <input type="hidden" name="redirectTo" value="/participant/notifications" />
              <Button type="submit" variant="secondary">Mark all updates as read</Button>
            </form>
          ) : undefined
        }
      />
      <Flash searchParams={searchParams} />

      {notifications.length === 0 && messages.length === 0 ? (
        <EmptyState title="No updates yet" body="Shift confirmations, reminders, and messages from your organizations will appear here." />
      ) : (
        <div className="space-y-6">
          {notifications.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">Activity updates</h2>
              <Card className="divide-y divide-ink-100 p-0">
                {notifications.map((notification) => (
                  <article
                    key={notification.id}
                    className={`flex flex-wrap items-center justify-between gap-4 px-6 py-4 ${notification.readAt ? '' : 'bg-brand-50/50'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink-800">{notification.title}</p>
                        {!notification.readAt ? <Badge tone="blue">new</Badge> : null}
                      </div>
                      {notification.body ? <p className="mt-1 text-sm leading-relaxed text-ink-500">{notification.body}</p> : null}
                      <p className="mt-1 text-xs text-ink-400">{fmtDateTime(notification.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {notification.link ? (
                        <Link href={notification.link} className="text-sm font-semibold text-brand-700 hover:text-brand-600">
                          View →
                        </Link>
                      ) : null}
                      {!notification.readAt ? (
                        <form action={markNotificationReadAction}>
                          <input type="hidden" name="notificationId" value={notification.id} />
                          <input type="hidden" name="redirectTo" value="/participant/notifications" />
                          <button type="submit" className="text-xs font-semibold text-ink-400 hover:text-ink-700">
                            Mark read
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </article>
                ))}
              </Card>
            </section>
          ) : null}

          {messages.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">Messages from your organizations</h2>
              <Card className="divide-y divide-ink-100 p-0">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`flex flex-wrap items-center justify-between gap-4 px-6 py-4 ${message.unread ? 'bg-brand-50/50' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink-800">{message.subject}</p>
                        {message.unread ? <Badge tone="blue">new</Badge> : null}
                      </div>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-500">{message.body}</p>
                      <p className="mt-1 text-xs text-ink-400">{message.orgName} · {fmtDateTime(message.createdAt)}</p>
                    </div>
                    {message.unread ? (
                      <form action={markOrganizationMessageReadAction} className="shrink-0">
                        <input type="hidden" name="messageId" value={message.id} />
                        <input type="hidden" name="redirectTo" value="/participant/notifications" />
                        <button type="submit" className="text-xs font-semibold text-ink-400 hover:text-ink-700">
                          Mark read
                        </button>
                      </form>
                    ) : null}
                  </article>
                ))}
              </Card>
            </section>
          ) : null}
        </div>
      )}
    </>
  )
}
