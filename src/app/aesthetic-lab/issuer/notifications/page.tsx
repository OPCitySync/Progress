import { requireRole } from '@/lib/auth/session'
import { getArchivedEventChatsForOrg, getEventChatForOrg, getEventChatsForOrg, getUpcomingShiftsForEventChat } from '@/lib/services/event-chat'
import { getRoster, getSentMessages, getVolunteerGroups } from '@/lib/services/roster'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { LabNotice } from '../../LabNotice'
import { IssuerEventChatWorkspace } from '../IssuerEventChatWorkspace'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

/** The issuer Inbox contains event chats and outbound volunteer messages. */
export default async function IssuerNotificationsPage({ searchParams }: { searchParams: { ok?: string; error?: string; event?: string; pane?: string; message?: string; recipient?: string } }) {
  const session = await requireRole('issuer')
  if (!session.orgId) return null
  const orgId = session.orgId
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [roster, groups, sentMessages] = await Promise.all([
    getRoster(orgId),
    getVolunteerGroups(orgId),
    getSentMessages(orgId, 100),
  ])
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
          <IssuerEventChatWorkspace events={upcomingEvents} archivedChats={archive} outboundMessages={sentMessages} volunteers={roster.volunteers} groups={groups} actorId={session.sub} initialShiftId={searchParams.event} initialPane={searchParams.pane} initialMessageId={searchParams.message} initialVolunteerId={searchParams.recipient} />
        </section>
      </div>
    </main>
  )
}
