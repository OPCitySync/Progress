import Link from 'next/link'
import { clsx } from 'clsx'
import { PublicHeader } from '@/components/profile/PublicHeader'
import { Card, Badge, EmptyState } from '@/components/ui'
import { listPublicIssuers } from '@/lib/services/profile'

export const dynamic = 'force-dynamic'

export default async function OrgDirectoryPage({
  searchParams,
}: {
  searchParams: { q?: string; cause?: string }
}) {
  const q = searchParams.q?.trim() ?? ''
  const cause = searchParams.cause?.trim() || undefined

  // One search-scoped query; derive cause chips from it, then filter by cause.
  const all = await listPublicIssuers({ search: q })
  const causes = Array.from(new Set(all.flatMap((e) => e.causes))).sort()
  const entries = cause ? all.filter((e) => e.causes.includes(cause)) : all

  const qs = (next: { q?: string; cause?: string }) => {
    const p = new URLSearchParams()
    const qq = next.q ?? q
    const cc = 'cause' in next ? next.cause : cause
    if (qq) p.set('q', qq)
    if (cc) p.set('cause', cc)
    const s = p.toString()
    return s ? `/orgs?${s}` : '/orgs'
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <PublicHeader />

      <div className="bg-brand-900">
        <div className="mx-auto max-w-5xl px-6 pb-10 pt-8">
          <h1 className="font-display text-3xl font-semibold text-white">Discover organizations</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
            Local organizations on City/Sync. Explore their work, find volunteer opportunities, and start
            contributing in your community.
          </p>
          <form action="/orgs" method="get" className="mt-6 flex max-w-md gap-2">
            {cause ? <input type="hidden" name="cause" value={cause} /> : null}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search organizations…"
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
            />
            <button className="rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-semibold text-brand-900 hover:bg-gold-400">
              Search
            </button>
          </form>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {causes.length > 0 ? (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <Link
              href={qs({ cause: undefined })}
              className={clsx(
                'rounded-full border px-3 py-1 text-xs font-medium',
                !cause ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-500 hover:border-ink-300',
              )}
            >
              All causes
            </Link>
            {causes.map((c) => (
              <Link
                key={c}
                href={qs({ cause: c })}
                className={clsx(
                  'rounded-full border px-3 py-1 text-xs font-medium',
                  cause === c ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-500 hover:border-ink-300',
                )}
              >
                {c}
              </Link>
            ))}
          </div>
        ) : null}

        {entries.length === 0 ? (
          <EmptyState
            title="No organizations found"
            body={q || cause ? 'Try a different search or clear the filters.' : 'Check back soon as organizations join City/Sync.'}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {entries.map(({ org, tagline, logoUrl, causes: orgCauses, openCount }) => (
              <Link key={org.id} href={`/orgs/${org.slug}`}>
                <Card className="flex h-full flex-col transition-shadow hover:shadow-panel">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-brand-700">
                      {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt={org.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-display text-lg font-semibold text-white">
                          {org.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <p className="font-semibold leading-tight text-ink-900">{org.name}</p>
                  </div>
                  <p className="mt-3 line-clamp-2 flex-1 text-sm leading-relaxed text-ink-500">
                    {tagline || org.description || 'A City/Sync community organization.'}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <Badge tone={openCount > 0 ? 'gold' : 'gray'}>
                      {openCount} open opportunit{openCount === 1 ? 'y' : 'ies'}
                    </Badge>
                    {orgCauses.length > 0 ? (
                      <span className="text-xs text-ink-400">{orgCauses.slice(0, 2).join(' · ')}</span>
                    ) : null}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
