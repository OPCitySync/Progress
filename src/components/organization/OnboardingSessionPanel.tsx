import Link from 'next/link'
import { CalendarDays, ChevronDown, Repeat2, UsersRound } from 'lucide-react'
import { createOnboardingSessionAction } from '@/app/actions'
import { Badge, Button, Card, Input, Label, Textarea } from '@/components/ui'
import { IssuerLocationField } from '@/components/organization/IssuerLocationField'
import type { OrganizationLocation } from '@/lib/services/organization-locations'

type ExistingSession = {
  id: string
  title: string
  location: string
  credits: number
  status: 'open' | 'closed'
}

type NextShift = {
  startsAt: number | null
  endsAt: number | null
  capacity: number
} | null

function scheduleText(shift: NextShift) {
  if (!shift?.startsAt) return 'No dated weekly shift has been scheduled yet.'
  const start = new Date(shift.startsAt)
  const day = start.toLocaleDateString('en-US', { weekday: 'long' })
  const time = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `Every ${day} at ${time}`
}

/** Issuer-only setup and summary for the organization’s public onboarding entry point. */
export function OnboardingSessionPanel({
  session,
  nextShift,
  replacesTaskTitle,
  locations,
}: {
  session: ExistingSession | null
  nextShift: NextShift
  replacesTaskTitle?: string
  locations: OrganizationLocation[]
}) {
  if (session) {
    return (
      <Card className="mb-6 border-brand-200 bg-brand-50">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white">
                <Repeat2 size={19} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-xl font-semibold text-ink-900">Onboarding Session</h2>
                  <Badge tone={session.status === 'open' ? 'green' : 'gray'}>{session.status === 'open' ? 'Public & open' : 'Closed'}</Badge>
                </div>
                <p className="mt-1 text-sm font-semibold text-ink-800">{session.title}</p>
                <p className="mt-1 text-sm text-ink-600">{scheduleText(nextShift)}</p>
              </div>
            </div>
            <ChevronDown className="mt-2 h-5 w-5 shrink-0 text-ink-500 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-5 grid gap-3 border-t border-brand-200 pt-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
            <p className="text-sm text-ink-600"><span className="font-semibold text-ink-800">Weekly capacity:</span> {nextShift?.capacity ?? '—'} volunteer slots</p>
            <p className="text-sm text-ink-600"><span className="font-semibold text-ink-800">Credits:</span> {session.credits} per completion</p>
            <p className="truncate text-sm text-ink-600"><span className="font-semibold text-ink-800">Location:</span> {session.location || 'To be set'}</p>
            <Link
              href={`/issuer/tasks/${session.id}`}
              className="justify-self-start rounded-xl border border-ink-300 px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 sm:justify-self-end"
            >
              Manage session
            </Link>
          </div>
        </details>
      </Card>
    )
  }

  return (
    <Card className="mb-6">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <CalendarDays size={20} />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-ink-900">Create an Onboarding Session</h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-600">
                Create a recurring public orientation for new volunteers.
              </p>
            </div>
          </div>
          <ChevronDown className="mt-2 h-5 w-5 shrink-0 text-ink-500 transition-transform group-open:rotate-180" />
        </summary>

        <form action={createOnboardingSessionAction} className="mt-5 border-t border-ink-100 pt-5">
          <input type="hidden" name="redirectTo" value="/issuer/catalog" />
          <p className="max-w-3xl text-sm leading-relaxed text-ink-600">
            The weekly capacity is the maximum number of people who can claim each onboarding session.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="onboardingTitle">Session name</Label>
              <Input id="onboardingTitle" name="title" required maxLength={120} placeholder="New Volunteer Orientation" />
            </div>
            <IssuerLocationField
              id="onboardingLocation"
              label="Default location"
              locations={locations}
              maxLength={240}
              placeholder="Community Room, 123 Main St."
            />
            <div>
              <Label htmlFor="onboardingFirstStartsAt">First session</Label>
              <Input id="onboardingFirstStartsAt" name="firstStartsAt" type="datetime-local" required />
            </div>
            <div>
              <Label htmlFor="onboardingWeeklyCapacity">Weekly capacity</Label>
              <div className="relative">
                <Input id="onboardingWeeklyCapacity" name="weeklyCapacity" type="number" min={1} max={500} defaultValue={10} required className="pr-28" />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-400">volunteer slots</span>
              </div>
            </div>
            <div>
              <Label htmlFor="onboardingDuration">Session length</Label>
              <select id="onboardingDuration" name="durationMinutes" defaultValue={90} className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200">
                <option value={60}>1 hour</option>
                <option value={90}>1 hour 30 minutes</option>
                <option value={120}>2 hours</option>
                <option value={180}>3 hours</option>
              </select>
            </div>
            <div>
              <Label htmlFor="onboardingCredits">Credits per completion</Label>
              <Input id="onboardingCredits" name="credits" type="number" min={1} max={100000} defaultValue={5} required />
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="onboardingDescription">What will volunteers do? <span className="font-normal text-ink-400">(optional)</span></Label>
            <Textarea id="onboardingDescription" name="description" rows={3} maxLength={2000} placeholder="Introduce volunteers to your organization, safety procedures, and their first ways to contribute." />
          </div>
          {replacesTaskTitle ? (
            <p className="mt-3 rounded-xl bg-gold-50 px-3 py-2 text-xs leading-relaxed text-gold-800">
              Creating this recurring session will replace <strong>{replacesTaskTitle}</strong> as your public onboarding designation. That opportunity will remain in your catalog.
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
            <p className="flex items-center gap-1.5 text-xs leading-relaxed text-ink-500"><UsersRound size={15} className="shrink-0 text-brand-600" /> Creates weekly public sessions for the next year. Your public organization profile must be published for visitors to discover them.</p>
            <Button type="submit">Create onboarding session</Button>
          </div>
        </form>
      </details>
    </Card>
  )
}
