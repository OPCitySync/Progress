import Link from 'next/link'
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, MapPin, ShieldCheck, UsersRound } from 'lucide-react'
import { and, eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { claims, orgs, tasks } from '@/lib/db/schema'
import { claimShiftAction } from '@/app/actions'
import { getActiveWaiver } from '@/lib/services/waivers'
import { checkClaimGate, getShiftsWithCounts } from '@/lib/services/opportunities'
import { savedItemIds } from '@/lib/services/saved-items'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { LabNotice } from '../../LabNotice'
import { SaveTaskButton } from '../../SaveTaskButton'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

function shiftTime(startsAt: number | null, endsAt: number | null) {
  if (!startsAt) return 'Time to be confirmed'
  const start = new Date(startsAt).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const end = endsAt ? new Date(endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
  return end ? `${start}–${end}` : start
}

export default async function LabOpportunityDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; error?: string } }) {
  const session = await requireRole('participant')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const task = (await db.select().from(tasks).where(eq(tasks.id, params.id)).limit(1))[0]
  const org = task ? (await db.select().from(orgs).where(eq(orgs.id, task.orgId)).limit(1))[0] : null
  if (!task || !org || task.status !== 'open' || (city && task.cityId !== city.id)) return <main className={styles.app}><LabHeader activeSection="opportunities" session={session} city={city} cities={cities} contexts={contexts} /><section className={styles.primaryColumn}><p className={styles.emptyCopy}>This opportunity is no longer available in your active city.</p><Link href="/aesthetic-lab/opportunities">Back to opportunities</Link></section></main>
  const [sessions, waiver, myClaims, savedTaskIds] = await Promise.all([
    getShiftsWithCounts(task.id),
    getActiveWaiver(org.id),
    db.select().from(claims).where(and(eq(claims.taskId, task.id), eq(claims.userId, session.sub))),
    savedItemIds(session.sub, 'task', [task.id]),
  ])
  const claimByShift = new Map(myClaims.map((claim) => [claim.shiftId, claim]))
  const isOnboarding = /onboard|orientation/i.test(task.title)

  return <main className={styles.app}>
    <LabHeader activeSection="opportunities" session={session} city={city} cities={cities} contexts={contexts} />
    <section className={styles.detailLayout}><aside className={styles.leftRail}><section className={styles.cityCard}><p className={styles.eyebrow}>{isOnboarding ? 'Onboarding session' : 'Volunteer opportunity'}</p><h2>{org.name}</h2><p>Provided by an approved organization in {city?.name ?? 'your city'}.</p><Link href={`/aesthetic-lab/organizations/${org.slug}`}>View organization</Link></section></aside><section className={styles.primaryColumn}><Link href="/aesthetic-lab/opportunities" className={styles.issuerTextButton}><ArrowLeft size={15} /> Back to opportunities</Link><div className={styles.pageIntro}><p className={styles.eyebrow}>{isOnboarding ? 'A good first step' : 'Open opportunity'}</p><h1>{task.title}</h1><p>{task.description || 'The organization has not added a description yet.'}</p></div><LabNotice ok={searchParams.ok} error={searchParams.error} /><SaveTaskButton taskId={task.id} saved={savedTaskIds.has(task.id)} redirectTo={`/aesthetic-lab/opportunities/${task.id}`} /><section className={`${styles.labPanel} ${styles.labStack}`}><div><p className={styles.eyebrow}>What to expect</p><h2>Plan your visit</h2></div><div className={styles.labChoiceList}><div className={styles.labChoice}><p><MapPin size={15} /> <strong>Location</strong><small>{task.location || 'Location to be confirmed'}</small></p><p><UsersRound size={15} /> <strong>Capacity</strong><small>{task.slots} spot{task.slots === 1 ? '' : 's'} per session</small></p></div>{waiver ? <div className={styles.labChoice}><p><ShieldCheck size={15} /> <strong>Liability waiver</strong><small>{waiver.title} will be shown for acceptance when you reserve a shift.</small></p></div> : null}</div></section><section className={`${styles.labPanel} ${styles.labStack}`}><div><p className={styles.eyebrow}>Available sessions</p><h2>Choose a time</h2></div>{sessions.length ? sessions.map(({ shift, slotsLeft }) => {
    const existing = claimByShift.get(shift.id)
    return <article className={styles.labChoice} key={shift.id}><div><p><strong><CalendarDays size={15} /> {shiftTime(shift.startsAt, shift.endsAt)}</strong></p><small>{shift.label || 'Scheduled shift'} · {slotsLeft} of {shift.capacity} spot{shift.capacity === 1 ? '' : 's'} open</small></div>{existing && existing.status !== 'unclaimed' ? <span>{existing.status === 'claimed' ? 'You’re signed up' : existing.status}</span> : slotsLeft <= 0 ? <span>Full</span> : <form action={claimShiftAction} className={styles.labForm}><input type="hidden" name="taskId" value={task.id} /><input type="hidden" name="shiftId" value={shift.id} /><input type="hidden" name="redirectTo" value={`/aesthetic-lab/opportunities/${task.id}`} />{waiver ? <><input type="hidden" name="acceptWaiverVersionId" value={waiver.id} /><label><span><input type="checkbox" name="waiverAgree" required /> I accept the current waiver.</span></label></> : null}<button className={styles.labButton} type="submit">Reserve this shift</button></form>}</article>
  }) : <p className={styles.emptyCopy}>No sessions are scheduled yet.</p>}</section></section><aside className={styles.rightRail}><section className={styles.commitmentCard}><div className={styles.sectionHeading}><p className={styles.eyebrow}>Participation</p><Clock3 size={17} /></div><p>{isOnboarding ? 'Completing local onboarding activates your City Member status.' : 'Your attendance is confirmed by the organization after the shift.'}</p></section><section className={styles.savedCard}><CheckCircle2 size={19} /><div><p className={styles.eyebrow}>City/Sync verified</p><strong>Approved local organization</strong><span>Each listing shows current capacity and requirements.</span></div></section></aside></section>
  </main>
}
