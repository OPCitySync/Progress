import { verifyCityChainDetailed } from '@/lib/ledger/city-ledger'
import { flushCityLedgerOutbox } from '@/lib/ledger/city-outbox'
import { buildLookups, describeEvent } from '@/lib/ledger/describe'
import { Card, Badge, Mono } from '@/components/ui'
import { fmtDateTime, shortHash } from '@/lib/format'

export async function VerificationLog({ cityId }: { cityId: string }) {
  await flushCityLedgerOutbox(cityId)
  const { events, intact, firstBrokenSeq } = await verifyCityChainDetailed(cityId)
  const lookups = await buildLookups()
  const newestFirst = [...events].reverse()

  return (
    <>
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold text-ink-900">{events.length} events verified · newest first</p>
          {intact ? <Badge tone="green">✓ entire chain intact</Badge> : <Badge tone="red">✗ chain broken at event #{firstBrokenSeq}</Badge>}
        </div>
      </Card>

      <div className="space-y-2">
        {newestFirst.map((event) => {
          const valid = event.hashValid && event.linkValid
          return (
            <Card key={event.seq} className={valid ? 'p-4' : 'border-red-300 bg-red-50 p-4'}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-ink-800">
                    <span className="mr-2 font-mono text-xs text-ink-400">#{event.seq}</span>
                    {describeEvent(event.type, event.payload, event.actorId, lookups)}
                  </p>
                  <p className="mt-1 text-xs text-ink-400">{fmtDateTime(event.ts)} · <span className="font-mono">{event.type}</span></p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge tone={event.hashValid ? 'green' : 'red'}>{event.hashValid ? '✓ hash' : '✗ hash'}</Badge>
                  <Badge tone={event.linkValid ? 'green' : 'red'}>{event.linkValid ? '✓ chain' : '✗ chain'}</Badge>
                </div>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-ink-400 hover:text-ink-600">Proof detail</summary>
                <div className="mt-2 space-y-1 rounded-xl bg-ink-50 p-3">
                  <p><Mono>hash: {event.hash}</Mono></p>
                  <p><Mono>prev: {shortHash(event.prevHash, 16)}</Mono></p>
                  <p><Mono>payload: {event.payload}</Mono></p>
                </div>
              </details>
            </Card>
          )
        })}
      </div>
    </>
  )
}
