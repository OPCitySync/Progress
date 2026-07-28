import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { offerings, redemptions, orgs, users } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { createOfferingAction, toggleOfferingAction, finalizeRedemptionAction } from '@/app/actions'
import { Card, PageHeader, StatCard, EmptyState, Flash, Input, Label, Textarea, Button, statusBadge } from '@/components/ui'
import { OrgStatusBanner } from '@/components/OrgStatusBanner'
import { fmtDateTime } from '@/lib/format'
import { getActiveCity } from '@/lib/services/city-networks'
import { participantDisplayName } from '@/lib/participant-name'

export default async function RedeemerDashboard({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const session = await requireRole('redeemer')
  const orgId = session.orgId!
  const city = await getActiveCity(session)

  const org = (await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1))[0]
  const myOfferings = city ? await db
    .select()
    .from(offerings)
    .where(sql`${offerings.orgId} = ${orgId} AND ${offerings.cityId} = ${city.id}`)
    .orderBy(desc(offerings.createdAt)) : []

  const recent = city ? await db
    .select({ redemption: redemptions, offering: offerings, participant: users })
    .from(redemptions)
    .innerJoin(offerings, eq(redemptions.offeringId, offerings.id))
    .innerJoin(users, eq(redemptions.userId, users.id))
    .where(sql`${redemptions.orgId} = ${orgId} AND ${redemptions.cityId} = ${city.id}`)
    .orderBy(desc(redemptions.createdAt))
    .limit(25) : []

  const burnedRows = city ? await db
    .select({ n: sql<number>`coalesce(sum(${redemptions.cost}), 0)` })
    .from(redemptions)
    .where(sql`${redemptions.orgId} = ${orgId} AND ${redemptions.cityId} = ${city.id} AND ${redemptions.status} = 'finalized'`) : []
  const burned = burnedRows[0]

  return (
    <>
      <PageHeader
        title={org?.name ?? 'Redeemer dashboard'}
        subtitle={city ? `Publish ${city.name} offerings and finalize local redemptions.` : 'Choose an organization city before publishing offerings.'}
      />
      <OrgStatusBanner status={org?.status ?? 'pending'} />
      <Flash searchParams={searchParams} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active offerings" value={myOfferings.filter((o) => o.active === 1).length} />
        <StatCard
          label="Pending redemptions"
          value={recent.filter((r) => r.redemption.status === 'pending').length}
        />
        <StatCard label="Credits burned" value={Number(burned?.n ?? 0)} hint="Total redeemed with you" />
      </div>

      <div className="mt-9 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">
            Finalize a redemption
          </h2>
          <Card>
            <p className="text-sm text-ink-500">
              Enter the 6-character code the participant shows you. Their credits burn at this moment.
            </p>
            <form action={finalizeRedemptionAction} className="mt-4 flex gap-2">
              <input type="hidden" name="redirectTo" value="/redeemer" />
              <Input
                name="code"
                required
                placeholder="e.g. K7MWP2"
                maxLength={6}
                className="font-mono uppercase tracking-[0.2em]"
              />
              <Button type="submit" className="shrink-0">
                Finalize
              </Button>
            </form>
          </Card>

          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-ink-400">
            New offering
          </h2>
          <Card>
            <form action={createOfferingAction} className="space-y-4">
              <input type="hidden" name="redirectTo" value="/redeemer" />
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required placeholder="e.g. One-month transit pass" />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={2} />
              </div>
              <div>
                <Label htmlFor="cost">Cost (credits)</Label>
                <Input id="cost" name="cost" type="number" min={1} required defaultValue={25} />
              </div>
              <Button type="submit">Publish offering</Button>
            </form>
          </Card>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">
            Your offerings
          </h2>
          {myOfferings.length === 0 ? (
            <EmptyState title="No offerings yet" />
          ) : (
            <Card className="divide-y divide-ink-100 p-0">
              {myOfferings.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-ink-800">{o.title}</p>
                    <p className="text-xs text-ink-400">{o.cost} credits</p>
                  </div>
                  <form action={toggleOfferingAction}>
                    <input type="hidden" name="offeringId" value={o.id} />
                    <input type="hidden" name="active" value={o.active === 1 ? 'false' : 'true'} />
                    <input type="hidden" name="redirectTo" value="/redeemer" />
                    <button
                      className={
                        o.active === 1
                          ? 'text-xs font-medium text-ink-400 hover:text-red-600'
                          : 'text-xs font-medium text-emerald-600 hover:text-emerald-500'
                      }
                    >
                      {o.active === 1 ? 'Deactivate' : 'Activate'}
                    </button>
                  </form>
                </div>
              ))}
            </Card>
          )}

          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-ink-400">
            Recent redemptions
          </h2>
          {recent.length === 0 ? (
            <EmptyState title="No redemptions yet" />
          ) : (
            <Card className="divide-y divide-ink-100 p-0">
              {recent.map(({ redemption, offering, participant }) => (
                <div key={redemption.id} className="flex items-center justify-between gap-3 px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-ink-800">
                      {offering.title} · {participantDisplayName(participant)}
                    </p>
                    <p className="text-xs text-ink-400">
                      {redemption.cost} credits · {fmtDateTime(redemption.finalizedAt ?? redemption.createdAt)}
                    </p>
                  </div>
                  {statusBadge(redemption.status)}
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
