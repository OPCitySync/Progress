import Link from 'next/link'
import { getCityFinanceStats } from '@/lib/services/city-wallets'
import { verifyCityChain } from '@/lib/ledger/city-ledger'
import { flushCityLedgerOutbox } from '@/lib/ledger/city-outbox'
import { Card, StatCard, Badge, Mono, EmptyState } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'
import type { ReactNode } from 'react'

export async function LedgerOverview({
  logHref,
  cityId,
  cityName,
  overviewHeader,
}: {
  logHref: string
  cityId: string
  cityName: string
  overviewHeader?: ReactNode
}) {
  // The scheduled drain handles routine delivery. Draining here also makes a
  // public-ledger visit self-healing after a transient city database outage.
  await flushCityLedgerOutbox(cityId)
  const stats = await getCityFinanceStats(cityId)
  const brokenSeq = await verifyCityChain(cityId)

  const summary = (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="City wallets" value={stats.wallets} hint={`${cityName} ledger accounts`} />
        <StatCard label="Credits minted" value={stats.creditsMinted} hint={`Issued in ${cityName}`} />
        <StatCard label="Credits outstanding" value={stats.creditsOutstanding} hint="Currently held" />
        <StatCard label="Credits burned" value={stats.creditsBurned} hint="Redeemed in this city" />
        <StatCard label="Ledger events" value={stats.ledgerEvents} />
      </div>

      <Card className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-ink-900">Ledger integrity</p>
            <p className="mt-1 text-sm text-ink-500">
              The full hash chain is re-verified on every load of this page.{' '}
              <Link href={logHref} className="font-semibold text-brand-600 hover:text-brand-500">
                View the per-event verification log →
              </Link>
            </p>
          </div>
          {brokenSeq === null ? (
            <Badge tone="green">chain intact · {stats.ledgerEvents} events verified</Badge>
          ) : (
            <Badge tone="red">chain broken at event #{brokenSeq}</Badge>
          )}
        </div>
      </Card>
    </>
  )

  return (
    <>
      {overviewHeader ? <Card className="mb-6">{overviewHeader}{summary}</Card> : summary}

      <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wider text-ink-400">Anchors</h2>
      {stats.anchors.length === 0 ? (
        <EmptyState
          title="No anchors published yet"
          body="Anchors commit a Merkle root over the event history. Once anchoring to Base is enabled, each anchor links to a public transaction."
        />
      ) : (
        <Card className="divide-y divide-ink-100 p-0">
          {stats.anchors.map((anchor) => (
            <div key={anchor.id} className="px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink-800">
                  Events {anchor.fromSeq}–{anchor.toSeq}{' '}
                  <span className="text-xs text-ink-400">({anchor.eventCount} events)</span>
                </p>
                <div className="flex items-center gap-2">
                  <Badge tone={anchor.txHash ? 'green' : 'gray'}>{anchor.network}</Badge>
                  <span className="text-xs text-ink-400">{fmtDateTime(anchor.createdAt)}</span>
                </div>
              </div>
              <p className="mt-1"><Mono>merkle root: {anchor.merkleRoot}</Mono></p>
            </div>
          ))}
        </Card>
      )}

      <p className="mt-10 text-center text-xs text-ink-400">{cityName} · City/Sync civic credits remain inside this city’s independent ledger.</p>
    </>
  )
}
