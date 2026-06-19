import { desc } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { events, anchors } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { verifyChain } from '@/lib/ledger/ledger'
import { createAnchorAction } from '@/app/actions'
import { Card, PageHeader, StatCard, EmptyState, Flash, Button, Badge, Mono } from '@/components/ui'
import { fmtDateTime, shortHash } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  await requireRole('admin')

  const recentEvents = await db.select().from(events).orderBy(desc(events.seq)).limit(50)
  const anchorList = await db.select().from(anchors).orderBy(desc(anchors.createdAt)).limit(20)
  const brokenSeq = await verifyChain()

  return (
    <>
      <PageHeader
        title="Ledger & anchors"
        subtitle="The append-only, hash-chained system of record. Anchors commit Merkle roots for public verifiability."
        action={
          <form action={createAnchorAction}>
            <input type="hidden" name="redirectTo" value="/admin/ledger" />
            <Button type="submit">Create anchor</Button>
          </form>
        }
      />
      <Flash searchParams={searchParams} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Chain integrity"
          value={
            brokenSeq === null ? (
              <span className="text-emerald-600">intact</span>
            ) : (
              <span className="text-red-600">broken @ {brokenSeq}</span>
            )
          }
          hint="Every event re-hashed and verified"
        />
        <StatCard label="Total events" value={recentEvents.length > 0 ? recentEvents[0].seq : 0} />
        <StatCard label="Anchors" value={anchorList.length} hint={`Mode: ${process.env.ANCHOR_MODE ?? 'stub'}`} />
      </div>

      <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider text-ink-400">Anchors</h2>
      {anchorList.length === 0 ? (
        <EmptyState
          title="No anchors yet"
          body="Create an anchor to commit a Merkle root over all events since the last anchor."
        />
      ) : (
        <Card className="divide-y divide-ink-100 p-0">
          {anchorList.map((a) => (
            <div key={a.id} className="px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink-800">
                  Events {a.fromSeq}–{a.toSeq}{' '}
                  <span className="text-xs text-ink-400">({a.eventCount} events)</span>
                </p>
                <div className="flex items-center gap-2">
                  <Badge tone={a.txHash ? 'green' : 'gray'}>{a.network}</Badge>
                  <span className="text-xs text-ink-400">{fmtDateTime(a.createdAt)}</span>
                </div>
              </div>
              <p className="mt-1">
                <Mono>root: {a.merkleRoot}</Mono>
              </p>
              {a.txHash ? (
                <p className="mt-0.5">
                  <Mono>tx: {a.txHash}</Mono>
                </p>
              ) : null}
            </div>
          ))}
        </Card>
      )}

      <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider text-ink-400">
        Recent events (latest 50)
      </h2>
      <Card className="divide-y divide-ink-100 p-0">
        {recentEvents.map((e) => (
          <div key={e.seq} className="px-6 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink-800">
                <span className="mr-2 font-mono text-xs text-ink-400">#{e.seq}</span>
                {e.type}
              </p>
              <span className="text-xs text-ink-400">{fmtDateTime(e.ts)}</span>
            </div>
            <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-ink-400">{e.payload}</p>
            <p className="mt-0.5">
              <Mono>{shortHash(e.hash, 16)}</Mono>
            </p>
          </div>
        ))}
      </Card>
    </>
  )
}
