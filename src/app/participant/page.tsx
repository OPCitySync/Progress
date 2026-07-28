import Link from 'next/link'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { claims, tasks, shifts, orgs } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { getMessagesForUser, markAllMessagesRead } from '@/lib/services/roster'
import { getNotifications, markNotificationsRead } from '@/lib/services/notifications'
import { setResumePublicAction, submitCompletionAction, unclaimClaimAction } from '@/app/actions'
import { Card, StatCard, statusBadge, EmptyState, Flash, Button, Textarea, Badge, Mono } from '@/components/ui'
import { fmtDate, fmtDateTime } from '@/lib/format'
import { getActiveCity } from '@/lib/services/city-networks'
import { getMyResume } from '@/lib/services/resume'
import { ResumeView } from '@/components/ResumeView'

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
  const past = myClaims.filter((c) => c.claim.status === 'verified' || c.claim.status === 'rejected' || c.claim.status === 'no_show')
  const verifiedCount = past.filter((c) => c.claim.status === 'verified').length

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
      <Card className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="skeuo-page-title font-display text-2xl font-semibold text-ink-900">Home</h1>
            <p className="mt-1 text-sm text-ink-500">
              {city ? `Welcome back, ${session.name.split(' ')[0]}. Your civic contributions in ${city.name}.` : `Welcome back, ${session.name.split(' ')[0]}. Add a city to begin participating.`}
            </p>
          </div>
          <Link
            href="/participant/opportunities"
            className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Browse opportunities
          </Link>
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
              ? `Active Participant · ${city.name}`
              : city.participation.status === 'barred'
                ? `Participation restricted · ${city.name}`
                : `New Participant · ${city.name}`}
          </p>
          <p className="mt-1 text-sm text-ink-600">
            {city.participation.status === 'active'
              ? 'Your on-site onboarding attendance has been verified. You can reserve open opportunities in this city.'
              : city.participation.status === 'barred'
                ? `You can join this city again after ${city.participation.barredUntil ? fmtDate(city.participation.barredUntil) : 'the restriction period'}.`
                : `Complete one onboarding task with a verified on-site check-in to activate this city. ${3 - city.participation.noShowCount} onboarding attempt${3 - city.participation.noShowCount === 1 ? '' : 's'} remain.`}
          </p>
        </Card>
      ) : null}

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
          body="Claim an opportunity to start making a difference."
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
                {statusBadge(claim.status)}
              </div>
            </div>
          ))}
        </Card>
      )}

      {resume ? (
        <section className="mt-10">
          <Card className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink-800">Share link</p>
                  <Badge tone={resume.isPublic ? 'green' : 'gray'}>{resume.isPublic ? 'Public' : 'Private'}</Badge>
                </div>
                {resume.isPublic && resume.token ? (
                  <p className="mt-1 text-sm">
                    <a href={`/resume/${resume.token}`} target="_blank" className="text-brand-600 hover:text-brand-500">
                      <Mono>{`${process.env.APP_URL ?? ''}/resume/${resume.token}` || `/resume/${resume.token}`}</Mono>
                    </a>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-ink-500">Your résumé is private. Make it public to get a share link.</p>
                )}
              </div>
              <form action={setResumePublicAction}>
                <input type="hidden" name="public" value={resume.isPublic ? 'false' : 'true'} />
                <input type="hidden" name="redirectTo" value="/participant" />
                <Button type="submit" variant={resume.isPublic ? 'secondary' : 'primary'}>
                  {resume.isPublic ? 'Make private' : 'Make shareable'}
                </Button>
              </form>
            </div>
          </Card>
          <ResumeView data={resume} embedded showCredits={false} />
        </section>
      ) : null}
    </>
  )
}
