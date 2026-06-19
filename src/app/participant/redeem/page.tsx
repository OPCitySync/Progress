import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { offerings, orgs, redemptions, users } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { requestRedemptionAction, cancelRedemptionAction } from '@/app/actions'
import { Card, PageHeader, StatCard, EmptyState, Flash, Button, Badge, statusBadge } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'

export default async function RedeemPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string; code?: string }
}) {
  const session = await requireRole('participant')

  const me = (await db.select().from(users).where(eq(users.id, session.sub)).limit(1))[0]
  const available = await db
    .select({ offering: offerings, org: orgs })
    .from(offerings)
    .innerJoin(orgs, eq(offerings.orgId, orgs.id))
    .where(sql`${offerings.active} = 1 AND ${orgs.status} = 'approved'`)
    .orderBy(offerings.cost)

  const mine = await db
    .select({ redemption: redemptions, offering: offerings, org: orgs })
    .from(redemptions)
    .innerJoin(offerings, eq(redemptions.offeringId, offerings.id))
    .innerJoin(orgs, eq(redemptions.orgId, orgs.id))
    .where(eq(redemptions.userId, session.sub))
    .orderBy(desc(redemptions.createdAt))

  const pending = mine.filter((m) => m.redemption.status === 'pending')
  const history = mine.filter((m) => m.redemption.status !== 'pending')
  const balance = me?.creditBalance ?? 0

  return (
    <>
      <PageHeader title="Redeem credits" subtitle="Exchange civic credits with community partners." />
      <Flash searchParams={searchParams} />

      {searchParams.code ? (
        <div className="mb-5 rounded-2xl border border-gold-300 bg-gold-50 p-6 text-center">
          <p className="text-sm font-medium text-gold-800">Show this code to the redeemer to complete your redemption:</p>
          <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em] text-gold-700">
            {searchParams.code}
          </p>
          <p className="mt-2 text-xs text-gold-700/70">
            Credits are deducted when the organization enters this code.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Your balance" value={balance} hint="Civic credits available" />
        <StatCard label="Pending redemptions" value={pending.length} />
      </div>

      {pending.length > 0 ? (
        <>
          <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider text-ink-400">
            Pending — show code at redemption
          </h2>
          <div className="space-y-3">
            {pending.map(({ redemption, offering, org }) => (
              <Card key={redemption.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-800">{offering.title}</p>
                  <p className="text-xs text-ink-400">
                    {org.name} · {redemption.cost} credits
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-lg font-bold tracking-[0.2em] text-brand-700">
                    {redemption.code}
                  </span>
                  <form action={cancelRedemptionAction}>
                    <input type="hidden" name="redemptionId" value={redemption.id} />
                    <input type="hidden" name="redirectTo" value="/participant/redeem" />
                    <button className="text-xs font-medium text-ink-400 hover:text-red-600">Cancel</button>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider text-ink-400">
        Available offerings
      </h2>
      {available.length === 0 ? (
        <EmptyState title="No offerings available yet" body="Redeemer organizations will publish offerings here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {available.map(({ offering, org }) => {
            const affordable = balance >= offering.cost
            return (
              <Card key={offering.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-ink-900">{offering.title}</p>
                  <Badge tone="gold">{offering.cost} cr</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-500">{org.name}</p>
                {offering.description ? (
                  <p className="mt-2 text-sm leading-relaxed text-ink-500">{offering.description}</p>
                ) : null}
                <form action={requestRedemptionAction} className="mt-4">
                  <input type="hidden" name="offeringId" value={offering.id} />
                  <input type="hidden" name="redirectTo" value="/participant/redeem" />
                  <Button type="submit" disabled={!affordable} variant={affordable ? 'primary' : 'secondary'}>
                    {affordable ? 'Request redemption' : `Need ${offering.cost - balance} more credits`}
                  </Button>
                </form>
              </Card>
            )
          })}
        </div>
      )}

      {history.length > 0 ? (
        <>
          <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider text-ink-400">History</h2>
          <Card className="divide-y divide-ink-100 p-0">
            {history.map(({ redemption, offering, org }) => (
              <div key={redemption.id} className="flex items-center justify-between gap-3 px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-ink-800">{offering.title}</p>
                  <p className="text-xs text-ink-400">
                    {org.name} · {fmtDateTime(redemption.finalizedAt ?? redemption.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {redemption.status === 'finalized' ? (
                    <span className="text-sm font-semibold text-red-500">−{redemption.cost}</span>
                  ) : null}
                  {statusBadge(redemption.status)}
                </div>
              </div>
            ))}
          </Card>
        </>
      ) : null}
    </>
  )
}
