import Link from 'next/link'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { claims, tasks, shifts, orgs } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { submitCompletionAction, unclaimClaimAction } from '@/app/actions'
import { Card, StatCard, statusBadge, EmptyState, Flash, Button, Textarea } from '@/components/ui'
import { fmtDate, fmtDateTime } from '@/lib/format'
import { getActiveCity } from '@/lib/services/city-networks'
import { getMyResume } from '@/lib/services/resume'
import { CommitmentCalendar } from '@/components/participant/CommitmentCalendar'

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
  searchParams: { error?: string; ok?: string; commitmentView?: string; week?: string }
}) {
  const session = await requireRole('participant')
  const [city, resume] = await Promise.all([getActiveCity(session), getMyResume(session.sub)])
  const myClaims = await db
    .select({ claim: claims, task: tasks, org: orgs, shift: shifts })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .innerJoin(orgs, eq(tasks.orgId, orgs.id))
    .leftJoin(shifts, eq(claims.shiftId, shifts.id))
    .where(and(eq(claims.userId, session.sub), ...(city ? [eq(tasks.cityId, city.id)] : [])))
    .orderBy(desc(claims.updatedAt))

  const active = myClaims.filter((c) => c.claim.status === 'claimed' || c.claim.status === 'submitted')
  const verified = myClaims.filter((c) => c.claim.status === 'verified')
  const verifiedCount = verified.length
  const participation = city?.participation?.status
  const commitmentView = searchParams.commitmentView === 'calendar' ? 'calendar' : 'list'

  return (
    <>
      <Card className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="skeuo-page-title font-display text-2xl font-semibold text-ink-900">Home</h1>
            <p className="mt-1 text-sm text-ink-500">
              {city
                ? `Welcome back, ${session.name.split(' ')[0]}. ${participation === 'new' ? `Your next step in ${city.name} is local onboarding.` : `Your local service in ${city.name}.`}`
                : `Welcome back, ${session.name.split(' ')[0]}. Choose a city network to begin participating.`}
            </p>
          </div>
          {!city ? (
            <Link href="/workspace/cities" className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
              Choose a city
            </Link>
          ) : participation === 'new' ? (
            <Link href="/participant/opportunities" className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
              Find onboarding
            </Link>
          ) : participation === 'active' ? (
            <Link href={active[0] ? `/participant/opportunities/${active[0].task.id}` : '/participant/opportunities'} className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
              {active[0] ? 'View next commitment' : 'Browse opportunities'}
            </Link>
          ) : null}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Active commitments" value={active.length} />
          <StatCard label="Verified contributions" value={verifiedCount} />
          <StatCard label="Organizations" value={resume?.totals.organizations ?? 0} />
        </div>
      </Card>
      <Flash searchParams={searchParams} />

      {city?.participation ? (
        <Card className="mb-6 border-brand-200 bg-brand-50">
          <p className="text-sm font-semibold text-ink-800">
            {city.participation.status === 'active'
              ? `City Member · ${city.name}`
              : city.participation.status === 'barred'
                ? `Participation restricted · ${city.name}`
                : `New Participant · ${city.name}`}
          </p>
          <p className="mt-1 text-sm text-ink-600">
            {city.participation.status === 'active'
              ? 'Your on-site onboarding attendance has been verified. You can reserve open opportunities in this city.'
              : city.participation.status === 'barred'
                ? `You can join this city again after ${city.participation.barredUntil ? fmtDate(city.participation.barredUntil) : 'the restriction period'}.`
                : `Complete one onboarding task with a verified on-site check-in to become a City Member. ${3 - city.participation.noShowCount} onboarding attempt${3 - city.participation.noShowCount === 1 ? '' : 's'} remain.`}
          </p>
          {city.participation.status === 'new' ? (
            <Link href="/participant/opportunities" className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:text-brand-600">
              Find an onboarding session →
            </Link>
          ) : null}
        </Card>
      ) : !city ? (
        <Card className="mb-6 border-brand-200 bg-brand-50">
          <p className="text-sm font-semibold text-ink-800">Choose a city network to get started</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">
            City membership and opportunities are local. You can add another city whenever you are able to participate there.
          </p>
        </Card>
      ) : null}

      <div className="mb-3 mt-9 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Your commitments</h2>
        <nav aria-label="Commitment view" className="inline-flex rounded-xl border border-ink-200 bg-ink-50 p-1 shadow-inner">
          <Link
            href="/participant"
            className={
              commitmentView === 'list'
                ? 'rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm'
                : 'rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-500 hover:text-ink-800'
            }
          >
            List View
          </Link>
          <Link
            href="/participant?commitmentView=calendar"
            className={
              commitmentView === 'calendar'
                ? 'rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm'
                : 'rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-500 hover:text-ink-800'
            }
          >
            Calendar View
          </Link>
        </nav>
      </div>
      {commitmentView === 'calendar' ? (
        <CommitmentCalendar
          week={searchParams.week}
          commitments={active.map(({ claim, task, org, shift }) => ({
            id: claim.id,
            taskId: task.id,
            taskTitle: task.title,
            organizationName: org.name,
            startsAt: shift?.startsAt ?? null,
            endsAt: shift?.endsAt ?? null,
            label: shift?.label ?? '',
            status: claim.status === 'submitted' ? 'submitted' : 'claimed',
          }))}
        />
      ) : active.length === 0 ? (
        <EmptyState
          title={participation === 'new' ? 'Start with local onboarding' : 'No active commitments'}
          body={participation === 'new' ? 'Reserve one onboarding session to become a City Member and unlock local opportunities.' : 'Reserve an opportunity when you are ready to get involved.'}
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
                    {org.name}{whenLabel(shift) ? ` · ${whenLabel(shift)}` : ''}
                  </p>
                </div>
                {statusBadge(claim.status)}
              </div>
              {claim.status === 'claimed' ? (
                <div className="mt-4 border-t border-ink-100 pt-4">
                  {shift ? (
                    <>
                      <p className="text-sm leading-relaxed text-ink-600">
                        Your spot is reserved. Check in on site when your shift begins.
                      </p>
                      <Link href={`/participant/opportunities/${task.id}`} className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:text-brand-600">
                        View commitment details →
                      </Link>
                    </>
                  ) : (
                    <form action={submitCompletionAction} className="space-y-3">
                      <input type="hidden" name="claimId" value={claim.id} />
                      <input type="hidden" name="redirectTo" value="/participant" />
                      <Textarea
                        name="note"
                        rows={2}
                        placeholder="Optional note for the organization (what you did, when, with whom)…"
                      />
                      <div className="flex items-center gap-3">
                        <Button type="submit">Request completion verification</Button>
                      </div>
                    </form>
                  )}
                  <form action={unclaimClaimAction} className="mt-2">
                    <input type="hidden" name="claimId" value={claim.id} />
                    <input type="hidden" name="redirectTo" value="/participant" />
                    <button className="text-xs font-medium text-ink-400 hover:text-red-600">
                      Withdraw sign-up (up to 24 hours ahead)
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

      {verified.length > 0 ? (
        <section>
          <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider text-ink-400">Recent service</h2>
        <Card className="divide-y divide-ink-100 p-0">
          {verified.slice(0, 5).map(({ claim, task, org }) => (
            <div key={claim.id} className="flex items-center justify-between gap-3 px-6 py-4">
              <div>
                <p className="text-sm font-medium text-ink-800">{task.title}</p>
                <p className="text-xs text-ink-400">
                  {org.name} · {fmtDate(claim.updatedAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {statusBadge(claim.status)}
              </div>
            </div>
          ))}
        </Card>
        </section>
      ) : null}
    </>
  )
}
