import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { claims, tasks, shifts, orgs, users } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { getMessagesForUser, markAllMessagesRead } from '@/lib/services/roster'
import { getNotifications, markNotificationsRead } from '@/lib/services/notifications'
import { submitCompletionAction, unclaimClaimAction } from '@/app/actions'
import { Card, PageHeader, StatCard, statusBadge, EmptyState, Flash, Button, Textarea, Badge } from '@/components/ui'
import { fmtDate, fmtDateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

function whenLabel(shift: { startsAt: number | null; endsAt: number | null; label: string } | null): string {
  if (!shift) return ''
  if (shift.startsAt) {
    const start = fmtDateTime(shift.startsAt)
    if (shift.endsAt) {
      const end = new Date(shift.endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      return `${start} – ${end}`
    }
    return start
  }
  return shift.label || ''
}

export default async function ParticipantDashboard({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const session = await requireRole('participant')

  const me = (await db.select().from(users).where(eq(users.id, session.sub)).limit(1))[0]
  const myClaims = await db
    .select({ claim: claims, task: tasks, org: orgs, shift: shifts })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .innerJoin(orgs, eq(tasks.orgId, orgs.id))
    .leftJoin(shifts, eq(claims.shiftId, shifts.id))
    .where(eq(claims.userId, session.sub))
    .orderBy(desc(claims.updatedAt))

  const active = myClaims.filter((c) => c.claim.status === 'claimed' || c.claim.status === 'submitted')
  const past = myClaims.filter((c) => c.claim.status === 'verified' || c.claim.status === 'rejected')

  // Inbox: messages from organizations whose roster you're on.
  const messages = await getMessagesForUser(session.sub, 10)
  const hasUnread = messages.some((m) => m.unread)
  if (hasUnread) {
    // Rendering the dashboard counts as reading — mark after fetch so the
    // unread highlight still shows on this load.
    await markAllMessagesRead(session.sub)
  }

  // Reminders / notifications (shift confirmations, pre-shift reminders).
  const notifications = await getNotifications(session.sub, 12)
  if (notifications.some((n) => !n.readAt)) {
    await markNotificationsRead(session.sub)
  }

  return (
    <>
      <PageHeader
        title={`Welcome, ${session.name.split(' ')[0]}`}
        subtitle="Your civic contributions and credit balance."
        action={
          <Link
            href="/participant/opportunities"
            className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Browse opportunities
          </Link>
        }
      />
      <Flash searchParams={searchParams} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Credit balance" value={me?.creditBalance ?? 0} hint="Redeemable now" />
        <StatCard label="Lifetime earned" value={me?.lifetimeEarned ?? 0} hint="Total credits minted to you" />
        <StatCard label="Verified contributions" value={past.filter((c) => c.claim.status === 'verified').length} />
      </div>

      {notifications.length > 0 ? (
        <>
          <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider text-ink-400">Notifications</h2>
          <Card className="divide-y divide-ink-100 p-0">
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={n.link || '/participant'}
                className={`block px-6 py-4 hover:bg-ink-50 ${n.readAt ? '' : 'bg-brand-50/50'}`}
              >
                <p className="text-sm font-semibold text-ink-800">
                  {n.title}
                  {n.readAt ? null : <Badge tone="blue">new</Badge>}
                </p>
                {n.body ? <p className="mt-0.5 text-sm text-ink-500">{n.body}</p> : null}
                <p className="mt-1 text-xs text-ink-400">{fmtDateTime(n.createdAt)}</p>
              </Link>
            ))}
          </Card>
        </>
      ) : null}

      {messages.length > 0 ? (
        <>
          <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider text-ink-400">
            Messages from your organizations
          </h2>
          <Card className="divide-y divide-ink-100 p-0">
            {messages.map((m) => (
              <details key={m.id} className={m.unread ? 'bg-brand-50/50' : ''}>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-6 py-4">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink-800">
                      {m.subject}
                      {m.unread ? (
                        <Badge tone="blue">
                          <span className="ml-0">new</span>
                        </Badge>
                      ) : null}
                    </span>
                    <span className="block text-xs text-ink-400">
                      {m.orgName} · {fmtDateTime(m.createdAt)}
                    </span>
                  </span>
                </summary>
                <p className="whitespace-pre-line border-t border-ink-100 px-6 py-4 text-sm leading-relaxed text-ink-600">
                  {m.body}
                </p>
              </details>
            ))}
          </Card>
        </>
      ) : null}

      <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider text-ink-400">
        Active commitments
      </h2>
      {active.length === 0 ? (
        <EmptyState
          title="No active commitments"
          body="Claim an opportunity to start earning civic credits."
        />
      ) : (
        <div className="space-y-4">
          {active.map(({ claim, task, org, shift }) => (
            <Card key={claim.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/participant/opportunities/${task.id}`}
                    className="font-semibold text-ink-900 hover:text-brand-600"
                  >
                    {task.title}
                  </Link>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {org.name} · {task.credits} credits{whenLabel(shift) ? ` · ${whenLabel(shift)}` : ''}
                  </p>
                </div>
                {statusBadge(claim.status)}
              </div>
              {claim.status === 'claimed' ? (
                <div className="mt-4 border-t border-ink-100 pt-4">
                  <form action={submitCompletionAction} className="space-y-3">
                    <input type="hidden" name="claimId" value={claim.id} />
                    <input type="hidden" name="redirectTo" value="/participant" />
                    <Textarea
                      name="note"
                      rows={2}
                      placeholder="Optional note for the verifier (what you did, when, with whom)…"
                    />
                    <div className="flex items-center gap-3">
                      <Button type="submit">Submit for verification</Button>
                    </div>
                  </form>
                  <form action={unclaimClaimAction} className="mt-2">
                    <input type="hidden" name="claimId" value={claim.id} />
                    <input type="hidden" name="redirectTo" value="/participant" />
                    <button className="text-xs font-medium text-ink-400 hover:text-red-600">
                      Withdraw sign-up
                    </button>
                  </form>
                </div>
              ) : (
                <p className="mt-3 text-sm text-ink-400">
                  Submitted — waiting for {org.name} to verify.
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider text-ink-400">History</h2>
      {past.length === 0 ? (
        <EmptyState title="No completed contributions yet" />
      ) : (
        <Card className="divide-y divide-ink-100 p-0">
          {past.map(({ claim, task, org }) => (
            <div key={claim.id} className="flex items-center justify-between gap-3 px-6 py-4">
              <div>
                <p className="text-sm font-medium text-ink-800">{task.title}</p>
                <p className="text-xs text-ink-400">
                  {org.name} · {fmtDate(claim.updatedAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {claim.status === 'verified' ? (
                  <span className="text-sm font-semibold text-emerald-600">+{task.credits}</span>
                ) : null}
                {statusBadge(claim.status)}
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  )
}
