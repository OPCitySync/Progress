import Link from 'next/link'
import { Bell, Mail, CheckCircle2, MessageCircle, UsersRound } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { markAllNotificationsReadAction, markNotificationReadAction, markOrganizationMessageReadAction } from '@/app/actions'
import { getNotifications } from '@/lib/services/notifications'
import { getMessagesForUser } from '@/lib/services/roster'
import { getEventChatsForParticipant } from '@/lib/services/event-chat'
import { getLabWorkspace } from '../lab-workspace'
import { LabHeader } from '../LabHeader'
import { LabNotice } from '../LabNotice'
import styles from '../prototype.module.css'

export const dynamic = 'force-dynamic'

function labNotificationLink(link: string) {
  if (link.startsWith('/participant/opportunities/')) return link.replace('/participant/opportunities/', '/aesthetic-lab/opportunities/')
  if (link.startsWith('/participant')) return '/aesthetic-lab'
  if (link.startsWith('/feed')) return '/aesthetic-lab'
  return link
}

export default async function LabNotificationsPage({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const session = await requireRole('participant')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [allNotifications, messages, eventChats] = await Promise.all([getNotifications(session.sub, 40), getMessagesForUser(session.sub, 40), getEventChatsForParticipant(session.sub)])
  const notifications = allNotifications.filter((item) => item.kind !== 'volunteer_reflection' && item.kind !== 'organization_calendar')
  const pending = notifications.filter((item) => !item.readAt).length + messages.filter((item) => item.unread).length
  return <main className={styles.app}>
    <LabHeader activeSection="feed" session={session} city={city} cities={cities} contexts={contexts} />
    <section className={styles.detailLayout}><aside className={styles.leftRail}><section className={styles.cityCard}><Bell size={19} /><h2>Notifications</h2><p>Opportunity updates and messages from organizations appear here.</p><Link href="/aesthetic-lab">Return home</Link></section></aside><section className={styles.primaryColumn}><div className={styles.pageIntro}><p className={styles.eyebrow}>Your updates</p><h1>Stay in the loop.</h1><p>{pending ? `${pending} update${pending === 1 ? '' : 's'} need your attention.` : 'You’re all caught up.'}</p></div><LabNotice ok={searchParams.ok} error={searchParams.error} /><div className={styles.labFormActions}><form action={markAllNotificationsReadAction}><input type="hidden" name="redirectTo" value="/aesthetic-lab/notifications" /><button className={`${styles.labButton} ${styles.labButtonSecondary}`} type="submit">Mark all read</button></form></div><section className={`${styles.labPanel} ${styles.labStack}`}><div><p className={styles.eyebrow}>City/Sync updates</p><h2>Notifications</h2></div>{notifications.length ? notifications.map((item) => <article className={styles.labChoice} key={item.id}><div><p><strong>{item.title}</strong>{!item.readAt ? <CheckCircle2 size={14} /> : null}</p><small>{item.body || 'An update from City/Sync.'}</small></div>{item.link ? <Link className={styles.labLinkButton} href={labNotificationLink(item.link)}>Open</Link> : null}{!item.readAt ? <form action={markNotificationReadAction}><input type="hidden" name="notificationId" value={item.id} /><input type="hidden" name="redirectTo" value="/aesthetic-lab/notifications" /><button className={styles.labButton} type="submit">Mark read</button></form> : null}</article>) : <p className={styles.emptyCopy}>No City/Sync notifications yet.</p>}</section><section className={`${styles.labPanel} ${styles.labStack}`}><div><p className={styles.eyebrow}>From your organizations</p><h2>Messages</h2></div>{messages.length ? messages.map((message) => <article className={styles.labChoice} key={message.id}><div><p><strong><Mail size={14} /> {message.subject}</strong></p><small>{message.orgName} · {message.body}</small></div>{message.unread ? <form action={markOrganizationMessageReadAction}><input type="hidden" name="messageId" value={message.id} /><input type="hidden" name="redirectTo" value="/aesthetic-lab/notifications" /><button className={styles.labButton} type="submit">Mark read</button></form> : null}</article>) : <p className={styles.emptyCopy}>Organization messages will appear here.</p>}</section><section className={`${styles.labPanel} ${styles.labStack}`}><div><p className={styles.eyebrow}>Your upcoming shifts</p><h2>Event chats</h2></div>{eventChats.length ? eventChats.map((item) => <article className={styles.labChoice} key={item.chat.id}><div><p><strong><MessageCircle size={14} /> {item.task.title}</strong></p><small>{item.shift.startsAt ? new Date(item.shift.startsAt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Scheduled event'} <UsersRound size={13} /> This chat closes when the event ends.</small></div><Link className={styles.labLinkButton} href={`/aesthetic-lab/chats/${item.chat.id}`}>Open chat</Link></article>) : <p className={styles.emptyCopy}>Event chats appear here when an organization opens one for a shift you have joined.</p>}</section></section></section>
  </main>
}
