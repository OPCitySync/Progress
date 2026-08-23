import Link from 'next/link'
import { Bell } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { markIssuerNotificationReadAction } from '@/app/actions'
import { getArchivedEventChatsForOrg, getEventChatForOrg, getEventChatsForOrg, getUpcomingShiftsForEventChat } from '@/lib/services/event-chat'
import { getNotifications } from '@/lib/services/notifications'
import { getRoster, getSentMessages, getVolunteerGroups } from '@/lib/services/roster'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { LabNotice } from '../../LabNotice'
import { IssuerEventChatWorkspace } from '../IssuerEventChatWorkspace'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

/** Private notices for the active organization, including calendar reminders. */
export default async function IssuerNotificationsPage({ searchParams }: { searchParams: { ok?: string; error?: string; event?: string; pane?: string; message?: string } }) {
  const session = await requireRole('issuer')
  if (!session.orgId) return null
  const orgId = session.orgId
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [roster, groups, sentMessages, notifications] = await Promise.all([
    getRoster(orgId),
    getVolunteerGroups(orgId),
    getSentMessages(orgId, 100),
    getNotifications(session.sub, 50),
  ])
  const volunteerNotes = notifications.filter((item) => item.kind === 'volunteer_reflection')
  // Both helpers clean up expired rooms. Keep them sequential so an expired
  // room is never processed twice during a single Inbox render.
  const upcomingShifts = await getUpcomingShiftsForEventChat(orgId)
  const chats = await getEventChatsForOrg(orgId)
  const archivedChats = await getArchivedEventChatsForOrg(orgId)
  const chatDetails = await Promise.all(chats.flatMap((item) => item.chat.id ? [getEventChatForOrg(item.chat.id!, orgId)] : []))
  const chatDetailsById = new Map(chatDetails.filter((item): item is NonNullable<typeof item> => item !== null).flatMap((item) => item.chat.id ? [[item.chat.id, item] as const] : []))
  const upcomingEvents = [
    ...chats.map((item) => ({
      shiftId: item.shift.id,
      title: item.task.title,
      label: item.shift.label,
      startsAt: item.shift.startsAt,
      endsAt: item.shift.endsAt,
      participantCount: item.participantCount,
      chat: {
        id: item.chat.id ?? '',
        closesAt: item.chat.closesAt,
        messageCount: item.messageCount,
        messages: item.chat.id ? chatDetailsById.get(item.chat.id)?.messages ?? [] : [],
      },
    })),
    ...upcomingShifts.map((item) => ({
      shiftId: item.shift.id,
      title: item.task.title,
      label: item.shift.label,
      startsAt: item.shift.startsAt,
      endsAt: item.shift.endsAt,
      participantCount: item.participantCount,
      chat: null,
    })),
  ].sort((a, b) => (a.startsAt ?? Number.MAX_SAFE_INTEGER) - (b.startsAt ?? Number.MAX_SAFE_INTEGER))
  const archive = archivedChats.flatMap((item) => item.chat.id ? [{
    id: item.chat.id,
    title: item.task.title,
    label: item.shift.label,
    startsAt: item.shift.startsAt,
    endsAt: item.shift.endsAt,
    participantCount: item.participantCount,
    messageCount: item.messageCount,
    messages: item.messages,
    archivedAt: item.archivedAt,
    deleteAt: item.deleteAt,
  }] : [])

  return (
    <main className={`${styles.app} ${styles.issuerMessagesApp}`}>
      <LabHeader activeSection="issuer-utility" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
      <div className={styles.issuerInboxLayout}>
        <section className={styles.issuerMain} aria-label="Organization inbox">
          <LabNotice hidden ok={searchParams.ok} error={searchParams.error} />
          {volunteerNotes.length ? <section className={`${styles.labPanel} ${styles.labStack} ${styles.issuerInsightNotifications}`}>
            <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Organization insight</p><h2>From the people who were there</h2><p>Volunteer notes are private reflections, not a message thread.</p></div><Bell size={19} /></div>
            <div className={styles.labChoiceList}>{volunteerNotes.map((notice) => <article className={styles.labChoice} key={notice.id}>
              <div><p><strong>{notice.title}</strong>{!notice.readAt ? <i className={styles.issuerInsightUnread}>New</i> : null}</p><small>{notice.body}</small></div>
              <div className={styles.issuerInsightActions}>{notice.link ? <Link className={styles.labLinkButton} href={notice.link}>View event</Link> : null}{!notice.readAt ? <form action={markIssuerNotificationReadAction}><input type="hidden" name="notificationId" value={notice.id} /><input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/notifications" /><button className={`${styles.labButton} ${styles.labButtonSecondary}`} type="submit">Mark read</button></form> : null}</div>
            </article>)}</div>
          </section> : null}
          <IssuerEventChatWorkspace events={upcomingEvents} archivedChats={archive} outboundMessages={sentMessages} volunteers={roster.volunteers} groups={groups} actorId={session.sub} initialShiftId={searchParams.event} initialPane={searchParams.pane} initialMessageId={searchParams.message} />
        </section>
      </div>
    </main>
  )
}
