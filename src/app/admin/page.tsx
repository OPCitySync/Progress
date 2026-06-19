import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orgs, users } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { approveOrgAction, suspendOrgAction } from '@/app/actions'
import { getPublicStats } from '@/lib/services/stats'
import { Card, PageHeader, StatCard, EmptyState, Flash, Button, statusBadge, Badge } from '@/components/ui'
import { fmtDate } from '@/lib/format'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  await requireRole('admin')

  const stats = await getPublicStats()
  const allOrgs = await db.select().from(orgs).orderBy(desc(orgs.createdAt))
  const owners = await db.select({ id: users.id, email: users.email }).from(users)
  const emailById = new Map(owners.map((o) => [o.id, o.email]))

  const pending = allOrgs.filter((o) => o.status === 'pending')
  const rest = allOrgs.filter((o) => o.status !== 'pending')

  return (
    <>
      <PageHeader title="Network administration" subtitle="Approve organizations and monitor the pilot." />
      <Flash searchParams={searchParams} />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Participants" value={stats.participants} />
        <StatCard label="Credits minted" value={stats.creditsMinted} />
        <StatCard label="Credits outstanding" value={stats.creditsOutstanding} />
        <StatCard label="Credits burned" value={stats.creditsBurned} />
      </div>

      <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider text-ink-400">
        Pending approval
      </h2>
      {pending.length === 0 ? (
        <EmptyState title="No organizations waiting" />
      ) : (
        <div className="space-y-3">
          {pending.map((org) => (
            <Card key={org.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink-900">
                    {org.name} <Badge tone={org.type === 'issuer' ? 'blue' : 'gold'}>{org.type}</Badge>
                  </p>
                  <p className="mt-1 text-xs text-ink-400">
                    {emailById.get(org.ownerUserId) ?? '—'} · registered {fmtDate(org.createdAt)}
                  </p>
                  {org.description ? (
                    <p className="mt-2 max-w-xl text-sm text-ink-500">{org.description}</p>
                  ) : null}
                </div>
                <form action={approveOrgAction}>
                  <input type="hidden" name="orgId" value={org.id} />
                  <input type="hidden" name="redirectTo" value="/admin" />
                  <Button type="submit">Approve</Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider text-ink-400">
        All organizations
      </h2>
      {rest.length === 0 ? (
        <EmptyState title="No organizations yet" />
      ) : (
        <Card className="divide-y divide-ink-100 p-0">
          {rest.map((org) => (
            <div key={org.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div>
                <p className="text-sm font-semibold text-ink-800">
                  {org.name}{' '}
                  <span className="ml-1 text-xs font-normal uppercase tracking-wide text-ink-400">
                    {org.type}
                  </span>
                </p>
                <p className="text-xs text-ink-400">{emailById.get(org.ownerUserId) ?? '—'}</p>
              </div>
              <div className="flex items-center gap-3">
                {statusBadge(org.status)}
                {org.status === 'approved' ? (
                  <form action={suspendOrgAction}>
                    <input type="hidden" name="orgId" value={org.id} />
                    <input type="hidden" name="redirectTo" value="/admin" />
                    <button className="text-xs font-medium text-ink-400 hover:text-red-600">Suspend</button>
                  </form>
                ) : org.status === 'suspended' ? (
                  <form action={approveOrgAction}>
                    <input type="hidden" name="orgId" value={org.id} />
                    <input type="hidden" name="redirectTo" value="/admin" />
                    <button className="text-xs font-medium text-emerald-600 hover:text-emerald-500">
                      Reinstate
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  )
}
