import Link from 'next/link'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import { Card } from '@/components/ui'

export type WeeklyCalendarShift = {
  id: string
  taskId: string
  taskTitle: string
  startsAt: number | null
  endsAt: number | null
  label: string
  capacity: number
  status: 'open' | 'closed'
}

function startOfWeek(date: Date) {
  const weekStart = new Date(date)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  return weekStart
}

function dayKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function weekParam(date: Date) {
  return dayKey(startOfWeek(date))
}

function parseWeek(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return startOfWeek(new Date())
  const parsed = new Date(`${value}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? startOfWeek(new Date()) : startOfWeek(parsed)
}

function shiftTime(shift: WeeklyCalendarShift) {
  if (!shift.startsAt) return shift.label || 'Time TBD'
  const start = new Date(shift.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (!shift.endsAt) return shift.label ? `${start} · ${shift.label}` : start
  const end = new Date(shift.endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${start} – ${end}`
}

/** A city-local, seven-day schedule for the issuer’s concrete volunteer shifts. */
export function WeeklyShiftCalendar({
  week,
  shifts,
}: {
  week?: string
  shifts: WeeklyCalendarShift[]
}) {
  const weekStart = parseWeek(week)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    return date
  })
  const today = dayKey(new Date())
  const datedShifts = shifts.filter((shift) => shift.startsAt !== null)
  const unscheduledCount = shifts.length - datedShifts.length
  const shiftsByDay = new Map<string, WeeklyCalendarShift[]>()

  for (const shift of datedShifts) {
    const date = new Date(shift.startsAt!)
    if (date >= weekStart && date < weekEnd) {
      const key = dayKey(date)
      shiftsByDay.set(key, [...(shiftsByDay.get(key) ?? []), shift])
    }
  }

  const previousWeek = new Date(weekStart)
  previousWeek.setDate(previousWeek.getDate() - 7)
  const nextWeek = new Date(weekStart)
  nextWeek.setDate(nextWeek.getDate() + 7)
  const finalDay = new Date(weekEnd)
  finalDay.setDate(finalDay.getDate() - 1)
  const rangeLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${finalDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  return (
    <Card className="mb-6 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <CalendarDays size={20} />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-ink-900">Volunteer shifts</h2>
            <p className="mt-0.5 text-sm text-ink-500">{rangeLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/issuer?week=${weekParam(previousWeek)}`}
            aria-label="Show previous week"
            className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800"
          >
            <ChevronLeft size={18} />
          </Link>
          <Link
            href="/issuer"
            className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50"
          >
            This week
          </Link>
          <Link
            href={`/issuer?week=${weekParam(nextWeek)}`}
            aria-label="Show next week"
            className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800"
          >
            <ChevronRight size={18} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 divide-x divide-ink-100 border-y border-ink-100">
        {days.map((day) => {
          const key = dayKey(day)
          const dayShifts = shiftsByDay.get(key) ?? []
          const isToday = key === today
          return (
            <section key={key} className={clsx('min-w-0 px-2 py-3 sm:px-3', isToday && 'bg-brand-50/50')}>
              <div className="flex items-baseline justify-between gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </p>
                <p className={clsx('text-sm font-semibold text-ink-700', isToday && 'text-brand-700')}>
                  {day.getDate()}
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {dayShifts.length === 0 ? (
                  <p className="pt-2 text-center text-xs text-ink-400">—</p>
                ) : (
                  dayShifts.map((shift) => (
                    <Link
                      key={shift.id}
                      href={`/issuer/tasks/${shift.taskId}`}
                      className="block rounded-xl border border-brand-200 bg-brand-50 px-2.5 py-2 transition-transform hover:-translate-y-0.5"
                    >
                      <p className="truncate text-xs font-semibold text-ink-800">{shift.taskTitle}</p>
                      <p className="mt-1 text-[11px] leading-snug text-ink-600">{shiftTime(shift)}</p>
                      <p className="mt-1 text-[10px] text-ink-500">{shift.capacity} volunteer slots</p>
                      <p className={clsx('mt-1 text-[10px] font-semibold uppercase tracking-wide', shift.status === 'open' ? 'text-emerald-600' : 'text-red-600')}>
                        {shift.status}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </section>
          )
        })}
      </div>

      {unscheduledCount > 0 ? (
        <p className="px-6 py-3 text-xs text-ink-500">
          {unscheduledCount} shift{unscheduledCount === 1 ? '' : 's'} need a start date before they can appear on this calendar.
        </p>
      ) : null}
    </Card>
  )
}
