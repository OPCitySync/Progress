import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { credentials } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { getRoster, getSentMessages, getVolunteerGroups } from '@/lib/services/roster'
import { grantCredentialAction, revokeCredentialAction } from '@/app/actions'
import { CREDENTIALS } from '@/lib/credentials'
import {
  Card,
  PageHeader,
  StatCard,
  EmptyState,
  Flash,
  Input,
  Badge,
} from '@/components/ui'
import { fmtDate, fmtDateTime } from '@/lib/format'
import type { RosterVolunteer } from '@/lib/services/roster'
import { CopyEmailButton } from '@/components/CopyEmailButton'
import { ChevronDown } from 'lucide-react'
import { VolunteerGroupingManager } from '@/components/organization/VolunteerGroupingManager'
import { RosterMessageComposer } from '@/components/organization/RosterMessageComposer'

export const dynamic = 'force-dynamic'

const statusMeta: Record<RosterVolunteer['status'], { label: string; tone: 'green' | 'blue' | 'gold' | 'gray' }> = {
  active: { label: 'Active', tone: 'green' },
  committed: { label: 'On a task', tone: 'blue' },
  'needs-waiver': { label: 'Needs current waiver', tone: 'gold' },
  inactive: { label: 'Inactive', tone: 'gray' },
}

function VolunteerRow({ v, credsByUser }: { v: RosterVolunteer; credsByUser: Map<string, Set<string>> }) {
  const meta = statusMeta[v.status]
  const held = credsByUser.get(v.userId) ?? new Set<string>()
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-800">{v.name}</p>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <p className="truncate text-xs text-ink-400">{v.email}</p>
            <CopyEmailButton email={v.email} />
          </div>
        </div>
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="grid gap-5 border-t border-ink-100 px-5 py-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Contribution history</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
            <div>
              <dt className="text-ink-500">Completed</dt>
              <dd className="font-semibold text-ink-800">{v.completedCount}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Credits earned</dt>
              <dd className="font-semibold text-ink-800">{v.creditsEarned}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Active claims</dt>
              <dd className="font-semibold text-ink-800">{v.activeClaims}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Last activity</dt>
              <dd className="font-semibold text-ink-800">{fmtDate(v.lastActivity)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-500">
            Waiver: <span className="font-medium text-ink-700">{v.waiverCurrent ? 'Current' : 'Needs renewal'}</span>
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Credentials</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {CREDENTIALS.map((c) => {
              const has = held.has(c.key)
              return (
                <form key={c.key} action={has ? revokeCredentialAction : grantCredentialAction}>
                  <input type="hidden" name="userId" value={v.userId} />
                  <input type="hidden" name="type" value={c.key} />
                  <input type="hidden" name="redirectTo" value="/issuer/volunteers" />
                  <button
                    title={has ? 'Granted — click to revoke' : 'Click to grant'}
                    className={
                      has
                        ? 'rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100'
                        : 'rounded-full border border-ink-200 px-2.5 py-0.5 text-xs font-medium text-ink-500 hover:border-ink-300'
                    }
                  >
                    {has ? '✓ ' : '+ '}
                    {c.label}
                  </button>
                </form>
              )
            })}
          </div>
        </div>
      </div>
    </details>
  )
}

export default async function VolunteersPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string; q?: string }
}) {
  const session = await requireRole('issuer')
  const orgId = session.orgId!
  const q = searchParams.q ?? ''

  const [roster, allRoster, sent, groups] = await Promise.all([
    getRoster(orgId, q),
    getRoster(orgId),
    getSentMessages(orgId, 5),
    getVolunteerGroups(orgId),
  ])

  // Credentials currently held by everyone on the roster (network-wide).
  const ids = Array.from(
    new Set([
      ...roster.volunteers.map((v) => v.userId),
      ...roster.taskGroups.flatMap((g) => g.volunteers.map((v) => v.userId)),
    ]),
  )
  const credsByUser = new Map<string, Set<string>>()
  if (ids.length > 0) {
    const rows = await db
      .select()
      .from(credentials)
      .where(and(inArray(credentials.userId, ids), eq(credentials.status, 'verified')))
    const now = Date.now()
    for (const r of rows) {
      if (r.expiresAt && r.expiresAt < now) continue
      const set = credsByUser.get(r.userId) ?? new Set<string>()
      set.add(r.type)
      credsByUser.set(r.userId, set)
    }
  }

  return (
    <>
      <Card className="mb-6">
        <PageHeader
          title="Volunteers"
          subtitle="Everyone who has claimed one of your opportunities — grouped by what they've completed."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Roster" value={roster.counts.total} hint="Total volunteers" />
          <StatCard label="Active" value={roster.counts.active} hint="Recently engaged or on an opportunity" />
          <StatCard
            label="Needs current waiver"
            value={roster.counts.needsWaiver}
            hint="Will be prompted on next claim"
          />
        </div>
      </Card>
      <Flash searchParams={searchParams} />

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <form method="GET" className="mb-4">
            <Input name="q" defaultValue={q} placeholder="Search volunteers by name, email, or status…" />
          </form>

          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">
            Full roster {q ? `· matching “${q}”` : ''}
          </h2>
          {roster.volunteers.length === 0 ? (
            <EmptyState
              title={q ? 'No volunteers match that search' : 'No volunteers yet'}
              body={q ? 'Try clearing the search.' : 'Volunteers appear here once they claim your opportunities.'}
            />
          ) : (
            <Card className="divide-y divide-ink-100 p-0">
              {roster.volunteers.map((v) => (
                <VolunteerRow key={v.userId} v={v} credsByUser={credsByUser} />
              ))}
            </Card>
          )}

          <VolunteerGroupingManager groups={groups} volunteers={allRoster.volunteers} />
        </div>

        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">
            Message volunteers
          </h2>
          <Card>
            <p className="text-sm text-ink-500">
              Delivered in-app to each volunteer’s dashboard. Recipients are frozen at send time;
              the send is recorded on the ledger.
            </p>
            <RosterMessageComposer volunteers={allRoster.volunteers} groups={groups} />
          </Card>

          {sent.length > 0 ? (
            <>
              <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-ink-400">
                Recently sent
              </h2>
              <Card className="divide-y divide-ink-100 p-0">
                {sent.map((m) => (
                  <div key={m.id} className="px-6 py-4">
                    <p className="text-sm font-medium text-ink-800">{m.subject}</p>
                    <p className="text-xs text-ink-400">
                      {m.scope === 'roster'
                        ? 'All volunteers'
                        : m.scope === 'group'
                          ? `Grouping: ${m.groupName ?? 'removed grouping'}`
                          : m.scope === 'members'
                            ? 'Selected volunteers'
                            : 'Completed opportunity'}{' '}
                      · {m.recipientCount} recipient
                      {m.recipientCount === 1 ? '' : 's'} · {fmtDateTime(m.createdAt)}
                    </p>
                  </div>
                ))}
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}
