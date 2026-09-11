'use client'

import { Archive, CalendarDays, Check, Inbox, Mail, MessageCircle, Search, Send, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createEventChatAction, postIssuerEventChatMessageAction, sendOrganizationMessageAction } from '@/app/actions'
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

type Volunteer = { userId: string; name: string; email: string }
type Group = { id: string; name: string; memberIds: string[] }

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

/** Select an upcoming event on the left and coordinate in its temporary room on the right. */
export function IssuerEventChatWorkspace({
  events,
  archivedChats,
  outboundMessages,
  volunteers,
  groups,
  actorId,
  initialShiftId,
  initialPane,
  initialMessageId,
  initialVolunteerId,
}: {
  events: UpcomingEvent[]
  archivedChats: ArchivedEventChat[]
  outboundMessages: OutboundMessage[]
  volunteers: Volunteer[]
  groups: Group[]
  actorId: string
  initialShiftId?: string
  initialPane?: string
  initialMessageId?: string
  initialVolunteerId?: string
}) {
  const [selectedShiftId, setSelectedShiftId] = useState(() => events.some((event) => event.shiftId === initialShiftId) ? initialShiftId! : events[0]?.shiftId ?? '')
  const [selectedArchiveId, setSelectedArchiveId] = useState(() => archivedChats[0]?.id ?? '')
  const [selectedMessageId, setSelectedMessageId] = useState(() => outboundMessages.some((message) => message.id === initialMessageId) ? initialMessageId! : outboundMessages[0]?.id ?? '')
  const [pane, setPane] = useState<'events' | 'outbound' | 'archive'>(() => initialPane === 'outbound' || initialPane === 'archive' ? initialPane : 'events')
  const [query, setQuery] = useState('')
  const [recipientKind, setRecipientKind] = useState<'individual' | 'group' | 'roster'>('individual')
  const [volunteerQuery, setVolunteerQuery] = useState('')
  const [selectedVolunteerIds, setSelectedVolunteerIds] = useState<string[]>(() => volunteers.some((volunteer) => volunteer.userId === initialVolunteerId) ? [initialVolunteerId!] : [])
  const selectedEvent = events.find((event) => event.shiftId === selectedShiftId) ?? events[0] ?? null
  const selectedArchive = archivedChats.find((chat) => chat.id === selectedArchiveId) ?? archivedChats[0] ?? null
  const selectedMessage = outboundMessages.find((message) => message.id === selectedMessageId) ?? outboundMessages[0] ?? null
  const selectedDate = selectedEvent ? eventDate(selectedEvent.startsAt) : null
  const redirectTo = selectedEvent ? `/aesthetic-lab/issuer/notifications?event=${encodeURIComponent(selectedEvent.shiftId)}` : '/aesthetic-lab/issuer/notifications'
  const normalizedQuery = query.trim().toLowerCase()
  const filteredEvents = events.filter((event) => !normalizedQuery || `${event.title} ${event.label}`.toLowerCase().includes(normalizedQuery))
  const filteredMessages = outboundMessages.filter((message) => !normalizedQuery || `${message.subject} ${message.body} ${audienceLabel(message)}`.toLowerCase().includes(normalizedQuery))
  const filteredArchivedChats = archivedChats.filter((chat) => !normalizedQuery || `${chat.title} ${chat.label}`.toLowerCase().includes(normalizedQuery))
  const filteredVolunteers = volunteers.filter((volunteer) => {
    const nextQuery = volunteerQuery.trim().toLowerCase()
    return !nextQuery || `${volunteer.name} ${volunteer.email}`.toLowerCase().includes(nextQuery)
  })

  const toggleVolunteer = (userId: string) => {
    setSelectedVolunteerIds((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId])
  }

  useEffect(() => {
    if (initialPane === 'outbound') {
      setPane('outbound')
      if (outboundMessages.some((message) => message.id === initialMessageId)) setSelectedMessageId(initialMessageId!)
    }
    if (initialPane === 'archive') setPane('archive')
  }, [initialMessageId, initialPane, outboundMessages])

  useEffect(() => {
    if (!initialVolunteerId || !volunteers.some((volunteer) => volunteer.userId === initialVolunteerId)) return
    setRecipientKind('individual')
    setSelectedVolunteerIds([initialVolunteerId])
    setVolunteerQuery('')
  }, [initialVolunteerId, volunteers])

  return <section className={styles.issuerEventChatWorkspace}>
    <header className={styles.issuerEventChatWorkspaceHeader}>
      <div><p className={styles.eyebrow}>Organization communication</p><h2>Communication Center</h2><p>Coordinate each shift in a shared conversation, or review messages sent to your volunteers. Event chats stay limited to the people signed up, then remain in Archive for 14 days after the event ends.</p></div>
    </header>

    <div className={styles.issuerEventChatWorkspaceBody}>
      <aside className={styles.issuerEventChatEventPane} aria-label="Communication views">
        <label className={styles.issuerEventChatSearch}><Search size={14} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={pane === 'events' ? 'Search upcoming events' : pane === 'outbound' ? 'Search outbound messages' : 'Search archived chats'} /></label>
        <div className={styles.issuerEventChatTabs} role="tablist" aria-label="Event group chat views">
          <button type="button" role="tab" aria-selected={pane === 'events'} data-active={pane === 'events' ? 'true' : undefined} onClick={() => setPane('events')}><MessageCircle size={13} /> Event chats</button>
          <button type="button" role="tab" aria-selected={pane === 'outbound'} data-active={pane === 'outbound' ? 'true' : undefined} onClick={() => setPane('outbound')}><Mail size={13} /> Outbound messages</button>
          <button type="button" role="tab" aria-selected={pane === 'archive'} data-active={pane === 'archive' ? 'true' : undefined} onClick={() => setPane('archive')}><Archive size={13} /> Archive</button>
        </div>
        <div className={styles.issuerEventChatEventList}>
          {pane === 'events' && filteredEvents.length ? filteredEvents.map((event) => {
            const date = eventDate(event.startsAt)
            return <button type="button" key={event.shiftId} data-active={selectedEvent?.shiftId === event.shiftId ? 'true' : undefined} onClick={() => setSelectedShiftId(event.shiftId)}>
              <time><b>{date.day}</b><span>{date.month}</span></time>
              <div><span>{event.chat ? 'Group chat open' : 'Chat not started'}</span><b>{event.title}</b><small>{date.detail}{event.label ? ` · ${event.label}` : ''}</small><em><UsersRound size={12} /> {event.participantCount} signed up{event.chat ? ` · ${event.chat.messageCount} message${event.chat.messageCount === 1 ? '' : 's'}` : ''}</em></div>
            </button>
          }) : null}
          {pane === 'events' && !filteredEvents.length ? <div className={styles.issuerEventChatNoEvents}><CalendarDays size={19} /><b>{events.length ? 'No events match that search.' : 'No upcoming events are published.'}</b><p>{events.length ? 'Try another title or schedule detail.' : 'Published volunteer shifts will appear here when they are ready to coordinate.'}</p></div> : null}
          {pane === 'outbound' && filteredMessages.length ? filteredMessages.map((message) => <button type="button" key={message.id} className={styles.issuerOutboundMessageRow} data-active={selectedMessage?.id === message.id ? 'true' : undefined} onClick={() => setSelectedMessageId(message.id)}>
            <span className={styles.issuerOutboundMessageIcon}><Mail size={14} /></span>
            <div><span>To: {audienceLabel(message)}</span><b>{message.subject}</b><small>{message.body}</small><em>{message.recipientCount} recipient{message.recipientCount === 1 ? '' : 's'} · {shortDate(message.createdAt)}</em></div>
          </button>) : null}
          {pane === 'outbound' && !filteredMessages.length ? <div className={styles.issuerEventChatNoEvents}><Mail size={19} /><b>{outboundMessages.length ? 'No messages match that search.' : 'No outbound messages yet.'}</b><p>{outboundMessages.length ? 'Try another subject, recipient, or phrase.' : 'Messages sent to individuals, groups, and your roster will appear here.'}</p></div> : null}
          {pane === 'archive' && filteredArchivedChats.length ? filteredArchivedChats.map((chat) => {
            const date = eventDate(chat.startsAt)
            return <button type="button" key={chat.id} className={styles.issuerArchivedChatRow} data-active={selectedArchive?.id === chat.id ? 'true' : undefined} onClick={() => setSelectedArchiveId(chat.id)}>
              <time><b>{date.day}</b><span>{date.month}</span></time>
              <div><span>Archived · deletes {shortDate(chat.deleteAt)}</span><b>{chat.title}</b><small>{date.detail}{chat.label ? ` · ${chat.label}` : ''}</small><em><UsersRound size={12} /> {chat.participantCount} participants · {chat.messageCount} message{chat.messageCount === 1 ? '' : 's'}</em></div>
            </button>
          }) : null}
          {pane === 'archive' && !filteredArchivedChats.length ? <div className={styles.issuerEventChatNoEvents}><Archive size={19} /><b>{archivedChats.length ? 'No archived chats match that search.' : 'No archived group chats.'}</b><p>{archivedChats.length ? 'Try another event title or schedule detail.' : 'When an event ends, its group chat will stay here for 14 days before permanent deletion.'}</p></div> : null}
        </div>
      </aside>

      <article className={styles.issuerEventChatConversation}>
        {pane === 'outbound' && selectedMessage ? <>
          <header>
            <span className={styles.issuerEventChatConversationIcon}><Mail size={17} /></span>
            <div><p className={styles.eyebrow}>Outbound message</p><h3>{selectedMessage.subject}</h3><small>Sent to {audienceLabel(selectedMessage)} · {selectedMessage.recipientCount} recipient{selectedMessage.recipientCount === 1 ? '' : 's'} · {new Date(selectedMessage.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></div>
          </header>
          <div className={styles.issuerOutboundMessageBody}><p>{selectedMessage.body}</p></div>
          <footer><span><Mail size={14} /> Delivered to {selectedMessage.recipientCount} recipient{selectedMessage.recipientCount === 1 ? '' : 's'}</span></footer>
        </> : null}
        {pane === 'archive' && selectedArchive ? <>
          <header>
            <span className={styles.issuerEventChatConversationIcon}><Archive size={17} /></span>
            <div><p className={styles.eyebrow}>Archived group chat</p><h3>{selectedArchive.title}</h3><small>{eventDate(selectedArchive.startsAt).detail}{selectedArchive.label ? ` · ${selectedArchive.label}` : ''} · {selectedArchive.participantCount} participant{selectedArchive.participantCount === 1 ? '' : 's'}</small></div>
            <span className={styles.issuerEventChatCloses}>Deletes {fullDate(selectedArchive.deleteAt)}</span>
          </header>
          <div className={styles.issuerEventChatMessages} aria-live="polite">
            {selectedArchive.messages.length ? selectedArchive.messages.map((message) => <article key={message.id} data-self={message.senderUserId === actorId ? 'true' : undefined}><b>{message.senderUserId === actorId ? 'You' : message.senderName}</b><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></article>) : <div className={styles.issuerEventChatEmpty}><Archive size={21} /><div><b>No messages were sent.</b><p>This group chat remained open until the event ended, then was placed here for short-term reference.</p></div></div>}
          </div>
          <footer><span><Archive size={14} /> Read-only · archived {fullDate(selectedArchive.archivedAt)} · permanently deleted {fullDate(selectedArchive.deleteAt)}</span></footer>
        </> : null}
        {pane === 'events' && selectedEvent && selectedDate ? <>
          <header>
            <span className={styles.issuerEventChatConversationIcon}><MessageCircle size={17} /></span>
            <div><p className={styles.eyebrow}>{selectedEvent.chat ? 'Live group chat' : 'Event ready for a group chat'}</p><h3>{selectedEvent.title}</h3><small>{selectedDate.detail}{selectedEvent.label ? ` · ${selectedEvent.label}` : ''} · {selectedEvent.participantCount} signed up</small></div>
          </header>

          {selectedEvent.chat ? <>
            <div className={styles.issuerEventChatMessages} aria-live="polite">
              {selectedEvent.chat.messages.length ? selectedEvent.chat.messages.map((message) => <article key={message.id} data-self={message.senderUserId === actorId ? 'true' : undefined}><b>{message.senderUserId === actorId ? 'You' : message.senderName}</b><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></article>) : <div className={styles.issuerEventChatEmpty}><MessageCircle size={21} /><div><b>Start the conversation.</b><p>Share arrival details, equipment needs, or a welcome with everyone signed up for this event.</p></div></div>}
            </div>
            <form action={postIssuerEventChatMessageAction} className={styles.issuerEventChatComposer}>
              <input type="hidden" name="chatId" value={selectedEvent.chat.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <label><span className="sr-only">Message</span><textarea name="body" rows={2} maxLength={2000} required placeholder="Write to everyone signed up for this event…" /></label>
              <button type="submit"><Send size={14} /> Send</button>
            </form>
          </> : <div className={styles.issuerEventChatStartState}>
            <span><MessageCircle size={23} /></span>
            <div><h4>Open a group chat for this event.</h4><p>The space will be available only to volunteers currently signed up for this shift. After the event, it becomes read-only in Archive for 14 days before permanent deletion.</p><form action={createEventChatAction}><input type="hidden" name="shiftId" value={selectedEvent.shiftId} /><input type="hidden" name="redirectTo" value={redirectTo} /><button type="submit"><MessageCircle size={14} /> Open group chat</button></form></div>
          </div>}
        </> : null}
        {pane === 'events' && (!selectedEvent || !selectedDate) ? <div className={styles.issuerEventChatConversationEmpty}><MessageCircle size={26} /><h3>Select an upcoming event.</h3><p>Its group chat will open here when it is ready.</p></div> : null}
        {pane === 'outbound' && !selectedMessage ? <div className={styles.issuerEventChatConversationEmpty}><Mail size={26} /><h3>Select an outbound message.</h3><p>Its delivery details will appear here.</p></div> : null}
        {pane === 'archive' && !selectedArchive ? <div className={styles.issuerEventChatConversationEmpty}><Archive size={26} /><h3>Select an archived group chat.</h3><p>Its messages remain available to your organization for 14 days after the event ends.</p></div> : null}
      </article>
    </div>

    <div id="individual-messages" className={styles.issuerInboxComposerWrap} data-open="true">
      <section className={styles.issuerInboxComposer}>
        <form action={sendOrganizationMessageAction} className={styles.issuerInboxComposerForm}>
          <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/notifications" />
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
          <div className={styles.issuerInboxComposerActions}><button type="submit" className={styles.issuerInboxSendButton} disabled={recipientKind === 'individual' && selectedVolunteerIds.length === 0}><Send size={14} /> Send message</button></div>
        </form>
      </section>
    </div>
  </section>
}
