import { Badge, Card, EmptyState, Mono } from '@/components/ui'
import { buildLookups, describeEvent } from '@/lib/ledger/describe'
import { fmtDateTime, shortHash } from '@/lib/format'
import { listOrganizationActivity } from '@/lib/services/organization-activity'

export async function OrganizationActivityLog({ orgId }: { orgId: string }) {
  const [activity, lookups] = await Promise.all([listOrganizationActivity(orgId), buildLookups()])

  if (activity.length === 0) {
    return <EmptyState title="No organization activity yet" body="Actions taken by this organization will appear here as an auditable record." />
  }

  return (
    <>
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold text-ink-900">{activity.length} recorded action{activity.length === 1 ? '' : 's'} · newest first</p>
          <Badge tone="green">Audit trail</Badge>
        </div>
      </Card>

      <div className="space-y-2">
        {activity.map((event) => (
          <Card key={event.seq} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-ink-800">
                  <span className="mr-2 font-mono text-xs text-ink-400">#{event.seq}</span>
                  {describeEvent(event.type, event.payload, event.actorId, lookups)}
                </p>
                <p className="mt-1 text-xs text-ink-400">{fmtDateTime(event.ts)} · by <span className="font-medium text-ink-600">{event.actorName}</span></p>
              </div>
              <Badge tone="gray">{event.type.replaceAll('_', ' ').toLowerCase()}</Badge>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-ink-400 hover:text-ink-600">Record detail</summary>
              <div className="mt-2 space-y-1 rounded-xl bg-ink-50 p-3">
                <p><Mono>hash: {shortHash(event.hash, 16)}</Mono></p>
                <p><Mono>actor: {event.actorId ?? 'system'}</Mono></p>
                <p><Mono>payload: {event.payload}</Mono></p>
              </div>
            </details>
          </Card>
        ))}
      </div>
    </>
  )
}
