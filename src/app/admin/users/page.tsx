import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users, orgs } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { setUserStatusAction, resetPasswordAction, adjustCreditsAction } from '@/app/actions'
import { Card, PageHeader, StatCard, EmptyState, Flash, Input, Button, Badge } from '@/components/ui'
import { fmtDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

const roleTone: Record<string, 'blue' | 'gold' | 'green' | 'gray'> = {
  participant: 'green',
  issuer: 'blue',
  redeemer: 'gold',
  admin: 'gray',
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string; q?: string; role?: string }
}) {
  const session = await requireRole('admin')
  const q = (searchParams.q ?? '').trim().toLowerCase()
  const roleFilter = searchParams.role ?? ''

  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt))
  const allOrgs = await db.select({ id: orgs.id, name: orgs.name }).from(orgs)
  const orgName = new Map(allOrgs.map((o) => [o.id, o.name]))

  const filtered = allUsers.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false
    if (q && ![u.name, u.email, u.role, u.status].join(' ').toLowerCase().includes(q)) return false
    return true
  })

  return (
    <>
      <PageHeader title="Users" subtitle="Every account on the network. All actions here are ledgered." />
      <Flash searchParams={searchParams} />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total accounts" value={allUsers.length} />
        <StatCard label="Participants" value={allUsers.filter((u) => u.role === 'participant').length} />
        <StatCard
          label="Org accounts"
          value={allUsers.filter((u) => u.role === 'issuer' || u.role === 'redeemer').length}
        />
        <StatCard label="Disabled" value={allUsers.filter((u) => u.status === 'disabled').length} />
      </div>

      <form method="GET" className="mt-6 flex flex-wrap gap-2">
        <div className="min-w-56 flex-1">
          <Input name="q" defaultValue={searchParams.q ?? ''} placeholder="Search by name, email, role…" />
        </div>
        <select
          name="role"
          defaultValue={roleFilter}
          className="rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900"
        >
          <option value="">All roles</option>
          <option value="participant">Participants</option>
          <option value="issuer">Issuers</option>
          <option value="redeemer">Redeemers</option>
          <option value="admin">Admins</option>
        </select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No users match" />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.map((u) => (
            <Card key={u.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-800">
                    {u.name}{' '}
                    <Badge tone={roleTone[u.role]}>{u.role}</Badge>{' '}
                    {u.status === 'disabled' ? <Badge tone="red">disabled</Badge> : null}
                  </p>
                  <p className="text-xs text-ink-400">
                    {u.email} · joined {fmtDate(u.createdAt)}
                    {u.orgId ? ` · ${orgName.get(u.orgId) ?? 'unknown org'}` : ''}
                  </p>
                  {u.role === 'participant' ? (
                    <p className="mt-1 text-xs text-ink-500">
                      Balance {u.creditBalance} · lifetime {u.lifetimeEarned}
                    </p>
                  ) : null}
                </div>

                {u.role !== 'admin' && u.id !== session.sub ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={resetPasswordAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="redirectTo" value="/admin/users" />
                      <Button type="submit" variant="secondary">
                        Reset password
                      </Button>
                    </form>
                    <form action={setUserStatusAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="status" value={u.status === 'disabled' ? 'active' : 'disabled'} />
                      <input type="hidden" name="redirectTo" value="/admin/users" />
                      <Button type="submit" variant={u.status === 'disabled' ? 'primary' : 'danger'}>
                        {u.status === 'disabled' ? 'Re-enable' : 'Disable'}
                      </Button>
                    </form>
                  </div>
                ) : null}
              </div>

              {u.role === 'participant' ? (
                <details className="mt-3 border-t border-ink-100 pt-3">
                  <summary className="cursor-pointer text-xs font-medium text-ink-400 hover:text-ink-600">
                    Adjust credits (ledgered, reason required)
                  </summary>
                  <form action={adjustCreditsAction} className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="redirectTo" value="/admin/users" />
                    <div className="w-28">
                      <label className="mb-1 block text-xs font-medium text-ink-500">Amount (±)</label>
                      <Input name="amount" type="number" required placeholder="e.g. -10" />
                    </div>
                    <div className="min-w-48 flex-1">
                      <label className="mb-1 block text-xs font-medium text-ink-500">Reason</label>
                      <Input name="reason" required placeholder="e.g. dispute resolution, epoch correction" />
                    </div>
                    <Button type="submit" variant="secondary">
                      Apply
                    </Button>
                  </form>
                </details>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
