import Link from 'next/link'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { tasks, orgProfiles, orgs } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { aggregateOpportunities, type PublicOpportunity } from '@/lib/services/profile'
import { Card, Badge } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'
import { getActiveCity } from '@/lib/services/city-networks'

export const dynamic = 'force-dynamic'

function shiftSummary(o: { openShiftCount: number; nextShiftAt: number | null; nextShiftLabel: string }): string {
  if (o.openShiftCount === 0) return 'No upcoming shifts'
  const when = o.nextShiftAt ? fmtDateTime(o.nextShiftAt) : o.nextShiftLabel || 'Time TBD'
  const extra = o.openShiftCount > 1 ? ` · +${o.openShiftCount - 1} more` : ''
  return `${when}${extra}`
}

function OpportunityCard({
  card,
  orgName,
  isOnboarding,
}: {
  card: PublicOpportunity
  orgName: string
  isOnboarding: boolean
}) {
  return (
    <Link key={card.id} href={`/participant/opportunities/${card.id}`} className="block h-full">
      <Card className="h-full transition-shadow hover:shadow-panel">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-ink-900">{card.title}</p>
          {isOnboarding ? <Badge tone="blue">Start here</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-ink-500">{orgName}</p>
        {card.description ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-500">{card.description}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
          {card.location ? <span>📍 {card.location}</span> : null}
          <span>🗓 {shiftSummary(card)}</span>
          <span>
            {card.totalOpenSlots} spot{card.totalOpenSlots === 1 ? '' : 's'} open
          </span>
        </div>
        <p className="mt-4 text-sm font-semibold text-brand-700">View details →</p>
      </Card>
    </Link>
  )
}

export default async function OpportunitiesPage() {
  const session = await requireRole('participant')
  const city = await getActiveCity(session)

  const [rows, onboardingRows] = city
    ? await Promise.all([
        db
          .select({ task: tasks, org: orgs })
          .from(tasks)
          .innerJoin(orgs, eq(tasks.orgId, orgs.id))
          .where(and(eq(tasks.status, 'open'), eq(orgs.status, 'approved'), eq(tasks.cityId, city.id)))
          .orderBy(desc(tasks.createdAt)),
        db.select({ taskId: orgProfiles.onboardingTaskId }).from(orgProfiles),
      ])
    : [[], []]

  const onboardingTaskIds = new Set(onboardingRows.flatMap((row) => (row.taskId ? [row.taskId] : [])))
  const aggregate = await aggregateOpportunities(rows.map((row) => row.task))
  const allCards = rows
    .map((row) => ({ card: aggregate.get(row.task.id)!, org: row.org, isOnboarding: onboardingTaskIds.has(row.task.id) }))
    .filter((row) => row.card.openShiftCount > 0 && row.card.totalOpenSlots > 0)
    .sort((a, b) => {
      if (a.card.nextShiftAt === null && b.card.nextShiftAt === null) return 0
      if (a.card.nextShiftAt === null) return 1
      if (b.card.nextShiftAt === null) return -1
      return a.card.nextShiftAt - b.card.nextShiftAt
    })

  const participation = city?.participation?.status
  const onboardingCards = allCards.filter((row) => row.isOnboarding)
  const openCards = allCards.filter((row) => !row.isOnboarding)
  const isNewParticipant = participation === 'new'
  const isRestricted = participation === 'barred'

  if (!city) {
    return (
      <Card>
        <h1 className="skeuo-page-title font-display text-2xl font-semibold text-ink-900">Opportunities</h1>
        <p className="mt-1 text-sm text-ink-500">Choose a city network to see local ways to get involved.</p>
        <Link href="/workspace/cities" className="mt-6 inline-flex rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          Choose a city network
        </Link>
      </Card>
    )
  }

  if (isRestricted) {
    return (
      <Card className="border-red-200 bg-red-50">
        <h1 className="skeuo-page-title font-display text-2xl font-semibold text-ink-900">Participation restricted</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Your participation in {city.name} is temporarily paused. You can join opportunities again after the restriction period ends.
        </p>
      </Card>
    )
  }

  return (
    <>
      <Card className="mb-6">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Onboarding Opportunities</h2>
          <p className="mt-1 text-sm text-ink-500">
            {isNewParticipant
              ? 'Complete one verified on-site onboarding session to become a City Member.'
              : 'Introductory sessions offered by local organizations.'}
          </p>
        </div>
        <div className="mt-4">
          {onboardingCards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50 px-6 py-8 text-center">
            <p className="text-sm font-semibold text-ink-800">No onboarding sessions are open right now</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-500">
              Explore local organizations to find one that is preparing its next onboarding session.
            </p>
            <Link href="/workspace/orgs" className="mt-5 inline-block text-sm font-semibold text-brand-700 hover:text-brand-600">
              Explore organizations →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {onboardingCards.map(({ card, org }) => (
              <OpportunityCard key={card.id} card={card} orgName={org.name} isOnboarding />
            ))}
          </div>
        )}
        </div>
      </Card>

      <Card>
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Open Opportunities</h2>
          <p className="mt-1 text-sm text-ink-500">
            {isNewParticipant
              ? 'These opportunities unlock after your onboarding attendance has been verified.'
              : 'Volunteer shifts currently open in your city.'}
          </p>
        </div>
        <div className="mt-4">
          {isNewParticipant ? (
            <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50 px-6 py-8 text-center">
              <p className="text-sm font-semibold text-ink-800">Complete onboarding to unlock open opportunities</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-500">
                Once a local organization verifies your on-site onboarding check-in, you can reserve any open shift in {city.name}.
              </p>
            </div>
          ) : openCards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50 px-6 py-8 text-center">
              <p className="text-sm font-semibold text-ink-800">No open opportunities right now</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-500">
                Check back soon—local organizations publish new opportunities regularly.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {openCards.map(({ card, org }) => (
                <OpportunityCard key={card.id} card={card} orgName={org.name} isOnboarding={false} />
              ))}
            </div>
          )}
        </div>
      </Card>
    </>
  )
}
