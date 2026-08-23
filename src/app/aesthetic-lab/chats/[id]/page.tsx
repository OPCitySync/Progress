import Link from 'next/link'
import { ArrowLeft, CalendarDays, MessageCircle, Send } from 'lucide-react'
import { postParticipantEventChatMessageAction } from '@/app/actions'
import { requireRole } from '@/lib/auth/session'
import { getEventChatForParticipant } from '@/lib/services/event-chat'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { LabNotice } from '../../LabNotice'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function ParticipantEventChatPage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; error?: string } }) {
  const session = await requireRole('participant')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const chat = await getEventChatForParticipant(params.id, session.sub)

  return <main className={styles.app}>
    <LabHeader activeSection="feed" session={session} city={city} cities={cities} contexts={contexts} />
    <section className={styles.detailLayout}><aside className={styles.leftRail}><section className={styles.cityCard}><MessageCircle size={19} /><h2>Event chat</h2><p>Shared only with people signed up for the same event.</p><Link href="/aesthetic-lab/notifications">Return to notifications</Link></section></aside><section className={styles.primaryColumn}>
      <Link className={styles.volunteerProfileBack} href="/aesthetic-lab/notifications"><ArrowLeft size={15} /> Back to notifications</Link>
      {!chat ? <section className={styles.labPanel}><p className={styles.emptyCopy}>This event chat has closed or is not available for your current shift.</p></section> : <>
        <section className={styles.eventChatHero}><span><MessageCircle size={22} /></span><div><p className={styles.eyebrow}>Live event chat</p><h1>{chat.task.title}</h1><p><CalendarDays size={14} /> {chat.shift.startsAt ? new Date(chat.shift.startsAt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Time to be confirmed'}</p></div></section>
        <LabNotice ok={searchParams.ok} error={searchParams.error} />
        <section className={styles.eventChatRoom}><div className={styles.eventChatRoomHeading}><div><p className={styles.eyebrow}>Shift conversation</p><h2>Connect with your event team.</h2></div><span>Closes when this event ends</span></div><div className={styles.eventChatMessages}>{chat.messages.length ? chat.messages.map((message) => <article key={message.id} data-self={message.senderUserId === session.sub ? 'true' : undefined}><b>{message.senderUserId === session.sub ? 'You' : message.senderName}</b><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></article>) : <div className={styles.eventChatEmpty}><MessageCircle size={19} /><div><b>Be the first to say hello.</b><p>Use this space for practical coordination with your event team.</p></div></div>}</div><form action={postParticipantEventChatMessageAction} className={styles.eventChatComposer}><input type="hidden" name="chatId" value={chat.chat.id} /><label><span className="sr-only">Message</span><textarea name="body" rows={2} maxLength={2000} required placeholder="Write to your event team…" /></label><button className={styles.rosterManageButton} type="submit"><Send size={14} /> Send</button></form></section>
      </>}
    </section></section>
  </main>
}
