import Link from 'next/link'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui'

export type ParticipantCommitment = {
  id: string
  taskId: string
  taskTitle: string
  organizationName: string
  startsAt: number | null
  endsAt: number | null
  label: string
  status: 'claimed' | 'submitted'
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

function parseWeek(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return startOfWeek(new Date())
  const parsed = new Date(`${value}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? startOfWeek(new Date()) : startOfWeek(parsed)
}

function timeLabel(commitment: ParticipantCommitment) {
  if (!commitment.startsAt) return commitment.label || 'Time to be arranged'
  const start = new Date(commitment.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (!commitment.endsAt) return commitment.label ? `${start} · ${commitment.label}` : start
  const end = new Date(commitment.endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${start} – ${end}`
}

function hrefForWeek(date: Date) {
  return `/participant?commitmentView=calendar&week=${dayKey(startOfWeek(date))}`
}

/** A participant-only seven-day view of scheduled commitments. */
export function CommitmentCalendar({ week, commitments }: { week?: string; commitments: ParticipantCommitment[] }) {
  const weekStart = parseWeek(week)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    return date
  })
  const today = dayKey(new Date())
  const scheduled = commitments.filter((commitment) => commitment.startsAt !== null)
  const unscheduled = commitments.filter((commitment) => commitment.startsAt === null)
  const commitmentsByDay = new Map<string, ParticipantCommitment[]>()

  for (const commitment of scheduled) {
    const date = new Date(commitment.startsAt!)
    if (date >= weekStart && date < weekEnd) {
      const key = dayKey(date)
      commitmentsByDay.set(key, [...(commitmentsByDay.get(key) ?? []), commitment])
    }
  }

  for (const dayCommitments of Array.from(commitmentsByDay.values())) {
    dayCommitments.sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0))
  }

  const previousWeek = new Date(weekStart)
  previousWeek.setDate(previousWeek.getDate() - 7)
  const nextWeek = new Date(weekStart)
  nextWeek.setDate(nextWeek.getDate() + 7)
  const finalDay = new Date(weekEnd)
  finalDay.setDate(finalDay.getDate() - 1)
  const rangeLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${finalDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <CalendarDays size={20} />
          </div>
          <div>
            <p className="font-semibold text-ink-900">Commitment calendar</p>
            <p className="mt-0.5 text-sm text-ink-500">{rangeLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={hrefForWeek(previousWeek)}
            aria-label="Show previous week"
            className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800"
          >
            <ChevronLeft size={18} />
          </Link>
          <Link
            href="/participant?commitmentView=calendar"
            className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50"
          >
            This week
          </Link>
          <Link
            href={hrefForWeek(nextWeek)}
            aria-label="Show next week"
            className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800"
          >
            <ChevronRight size={18} />
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto border-y border-ink-100">
        <div className="grid min-w-[49rem] grid-cols-7 divide-x divide-ink-100">
          {days.map((day) => {
            const key = dayKey(day)
            const dayCommitments = commitmentsByDay.get(key) ?? []
            const isToday = key === today
            return (
              <section key={key} className={`min-w-0 px-2 py-3 sm:px-3 ${isToday ? 'bg-brand-50/50' : ''}`}>
                <div className="flex items-baseline justify-between gap-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <p className={`text-sm font-semibold ${isToday ? 'text-brand-700' : 'text-ink-700'}`}>{day.getDate()}</p>
                </div>
                <div className="mt-3 space-y-2">
                  {dayCommitments.length === 0 ? (
                    <p className="pt-2 text-center text-xs text-ink-400">—</p>
                  ) : (
                    dayCommitments.map((commitment) => (
                      <Link
                        key={commitment.id}
                        href={`/participant/opportunities/${commitment.taskId}`}
                        className="block rounded-xl border border-brand-200 bg-brand-50 px-2.5 py-2 transition-transform hover:-translate-y-0.5"
                      >
                        <p className="truncate text-xs font-semibold text-ink-800">{commitment.taskTitle}</p>
                        <p className="mt-1 truncate text-[11px] text-ink-600">{commitment.organizationName}</p>
                        <p className="mt-1 text-[11px] leading-snug text-ink-600">{timeLabel(commitment)}</p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                          {commitment.status === 'submitted' ? 'Awaiting verification' : 'Reserved'}
                        </p>
                      </Link>
                    ))
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      {unscheduled.length > 0 ? (
        <p className="px-6 py-3 text-xs text-ink-500">
          {unscheduled.length} commitment{unscheduled.length === 1 ? '' : 's'} {unscheduled.length === 1 ? 'does' : 'do'} not have a scheduled start time and {unscheduled.length === 1 ? 'is' : 'are'} available in List View.
        </p>
      ) : null}
    </Card>
  )
}
