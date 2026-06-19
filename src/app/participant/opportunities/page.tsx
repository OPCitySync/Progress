import Link from 'next/link'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { tasks, orgs } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { aggregateOpportunities } from '@/lib/services/profile'
import { recommendedOpportunities } from '@/lib/services/interests'
import { Card, PageHeader, EmptyState, Badge } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

function shiftSummary(o: { openShiftCount: number; nextShiftAt: number | null; nextShiftLabel: string }): string {
  if (o.openShiftCount === 0) return 'No upcoming shifts'
  const when = o.nextShiftAt ? fmtDateTime(o.nextShiftAt) : o.nextShiftLabel || 'Time TBD'
  const extra = o.openShiftCount > 1 ? ` · +${o.openShiftCount - 1} more` : ''
  return `${when}${extra}`
}

export default async function OpportunitiesPage() {
  const session = await requireRole('participant')

  const rows = await db
    .select({ task: tasks, org: orgs })
    .from(tasks)
    .innerJoin(orgs, eq(tasks.orgId, orgs.id))
    .where(and(eq(tasks.status, 'open'), eq(orgs.status, 'approved')))
    .orderBy(desc(tasks.createdAt))

  const agg = await aggregateOpportunities(rows.map((r) => r.task))
  const cards = rows
    .map((r) => ({ card: agg.get(r.task.id)!, org: r.org }))
    .filter((x) => x.card.openShiftCount > 0)

  const recommended = await recommendedOpportunities(session.sub)

  return (
    <>
      <PageHeader
        title="Open opportunities"
        subtitle="Approved civic-labor opportunities from issuer organizations. Pick a shift to sign up."
        action={
          <Link
            href="/participant/interests"
            className="rounded-xl border border-ink-300 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            Edit interests
          </Link>
        }
      />

      {recommended.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">Recommended for you</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {recommended.map(({ card, orgName }) => (
              <Link key={card.id} href={`/participant/opportunities/${card.id}`}>
                <Card className="h-full border-brand-200 bg-brand-50 transition-shadow hover:shadow-panel">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-ink-900">{card.title}</p>
                    <Badge tone="gold">{card.credits} cr</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-500">{orgName}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
                    <span>🗓 {shiftSummary(card)}</span>
                    <span>
                      {card.totalOpenSlots} slot{card.totalOpenSlots === 1 ? '' : 's'} open
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {cards.length === 0 ? (
        <EmptyState
          title="No open opportunities right now"
          body="Check back soon — issuer organizations publish new opportunities regularly."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map(({ card, org }) => (
            <Link key={card.id} href={`/participant/opportunities/${card.id}`}>
              <Card className="h-full transition-shadow hover:shadow-panel">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-ink-900">{card.title}</p>
                  <Badge tone="gold">{card.credits} cr</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-500">{org.name}</p>
                {card.description ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-500">{card.description}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
                  {card.location ? <span>📍 {card.location}</span> : null}
                  <span>🗓 {shiftSummary(card)}</span>
                  <span>
                    {card.totalOpenSlots} slot{card.totalOpenSlots === 1 ? '' : 's'} open
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
