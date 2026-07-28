import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, asc, eq, gte } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { shifts, tasks } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { features } from '@/lib/config'
import { listOrgEntries, listTypes } from '@/lib/services/catalog'
import { getOrganizationLocations } from '@/lib/services/organization-locations'
import { getProfile } from '@/lib/services/profile'
import { Card, PageHeader, EmptyState, Flash } from '@/components/ui'
import { CatalogStatusBadge } from '@/components/CatalogStatusBadge'
import { OnboardingSessionPanel } from '@/components/organization/OnboardingSessionPanel'

export const dynamic = 'force-dynamic'

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const session = await requireRole('issuer')
  if (!features().catalog) notFound()

  const [entries, types, profile, locations] = await Promise.all([
    listOrgEntries(session.orgId!),
    listTypes(),
    getProfile(session.orgId!),
    getOrganizationLocations(session.orgId!),
  ])
  const typeName = new Map(types.map((t) => [t.id, t.name]))
  const approvalOn = features().catalogApproval
  const onboardingTask = profile?.onboardingTaskId
    ? (await db.select().from(tasks).where(and(eq(tasks.id, profile.onboardingTaskId), eq(tasks.orgId, session.orgId!))).limit(1))[0] ?? null
    : null
  const recurringOnboardingTask = onboardingTask?.startsAt.startsWith('Weekly ') ? onboardingTask : null
  const nextOnboardingShift = recurringOnboardingTask
    ? (await db
        .select({ startsAt: shifts.startsAt, endsAt: shifts.endsAt, capacity: shifts.capacity })
        .from(shifts)
        .where(and(eq(shifts.taskId, recurringOnboardingTask.id), gte(shifts.startsAt, Date.now())))
        .orderBy(asc(shifts.startsAt))
        .limit(1))[0] ?? null
    : null

  return (
    <>
      <OnboardingSessionPanel
        session={recurringOnboardingTask}
        nextShift={nextOnboardingShift}
        replacesTaskTitle={recurringOnboardingTask ? undefined : onboardingTask?.title}
        locations={locations}
      />
      <Card>
        <PageHeader
          title="Opportunity Catalog"
          subtitle={
            approvalOn
              ? 'Your reusable opportunity templates. Submit them for approval, then schedule opportunities from approved templates.'
              : 'Your reusable opportunity templates — create once, schedule as often as you need.'
          }
          action={
            <Link
              href="/issuer/catalog/new"
              className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              New template
            </Link>
          }
        />
        <Flash searchParams={searchParams} />

        {entries.length === 0 ? (
          <EmptyState
            title="No templates yet"
            body="Create a template for an opportunity you run, then schedule dated instances from it."
          />
        ) : (
          <div className="grid gap-4">
            {entries.map((e) => (
              <Card key={e.id} className="p-0 transition-colors hover:border-brand-300">
                <Link
                  href={`/issuer/catalog/${e.id}`}
                  className="flex items-center justify-between gap-3 px-6 py-4 hover:bg-ink-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-800">{e.title}</p>
                    <p className="text-xs text-ink-400">
                      {e.typeId && typeName.get(e.typeId) ? typeName.get(e.typeId) : 'No type'}
                      {e.location ? ` · ${e.location}` : ''}
                    </p>
                  </div>
                  <CatalogStatusBadge status={e.status} />
                </Link>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}
