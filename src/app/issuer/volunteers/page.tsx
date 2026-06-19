import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { credentials } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { getRoster, getSentMessages } from '@/lib/services/roster'
import { sendRosterMessageAction, grantCredentialAction, revokeCredentialAction } from '@/app/actions'
import { CREDENTIALS } from '@/lib/credentials'
import {
  Card,
  PageHeader,
  StatCard,
  EmptyState,
  Flash,
  Input,
  Label,
  Textarea,
  Button,
  Badge,
} from '@/components/ui'
import { fmtDate, fmtDateTime } from '@/lib/format'
import type { RosterVolunteer } from '@/lib/services/roster'

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
    <div className="px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-800">{v.name}</p>
          <p className="text-xs text-ink-400">{v.email}</p>
          <p className="mt-1 text-xs text-ink-500">
            {v.completedCount} completed · {v.creditsEarned} credits earned · last activity{' '}
            {fmtDate(v.lastActivity)}
          </p>
        </div>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Credentials</span>
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

  const roster = await getRoster(orgId, q)
  const sent = await getSentMessages(orgId, 5)

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
      <PageHeader
        title="Volunteers"
        subtitle="Everyone who has claimed one of your opportunities — grouped by what they've completed."
      />
      <Flash searchParams={searchParams} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Roster" value={roster.counts.total} hint="Total volunteers" />
        <StatCard label="Active" value={roster.counts.active} hint="Recently engaged or on an opportunity" />
        <StatCard
          label="Needs current waiver"
          value={roster.counts.needsWaiver}
          hint="Will be prompted on next claim"
        />
      </div>

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

          {roster.taskGroups.length > 0 ? (
            <>
              <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-ink-400">
                By completed opportunity
              </h2>
              <div className="space-y-3">
                {roster.taskGroups.map((g) => (
                  <Card key={g.taskId} className="p-0">
                    <details>
                      <summary className="cursor-pointer px-6 py-4 text-sm font-semibold text-ink-800 hover:text-brand-600">
                        {g.title}{' '}
                        <span className="ml-1 font-normal text-ink-400">
                          · {g.volunteers.length} volunteer{g.volunteers.length === 1 ? '' : 's'}
                        </span>
                      </summary>
                      <div className="divide-y divide-ink-100 border-t border-ink-100">
                        {g.volunteers.map((v) => (
                          <VolunteerRow key={`${g.taskId}-${v.userId}`} v={v} credsByUser={credsByUser} />
                        ))}
                      </div>
                    </details>
                  </Card>
                ))}
              </div>
            </>
          ) : null}
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
            <form action={sendRosterMessageAction} className="mt-4 space-y-4">
              <input type="hidden" name="redirectTo" value="/issuer/volunteers" />
              <div>
                <Label htmlFor="audience">Audience</Label>
                <select
                  id="audience"
                  name="audience"
                  className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                >
                  <option value="roster">Full roster ({roster.counts.total})</option>
                  {roster.taskGroups.map((g) => (
                    <option key={g.taskId} value={g.taskId}>
                      Completed: {g.title} ({g.volunteers.length})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" name="subject" required placeholder="e.g. Saturday shift moved to 10am" />
              </div>
              <div>
                <Label htmlFor="body">Message</Label>
                <Textarea
                  id="body"
                  name="body"
                  rows={5}
                  required
                  placeholder="Shift update, request, or thank-you note…"
                />
              </div>
              <Button type="submit">Send message</Button>
            </form>
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
                      {m.scope === 'roster' ? 'Full roster' : 'Task group'} · {m.recipientCount} recipient
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
