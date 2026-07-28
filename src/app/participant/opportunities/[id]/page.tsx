import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { tasks, orgs, claims } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { getActiveWaiver, hasAcceptedWaiver } from '@/lib/services/waivers'
import { getShiftsWithCounts, checkInOpen, type ShiftRow } from '@/lib/services/opportunities'
import { getHeldCredentials } from '@/lib/services/credentials'
import { parseCredentialList, credentialLabel } from '@/lib/credentials'
import { claimShiftAction, selfCheckInAction } from '@/app/actions'
import { Card, PageHeader, Badge, Button, Input, Flash, Mono, statusBadge } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'
import { getActiveCity } from '@/lib/services/city-networks'

export const dynamic = 'force-dynamic'

function whenLabel(shift: ShiftRow): string {
  if (shift.startsAt) {
    const start = fmtDateTime(shift.startsAt)
    if (shift.endsAt) {
      const end = new Date(shift.endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      return `${start} – ${end}`
    }
    return start
  }
  return shift.label || 'Time TBD'
}

export default async function OpportunityDetail({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { error?: string; ok?: string }
}) {
  const session = await requireRole('participant')
  const city = await getActiveCity(session)
  if (!city) notFound()

  const row = (
    await db
      .select({ task: tasks, org: orgs })
      .from(tasks)
      .innerJoin(orgs, eq(tasks.orgId, orgs.id))
      .where(and(eq(tasks.id, params.id), eq(tasks.cityId, city.id)))
      .limit(1)
  )[0]
  if (!row) notFound()
  const { task, org } = row

  const shiftRows = await getShiftsWithCounts(task.id)
  const myClaims = await db
    .select()
    .from(claims)
    .where(and(eq(claims.taskId, task.id), eq(claims.userId, session.sub)))
  const claimByShift = new Map(myClaims.filter((c) => c.status !== 'unclaimed').map((c) => [c.shiftId, c]))

  const waiver = await getActiveWaiver(org.id)
  const waiverAccepted = waiver ? await hasAcceptedWaiver(session.sub, waiver.id) : true
  const needsWaiver = !!waiver && !waiverAccepted

  const required = parseCredentialList(task.requiredCredentials)
  const held = required.length ? await getHeldCredentials(session.sub) : new Set<string>()
  const missingCreds = required.filter((c) => !held.has(c))
  const credBlocked = missingCreds.length > 0

  return (
    <>
      <Link href="/participant/opportunities" className="mb-4 inline-block text-sm text-ink-400 hover:text-ink-600">
        ← All opportunities
      </Link>
      <PageHeader title={task.title} subtitle={`${org.name}${task.location ? ` · ${task.location}` : ''}`} />
      <Flash searchParams={searchParams} />

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="gold">{task.credits} credits per shift</Badge>
          {statusBadge(task.status)}
        </div>
        {task.description ? (
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-600">{task.description}</p>
        ) : null}
      </Card>

      {required.length > 0 ? (
        <Card className="mt-4">
          <p className="text-sm font-semibold text-ink-800">Requirements</p>
          <ul className="mt-2 space-y-1 text-sm">
            {required.map((c) => {
              const ok = held.has(c)
              return (
                <li key={c} className={ok ? 'text-emerald-700' : 'text-ink-600'}>
                  {ok ? '✓ ' : '• '}
                  {credentialLabel(c)}
                  {ok ? '' : ' — not yet verified'}
                </li>
              )
            })}
          </ul>
          {credBlocked ? (
            <p className="mt-2 text-xs text-ink-400">
              Contact {org.name} to get verified, then you can sign up for a shift.
            </p>
          ) : null}
        </Card>
      ) : null}

      {needsWaiver ? (
        <Card className="mt-4">
          <p className="text-sm font-semibold text-ink-800">{org.name} requires a liability waiver</p>
          <p className="mt-1 text-xs text-ink-400">
            {waiver!.title} — version {waiver!.version} · document hash: <Mono>{waiver!.sha256.slice(0, 16)}…</Mono>
          </p>
          {waiver!.documentUrl ? (
            <a
              href={waiver!.documentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs font-semibold text-brand-600 hover:text-brand-500"
            >
              View attached waiver document{waiver!.documentName ? `: ${waiver!.documentName}` : ''} →
            </a>
          ) : null}
          <div className="mt-3 max-h-48 overflow-y-auto whitespace-pre-line rounded-xl border border-ink-200 bg-ink-50 p-4 text-xs leading-relaxed text-ink-600">
            {waiver!.body}
          </div>
          <p className="mt-2 text-xs text-ink-400">You’ll accept this when you sign up for your first shift below.</p>
        </Card>
      ) : null}

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-ink-400">Shifts</h2>
      {shiftRows.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-500">No shifts have been scheduled for this opportunity yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {shiftRows.map(({ shift, slotsLeft }) => {
            const myClaim = claimByShift.get(shift.id)
            const claimable =
              task.status === 'open' && shift.status === 'open' && slotsLeft > 0 && !myClaim && !credBlocked
            return (
              <Card key={shift.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-800">{whenLabel(shift)}</p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {slotsLeft} of {shift.capacity} slot{shift.capacity === 1 ? '' : 's'} open
                      {shift.status === 'closed' ? ' · closed' : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {myClaim ? (
                      <div>
                        {statusBadge(myClaim.status)}
                        {myClaim.checkedInAt ? (
                          <p className="mt-1 text-xs font-medium text-emerald-600">✓ Checked in</p>
                        ) : checkInOpen(shift) && (myClaim.status === 'claimed' || myClaim.status === 'submitted') ? (
                          <form action={selfCheckInAction} className="mt-2 flex items-center gap-2">
                            <input type="hidden" name="shiftId" value={shift.id} />
                            <input type="hidden" name="taskId" value={task.id} />
                            <Input
                              name="code"
                              placeholder="Code"
                              maxLength={6}
                              className="w-24 uppercase"
                              autoComplete="off"
                            />
                            <Button type="submit" variant="secondary">
                              Check in
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    ) : !claimable ? (
                      <span className="text-sm text-ink-400">
                        {credBlocked
                          ? 'Requirements needed'
                          : task.status !== 'open' || shift.status !== 'open'
                            ? 'Closed'
                            : 'Full'}
                      </span>
                    ) : (
                      <form action={claimShiftAction} className="space-y-2">
                        <input type="hidden" name="shiftId" value={shift.id} />
                        <input type="hidden" name="taskId" value={task.id} />
                        <input type="hidden" name="redirectTo" value={`/participant/opportunities/${task.id}`} />
                        {needsWaiver ? (
                          <>
                            <input type="hidden" name="acceptWaiverVersionId" value={waiver!.id} />
                            <label className="flex items-start gap-2 text-xs text-ink-600">
                              <input type="checkbox" name="waiverAgree" className="mt-0.5" />
                              <span>I accept the liability waiver above.</span>
                            </label>
                          </>
                        ) : null}
                        <Button type="submit">Sign up</Button>
                      </form>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
