import { and, desc, eq, gte } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { claims, notifications, organizationQueueAcknowledgements, shifts, tasks, users } from '@/lib/db/schema'
import { participantDisplayName } from '@/lib/participant-name'
import { getArchivedEventChatsForOrg, getEventChatForOrg, getEventChatsForOrg, getUpcomingShiftsForEventChat } from '@/lib/services/event-chat'
import { getRoster, getSentMessages, getVolunteerGroups } from '@/lib/services/roster'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { LabNotice } from '../../LabNotice'
import { IssuerEventChatWorkspace } from '../IssuerEventChatWorkspace'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

/** One issuer communication center for messages, event chats, and notifications. */
export default async function IssuerNotificationsPage({ searchParams }: { searchParams: { ok?: string; error?: string; event?: string; pane?: string; message?: string; recipient?: string; notice?: string } }) {
  const session = await requireRole('issuer')
  if (!session.orgId) return null
  const orgId = session.orgId
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [roster, groups, sentMessages, storedNotifications, signupRows, acknowledgementRows] = await Promise.all([
    getRoster(orgId),
    getVolunteerGroups(orgId),
    getSentMessages(orgId, 100),
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

  return (
    <main className={`${styles.app} ${styles.issuerMessagesApp}`}>
      <LabHeader activeSection="issuer-utility" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
      <div className={styles.issuerInboxLayout}>
        <section className={styles.issuerMain} aria-label="Organization Communication Center">
          <LabNotice hidden ok={searchParams.ok} error={searchParams.error} />
          <IssuerEventChatWorkspace events={upcomingEvents} archivedChats={archive} outboundMessages={sentMessages} notifications={notificationItems} volunteers={roster.volunteers} groups={groups} actorId={session.sub} initialShiftId={searchParams.event} initialPane={searchParams.pane} initialMessageId={searchParams.message} initialVolunteerId={searchParams.recipient} initialNotificationId={searchParams.notice} />
        </section>
      </div>
    </main>
  )
}
