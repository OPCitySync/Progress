import Link from 'next/link'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { tasks, claims, users, orgs, shifts } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { verifyClaimAction, rejectClaimAction } from '@/app/actions'
import { Card, StatCard, EmptyState, Flash, Button, statusBadge } from '@/components/ui'
import { OrgStatusBanner } from '@/components/OrgStatusBanner'
import { fmtDateTime } from '@/lib/format'
import { getActiveCity } from '@/lib/services/city-networks'
import { participantDisplayName } from '@/lib/participant-name'
import { IssuerOpportunityStatusControl } from '@/components/organization/IssuerOpportunityStatusControl'
import { WeeklyShiftCalendar } from '@/components/organization/WeeklyShiftCalendar'

export default async function IssuerDashboard({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string; week?: string }
}) {
  const session = await requireRole('issuer')
  const orgId = session.orgId!
  const city = await getActiveCity(session)

  const org = (await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1))[0]
  const myTasks = city
    ? await db.select().from(tasks).where(and(eq(tasks.orgId, orgId), eq(tasks.cityId, city.id))).orderBy(desc(tasks.createdAt))
    : []

  const [submissions, scheduledShifts] = await Promise.all([
    db
    .select({ claim: claims, task: tasks, participant: users })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .innerJoin(users, eq(claims.userId, users.id))
    .where(city ? sql`${tasks.orgId} = ${orgId} AND ${tasks.cityId} = ${city.id} AND ${claims.status} = 'submitted'` : sql`0`)
    .orderBy(desc(claims.updatedAt)),
    city
      ? db
          .select({
            id: shifts.id,
            taskId: tasks.id,
            taskTitle: tasks.title,
            startsAt: shifts.startsAt,
            endsAt: shifts.endsAt,
            label: shifts.label,
            capacity: shifts.capacity,
            status: shifts.status,
          })
          .from(shifts)
          .innerJoin(tasks, eq(shifts.taskId, tasks.id))
          .where(and(eq(shifts.orgId, orgId), eq(tasks.orgId, orgId), eq(tasks.cityId, city.id)))
          .orderBy(asc(shifts.startsAt), asc(shifts.createdAt))
      : Promise.resolve([]),
  ])

  const [verifiedStats] = await db
    .select({ n: sql<number>`count(*)`, credits: sql<number>`coalesce(sum(${tasks.credits}), 0)` })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .where(city ? sql`${tasks.orgId} = ${orgId} AND ${tasks.cityId} = ${city.id} AND ${claims.status} = 'verified'` : sql`0`)

  const openTasks = myTasks.filter((t) => t.status === 'open')

  return (
    <>
      <Card className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="skeuo-page-title font-display text-2xl font-semibold text-ink-900">Overview</h1>
            <p className="mt-1 text-sm text-ink-500">Schedule opportunities, verify completions, recognize contributions.</p>
          </div>
          <Link
            href="/issuer/catalog"
            className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            New opportunity
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Open opportunities" value={openTasks.length} />
          <StatCard label="Awaiting verification" value={submissions.length} />
          <StatCard
            label="Credits minted"
            value={Number(verifiedStats?.credits ?? 0)}
            hint={`${Number(verifiedStats?.n ?? 0)} verified completions`}
          />
        </div>
      </Card>
      <WeeklyShiftCalendar week={searchParams.week} shifts={scheduledShifts} />
      <OrgStatusBanner status={org?.status ?? 'pending'} />
      <Flash searchParams={searchParams} />

      <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider text-ink-400">
        Awaiting verification
      </h2>
      {submissions.length === 0 ? (
        <EmptyState title="Nothing to verify" body="Submitted completions from participants appear here." />
      ) : (
        <div className="space-y-3">
          {submissions.map(({ claim, task, participant }) => (
            <Card key={claim.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-800">
                    {participantDisplayName(participant)} · {task.title}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    Submitted {fmtDateTime(claim.updatedAt)} · {task.credits} credits on verification
                  </p>
                  {claim.note ? (
                    <p className="mt-2 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-600">“{claim.note}”</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <form action={verifyClaimAction}>
                    <input type="hidden" name="claimId" value={claim.id} />
                    <input type="hidden" name="redirectTo" value="/issuer" />
                    <Button type="submit">Verify & mint</Button>
                  </form>
                  <form action={rejectClaimAction}>
                    <input type="hidden" name="claimId" value={claim.id} />
                    <input type="hidden" name="redirectTo" value="/issuer" />
                    <Button type="submit" variant="danger">
                      Reject
                    </Button>
                  </form>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider text-ink-400">
        Your opportunities
      </h2>
      {myTasks.length === 0 ? (
        <EmptyState title="No opportunities yet" body="Publish your first opportunity to get started." />
      ) : (
        <Card className="divide-y divide-ink-100 p-0">
          {myTasks.map((task) => (
            <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div>
                <Link
                  href={`/issuer/tasks/${task.id}`}
                  className="text-sm font-semibold text-ink-800 hover:text-brand-600"
                >
                  {task.title}
                </Link>
                <p className="text-xs text-ink-400">{task.credits} credits per completion · manage shifts →</p>
              </div>
              <div className="flex items-center gap-3">
                {statusBadge(task.status)}
                <IssuerOpportunityStatusControl taskId={task.id} taskTitle={task.title} status={task.status} />
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  )
}
