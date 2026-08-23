import Link from 'next/link'
import { ArrowLeft, CalendarDays, MessageCircle, Send, UsersRound } from 'lucide-react'
import { postIssuerEventChatMessageAction } from '@/app/actions'
import { requireRole } from '@/lib/auth/session'
import { getEventChatForOrg } from '@/lib/services/event-chat'
import { getLabWorkspace } from '../../../../lab-workspace'
import { LabHeader } from '../../../../LabHeader'
import { LabNotice } from '../../../../LabNotice'
import { IssuerLabSidebar } from '../../../IssuerLabSidebar'
import styles from '../../../../prototype.module.css'

export const dynamic = 'force-dynamic'

function time(value: number) {
  return new Date(value).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default async function IssuerEventChatPage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; error?: string } }) {
  const session = await requireRole('issuer')
  if (!session.orgId) return null
  const { city, cities, contexts } = await getLabWorkspace(session)
  const chat = await getEventChatForOrg(params.id, session.orgId)

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-utility" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerLayout}>
      <IssuerLabSidebar organizationId={session.orgId} cityName={city?.name} />
      <section className={styles.issuerMain} aria-label="Event chat">
        <Link className={styles.volunteerProfileBack} href="/aesthetic-lab/issuer/notifications"><ArrowLeft size={15} /> Back to inbox</Link>
        {!chat ? <section className={styles.labPanel}><p className={styles.emptyCopy}>This event chat has closed or is not available for your organization.</p></section> : <>
          <section className={styles.eventChatHero}>
            <span><MessageCircle size={22} /></span>
            <div><p className={styles.eyebrow}>Live event chat</p><h1>{chat.task.title}</h1><p><CalendarDays size={14} /> {chat.shift.startsAt ? time(chat.shift.startsAt) : 'Time to be confirmed'} · closes {time(chat.chat.closesAt)}</p></div>
          </section>
          <LabNotice hidden ok={searchParams.ok} error={searchParams.error} />
          <section className={styles.eventChatRoom}>
            <div className={styles.eventChatRoomHeading}><div><p className={styles.eyebrow}>Shift conversation</p><h2>Everyone signed up for this event can participate.</h2></div><span><UsersRound size={14} /> Live until the event ends</span></div>
            <div className={styles.eventChatMessages}>{chat.messages.length ? chat.messages.map((message) => <article key={message.id} data-self={message.senderUserId === session.sub ? 'true' : undefined}><b>{message.senderUserId === session.sub ? 'You' : message.senderName}</b><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></article>) : <div className={styles.eventChatEmpty}><MessageCircle size={19} /><div><b>Start the conversation.</b><p>Share arrival details, equipment needs, or a quick welcome with everyone signed up for this shift.</p></div></div>}</div>
            <form action={postIssuerEventChatMessageAction} className={styles.eventChatComposer}><input type="hidden" name="chatId" value={chat.chat.id} /><label><span className="sr-only">Message</span><textarea name="body" rows={2} maxLength={2000} required placeholder="Write to everyone signed up for this event…" /></label><button className={styles.rosterManageButton} type="submit"><Send size={14} /> Send</button></form>
          </section>
        </>}
      </section>
    </div>
  </main>
}
