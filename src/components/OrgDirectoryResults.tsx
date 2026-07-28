import Link from 'next/link'
import { clsx } from 'clsx'
import { Badge, Card, EmptyState } from '@/components/ui'
import { listPublicIssuers } from '@/lib/services/profile'

export async function OrgDirectoryResults({
  searchParams,
  basePath,
  cityId,
}: {
  searchParams: { q?: string; cause?: string }
  basePath: string
  cityId?: string
}) {
  const q = searchParams.q?.trim() ?? ''
  const cause = searchParams.cause?.trim() || undefined
  const all = await listPublicIssuers({ search: q, cityId })
  const causes = Array.from(new Set(all.flatMap((entry) => entry.causes))).sort()
  const entries = cause ? all.filter((entry) => entry.causes.includes(cause)) : all

  const qs = (next: { q?: string; cause?: string }) => {
    const params = new URLSearchParams()
    const nextQ = next.q ?? q
    const nextCause = 'cause' in next ? next.cause : cause
    if (nextQ) params.set('q', nextQ)
    if (nextCause) params.set('cause', nextCause)
    const search = params.toString()
    return search ? `${basePath}?${search}` : basePath
  }

  return (
    <>
      {causes.length > 0 ? (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Link
            href={qs({ cause: undefined })}
            aria-current={!cause ? 'page' : undefined}
            className={clsx(
              'skeuo-filter-chip rounded-full px-3 py-1 text-xs font-semibold',
              !cause ? 'skeuo-filter-chip-active' : 'text-ink-600',
            )}
          >
            All causes
          </Link>
          {causes.map((item) => (
            <Link
              key={item}
              href={qs({ cause: item })}
              aria-current={cause === item ? 'page' : undefined}
              className={clsx(
                'skeuo-filter-chip rounded-full px-3 py-1 text-xs font-semibold',
                cause === item ? 'skeuo-filter-chip-active' : 'text-ink-600',
              )}
            >
              {item}
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
                  {orgCauses.length > 0 ? <span className="text-xs text-ink-400">{orgCauses.slice(0, 2).join(' · ')}</span> : null}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
