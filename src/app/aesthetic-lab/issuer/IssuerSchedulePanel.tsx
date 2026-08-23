'use client'

import Link from 'next/link'
import { CalendarDays, Clock3, LayoutGrid, List, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AddCalendarEntryButton } from './AddCalendarEntryButton'
import styles from '../prototype.module.css'

export type IssuerScheduleEntry = {
  id: string
  taskId: string | null
  title: string
  startsAt: number | null
  endsAt: number | null
  capacity: number | null
  reserved: number | null
  isOnboarding: boolean
  color?: 'blue' | 'gold' | 'mint' | 'coral'
}

type Presentation = 'list' | 'calendar'
type Period = 'week' | 'month'

const DAY = 24 * 60 * 60 * 1000

function startOfDay(value: Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function startOfWeek(value: Date) {
  const date = startOfDay(value)
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return date
}

function dayKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function timeLabel(timestamp: number | null) {
  if (!timestamp) return 'Time TBD'
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function dateLabel(timestamp: number | null) {
  if (!timestamp) return 'Schedule TBD'
  return new Date(timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function colorClass(value: IssuerScheduleEntry['color'], prefix: 'issuerSchedule' | 'issuerCalendar') {
  const tone = value ?? 'blue'
  return `${prefix}${tone[0].toUpperCase()}${tone.slice(1)}`
}

function isOnDay(entry: IssuerScheduleEntry, day: Date) {
  if (entry.startsAt === null) return false
  const start = startOfDay(day).getTime()
  const end = start + DAY
  const entryEnd = entry.endsAt ?? entry.startsAt
  return entry.startsAt < end && entryEnd >= start
}

function periodBounds(period: Period) {
  const now = new Date()
  if (period === 'week') {
    const start = startOfWeek(now)
    return { start, end: new Date(start.getTime() + 7 * DAY) }
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { start, end }
}

function calendarDays(period: Period) {
  const { start, end } = periodBounds(period)
  if (period === 'week') return Array.from({ length: 7 }, (_, index) => new Date(start.getTime() + index * DAY))

  const first = startOfWeek(start)
  const last = new Date(end.getTime() - DAY)
  const final = new Date(last)
  final.setDate(final.getDate() + (6 - ((final.getDay() + 6) % 7)))
  const total = Math.round((final.getTime() - first.getTime()) / DAY) + 1
  return Array.from({ length: total }, (_, index) => new Date(first.getTime() + index * DAY))
}

/** An issuer-only schedule that can move between a compact agenda and a calendar. */
export function IssuerSchedulePanel({ entries }: { entries: IssuerScheduleEntry[] }) {
  const [presentation, setPresentation] = useState<Presentation>('calendar')
  const [period, setPeriod] = useState<Period>('month')
  const activePeriod = presentation === 'calendar' ? period : 'week'
  const bounds = useMemo(() => periodBounds(activePeriod), [activePeriod])
  const visibleEntries = useMemo(
    () => entries
      .filter((entry) => {
        if (entry.startsAt === null) return false
        const entryEnd = entry.endsAt ?? entry.startsAt
        return entry.startsAt < bounds.end.getTime() && entryEnd >= bounds.start.getTime()
      })
      .sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0)),
    [entries, bounds],
  )
  const days = useMemo(() => calendarDays(activePeriod), [activePeriod])
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const today = dayKey(new Date())
  const rangeLabel = activePeriod === 'week'
    ? `${bounds.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(bounds.end.getTime() - DAY).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : bounds.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <section className={styles.issuerScheduleCard} aria-label="Organization schedule">
      <div className={styles.issuerScheduleHeader}>
        <div>
          <h2>{presentation === 'list' ? 'Volunteer schedule' : 'Calendar overview'}</h2>
          <p>{rangeLabel}</p>
        </div>
        <div className={styles.issuerScheduleControls}>
          <div className={styles.issuerScheduleControlRow}>
            <div className={styles.issuerScheduleButtons} aria-label="Schedule presentation" role="group">
              <button type="button" className={presentation === 'calendar' ? styles.issuerScheduleButtonActive : undefined} onClick={() => setPresentation('calendar')} aria-pressed={presentation === 'calendar'}>
                <LayoutGrid size={14} /> Calendar overview
              </button>
              <button type="button" className={presentation === 'list' ? styles.issuerScheduleButtonActive : undefined} onClick={() => setPresentation('list')} aria-pressed={presentation === 'list'}>
                <List size={14} /> Weekly list
              </button>
            </div>
          </div>
        </div>
      </div>

      {presentation === 'list' ? (
        <div className={styles.issuerAgendaList}>
          {visibleEntries.length === 0 ? <p className={styles.emptyCopy}>No organization schedule items are set for this week.</p> : visibleEntries.map((entry) => {
            const content = <>
              <span className={`${styles.issuerAgendaBadge} ${styles[colorClass(entry.isOnboarding ? 'gold' : entry.color, 'issuerSchedule')]}`}>
                <small>{entry.startsAt ? new Date(entry.startsAt).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() : 'TBD'}</small>
                <b>{entry.startsAt ? new Date(entry.startsAt).getDate() : '—'}</b>
              </span>
              <div>
                <b>{entry.title}</b>
                <span><Clock3 size={13} /> {dateLabel(entry.startsAt)} · {timeLabel(entry.startsAt)}</span>
              </div>
              {entry.capacity !== null ? <em><UsersRound size={13} /> {entry.reserved ?? 0} / {entry.capacity}</em> : <em className={styles.issuerAgendaNote}>Organization note</em>}
            </>
            return entry.taskId ? <Link href={`/aesthetic-lab/issuer/opportunities/${entry.taskId}`} className={styles.issuerAgendaItem} key={entry.id}>{content}</Link> : <article className={styles.issuerAgendaItem} key={entry.id}>{content}</article>
          })}
        </div>
      ) : (
        <div className={styles.issuerCalendarScroll}>
          <div className={`${styles.issuerCalendarGrid} ${activePeriod === 'month' ? styles.issuerCalendarMonth : ''}`}>
            {days.map((day) => {
              const key = dayKey(day)
              const events = visibleEntries.filter((entry) => isOnDay(entry, day))
              const outsideMonth = activePeriod === 'month' && (day.getMonth() !== currentMonth || day.getFullYear() !== currentYear)
              return (
                <section className={`${styles.issuerCalendarDay} ${key === today ? styles.issuerCalendarToday : ''} ${outsideMonth ? styles.issuerCalendarMuted : ''}`} key={key}>
                  <div><span>{day.toLocaleDateString('en-US', { weekday: 'short' })}</span><b>{day.getDate()}</b></div>
                  {events.map((entry) => {
                    const eventClass = `${styles.issuerCalendarEvent} ${styles[colorClass(entry.isOnboarding ? 'gold' : entry.color, 'issuerCalendar')]}`
                    const content = <><b>{timeLabel(entry.startsAt)}</b><span>{entry.title}</span></>
                    return entry.taskId ? <Link href={`/aesthetic-lab/issuer/opportunities/${entry.taskId}`} className={eventClass} key={entry.id}>{content}</Link> : <div className={eventClass} key={entry.id}>{content}</div>
                  })}
                </section>
              )
            })}
          </div>
        </div>
      )}
      <div className={styles.issuerScheduleFooter}>
        {presentation === 'calendar' ? <>
          <div className={styles.issuerCalendarFooterStart}>
            <AddCalendarEntryButton />
            <span>{visibleEntries.length} event{visibleEntries.length === 1 ? '' : 's'} this {activePeriod}.</span>
          </div>
          <div className={`${styles.issuerScheduleButtons} ${styles.issuerCalendarPeriodPicker}`} aria-label="Calendar period" role="group">
            <button type="button" className={period === 'week' ? styles.issuerScheduleButtonActive : undefined} onClick={() => setPeriod('week')} aria-pressed={period === 'week'}>Week</button>
            <button type="button" className={period === 'month' ? styles.issuerScheduleButtonActive : undefined} onClick={() => setPeriod('month')} aria-pressed={period === 'month'}>Month</button>
          </div>
        </> : <>
          <CalendarDays size={15} />
          <span>{visibleEntries.length} calendar item{visibleEntries.length === 1 ? '' : 's'} in this week.</span>
          <Link href="/aesthetic-lab/issuer/catalog">Manage opportunities</Link>
        </>}
      </div>
    </section>
  )
}
