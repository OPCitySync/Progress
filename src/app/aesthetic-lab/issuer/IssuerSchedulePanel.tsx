'use client'

import Link from 'next/link'
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, LayoutGrid, List, MessageCircle, Settings2, UsersRound, XCircle } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cancelShiftAndNotifyAction } from '@/app/actions'
import { AddCalendarEntryButton } from './AddCalendarEntryButton'
import { ScheduleNewShiftButton } from './ScheduleNewShiftButton'
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

type CalendarShiftOptions = {
  suggestedStartsAt: number
  defaultLocation?: string
  volunteers: Array<{ userId: string; name: string; email: string; status?: string }>
  staff: Array<{ userId: string; name: string; email: string; roleLabel: string }>
  documents?: Array<{ id: string; title: string; categoryLabel: string }>
  waivers?: Array<{ id: string; title: string }>
}

type Period = 'week' | 'month'
type CalendarStage = 'calendar' | 'transitioning' | 'timeline'
type Bounds = { top: number; left: number; width: number; height: number }
type CalendarTransition = {
  entryId: string
  taskId: string | null
  title: string
  startsAt: number | null
  endsAt: number | null
  capacity: number | null
  reserved: number | null
  color: IssuerScheduleEntry['color']
  isOnboarding: boolean
  source: Bounds
  calendarSurface?: Bounds
  timelineSurface?: Bounds
  staging?: Bounds
  target?: Bounds
  phase: 'prepare' | 'floating' | 'morphing' | 'flying'
}

type TimelinePeriod = {
  id: string
  startsAt: number
  endsAt: number
  entries: IssuerScheduleEntry[]
}

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

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

function hourLabel(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric' })
}

function elementBounds(element: HTMLElement): Bounds {
  const { top, left, width, height } = element.getBoundingClientRect()
  return { top, left, width, height }
}

function relativeBounds(bounds: Bounds, container: Bounds): Bounds {
  return {
    top: bounds.top - container.top,
    left: bounds.left - container.left,
    width: bounds.width,
    height: bounds.height,
  }
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

function timelineEnd(entry: IssuerScheduleEntry) {
  if (entry.startsAt === null) return null
  return entry.endsAt !== null && entry.endsAt > entry.startsAt ? entry.endsAt : entry.startsAt + HOUR
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
export function IssuerSchedulePanel({ entries, scheduleShift }: { entries: IssuerScheduleEntry[]; scheduleShift?: CalendarShiftOptions }) {
  const [period, setPeriod] = useState<Period>('month')
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [calendarStage, setCalendarStage] = useState<CalendarStage>('calendar')
  const [transitionCard, setTransitionCard] = useState<CalendarTransition | null>(null)
  const timelineEventRefs = useRef(new Map<string, HTMLElement>())
  const calendarGridRef = useRef<HTMLDivElement>(null)
  const calendarStageRef = useRef<HTMLDivElement>(null)
  const dayTimelineRef = useRef<HTMLElement>(null)
  const dayTimelineReelRef = useRef<HTMLDivElement>(null)
  const scheduleHeaderActionRef = useRef<HTMLDivElement>(null)
  const scheduleHeaderControlsRef = useRef<HTMLDivElement>(null)
  const [scheduleHeaderActionOffset, setScheduleHeaderActionOffset] = useState(0)
  const activePeriod = period
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
  const todayDate = new Date()
  const today = dayKey(todayDate)
  const todayLabel = todayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const rangeLabel = activePeriod === 'week'
    ? `${bounds.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(bounds.end.getTime() - DAY).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : bounds.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const selectedDay = useMemo(() => selectedDayKey ? days.find((day) => dayKey(day) === selectedDayKey) ?? null : null, [days, selectedDayKey])
  const selectedDayEntries = useMemo(() => selectedDay ? visibleEntries.filter((entry) => isOnDay(entry, selectedDay)) : [], [selectedDay, visibleEntries])
  const timelinePeriods = useMemo<TimelinePeriod[]>(() => {
    if (!selectedDay) return []
    const dayStart = startOfDay(selectedDay).getTime()
    const dayEnd = dayStart + DAY
    const eventBlocks = selectedDayEntries
      .filter((entry): entry is IssuerScheduleEntry & { startsAt: number } => entry.startsAt !== null)
      .map((entry) => {
        const eventStart = Math.max(dayStart, entry.startsAt)
        const eventEnd = Math.min(dayEnd, timelineEnd(entry) ?? entry.startsAt + HOUR)
        return {
          entry,
          startsAt: dayStart + Math.floor((eventStart - dayStart) / HOUR) * HOUR,
          endsAt: dayStart + Math.ceil((eventEnd - dayStart) / HOUR) * HOUR,
        }
      })
      .filter((block) => block.endsAt > block.startsAt)
      .sort((left, right) => left.startsAt - right.startsAt || right.endsAt - left.endsAt)

    const eventPeriods: TimelinePeriod[] = []
    for (const block of eventBlocks) {
      const current = eventPeriods[eventPeriods.length - 1]
      if (current && block.startsAt < current.endsAt) {
        current.endsAt = Math.max(current.endsAt, block.endsAt)
        current.entries.push(block.entry)
      } else {
        eventPeriods.push({ id: `event-${block.entry.id}`, startsAt: block.startsAt, endsAt: block.endsAt, entries: [block.entry] })
      }
    }

    const periods: TimelinePeriod[] = []
    let cursor = dayStart
    for (const eventPeriod of eventPeriods) {
      while (cursor < eventPeriod.startsAt) {
        periods.push({ id: `open-${cursor}`, startsAt: cursor, endsAt: cursor + HOUR, entries: [] })
        cursor += HOUR
      }
      periods.push(eventPeriod)
      // A rounded end label (for example, 1 PM) belongs to the event period.
      // The next standalone hour therefore begins at 2 PM, not 1 PM.
      cursor = Math.max(cursor, Math.min(dayEnd, eventPeriod.endsAt + HOUR))
    }
    while (cursor < dayEnd) {
      periods.push({ id: `open-${cursor}`, startsAt: cursor, endsAt: cursor + HOUR, entries: [] })
      cursor += HOUR
    }
    return periods
  }, [selectedDay, selectedDayEntries])
  const openDayTimeline = (key: string, entry: IssuerScheduleEntry, source: HTMLButtonElement) => {
    setSelectedDayKey(key)
    setSelectedEntryId(entry.id)
    setCalendarStage('transitioning')
    setTransitionCard({
      entryId: entry.id,
      taskId: entry.taskId,
      title: entry.title,
      startsAt: entry.startsAt,
      endsAt: entry.endsAt,
      capacity: entry.capacity,
      reserved: entry.reserved,
      color: entry.color,
      isOnboarding: entry.isOnboarding,
      source: elementBounds(source),
      phase: 'prepare',
    })
  }
  const returnToCalendar = () => {
    setCalendarStage('calendar')
    setSelectedDayKey(null)
    setSelectedEntryId(null)
    setTransitionCard(null)
  }
  const changePeriod = (next: Period) => {
    setPeriod(next)
    returnToCalendar()
  }

  useLayoutEffect(() => {
    const action = scheduleHeaderActionRef.current
    const controls = scheduleHeaderControlsRef.current
    if (!action || !controls) return
    const alignWithControls = () => {
      const offset = Math.max(0, controls.offsetWidth - action.offsetWidth)
      setScheduleHeaderActionOffset((current) => current === offset ? current : offset)
    }
    alignWithControls()
    const observer = new ResizeObserver(alignWithControls)
    observer.observe(action)
    observer.observe(controls)
    return () => observer.disconnect()
  }, [period])

  useLayoutEffect(() => {
    if (calendarStage === 'calendar' || !selectedEntryId) return
    const selectedEvent = timelineEventRefs.current.get(selectedEntryId)
    const reel = dayTimelineReelRef.current
    const row = selectedEvent?.closest('article')
    if (!reel || !row) return
    reel.scrollTop = Math.max(0, row.offsetTop - (reel.clientHeight - row.clientHeight) / 2)
  }, [calendarStage, selectedDayKey, selectedEntryId])

  useLayoutEffect(() => {
    if (calendarStage !== 'transitioning' || !transitionCard || transitionCard.phase !== 'prepare') return
    const target = timelineEventRefs.current.get(transitionCard.entryId)
    const calendarSurface = calendarGridRef.current
    const stage = calendarStageRef.current
    const timelineSurface = dayTimelineRef.current
    if (!target || !calendarSurface || !stage || !timelineSurface) return

    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const stageBounds = elementBounds(stage)
        const timelineBounds = elementBounds(timelineSurface)
        const targetBounds = relativeBounds(elementBounds(target), stageBounds)
        const timelineBoundsInStage = relativeBounds(timelineBounds, stageBounds)
        setTransitionCard((current) => current ? {
          ...current,
          calendarSurface: elementBounds(calendarSurface),
          timelineSurface: timelineBounds,
          source: relativeBounds(current.source, stageBounds),
          // The card first grows and travels to the top of the emerging Day
          // View, then makes its final, shorter move into its scheduled slot.
          staging: {
            // Leave room for the suspended-card lift and center the expanded
            // card inside the self-contained Day View surface.
            top: timelineBoundsInStage.top + 28,
            left: Math.max(12, (stageBounds.width - targetBounds.width) / 2),
            width: targetBounds.width,
            height: targetBounds.height,
          },
          target: targetBounds,
          phase: 'floating',
        } : null)
      })
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
    }
  }, [calendarStage, transitionCard])

  useEffect(() => {
    if (calendarStage !== 'transitioning' || transitionCard?.phase !== 'floating') return
    const morphTimer = window.setTimeout(() => {
      setTransitionCard((current) => current ? { ...current, phase: 'morphing' } : null)
    }, 160)
    return () => window.clearTimeout(morphTimer)
  }, [calendarStage, transitionCard?.entryId, transitionCard?.phase])

  useEffect(() => {
    if (calendarStage !== 'transitioning' || transitionCard?.phase !== 'morphing') return
    const flightTimer = window.setTimeout(() => {
      setTransitionCard((current) => current ? { ...current, phase: 'flying' } : null)
    }, 1380)
    return () => window.clearTimeout(flightTimer)
  }, [calendarStage, transitionCard?.entryId, transitionCard?.phase])

  useEffect(() => {
    if (calendarStage !== 'transitioning' || transitionCard?.phase !== 'flying') return
    const completeTimer = window.setTimeout(() => {
      setCalendarStage('timeline')
      setTransitionCard(null)
    }, 980)
    return () => window.clearTimeout(completeTimer)
  }, [calendarStage, transitionCard?.entryId, transitionCard?.phase])

  const calendarMorphHeight = transitionCard?.calendarSurface && transitionCard.timelineSurface && transitionCard.phase !== 'prepare'
    ? transitionCard.phase === 'floating' ? transitionCard.calendarSurface.height : transitionCard.timelineSurface.height
    : null

  return (
    <section className={styles.issuerScheduleCard} data-day-view={calendarStage !== 'calendar' ? 'true' : undefined} aria-label="Organization schedule">
      {calendarStage === 'calendar' ? <div className={styles.issuerScheduleHeader}>
        <div className={styles.issuerScheduleHeaderAction} ref={scheduleHeaderActionRef} style={{ marginLeft: scheduleHeaderActionOffset }}>
          <AddCalendarEntryButton />
          {scheduleShift ? <ScheduleNewShiftButton
            programId={null}
            redirectTo="/aesthetic-lab/issuer"
            suggestedStartsAt={scheduleShift.suggestedStartsAt}
            defaultLocation={scheduleShift.defaultLocation}
            defaultCapacity={2}
            defaultDurationMinutes={120}
            defaultVisibility="private"
            documents={scheduleShift.documents}
            waivers={scheduleShift.waivers}
            volunteers={scheduleShift.volunteers}
            staff={scheduleShift.staff}
            privateRosterFlow
            buttonLabel="Schedule Shift"
            triggerClassName={styles.issuerAddCalendarButton}
          /> : null}
        </div>
        <div className={styles.issuerScheduleTitle}>
          <h2>Calendar Overview</h2>
          <p>{period === 'month' ? todayLabel : rangeLabel}</p>
        </div>
        <div className={styles.issuerScheduleControls} ref={scheduleHeaderControlsRef}>
          <div className={styles.issuerScheduleControlRow}>
            <div className={styles.issuerScheduleButtons} aria-label="Calendar period" role="group">
              <button type="button" className={period === 'month' ? styles.issuerScheduleButtonActive : undefined} onClick={() => changePeriod('month')} aria-pressed={period === 'month'}>
                <LayoutGrid size={14} /> Month
              </button>
              <button type="button" className={period === 'week' ? styles.issuerScheduleButtonActive : undefined} onClick={() => changePeriod('week')} aria-pressed={period === 'week'}>
                <List size={14} /> Week
              </button>
            </div>
          </div>
        </div>
      </div> : null}

      {period === 'week' ? (
        <div className={styles.issuerAgendaList}>
          {days.map((day) => {
            const dayEntries = visibleEntries.filter((entry) => isOnDay(entry, day))
            return <section className={styles.issuerAgendaDay} key={dayKey(day)}>
              <time className={styles.issuerAgendaDayDate} dateTime={day.toISOString()}>
                <span>{day.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</span>
                <b>{day.getDate()}</b>
                <small>{day.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</small>
              </time>
              <div className={styles.issuerAgendaDayEvents}>
                {dayEntries.length === 0 ? <p>No events scheduled.</p> : dayEntries.map((entry) => {
                  const content = <>
                    <span className={`${styles.issuerAgendaEventIcon} ${styles[colorClass(entry.isOnboarding ? 'gold' : entry.color, 'issuerSchedule')]}`}><CalendarDays size={15} /></span>
                    <div>
                      <b>{entry.title}</b>
                      <span><Clock3 size={13} /> {entry.endsAt ? `${timeLabel(entry.startsAt)} – ${timeLabel(entry.endsAt)}` : timeLabel(entry.startsAt)}</span>
                    </div>
                    {entry.capacity !== null ? <em><UsersRound size={13} /> {entry.reserved ?? 0} / {entry.capacity}</em> : <em className={styles.issuerAgendaNote}>Organization note</em>}
                  </>
                  return entry.taskId ? <Link href={`/aesthetic-lab/issuer/opportunities/${entry.taskId}`} className={styles.issuerAgendaEvent} key={entry.id}>{content}</Link> : <article className={styles.issuerAgendaEvent} key={entry.id}>{content}</article>
                })}
              </div>
            </section>
          })}
        </div>
      ) : (
        <div className={styles.issuerCalendarScroll}>
          <div
            className={styles.issuerCalendarStage}
            ref={calendarStageRef}
            data-stage={calendarStage}
            data-transition-phase={transitionCard?.phase}
            data-transfer-surface={calendarMorphHeight ? 'true' : undefined}
            style={calendarMorphHeight ? { height: calendarMorphHeight } : undefined}
          >
          {selectedDay && calendarStage !== 'calendar' ? <section className={styles.issuerDayTimeline} key={`timeline-${selectedDayKey}`} ref={dayTimelineRef} aria-label={`Timeline for ${selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}>
            <header className={styles.issuerDayTimelineHeader}>
              <div>
                <p className={styles.eyebrow}>Day timeline</p>
                <h3>{selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                <p>{selectedDayEntries.length ? `${selectedDayEntries.length} calendar item${selectedDayEntries.length === 1 ? '' : 's'} scheduled for this day. Scroll to browse every hour.` : 'No calendar items are scheduled for this day. Scroll to browse every hour.'}</p>
              </div>
              <button type="button" className={`${styles.issuerHistoryBack} ${styles.issuerDayTimelineReturn}`} style={{ height: '30px', minHeight: '30px', padding: '.42rem .5rem', fontSize: '.59rem', fontWeight: 800, lineHeight: 'normal' }} onClick={returnToCalendar}><ArrowLeft size={15} />Calendar</button>
            </header>
            <div className={styles.issuerDayTimelineReel}>
              <div className={styles.issuerDayTimelineList} ref={dayTimelineReelRef} aria-label="24-hour day timeline">
                {timelinePeriods.map((period) => <article key={period.id} data-timeline-period={period.id} data-period-type={period.entries.length ? 'event' : 'open'} data-selected={period.entries.some((entry) => entry.id === selectedEntryId) ? 'true' : undefined}>
                  <time>{period.entries.length ? <>{hourLabel(period.startsAt)}<span>–{hourLabel(period.endsAt)}</span></> : hourLabel(period.startsAt)}</time>
                  <span className={styles.issuerDayTimelineConnector} />
                  <div>
                    {period.entries.length ? period.entries.map((entry) => <section className={styles.issuerDayTimelineEvent} key={entry.id} data-can-cancel={entry.taskId ? 'true' : undefined} data-timeline-entry-id={entry.id} data-selected={entry.id === selectedEntryId ? 'true' : undefined} data-transition-target={calendarStage === 'transitioning' && entry.id === transitionCard?.entryId ? 'true' : undefined} ref={(node) => {
                      if (node) timelineEventRefs.current.set(entry.id, node)
                      else timelineEventRefs.current.delete(entry.id)
                    }}>
                      <span className={styles[colorClass(entry.isOnboarding ? 'gold' : entry.color, 'issuerCalendar')]}><CalendarDays size={15} /></span>
                      <div>
                        <b>{entry.title}</b>
                        <p>{entry.endsAt ? `${timeLabel(entry.startsAt)} – ${timeLabel(entry.endsAt)}` : timeLabel(entry.startsAt)}{entry.capacity !== null ? ` · ${entry.reserved ?? 0} of ${entry.capacity} volunteer spots filled` : ' · Organization calendar item'}</p>
                        {entry.taskId ? <div className={styles.issuerDayTimelineActions}>
                          <Link href={`/aesthetic-lab/issuer/opportunities/${entry.taskId}`}><Settings2 size={13} />Manage event</Link>
                          <Link href={`/aesthetic-lab/issuer/notifications?event=${encodeURIComponent(entry.id)}`}><MessageCircle size={13} />Message team</Link>
                          {!entry.startsAt || entry.startsAt <= Date.now() ? (
                            <Link className={styles.issuerDayTimelineVerify} href={`/aesthetic-lab/issuer/shifts/${entry.id}/verify`}><CheckCircle2 size={13} />Verify &amp; Close</Link>
                          ) : (
                            <form className={styles.issuerDayTimelineCancel} action={cancelShiftAndNotifyAction} onSubmit={(event) => {
                              if (!window.confirm(`Cancel “${entry.title}” and notify everyone signed up?`)) event.preventDefault()
                            }}>
                              <input type="hidden" name="shiftId" value={entry.id} />
                              <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer" />
                              <button type="submit"><XCircle size={13} />Cancel &amp; Notify</button>
                            </form>
                          )}
                        </div> : null}
                      </div>
                    </section>) : <p className={styles.issuerDayTimelineOpenHour}>Open time</p>}
                  </div>
                </article>)}
              </div>
            </div>
          </section> : null}
          {calendarStage !== 'timeline' ? <div
            className={`${styles.issuerCalendarGrid} ${activePeriod === 'month' ? styles.issuerCalendarMonth : ''}`}
            key={`calendar-${activePeriod}`}
            ref={calendarGridRef}
            data-transfer-surface={calendarMorphHeight ? 'true' : undefined}
            style={calendarMorphHeight ? { height: calendarMorphHeight } : undefined}
            aria-hidden={calendarStage === 'transitioning'}
          >
            {days.map((day) => {
              const key = dayKey(day)
              const events = visibleEntries.filter((entry) => isOnDay(entry, day))
              const outsideMonth = activePeriod === 'month' && (day.getMonth() !== currentMonth || day.getFullYear() !== currentYear)
              return (
                <section className={`${styles.issuerCalendarDay} ${key === today ? styles.issuerCalendarToday : ''} ${outsideMonth ? styles.issuerCalendarMuted : ''}`} key={key}>
                  <div><span>{day.toLocaleDateString('en-US', { weekday: 'short' })}</span><b>{day.getDate()}</b></div>
                  {events.map((entry) => {
                    const eventClass = `${styles.issuerCalendarEvent} ${styles[colorClass(entry.isOnboarding ? 'gold' : entry.color, 'issuerCalendar')]}`
                    return <button type="button" className={eventClass} key={entry.id} onClick={(event) => openDayTimeline(key, entry, event.currentTarget)} aria-label={`Open ${entry.title} in the ${day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} timeline`}>
                      <b>{timeLabel(entry.startsAt)}</b><span>{entry.title}</span>
                    </button>
                  })}
                </section>
              )
            })}
          </div> : null}
          {transitionCard ? <div
            className={`${styles.issuerCalendarTransitionCard} ${styles[colorClass(transitionCard.isOnboarding ? 'gold' : transitionCard.color, 'issuerCalendar')]}`}
            data-phase={transitionCard.phase}
            style={transitionCard.target && transitionCard.phase === 'flying'
              ? { top: transitionCard.target.top, left: transitionCard.target.left, width: transitionCard.target.width, height: transitionCard.target.height }
              : transitionCard.staging && transitionCard.phase === 'morphing'
                ? { top: transitionCard.staging.top, left: transitionCard.staging.left, width: transitionCard.staging.width, height: transitionCard.staging.height }
                : { top: transitionCard.source.top, left: transitionCard.source.left, width: transitionCard.source.width, height: transitionCard.source.height }}
            aria-hidden="true"
          >
            <span className={`${styles.issuerCalendarTransitionIcon} ${styles[colorClass(transitionCard.isOnboarding ? 'gold' : transitionCard.color, 'issuerCalendar')]}`}><CalendarDays size={15} /></span>
            <div className={styles.issuerCalendarTransitionCopy}>
              <b>{transitionCard.title}</b>
              <p>{transitionCard.endsAt ? `${timeLabel(transitionCard.startsAt)} – ${timeLabel(transitionCard.endsAt)}` : timeLabel(transitionCard.startsAt)}{transitionCard.capacity !== null ? ` · ${transitionCard.reserved ?? 0} of ${transitionCard.capacity} volunteer spots filled` : ' · Organization calendar item'}</p>
              {transitionCard.taskId ? <div className={styles.issuerCalendarTransitionActions}>
                <span><Settings2 size={13} />Manage event</span>
                <span><MessageCircle size={13} />Message team</span>
                {transitionCard.startsAt && transitionCard.startsAt > Date.now()
                  ? <span><XCircle size={13} />Cancel &amp; Notify</span>
                  : <span className={styles.issuerCalendarTransitionVerify}><CheckCircle2 size={13} />Verify &amp; Close</span>}
              </div> : null}
            </div>
          </div> : null}
          </div>
        </div>
      )}
      {calendarStage === 'calendar' ? <div className={styles.issuerScheduleFooter}>
        <div className={styles.issuerCalendarFooterStart}>
          <span>{visibleEntries.length} event{visibleEntries.length === 1 ? '' : 's'} this {activePeriod}.</span>
        </div>
      </div> : null}
    </section>
  )
}
