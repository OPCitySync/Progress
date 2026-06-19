import Link from 'next/link'
import { getSession, homeFor } from '@/lib/auth/session'
import { getPublicStats } from '@/lib/services/stats'
import { verifyChain } from '@/lib/ledger/ledger'
import { Logo } from '@/components/brand/Logo'
import { Card, StatCard, Badge, Mono, EmptyState } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function TransparencyPage() {
  const session = await getSession()
  const stats = await getPublicStats()
  const brokenSeq = await verifyChain()

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="bg-brand-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Logo variant="light" size={26} href="/" />
          <Link
            href={session ? homeFor(session.role) : '/login'}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            {session ? 'Back to app' : 'Sign in'}
          </Link>
        </div>
        <div className="mx-auto max-w-5xl px-6 pb-10">
          <h1 className="font-display text-3xl font-semibold text-white">Public ledger</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
            Every credit minted, redeemed, and every waiver accepted is an event on an append-only,
            hash-chained ledger. Periodic anchors commit Merkle roots of the event history, so the
            record can be independently verified — the operator cannot quietly rewrite the past.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Civic participants" value={stats.participants} />
          <StatCard label="Issuer organizations" value={stats.issuers} />
          <StatCard label="Redeemer organizations" value={stats.redeemers} />
          <StatCard label="Verified contributions" value={stats.verifiedCompletions} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Credits minted" value={stats.creditsMinted} hint="Total issued, ever" />
          <StatCard label="Credits outstanding" value={stats.creditsOutstanding} hint="Currently held" />
          <StatCard label="Credits burned" value={stats.creditsBurned} hint="Redeemed and extinguished" />
          <StatCard label="Ledger events" value={stats.ledgerEvents} />
        </div>

        <Card className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-ink-900">Ledger integrity</p>
              <p className="mt-1 text-sm text-ink-500">
                The full hash chain is re-verified on every load of this page.{' '}
                <Link href="/transparency/log" className="font-semibold text-brand-600 hover:text-brand-500">
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

        <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wider text-ink-400">
          Anchors
        </h2>
        {stats.anchors.length === 0 ? (
          <EmptyState
            title="No anchors published yet"
            body="Anchors commit a Merkle root over the event history. Once anchoring to Base is enabled, each anchor links to a public transaction."
          />
        ) : (
          <Card className="divide-y divide-ink-100 p-0">
            {stats.anchors.map((a) => (
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
                  <Mono>merkle root: {a.merkleRoot}</Mono>
                </p>
              </div>
            ))}
          </Card>
        )}

        <p className="mt-10 text-center text-xs text-ink-400">
          City/Sync pilot · non-transferable civic credits · no speculation, by design
        </p>
      </main>
    </div>
  )
}
