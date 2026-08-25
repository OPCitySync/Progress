import { requireRole } from '@/lib/auth/session'
import { getArchivedEventChatsForParticipant, getEventChatForParticipant, getEventChatsForParticipant } from '@/lib/services/event-chat'
import { getNotifications } from '@/lib/services/notifications'
import { getMessagesForUser } from '@/lib/services/roster'
import { getLabWorkspace } from '../lab-workspace'
import { LabHeader } from '../LabHeader'
import { LabNotice } from '../LabNotice'
import { ParticipantMessageWorkspace } from '../ParticipantMessageWorkspace'
import styles from '../prototype.module.css'

export const dynamic = 'force-dynamic'

function labNotificationLink(link: string) {
  if (link.startsWith('/participant/opportunities/')) return link.replace('/participant/opportunities/', '/aesthetic-lab/opportunities/')
  if (link.startsWith('/participant')) return '/aesthetic-lab'
  if (link.startsWith('/feed')) return '/aesthetic-lab'
  return link
}

export default async function ParticipantMessagesPage({ searchParams }: { searchParams: { ok?: string; error?: string; pane?: string; event?: string; item?: string } }) {
  const session = await requireRole('participant')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const chats = await getEventChatsForParticipant(session.sub)
  const [chatDetails, archivedChats, notifications, organizationMessages] = await Promise.all([
    Promise.all(chats.map((item) => getEventChatForParticipant(item.chat.id, session.sub))),
    getArchivedEventChatsForParticipant(session.sub),
    getNotifications(session.sub, 100),
    getMessagesForUser(session.sub, 100),
  ])
  const detailsById = new Map(chatDetails.filter((item): item is NonNullable<typeof item> => item !== null).map((item) => [item.chat.id, item] as const))
  const activeChats = chats.map((item) => ({
    id: item.chat.id,
    title: item.task.title,
    label: item.shift.label,
    startsAt: item.shift.startsAt,
    endsAt: item.shift.endsAt,
    closesAt: item.chat.closesAt,
    messageCount: detailsById.get(item.chat.id)?.messages.length ?? 0,
    messages: detailsById.get(item.chat.id)?.messages ?? [],
    unreadCount: (detailsById.get(item.chat.id)?.messages ?? []).filter((message) => message.senderUserId !== session.sub && (item.lastReadAt === null || message.createdAt > item.lastReadAt)).length,
  }))
  const archive = archivedChats.map((item) => ({
    id: item.chat.id,
    title: item.task.title,
    label: item.shift.label,
    startsAt: item.shift.startsAt,
    endsAt: item.shift.endsAt,
    messageCount: item.messages.length,
    messages: item.messages,
    archivedAt: item.archivedAt,
    deleteAt: item.deleteAt,
  }))
  const participantNotifications = notifications.filter((item) => item.kind !== 'volunteer_reflection' && item.kind !== 'organization_calendar')
  const inbox = [
    ...participantNotifications.map((item) => ({
      id: item.id,
      kind: 'notification' as const,
      title: item.title,
      body: item.body,
      source: 'City/Sync',
      createdAt: item.createdAt,
      unread: item.readAt === null,
      link: item.link ? labNotificationLink(item.link) : null,
    })),
    ...organizationMessages.map((item) => ({
      id: item.id,
      kind: 'organization-message' as const,
      title: item.subject,
      body: item.body,
      source: item.orgName,
      createdAt: item.createdAt,
      unread: item.unread,
      link: null,
    })),
  ].sort((a, b) => b.createdAt - a.createdAt)

  return <main className={`${styles.app} ${styles.issuerMessagesApp}`}>
    <LabHeader activeSection="feed" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerInboxLayout}>
      <section className={styles.issuerMain} aria-label="Participant messages">
        <LabNotice hidden ok={searchParams.ok} error={searchParams.error} />
        <ParticipantMessageWorkspace
          chats={activeChats}
          archivedChats={archive}
          inbox={inbox}
          actorId={session.sub}
          initialPane={searchParams.pane}
          initialChatId={searchParams.event}
          initialInboxId={searchParams.item}
        />
      </section>
    </div>
  </main>
}
