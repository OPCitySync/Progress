import { and, asc, eq, gte, inArray, isNull, lt, ne } from 'drizzle-orm'
import { CalendarDays, MapPin, UsersRound, UserRoundCog } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { claims, orgs, shiftStaffAssignments, shifts, tasks, users, volunteerPrograms } from '@/lib/db/schema'
import { participantDisplayName } from '@/lib/participant-name'
import { PrintScheduleControls } from './PrintScheduleControls'
import styles from '../../../../prototype.module.css'

export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000

function mondayStart(value = Date.now()) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return date.getTime()
}

function numberParam(value: string | string[] | undefined) {
  const valueString = Array.isArray(value) ? value[0] : value
  const parsed = Number(valueString)
  return Number.isFinite(parsed) ? parsed : null
}

function dayKey(value: number) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function rangeLabel(from: number, to: number) {
  const first = new Date(from).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const last = new Date(to - 1).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return `${first} – ${last}`
}

function timeLabel(startsAt: number | null, endsAt: number | null) {
  if (!startsAt) return 'Time to be confirmed'
  const start = new Date(startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const end = endsAt ? new Date(endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null
  return end ? `${start} – ${end}` : start
}

export default async function ProgramSchedulePrintPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { from?: string | string[]; to?: string | string[] }
}) {
  const session = await requireRole('issuer')
  const orgId = session.orgId!
  const isOrganizationArea = params.id === 'organization'
  const proposedFrom = numberParam(searchParams.from)
  const proposedTo = numberParam(searchParams.to)
  const from = proposedFrom && proposedFrom > 0 ? proposedFrom : mondayStart()
  const to = proposedTo && proposedTo > from && proposedTo - from <= 62 * DAY ? proposedTo : from + 14 * DAY
  const [org, program, taskRows] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    isOrganizationArea
      ? Promise.resolve(null)
      : db.select().from(volunteerPrograms).where(and(eq(volunteerPrograms.id, params.id), eq(volunteerPrograms.orgId, orgId))).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(tasks).where(and(
      eq(tasks.orgId, orgId),
      isOrganizationArea ? isNull(tasks.programId) : eq(tasks.programId, params.id),
      eq(tasks.isOnboarding, 0),
    )),
  ])
  const taskIds = taskRows.map((task) => task.id)
  const scheduleShifts = taskIds.length
    ? await db.select({ shift: shifts, task: tasks }).from(shifts).innerJoin(tasks, eq(shifts.taskId, tasks.id)).where(and(
      inArray(shifts.taskId, taskIds),
      eq(shifts.status, 'open'),
      gte(shifts.startsAt, from),
      lt(shifts.startsAt, to),
    )).orderBy(asc(shifts.startsAt))
    : []
  const shiftIds = scheduleShifts.map(({ shift }) => shift.id)
  const [claimRows, staffRows] = shiftIds.length ? await Promise.all([
    db.select({ shiftId: claims.shiftId, user: users }).from(claims).innerJoin(users, eq(claims.userId, users.id)).where(and(
      inArray(claims.shiftId, shiftIds),
      ne(claims.status, 'unclaimed'),
      ne(claims.status, 'no_show'),
    )),
    db.select({ shiftId: shiftStaffAssignments.shiftId, user: users }).from(shiftStaffAssignments).innerJoin(users, eq(shiftStaffAssignments.userId, users.id)).where(inArray(shiftStaffAssignments.shiftId, shiftIds)),
  ]) : [[], []]
  const volunteersByShift = new Map<string, string[]>()
  claimRows.forEach(({ shiftId, user }) => {
    if (!shiftId) return
    volunteersByShift.set(shiftId, [...(volunteersByShift.get(shiftId) ?? []), participantDisplayName(user)])
  })
  const staffByShift = new Map<string, string[]>()
  staffRows.forEach(({ shiftId, user }) => staffByShift.set(shiftId, [...(staffByShift.get(shiftId) ?? []), participantDisplayName(user)]))
  const days = new Map<number, typeof scheduleShifts>()
  scheduleShifts.forEach((entry) => {
    const key = dayKey(entry.shift.startsAt ?? from)
    days.set(key, [...(days.get(key) ?? []), entry])
  })
  const programName = isOrganizationArea ? 'Organization' : program?.name ?? 'Volunteer program'

  return <main className={styles.printSchedulePage}>
    <header className={styles.printScheduleHeader}>
      <div><p>City/Sync · Shift plan</p><h1>{programName}</h1><span>{org?.name ?? 'Organization'} · {rangeLabel(from, to)}</span></div>
      <PrintScheduleControls />
    </header>
    <section className={styles.printScheduleSummary}><span><CalendarDays size={16} /> Planning period: {rangeLabel(from, to)}</span><span><UsersRound size={16} /> {scheduleShifts.length} published shift{scheduleShifts.length === 1 ? '' : 's'}</span><span>Generated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></section>
    {Array.from(days.entries()).map(([day, entries]) => <section key={day} className={styles.printScheduleDay}>
      <h2>{new Date(day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
      {entries.map(({ shift, task }) => {
        const volunteers = volunteersByShift.get(shift.id) ?? []
        const staff = staffByShift.get(shift.id) ?? []
        return <article key={shift.id}>
          <header><div><strong>{task.title}</strong><span>{timeLabel(shift.startsAt, shift.endsAt)}</span></div><em>{shift.visibility === 'private' ? 'Private shift' : 'Public shift'}</em></header>
          {task.location ? <p className={styles.printScheduleLocation}><MapPin size={14} /> {task.location}</p> : null}
          <div className={styles.printScheduleRosters}>
            <section><span><UserRoundCog size={14} /> Staff support</span><p>{staff.length ? staff.join(' · ') : 'No staff scheduled'}</p></section>
            <section><span><UsersRound size={14} /> Volunteers ({volunteers.length} of {shift.capacity})</span><p>{volunteers.length ? volunteers.join(' · ') : 'No volunteers scheduled'}</p></section>
          </div>
        </article>
      })}
    </section>)}
    {!scheduleShifts.length ? <section className={styles.printScheduleEmpty}><CalendarDays size={22} /><div><b>No published shifts in this period.</b><p>Return to Shift Planning to choose another period or publish a shift first.</p></div></section> : null}
    <footer className={styles.printScheduleFooter}>City/Sync · {org?.name ?? 'Organization'} · Shift Planning</footer>
  </main>
}
