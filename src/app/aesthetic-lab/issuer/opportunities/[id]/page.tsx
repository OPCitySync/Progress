import Link from 'next/link'
import { ArrowLeft, CalendarDays, Plus, UsersRound } from 'lucide-react'
import { and, eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { tasks } from '@/lib/db/schema'
import { closeTaskAction, createShiftAction, reopenTaskAction } from '@/app/actions'
import { getShiftsWithCounts } from '@/lib/services/opportunities'
import { getLabWorkspace } from '../../../lab-workspace'
import { LabHeader } from '../../../LabHeader'
import { LabNotice } from '../../../LabNotice'
import styles from '../../../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function ManageLabOpportunityPage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; error?: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const task = (await db.select().from(tasks).where(and(eq(tasks.id, params.id), eq(tasks.orgId, session.orgId!))).limit(1))[0]
  if (!task) return <main className={styles.app}><LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} /><section className={styles.primaryColumn}><p className={styles.emptyCopy}>This opportunity is unavailable.</p><Link href="/aesthetic-lab/issuer/catalog">Back to catalog</Link></section></main>
  const sessions = await getShiftsWithCounts(task.id)
  const redirectTo = `/aesthetic-lab/issuer/opportunities/${task.id}`
  return <main className={styles.app}><LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} /><section className={styles.detailLayout}><aside className={styles.leftRail}><section className={styles.cityCard}><p className={styles.eyebrow}>Opportunity</p><h2>{task.title}</h2><p>{task.status === 'open' ? 'Published and open for sign-ups.' : 'Closed to new sign-ups.'}</p><Link href="/aesthetic-lab/issuer/catalog"><ArrowLeft size={14} /> Catalog</Link></section></aside><section className={styles.primaryColumn}><div className={styles.labDetailHero}><div><p className={styles.eyebrow}>Manage opportunity</p><h1>{task.title}</h1><p>{task.description || 'No description added.'}</p></div>{task.status === 'open' ? <form action={closeTaskAction}><input type="hidden" name="taskId" value={task.id} /><input type="hidden" name="redirectTo" value={redirectTo} /><button className={`${styles.labButton} ${styles.labButtonSecondary}`} type="submit">Close opportunity</button></form> : <form action={reopenTaskAction}><input type="hidden" name="taskId" value={task.id} /><input type="hidden" name="redirectTo" value={redirectTo} /><button className={styles.labButton} type="submit">Reopen opportunity</button></form>}</div><LabNotice ok={searchParams.ok} error={searchParams.error} /><section className={`${styles.labPanel} ${styles.labStack}`}><div><p className={styles.eyebrow}>Scheduled shifts</p><h2>Capacity at a glance</h2></div>{sessions.length ? sessions.map(({ shift, taken, slotsLeft }) => <article className={styles.labChoice} key={shift.id}><div><p><strong><CalendarDays size={15} /> {shift.startsAt ? new Date(shift.startsAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Time TBD'}</strong></p><small>{shift.label || 'Scheduled shift'} · {taken} reserved · {slotsLeft} open</small></div><span><UsersRound size={15} /> {shift.capacity}</span></article>) : <p className={styles.emptyCopy}>No shifts are scheduled yet.</p>}</section><section className={styles.labPanel}><form action={createShiftAction} className={styles.labForm}><input type="hidden" name="taskId" value={task.id} /><input type="hidden" name="redirectTo" value={redirectTo} /><div><p className={styles.eyebrow}>Add a shift</p><h2>Schedule another session</h2></div><div className={styles.labFormGrid}><label>Starts<input type="datetime-local" name="shiftStartsAt" required /></label><label>Ends<input type="datetime-local" name="shiftEndsAt" required /></label></div><div className={styles.labFormGrid}><label>Capacity<input type="number" name="capacity" min="1" defaultValue={task.slots} required /></label><label>Label<input name="shiftLabel" placeholder="Optional label" /></label></div><div className={styles.labFormActions}><button className={styles.labButton} type="submit"><Plus size={15} /> Add shift</button></div></form></section></section></section></main>
}
