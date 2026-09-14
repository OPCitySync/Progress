'use client'

import Link from 'next/link'
import { Archive, Bell, CalendarDays, Check, Inbox, Mail, MessageCircle, Search, Send, SquarePen, UserRoundCheck, UsersRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  acknowledgeOrganizationQueueAction,
  createEventChatAction,
  markIssuerNotificationReadAction,
  postIssuerEventChatMessageAction,
  sendOrganizationMessageAction,
} from '@/app/actions'
import styles from '../prototype.module.css'

type EventMessage = {
  id: string
  senderUserId: string
  senderName: string
  body: string
  createdAt: number
}

type UpcomingEvent = {
  shiftId: string
  title: string
  label: string
  startsAt: number | null
  endsAt: number | null
  participantCount: number
  chat: {
    id: string
    closesAt: number
    messageCount: number
    messages: EventMessage[]
  } | null
}

type OutboundMessage = {
  id: string
  scope: string
  groupName: string | null
  subject: string
  body: string
  recipientCount: number
  createdAt: number
}

type ArchivedEventChat = {
  id: string
  title: string
  label: string
  startsAt: number | null
  endsAt: number | null
  participantCount: number
  messageCount: number
  archivedAt: number
  deleteAt: number
  messages: EventMessage[]
}

type NotificationItem = {
  id: string
  actionKey: string
  kind: 'notification' | 'signup'
  title: string
  body: string
  link: string
  createdAt: number
  unread: boolean
}

type Volunteer = { userId: string; name: string; email: string }
type Group = { id: string; name: string; memberIds: string[] }
type CommunicationPane = 'messages' | 'events' | 'notifications'
type ChatView = 'active' | 'archive'

function eventDate(value: number | null) {
  if (!value) return { day: '—', month: 'TBD', detail: 'Time to be confirmed' }
  const date = new Date(value)
  return {
    day: date.toLocaleDateString([], { day: 'numeric' }),
    month: date.toLocaleDateString([], { month: 'short' }),
    detail: date.toLocaleString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' }),
  }
}

function shortDate(value: number) {
  const date = new Date(value)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function fullDate(value: number) {
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function audienceLabel(message: OutboundMessage) {
  if (message.scope === 'group') return message.groupName ?? 'Volunteer group'
  if (message.scope === 'roster') return 'Full roster'
  return `${message.recipientCount} selected volunteer${message.recipientCount === 1 ? '' : 's'}`
}

function isInternalPath(path: string) {
  return path.startsWith('/') && !path.startsWith('//')
}

function startingPane(initialPane?: string, initialShiftId?: string, initialVolunteerId?: string): CommunicationPane {
  if (initialPane === 'notifications') return 'notifications'
  if (initialPane === 'events' || initialPane === 'archive' || initialShiftId) return 'events'
  if (initialPane === 'messages' || initialPane === 'outbound' || initialVolunteerId) return 'messages'
  return 'messages'
}

/** One interface with deliberately distinct modes for sent messages, live chats, and system notices. */
export function IssuerEventChatWorkspace({
  events,
  archivedChats,
  outboundMessages,
  notifications,
  volunteers,
  groups,
  actorId,
  initialShiftId,
  initialPane,
  initialMessageId,
  initialVolunteerId,
  initialNotificationId,
}: {
  events: UpcomingEvent[]
  archivedChats: ArchivedEventChat[]
  outboundMessages: OutboundMessage[]
  notifications: NotificationItem[]
  volunteers: Volunteer[]
  groups: Group[]
  actorId: string
  initialShiftId?: string
  initialPane?: string
  initialMessageId?: string
  initialVolunteerId?: string
  initialNotificationId?: string
}) {
  const [selectedShiftId, setSelectedShiftId] = useState(() => events.some((event) => event.shiftId === initialShiftId) ? initialShiftId! : events[0]?.shiftId ?? '')
  const [selectedArchiveId, setSelectedArchiveId] = useState(() => archivedChats[0]?.id ?? '')
  const [selectedMessageId, setSelectedMessageId] = useState(() => outboundMessages.some((message) => message.id === initialMessageId) ? initialMessageId! : outboundMessages[0]?.id ?? '')
  const [selectedNotificationId, setSelectedNotificationId] = useState(() => notifications.some((notice) => notice.id === initialNotificationId) ? initialNotificationId! : '')
  const [pane, setPane] = useState<CommunicationPane>(() => startingPane(initialPane, initialShiftId, initialVolunteerId))
  const [chatView, setChatView] = useState<ChatView>(() => initialPane === 'archive' ? 'archive' : 'active')
  const [query, setQuery] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [recipientKind, setRecipientKind] = useState<'individual' | 'group' | 'roster'>('individual')
  const [volunteerQuery, setVolunteerQuery] = useState('')
  const [selectedVolunteerIds, setSelectedVolunteerIds] = useState<string[]>(() => volunteers.some((volunteer) => volunteer.userId === initialVolunteerId) ? [initialVolunteerId!] : [])

  const selectedEvent = events.find((event) => event.shiftId === selectedShiftId) ?? events[0] ?? null
  const selectedArchive = archivedChats.find((chat) => chat.id === selectedArchiveId) ?? archivedChats[0] ?? null
  const selectedMessage = outboundMessages.find((message) => message.id === selectedMessageId) ?? outboundMessages[0] ?? null
  const selectedNotification = notifications.find((notice) => notice.id === selectedNotificationId) ?? null
  const selectedDate = selectedEvent ? eventDate(selectedEvent.startsAt) : null
  const redirectTo = selectedEvent ? `/aesthetic-lab/issuer/notifications?pane=events&event=${encodeURIComponent(selectedEvent.shiftId)}` : '/aesthetic-lab/issuer/notifications?pane=events'
  const normalizedQuery = query.trim().toLowerCase()
  const filteredEvents = events.filter((event) => !normalizedQuery || `${event.title} ${event.label}`.toLowerCase().includes(normalizedQuery))
  const filteredMessages = outboundMessages.filter((message) => !normalizedQuery || `${message.subject} ${message.body} ${audienceLabel(message)}`.toLowerCase().includes(normalizedQuery))
  const filteredArchivedChats = archivedChats.filter((chat) => !normalizedQuery || `${chat.title} ${chat.label}`.toLowerCase().includes(normalizedQuery))
  const filteredNotifications = notifications.filter((notice) => !normalizedQuery || `${notice.title} ${notice.body}`.toLowerCase().includes(normalizedQuery))
  const unreadNotifications = notifications.filter((notice) => notice.unread).length
  const filteredVolunteers = volunteers.filter((volunteer) => {
    const nextQuery = volunteerQuery.trim().toLowerCase()
    return !nextQuery || `${volunteer.name} ${volunteer.email}`.toLowerCase().includes(nextQuery)
  })

  const toggleVolunteer = (userId: string) => {
    setSelectedVolunteerIds((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId])
  }

  const changePane = (nextPane: CommunicationPane) => {
    setPane(nextPane)
    setQuery('')
  }

  useEffect(() => {
    setPane(startingPane(initialPane, initialShiftId, initialVolunteerId))
    if (initialPane === 'archive') setChatView('archive')
    if (events.some((event) => event.shiftId === initialShiftId)) setSelectedShiftId(initialShiftId!)
    if (outboundMessages.some((message) => message.id === initialMessageId)) setSelectedMessageId(initialMessageId!)
    if (notifications.some((notice) => notice.id === initialNotificationId)) setSelectedNotificationId(initialNotificationId!)
  }, [events, initialMessageId, initialNotificationId, initialPane, initialShiftId, initialVolunteerId, notifications, outboundMessages])

  useEffect(() => {
    if (!initialVolunteerId || !volunteers.some((volunteer) => volunteer.userId === initialVolunteerId)) return
    setRecipientKind('individual')
    setSelectedVolunteerIds([initialVolunteerId])
    setVolunteerQuery('')
    setComposerOpen(true)
  }, [initialVolunteerId, volunteers])

  return <section className={styles.issuerEventChatWorkspace}>
    <header className={styles.issuerEventChatWorkspaceHeader}>
      <div><p className={styles.eyebrow}>Organization communication</p><h2>Communication Center</h2><p>Send deliberate messages, coordinate live event conversations, and review system notifications in one place.</p></div>
      {pane === 'messages' ? <button type="button" className={styles.issuerCommunicationNewMessage} onClick={() => setComposerOpen(true)}><SquarePen size={14} /> New Message</button> : null}
    </header>

    <nav className={styles.issuerCommunicationTabs} role="tablist" aria-label="Communication types">
      <button type="button" role="tab" aria-selected={pane === 'messages'} data-active={pane === 'messages' ? 'true' : undefined} data-kind="messages" onClick={() => changePane('messages')}><Mail size={14} /><span>Messages</span></button>
      <button type="button" role="tab" aria-selected={pane === 'events'} data-active={pane === 'events' ? 'true' : undefined} data-kind="chats" onClick={() => changePane('events')}><MessageCircle size={14} /><span>Event Chats</span></button>
      <button type="button" role="tab" aria-selected={pane === 'notifications'} data-active={pane === 'notifications' ? 'true' : undefined} data-kind="notifications" onClick={() => changePane('notifications')}><Bell size={14} /><span>Notifications</span>{unreadNotifications ? <em>{unreadNotifications}</em> : null}</button>
    </nav>

    <div className={styles.issuerEventChatWorkspaceBody}>
      <aside className={styles.issuerEventChatEventPane} aria-label={`${pane === 'messages' ? 'Messages' : pane === 'events' ? 'Event chats' : 'Notifications'} list`}>
        <label className={styles.issuerEventChatSearch}><Search size={14} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={pane === 'messages' ? 'Search messages' : pane === 'notifications' ? 'Search notifications' : chatView === 'active' ? 'Search active event chats' : 'Search archived event chats'} /></label>
        {pane === 'events' ? <div className={styles.issuerEventChatTabs} role="tablist" aria-label="Event chat status">
          <button type="button" role="tab" aria-selected={chatView === 'active'} data-active={chatView === 'active' ? 'true' : undefined} onClick={() => { setChatView('active'); setQuery('') }}><MessageCircle size={13} /> Active</button>
          <button type="button" role="tab" aria-selected={chatView === 'archive'} data-active={chatView === 'archive' ? 'true' : undefined} onClick={() => { setChatView('archive'); setQuery('') }}><Archive size={13} /> Archived</button>
        </div> : <p className={styles.issuerEventChatPaneLabel}>{pane === 'messages' ? 'Sent messages' : unreadNotifications ? `${unreadNotifications} unread` : 'All caught up'}</p>}

        <div className={styles.issuerEventChatEventList}>
          {pane === 'messages' && filteredMessages.length ? filteredMessages.map((message) => <button type="button" key={message.id} className={styles.issuerOutboundMessageRow} data-active={selectedMessage?.id === message.id ? 'true' : undefined} onClick={() => setSelectedMessageId(message.id)}>
            <span className={styles.issuerOutboundMessageIcon}><Mail size={14} /></span>
            <div><span>To: {audienceLabel(message)}</span><b>{message.subject}</b><small>{message.body}</small><em>{message.recipientCount} recipient{message.recipientCount === 1 ? '' : 's'} · {shortDate(message.createdAt)}</em></div>
          </button>) : null}
          {pane === 'messages' && !filteredMessages.length ? <div className={styles.issuerEventChatNoEvents}><Mail size={19} /><b>{outboundMessages.length ? 'No messages match that search.' : 'No messages sent yet.'}</b><p>{outboundMessages.length ? 'Try another recipient, subject, or phrase.' : 'Use New Message to write to an individual, group, or your full roster.'}</p></div> : null}

          {pane === 'events' && chatView === 'active' && filteredEvents.length ? filteredEvents.map((event) => {
            const date = eventDate(event.startsAt)
            return <button type="button" key={event.shiftId} data-active={selectedEvent?.shiftId === event.shiftId ? 'true' : undefined} onClick={() => setSelectedShiftId(event.shiftId)}>
              <time><b>{date.day}</b><span>{date.month}</span></time>
              <div><span>{event.chat ? 'Group chat open' : 'Chat not started'}</span><b>{event.title}</b><small>{date.detail}{event.label ? ` · ${event.label}` : ''}</small><em><UsersRound size={12} /> {event.participantCount} signed up{event.chat ? ` · ${event.chat.messageCount} message${event.chat.messageCount === 1 ? '' : 's'}` : ''}</em></div>
            </button>
          }) : null}
          {pane === 'events' && chatView === 'active' && !filteredEvents.length ? <div className={styles.issuerEventChatNoEvents}><CalendarDays size={19} /><b>{events.length ? 'No event chats match that search.' : 'No upcoming events are published.'}</b><p>{events.length ? 'Try another title or schedule detail.' : 'Published shifts will appear here when they are ready to coordinate.'}</p></div> : null}

          {pane === 'events' && chatView === 'archive' && filteredArchivedChats.length ? filteredArchivedChats.map((chat) => {
            const date = eventDate(chat.startsAt)
            return <button type="button" key={chat.id} className={styles.issuerArchivedChatRow} data-active={selectedArchive?.id === chat.id ? 'true' : undefined} onClick={() => setSelectedArchiveId(chat.id)}>
              <time><b>{date.day}</b><span>{date.month}</span></time>
              <div><span>Archived · deletes {shortDate(chat.deleteAt)}</span><b>{chat.title}</b><small>{date.detail}{chat.label ? ` · ${chat.label}` : ''}</small><em><UsersRound size={12} /> {chat.participantCount} participants · {chat.messageCount} message{chat.messageCount === 1 ? '' : 's'}</em></div>
            </button>
          }) : null}
          {pane === 'events' && chatView === 'archive' && !filteredArchivedChats.length ? <div className={styles.issuerEventChatNoEvents}><Archive size={19} /><b>{archivedChats.length ? 'No archived chats match that search.' : 'No archived event chats.'}</b><p>{archivedChats.length ? 'Try another event title or schedule detail.' : 'Ended event chats remain here for 14 days.'}</p></div> : null}

          {pane === 'notifications' && filteredNotifications.length ? filteredNotifications.map((notice) => {
            const content = <>
              <span className={styles.issuerCommunicationNotificationIcon} data-kind={notice.kind}>{notice.kind === 'signup' ? <UserRoundCheck size={15} /> : <Bell size={15} />}</span>
              <div><span>{notice.kind === 'signup' ? 'Roster update' : 'System notification'}{notice.unread ? ' · New' : ''}</span><b>{notice.title}</b><small>{notice.body}</small><em>{shortDate(notice.createdAt)}</em></div>
            </>
            return notice.unread ? <form key={notice.id} action={notice.kind === 'notification' ? markIssuerNotificationReadAction : acknowledgeOrganizationQueueAction} className={styles.issuerCommunicationNotificationForm} onSubmit={() => setSelectedNotificationId(notice.id)}>
              {notice.kind === 'notification' ? <input type="hidden" name="notificationId" value={notice.id} /> : <input type="hidden" name="actionKey" value={notice.actionKey} />}
              <input type="hidden" name="redirectTo" value={`/aesthetic-lab/issuer/notifications?pane=notifications&notice=${encodeURIComponent(notice.id)}`} />
              <button type="submit" data-active={selectedNotification?.id === notice.id ? 'true' : undefined} data-unread="true">{content}</button>
            </form> : <button type="button" key={notice.id} className={styles.issuerCommunicationNotificationRow} data-active={selectedNotification?.id === notice.id ? 'true' : undefined} onClick={() => setSelectedNotificationId(notice.id)}>{content}</button>
          }) : null}
          {pane === 'notifications' && !filteredNotifications.length ? <div className={styles.issuerEventChatNoEvents}><Bell size={19} /><b>{notifications.length ? 'No notifications match that search.' : 'No notifications yet.'}</b></div> : null}
        </div>
      </aside>

      <article className={styles.issuerEventChatConversation}>
        {pane === 'messages' && selectedMessage ? <>
          <header>
            <span className={styles.issuerEventChatConversationIcon}><Mail size={17} /></span>
            <div><p className={styles.eyebrow}>Sent message</p><h3>{selectedMessage.subject}</h3><small>Sent to {audienceLabel(selectedMessage)} · {selectedMessage.recipientCount} recipient{selectedMessage.recipientCount === 1 ? '' : 's'} · {fullDate(selectedMessage.createdAt)}</small></div>
          </header>
          <div className={styles.issuerOutboundMessageBody}><p>{selectedMessage.body}</p></div>
          <footer><span><Mail size={14} /> Delivered to {selectedMessage.recipientCount} recipient{selectedMessage.recipientCount === 1 ? '' : 's'}</span></footer>
        </> : null}

        {pane === 'events' && chatView === 'archive' && selectedArchive ? <>
          <header>
            <span className={styles.issuerEventChatConversationIcon}><Archive size={17} /></span>
            <div><p className={styles.eyebrow}>Archived event chat</p><h3>{selectedArchive.title}</h3><small>{eventDate(selectedArchive.startsAt).detail}{selectedArchive.label ? ` · ${selectedArchive.label}` : ''} · {selectedArchive.participantCount} participant{selectedArchive.participantCount === 1 ? '' : 's'}</small></div>
            <span className={styles.issuerEventChatCloses}>Deletes {fullDate(selectedArchive.deleteAt)}</span>
          </header>
          <div className={styles.issuerEventChatMessages} aria-live="polite">
            {selectedArchive.messages.length ? selectedArchive.messages.map((message) => <article key={message.id} data-self={message.senderUserId === actorId ? 'true' : undefined}><b>{message.senderUserId === actorId ? 'You' : message.senderName}</b><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></article>) : <div className={styles.issuerEventChatEmpty}><Archive size={21} /><div><b>No messages were sent.</b><p>This chat remained open until the event ended.</p></div></div>}
          </div>
          <footer><span><Archive size={14} /> Read-only · archived {fullDate(selectedArchive.archivedAt)}</span></footer>
        </> : null}

        {pane === 'events' && chatView === 'active' && selectedEvent && selectedDate ? <>
          <header>
            <span className={styles.issuerEventChatConversationIcon}><MessageCircle size={17} /></span>
            <div><p className={styles.eyebrow}>{selectedEvent.chat ? 'Live event chat' : 'Event ready for a chat'}</p><h3>{selectedEvent.title}</h3><small>{selectedDate.detail}{selectedEvent.label ? ` · ${selectedEvent.label}` : ''} · {selectedEvent.participantCount} signed up</small></div>
          </header>
          {selectedEvent.chat ? <>
            <div className={styles.issuerEventChatMessages} aria-live="polite">
              {selectedEvent.chat.messages.length ? selectedEvent.chat.messages.map((message) => <article key={message.id} data-self={message.senderUserId === actorId ? 'true' : undefined}><b>{message.senderUserId === actorId ? 'You' : message.senderName}</b><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></article>) : <div className={styles.issuerEventChatEmpty}><MessageCircle size={21} /><div><b>Start the conversation.</b><p>Share arrival details, equipment needs, or a welcome with everyone signed up.</p></div></div>}
            </div>
            <form action={postIssuerEventChatMessageAction} className={styles.issuerEventChatComposer}>
              <input type="hidden" name="chatId" value={selectedEvent.chat.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <label><span className="sr-only">Message</span><textarea name="body" rows={2} maxLength={2000} required placeholder="Write to everyone signed up for this event…" /></label>
              <button type="submit"><Send size={14} /> Send</button>
            </form>
          </> : <div className={styles.issuerEventChatStartState}>
            <span><MessageCircle size={23} /></span>
            <div><h4>Open a group chat for this event.</h4><p>Only volunteers currently signed up for this shift can participate. The chat becomes read-only when the event ends.</p><form action={createEventChatAction}><input type="hidden" name="shiftId" value={selectedEvent.shiftId} /><input type="hidden" name="redirectTo" value={redirectTo} /><button type="submit"><MessageCircle size={14} /> Open Event Chat</button></form></div>
          </div>}
        </> : null}

        {pane === 'notifications' && selectedNotification ? <>
          <header>
            <span className={`${styles.issuerEventChatConversationIcon} ${styles.issuerCommunicationNotificationDetailIcon}`}>{selectedNotification.kind === 'signup' ? <UserRoundCheck size={17} /> : <Bell size={17} />}</span>
            <div><p className={styles.eyebrow}>{selectedNotification.kind === 'signup' ? 'Roster update' : 'System notification'}</p><h3>{selectedNotification.title}</h3><small>{fullDate(selectedNotification.createdAt)} · {selectedNotification.unread ? 'Unread' : 'Read'}</small></div>
          </header>
          <div className={styles.issuerCommunicationNotificationBody}><p>{selectedNotification.body}</p></div>
          {isInternalPath(selectedNotification.link) ? <footer className={styles.issuerCommunicationNotificationFooter}><Link href={selectedNotification.link}>Open Related Item</Link></footer> : null}
        </> : null}

        {pane === 'messages' && !selectedMessage ? <div className={styles.issuerEventChatConversationEmpty}><Mail size={26} /><h3>Select a sent message.</h3><p>Its recipients and delivery details will appear here.</p></div> : null}
        {pane === 'events' && chatView === 'active' && (!selectedEvent || !selectedDate) ? <div className={styles.issuerEventChatConversationEmpty}><MessageCircle size={26} /><h3>Select an upcoming event.</h3><p>Its event chat will open here.</p></div> : null}
        {pane === 'events' && chatView === 'archive' && !selectedArchive ? <div className={styles.issuerEventChatConversationEmpty}><Archive size={26} /><h3>Select an archived event chat.</h3><p>Its conversation remains available for 14 days after the event.</p></div> : null}
        {pane === 'notifications' && !selectedNotification ? <div className={styles.issuerEventChatConversationEmpty}><Bell size={26} /><h3>Select a notification.</h3><p>Opening an unread notification marks it as read.</p></div> : null}
      </article>
    </div>

    {composerOpen ? createPortal(<div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setComposerOpen(false)}>
      <section id="individual-messages" className={`${styles.issuerInboxComposer} ${styles.issuerCommunicationComposerModal}`} role="dialog" aria-modal="true" aria-labelledby="new-message-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerInboxComposerHeading}>
          <div><p className={styles.eyebrow}>Organization message</p><h3 id="new-message-title">New Message</h3></div>
          <button type="button" aria-label="Close new message" onClick={() => setComposerOpen(false)}><X size={16} /></button>
        </div>
        <form action={sendOrganizationMessageAction} className={styles.issuerInboxComposerForm}>
          <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/notifications?pane=messages" />
          <input type="hidden" name="recipientKind" value={recipientKind} />
          {selectedVolunteerIds.map((userId) => <input type="hidden" name="memberId" value={userId} key={userId} />)}
          <div className={styles.issuerRecipientTabs} role="group" aria-label="Recipient type">
            <button type="button" data-active={recipientKind === 'individual' ? 'true' : undefined} onClick={() => setRecipientKind('individual')}><Mail size={14} /> Individuals</button>
            <button type="button" data-active={recipientKind === 'group' ? 'true' : undefined} onClick={() => setRecipientKind('group')}><UsersRound size={14} /> Groups</button>
            <button type="button" data-active={recipientKind === 'roster' ? 'true' : undefined} onClick={() => setRecipientKind('roster')}><Inbox size={14} /> Full roster</button>
          </div>
          <div className={styles.issuerRecipientPicker}>
            {recipientKind === 'individual' ? <>
              <label className={styles.issuerInboxSearch}><Search size={14} /><input type="search" value={volunteerQuery} onChange={(event) => setVolunteerQuery(event.target.value)} placeholder="Search volunteers by name or email" /></label>
              <div className={styles.issuerVolunteerRecipientList}>{filteredVolunteers.length ? filteredVolunteers.map((volunteer) => {
                const selected = selectedVolunteerIds.includes(volunteer.userId)
                return <button type="button" key={volunteer.userId} data-selected={selected ? 'true' : undefined} onClick={() => toggleVolunteer(volunteer.userId)}><span>{selected ? <Check size={13} /> : volunteer.name.slice(0, 2).toUpperCase()}</span><div><b>{volunteer.name}</b><small>{volunteer.email}</small></div></button>
              }) : <p>No volunteers match that search.</p>}</div>
              <small className={styles.issuerRecipientCount}>{selectedVolunteerIds.length} volunteer{selectedVolunteerIds.length === 1 ? '' : 's'} selected</small>
            </> : null}
            {recipientKind === 'group' ? <div className={styles.issuerGroupRecipientList}>{groups.length ? groups.map((group) => <label key={group.id}><input type="radio" name="groupId" value={group.id} required /><span><UsersRound size={15} /></span><div><b>{group.name}</b><small>{group.memberIds.length} volunteer{group.memberIds.length === 1 ? '' : 's'}</small></div></label>) : <p>Create a volunteer group from the Volunteers page before sending a group message.</p>}</div> : null}
            {recipientKind === 'roster' ? <div className={styles.issuerRosterRecipientSummary}><span><Inbox size={17} /></span><div><b>Everyone on your volunteer roster</b><p>This message will be delivered to all {volunteers.length} current roster member{volunteers.length === 1 ? '' : 's'}.</p></div></div> : null}
          </div>
          <div className={styles.issuerMessageFields}><label>Subject<input name="subject" maxLength={160} required placeholder="What is this message about?" /></label><label>Message<textarea name="body" rows={5} maxLength={5000} required placeholder="Write a clear update for your volunteers…" /></label></div>
          <div className={styles.issuerInboxComposerActions}><button type="button" onClick={() => setComposerOpen(false)}>Cancel</button><button type="submit" className={styles.issuerInboxSendButton} disabled={recipientKind === 'individual' && selectedVolunteerIds.length === 0}><Send size={14} /> Send Message</button></div>
        </form>
      </section>
    </div>, document.body) : null}
  </section>
}
