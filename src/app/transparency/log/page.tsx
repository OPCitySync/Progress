import Link from 'next/link'
import { getSession, homeFor } from '@/lib/auth/session'
import { verifyChainDetailed } from '@/lib/ledger/ledger'
import { buildLookups, describeEvent } from '@/lib/ledger/describe'
import { Logo } from '@/components/brand/Logo'
import { Card, Badge, Mono } from '@/components/ui'
import { fmtDateTime, shortHash } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function VerificationLogPage() {
  const session = await getSession()
  const { events, intact, firstBrokenSeq } = await verifyChainDetailed()
  const lookups = await buildLookups()
  const newestFirst = [...events].reverse()

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
          <Link href="/transparency" className="text-sm text-white/50 hover:text-white">
            ← Public ledger
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold text-white">Verification log</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
            Every event below was re-verified just now: its hash is recomputed from its contents
            (✓ hash), and its link to the previous event is checked (✓ chain). Change any historical
            record and the chain visibly breaks from that point forward.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold text-ink-900">
              {events.length} events verified · newest first
            </p>
            {intact ? (
              <Badge tone="green">✓ entire chain intact</Badge>
            ) : (
              <Badge tone="red">✗ chain broken at event #{firstBrokenSeq}</Badge>
            )}
          </div>
        </Card>

        <div className="space-y-2">
          {newestFirst.map((e) => {
            const valid = e.hashValid && e.linkValid
            return (
              <Card key={e.seq} className={valid ? 'p-4' : 'border-red-300 bg-red-50 p-4'}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-800">
                      <span className="mr-2 font-mono text-xs text-ink-400">#{e.seq}</span>
                      {describeEvent(e.type, e.payload, e.actorId, lookups)}
                    </p>
                    <p className="mt-1 text-xs text-ink-400">
                      {fmtDateTime(e.ts)} · <span className="font-mono">{e.type}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge tone={e.hashValid ? 'green' : 'red'}>
                      {e.hashValid ? '✓ hash' : '✗ hash'}
                    </Badge>
                    <Badge tone={e.linkValid ? 'green' : 'red'}>
                      {e.linkValid ? '✓ chain' : '✗ chain'}
                    </Badge>
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-ink-400 hover:text-ink-600">
                    Proof detail
                  </summary>
                  <div className="mt-2 space-y-1 rounded-xl bg-ink-50 p-3">
                    <p>
                      <Mono>hash: {e.hash}</Mono>
                    </p>
                    <p>
                      <Mono>prev: {shortHash(e.prevHash, 16)}</Mono>
                    </p>
                    <p>
                      <Mono>payload: {e.payload}</Mono>
                    </p>
                  </div>
                </details>
              </Card>
            )
          })}
        </div>
      </main>
    </div>
  )
}
