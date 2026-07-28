import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { tasks, orgs, redemptions, offerings, users, posts } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import {
  adminCloseTaskAction,
  adminCancelRedemptionAction,
  removePostAction,
  runRemindersAction,
  approveCityLaunchApplicationAction,
} from '@/app/actions'
import { Card, PageHeader, EmptyState, Flash, Button, Input, statusBadge, Badge } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'
import { participantDisplayName } from '@/lib/participant-name'
import { listCityLaunchApplicationsForAdmin } from '@/lib/services/city-launch'
import { getActiveCity } from '@/lib/services/city-networks'

export const dynamic = 'force-dynamic'

export default async function OversightPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const session = await requireRole('admin')
  const city = await getActiveCity(session)

  const [openTasks, pendingRedemptions, recentPosts, cityLaunchApplications] = await Promise.all([
    db
      .select({ task: tasks, org: orgs })
      .from(tasks)
      .innerJoin(orgs, eq(tasks.orgId, orgs.id))
      .where(city ? and(eq(tasks.status, 'open'), eq(tasks.cityId, city.id)) : eq(tasks.status, 'open'))
      .orderBy(desc(tasks.createdAt)),
    db
      .select({ redemption: redemptions, offering: offerings, org: orgs, participant: users })
      .from(redemptions)
      .innerJoin(offerings, eq(redemptions.offeringId, offerings.id))
      .innerJoin(orgs, eq(redemptions.orgId, orgs.id))
      .innerJoin(users, eq(redemptions.userId, users.id))
      .where(city ? and(eq(redemptions.status, 'pending'), eq(redemptions.cityId, city.id)) : eq(redemptions.status, 'pending'))
      .orderBy(desc(redemptions.createdAt)),
    db
      .select({ post: posts, org: orgs })
      .from(posts)
      .innerJoin(orgs, eq(posts.orgId, orgs.id))
      .where(city ? eq(orgs.requestedCityId, city.id) : undefined)
      .orderBy(desc(posts.createdAt))
      .limit(25),
    listCityLaunchApplicationsForAdmin(),
  ])

  return (
    <>
      <PageHeader
        title="Oversight"
        subtitle={city ? `Manage opportunities, redemptions, and feed moderation in ${city.name}. City launch applications remain network-wide.` : 'Choose a city network to manage local activity.'}
      />
      <Flash searchParams={searchParams} />

      <Card className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-800">Reminders & attendance</p>
          <p className="text-xs text-ink-400">
            Deliver due shift confirmations and pre-shift reminders, and record overdue onboarding no-shows. In production a cron hits{' '}
            <code className="font-mono">/api/cron/reminders</code> on a schedule.
          </p>
        </div>
        <form action={runRemindersAction}>
          <input type="hidden" name="redirectTo" value="/admin/oversight" />
          <Button type="submit" variant="secondary">
            Process reminders & attendance
          </Button>
        </form>
      </Card>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">
        City launch applications ({cityLaunchApplications.length})
      </h2>
      {cityLaunchApplications.length === 0 ? (
        <EmptyState title="No city launch applications" body="Approved issuer organizations can request City/Sync for another physical location." />
      ) : (
        <div className="space-y-3">
          {cityLaunchApplications.map(({ application, sponsor, bootstrapUser }) => (
            <Card key={application.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-ink-900">{application.cityName}</p>{statusBadge(application.status)}</div>
                  <p className="mt-1 text-sm text-ink-600">Sponsor: {sponsor.name} · submitted by {participantDisplayName(bootstrapUser)}</p>
                  <p className="mt-1 text-sm text-ink-600">Proposed local owner: {application.proposedOwnerName} · {application.proposedOwnerEmail}</p>
                  {application.cityDescription ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-500">{application.cityDescription}</p> : null}
                  {application.status === 'awaiting_owner' ? <p className="mt-3 text-xs font-medium text-brand-700">City database provisioned. The sponsor can now share the owner-claim link.</p> : null}
                  {application.status === 'owner_assigned' ? <p className="mt-3 text-xs font-medium text-emerald-700">The city-local owner has claimed this organization.</p> : null}
                </div>
                {application.status === 'submitted' ? (
                  <form action={approveCityLaunchApplicationAction}>
                    <input type="hidden" name="applicationId" value={application.id} />
                    <input type="hidden" name="redirectTo" value="/admin/oversight" />
                    <Button type="submit">Approve &amp; Provision</Button>
                  </form>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">
        Open opportunities ({openTasks.length})
      </h2>
      {openTasks.length === 0 ? (
        <EmptyState title="No open opportunities" />
      ) : (
        <Card className="divide-y divide-ink-100 p-0">
          {openTasks.map(({ task, org }) => (
            <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div>
                <p className="text-sm font-semibold text-ink-800">{task.title}</p>
                <p className="text-xs text-ink-400">
                  {org.name} · {task.credits} credits · {task.slots} slot{task.slots === 1 ? '' : 's'}
                </p>
              </div>
              <form action={adminCloseTaskAction}>
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="redirectTo" value="/admin/oversight" />
                <Button type="submit" variant="danger">
                  Close
                </Button>
              </form>
            </div>
          ))}
        </Card>
      )}

      <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider text-ink-400">
        Pending redemptions ({pendingRedemptions.length})
      </h2>
      {pendingRedemptions.length === 0 ? (
        <EmptyState title="No pending redemptions" />
      ) : (
        <Card className="divide-y divide-ink-100 p-0">
          {pendingRedemptions.map(({ redemption, offering, org, participant }) => (
            <div key={redemption.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div>
                <p className="text-sm font-semibold text-ink-800">
                  {offering.title} · {participantDisplayName(participant)}
                </p>
                <p className="text-xs text-ink-400">
                  {org.name} · {redemption.cost} credits · code{' '}
                  <span className="font-mono">{redemption.code}</span> · {fmtDateTime(redemption.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {statusBadge(redemption.status)}
                <form action={adminCancelRedemptionAction}>
                  <input type="hidden" name="redemptionId" value={redemption.id} />
                  <input type="hidden" name="redirectTo" value="/admin/oversight" />
                  <Button type="submit" variant="danger">
                    Cancel
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </Card>
      )}

      <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider text-ink-400">
        MyCity Feed moderation (latest {recentPosts.length})
      </h2>
      {recentPosts.length === 0 ? (
        <EmptyState title="No posts yet" />
      ) : (
        <div className="space-y-3">
          {recentPosts.map(({ post, org }) => (
            <Card key={post.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-800">
                    {org.name} <Badge tone={org.type === 'issuer' ? 'blue' : 'gold'}>{org.type}</Badge>
                  </p>
                  <p className="text-xs text-ink-400">{fmtDateTime(post.createdAt)}</p>
                  <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-ink-600">{post.body}</p>
                </div>
                <form action={removePostAction} className="flex items-end gap-2">
                  <input type="hidden" name="postId" value={post.id} />
                  <input type="hidden" name="redirectTo" value="/admin/oversight" />
                  <div className="w-44">
                    <Input name="reason" placeholder="Reason (ledgered)" />
                  </div>
                  <Button type="submit" variant="danger">
                    Remove
                  </Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
