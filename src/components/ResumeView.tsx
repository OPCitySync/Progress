import Link from 'next/link'
import { Card, StatCard, Badge, EmptyState } from '@/components/ui'
import { fmtDate } from '@/lib/format'
import type { ResumeData, ResumeContribution } from '@/lib/services/resume'

function whenText(c: ResumeContribution): string {
  if (c.when) return fmtDate(c.when)
  if (c.whenLabel) return c.whenLabel
  return fmtDate(c.verifiedAt)
}

/** Shared render of a volunteer's verified contribution record. */
export function ResumeView({
  data,
  embedded = false,
  showCredits = true,
  showSummary = true,
}: {
  data: ResumeData
  /** Use a subordinate heading when the résumé is part of the participant Home page. */
  embedded?: boolean
  /** Credits remain stored, but are intentionally hidden in the participant MVP dashboard. */
  showCredits?: boolean
  /** The private Service History page keeps its summary metrics on Home instead. */
  showSummary?: boolean
}) {
  const Heading = embedded ? 'h2' : 'h1'
  return (
    <div>
      {showSummary ? (
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Heading className={`font-display font-semibold text-ink-900 ${embedded ? 'text-xl' : 'text-3xl'}`}>{embedded ? 'My service resume' : data.name}</Heading>
              <p className="mt-1 text-sm text-ink-500">Civic contributor since {fmtDate(data.joinedAt)}</p>
            </div>
            <Badge tone="green">Ledger-verified</Badge>
          </div>

          <div className={`mt-6 grid gap-4 sm:grid-cols-2 ${showCredits ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
            <StatCard label="Verified contributions" value={data.totals.contributions} />
            <StatCard label="Volunteer hours" value={data.totals.hours} />
            <StatCard label="Organizations" value={data.totals.organizations} />
            {showCredits ? <StatCard label="Civic credits earned" value={data.totals.credits} /> : null}
          </div>
        </Card>
      ) : null}

      <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider text-ink-400">Contribution history</h2>
      {data.contributions.length === 0 ? (
        <EmptyState title="No verified contributions yet" body="Completed and verified work will appear here." />
      ) : (
        <Card className="divide-y divide-ink-100 p-0">
          {data.contributions.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div>
                <p className="text-sm font-semibold text-ink-800">{c.opportunity}</p>
                <p className="text-xs text-ink-400">
                  {c.orgSlug ? (
                    <Link href={`/orgs/${c.orgSlug}`} className="hover:text-brand-600">
                      {c.org}
                    </Link>
                  ) : (
                    c.org
                  )}{' '}
                  · {whenText(c)}
                  {c.hours != null ? ` · ${c.hours}h` : ''}
                </p>
              </div>
              {showCredits ? <span className="text-sm font-semibold text-emerald-600">+{c.credits}</span> : null}
            </div>
          ))}
        </Card>
      )}

      <Card className="mt-6 border-brand-200 bg-brand-50">
        <p className="text-sm font-semibold text-ink-800">Independently verifiable</p>
        <p className="mt-1 text-sm text-ink-600">
          Every contribution here was verified by the issuing organization and recorded on City/Sync’s tamper-evident
          public ledger.{' '}
          <Link href="/transparency" className="font-semibold text-brand-600 hover:text-brand-500">
            See the public ledger →
          </Link>
        </p>
      </Card>
    </div>
  )
}
