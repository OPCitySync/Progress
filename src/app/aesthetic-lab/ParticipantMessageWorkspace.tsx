'use client'

import Link from 'next/link'
import { Archive, Bell, CalendarDays, Inbox, Mail, MessageCircle, Search, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { markParticipantEventChatReadAction, markParticipantInboxItemReadAction, postParticipantEventChatMessageAction } from '@/app/actions'
import styles from './prototype.module.css'

type EventMessage = {
  id: string
  senderUserId: string
  senderName: string
  body: string
  createdAt: number
}

type EventChat = {
  id: string
  title: string
  label: string
  startsAt: number | null
  endsAt: number | null
  closesAt: number
  messageCount: number
  unreadCount: number
  messages: EventMessage[]
}

type ArchivedEventChat = Omit<EventChat, 'closesAt' | 'unreadCount'> & {
  archivedAt: number
  deleteAt: number
}

type InboxItem = {
  id: string
  kind: 'notification' | 'organization-message'
  title: string
  body: string
  source: string
  createdAt: number
  unread: boolean
  link?: string | null
}

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

/** The participant counterpart to the organization Communication Center. */
export function ParticipantMessageWorkspace({
  chats,
  archivedChats,
  inbox,
  actorId,
  initialPane,
  initialChatId,
  initialInboxId,
}: {
  chats: EventChat[]
  archivedChats: ArchivedEventChat[]
  inbox: InboxItem[]
  actorId: string
  initialPane?: string
  initialChatId?: string
  initialInboxId?: string
}) {
  const [pane, setPane] = useState<'events' | 'inbox' | 'archive'>(() => initialPane === 'inbox' || initialPane === 'archive' ? initialPane : 'events')
  const [query, setQuery] = useState('')
  const [selectedChatId, setSelectedChatId] = useState(() => chats.some((chat) => chat.id === initialChatId) ? initialChatId! : chats[0]?.id ?? '')
  const [selectedInboxId, setSelectedInboxId] = useState(() => inbox.some((item) => item.id === initialInboxId) ? initialInboxId! : inbox[0]?.id ?? '')
  const [selectedArchiveId, setSelectedArchiveId] = useState(() => archivedChats[0]?.id ?? '')
  const [readEventChatIds, setReadEventChatIds] = useState<Set<string>>(() => new Set())
  const [readInboxItemIds, setReadInboxItemIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (initialPane === 'inbox') {
      setPane('inbox')
      if (inbox.some((item) => item.id === initialInboxId)) setSelectedInboxId(initialInboxId!)
    }
    if (initialPane === 'archive') setPane('archive')
    if (initialPane === 'events') {
      setPane('events')
      if (chats.some((chat) => chat.id === initialChatId)) setSelectedChatId(initialChatId!)
    }
  }, [chats, inbox, initialChatId, initialInboxId, initialPane])

  const normalizedQuery = query.trim().toLowerCase()
  const filteredChats = chats.filter((chat) => !normalizedQuery || `${chat.title} ${chat.label}`.toLowerCase().includes(normalizedQuery))
  const filteredInbox = inbox.filter((item) => !normalizedQuery || `${item.title} ${item.body} ${item.source}`.toLowerCase().includes(normalizedQuery))
  const filteredArchive = archivedChats.filter((chat) => !normalizedQuery || `${chat.title} ${chat.label}`.toLowerCase().includes(normalizedQuery))
  const selectedChat = chats.find((chat) => chat.id === selectedChatId) ?? chats[0] ?? null
  const selectedInbox = inbox.find((item) => item.id === selectedInboxId) ?? inbox[0] ?? null
  const selectedArchive = archivedChats.find((chat) => chat.id === selectedArchiveId) ?? archivedChats[0] ?? null
  const unreadInboxCount = inbox.filter((item) => item.unread && !readInboxItemIds.has(item.id)).length
  const unreadEventChatCount = chats.reduce((count, chat) => count + (readEventChatIds.has(chat.id) ? 0 : chat.unreadCount), 0)

  useEffect(() => {
    if (pane !== 'events' || !selectedChat || selectedChat.unreadCount === 0) return

    setReadEventChatIds((current) => {
      if (current.has(selectedChat.id)) return current
      return new Set(current).add(selectedChat.id)
    })

    const formData = new FormData()
    formData.set('chatId', selectedChat.id)
    void markParticipantEventChatReadAction(formData)
  }, [pane, selectedChat])

  function openInboxItem(item: InboxItem) {
    setSelectedInboxId(item.id)
    if (!item.unread || readInboxItemIds.has(item.id)) return

    setReadInboxItemIds((current) => new Set(current).add(item.id))
    const formData = new FormData()
    formData.set('itemId', item.id)
    formData.set('kind', item.kind)
    void markParticipantInboxItemReadAction(formData)
  }

  const searchPlaceholder = pane === 'events'
    ? 'Search event chats'
    : pane === 'inbox'
      ? 'Search inbox'
      : 'Search archived chats'

  return <section className={styles.issuerEventChatWorkspace}>
    <header className={styles.issuerEventChatWorkspaceHeader}>
      <div><p className={styles.eyebrow}>Your communications</p><h2>Messages</h2><p>Keep practical coordination in the event chat for each upcoming shift. Organization messages and City/Sync updates stay in your Inbox; finished event chats remain in Archive for 14 days.</p></div>
    </header>

    <div className={styles.issuerEventChatWorkspaceBody}>
      <aside className={styles.issuerEventChatEventPane} aria-label="Message views">
        <label className={styles.issuerEventChatSearch}><Search size={14} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} /></label>
        <div className={styles.issuerEventChatTabs} role="tablist" aria-label="Messages views">
          <button type="button" role="tab" aria-selected={pane === 'inbox'} data-active={pane === 'inbox' ? 'true' : undefined} onClick={() => setPane('inbox')}><Inbox size={13} /> Inbox{unreadInboxCount ? <span className={styles.issuerEventChatTabBadge} aria-label={`${unreadInboxCount} unread inbox message${unreadInboxCount === 1 ? '' : 's'}`}>{unreadInboxCount > 99 ? '99+' : unreadInboxCount}</span> : null}</button>
          <button type="button" role="tab" aria-selected={pane === 'events'} data-active={pane === 'events' ? 'true' : undefined} onClick={() => setPane('events')}><MessageCircle size={13} /> Event chats{unreadEventChatCount ? <span className={styles.issuerEventChatTabBadge} aria-label={`${unreadEventChatCount} unread event-chat message${unreadEventChatCount === 1 ? '' : 's'}`}>{unreadEventChatCount > 99 ? '99+' : unreadEventChatCount}</span> : null}</button>
          <button type="button" role="tab" aria-selected={pane === 'archive'} data-active={pane === 'archive' ? 'true' : undefined} onClick={() => setPane('archive')}><Archive size={13} /> Archive</button>
        </div>
        <div className={styles.issuerEventChatEventList}>
          {pane === 'events' && filteredChats.length ? filteredChats.map((chat) => {
            const date = eventDate(chat.startsAt)
            return <button type="button" key={chat.id} data-active={selectedChat?.id === chat.id ? 'true' : undefined} onClick={() => setSelectedChatId(chat.id)}>
              <time><b>{date.day}</b><span>{date.month}</span></time>
              <div><span>Group chat open</span><b>{chat.title}</b><small>{date.detail}{chat.label ? ` · ${chat.label}` : ''}</small><em><MessageCircle size={12} /> {chat.messageCount} message{chat.messageCount === 1 ? '' : 's'}</em></div>
            </button>
          }) : null}
          {pane === 'events' && !filteredChats.length ? <div className={styles.issuerEventChatNoEvents}><CalendarDays size={19} /><b>{chats.length ? 'No event chats match that search.' : 'No event chats are open.'}</b><p>{chats.length ? 'Try another event title or schedule detail.' : 'When an organization opens a chat for a shift you joined, it will appear here.'}</p></div> : null}

          {pane === 'inbox' && filteredInbox.length ? filteredInbox.map((item) => <button type="button" key={item.id} className={styles.issuerOutboundMessageRow} data-active={selectedInbox?.id === item.id ? 'true' : undefined} onClick={() => openInboxItem(item)}>
            <span className={styles.issuerOutboundMessageIcon}>{item.kind === 'organization-message' ? <Mail size={14} /> : <Bell size={14} />}</span>
            <div><span>{item.kind === 'organization-message' ? item.source : 'City/Sync update'}{item.unread && !readInboxItemIds.has(item.id) ? ' · New' : ''}</span><b>{item.title}</b><small>{item.body || 'An update from City/Sync.'}</small><em>{shortDate(item.createdAt)}</em></div>
          </button>) : null}
          {pane === 'inbox' && !filteredInbox.length ? <div className={styles.issuerEventChatNoEvents}><Inbox size={19} /><b>{inbox.length ? 'No messages match that search.' : 'Your Inbox is clear.'}</b><p>{inbox.length ? 'Try a message subject, organization, or phrase.' : 'Messages from your organizations and City/Sync updates will appear here.'}</p></div> : null}

          {pane === 'archive' && filteredArchive.length ? filteredArchive.map((chat) => {
            const date = eventDate(chat.startsAt)
            return <button type="button" key={chat.id} className={styles.issuerArchivedChatRow} data-active={selectedArchive?.id === chat.id ? 'true' : undefined} onClick={() => setSelectedArchiveId(chat.id)}>
              <time><b>{date.day}</b><span>{date.month}</span></time>
              <div><span>Archived · deletes {shortDate(chat.deleteAt)}</span><b>{chat.title}</b><small>{date.detail}{chat.label ? ` · ${chat.label}` : ''}</small><em><MessageCircle size={12} /> {chat.messageCount} message{chat.messageCount === 1 ? '' : 's'}</em></div>
            </button>
          }) : null}
          {pane === 'archive' && !filteredArchive.length ? <div className={styles.issuerEventChatNoEvents}><Archive size={19} /><b>{archivedChats.length ? 'No archived chats match that search.' : 'No archived event chats.'}</b><p>{archivedChats.length ? 'Try another event title or schedule detail.' : 'When a chat closes after a shift, it stays here for 14 days before permanent deletion.'}</p></div> : null}
        </div>
      </aside>

      <article className={styles.issuerEventChatConversation}>
        {pane === 'events' && selectedChat ? <>
          <header>
            <span className={styles.issuerEventChatConversationIcon}><MessageCircle size={17} /></span>
            <div><p className={styles.eyebrow}>Live event chat</p><h3>{selectedChat.title}</h3><small>{eventDate(selectedChat.startsAt).detail}{selectedChat.label ? ` · ${selectedChat.label}` : ''}</small></div>
            <span className={styles.issuerEventChatCloses}>Closes {fullDate(selectedChat.closesAt)}</span>
          </header>
          <div className={styles.issuerEventChatMessages} aria-live="polite">
            {selectedChat.messages.length ? selectedChat.messages.map((message) => <article key={message.id} data-self={message.senderUserId === actorId ? 'true' : undefined}><b>{message.senderUserId === actorId ? 'You' : message.senderName}</b><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></article>) : <div className={styles.issuerEventChatEmpty}><MessageCircle size={21} /><div><b>Be the first to say hello.</b><p>Use this space for practical coordination with the people signed up for your event.</p></div></div>}
          </div>
          <form action={postParticipantEventChatMessageAction} className={styles.issuerEventChatComposer}>
            <input type="hidden" name="chatId" value={selectedChat.id} />
            <input type="hidden" name="redirectTo" value={`/aesthetic-lab/messages?pane=events&event=${encodeURIComponent(selectedChat.id)}`} />
            <label><span className="sr-only">Message</span><textarea name="body" rows={2} maxLength={2000} required placeholder="Write to your event team…" /></label>
            <button type="submit"><Send size={14} /> Send</button>
          </form>
        </> : null}

        {pane === 'inbox' && selectedInbox ? <>
          <header>
            <span className={styles.issuerEventChatConversationIcon}>{selectedInbox.kind === 'organization-message' ? <Mail size={17} /> : <Bell size={17} />}</span>
            <div><p className={styles.eyebrow}>{selectedInbox.kind === 'organization-message' ? `From ${selectedInbox.source}` : 'City/Sync update'}</p><h3>{selectedInbox.title}</h3><small>{fullDate(selectedInbox.createdAt)}</small></div>
          </header>
          <div className={styles.issuerOutboundMessageBody}><p>{selectedInbox.body || 'An update from City/Sync.'}</p></div>
          {selectedInbox.link ? <footer><div className={styles.participantMessageActions}><Link className={`${styles.participantMessageAction} ${styles.participantMessageActionPrimary}`} href={selectedInbox.link}>Open Related Item</Link></div></footer> : null}
        </> : null}

        {pane === 'archive' && selectedArchive ? <>
          <header>
            <span className={styles.issuerEventChatConversationIcon}><Archive size={17} /></span>
            <div><p className={styles.eyebrow}>Archived event chat</p><h3>{selectedArchive.title}</h3><small>{eventDate(selectedArchive.startsAt).detail}{selectedArchive.label ? ` · ${selectedArchive.label}` : ''}</small></div>
            <span className={styles.issuerEventChatCloses}>Deletes {fullDate(selectedArchive.deleteAt)}</span>
          </header>
          <div className={styles.issuerEventChatMessages} aria-live="polite">
            {selectedArchive.messages.length ? selectedArchive.messages.map((message) => <article key={message.id} data-self={message.senderUserId === actorId ? 'true' : undefined}><b>{message.senderUserId === actorId ? 'You' : message.senderName}</b><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></article>) : <div className={styles.issuerEventChatEmpty}><Archive size={21} /><div><b>No messages were sent.</b><p>This event chat stayed open until the shift ended, then moved here for short-term reference.</p></div></div>}
          </div>
          <footer><span><Archive size={14} /> Read-only · archived {fullDate(selectedArchive.archivedAt)} · permanently deleted {fullDate(selectedArchive.deleteAt)}</span></footer>
        </> : null}

        {pane === 'events' && !selectedChat ? <div className={styles.issuerEventChatConversationEmpty}><MessageCircle size={26} /><h3>Select an event chat.</h3><p>Your conversation with that event team will appear here.</p></div> : null}
        {pane === 'inbox' && !selectedInbox ? <div className={styles.issuerEventChatConversationEmpty}><Inbox size={26} /><h3>Select a message.</h3><p>Messages from organizations and City/Sync will appear here.</p></div> : null}
        {pane === 'archive' && !selectedArchive ? <div className={styles.issuerEventChatConversationEmpty}><Archive size={26} /><h3>Select an archived chat.</h3><p>Its record stays available for 14 days after the event ends.</p></div> : null}
      </article>
    </div>
  </section>
}
