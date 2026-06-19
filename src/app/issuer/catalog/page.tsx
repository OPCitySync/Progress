import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { features } from '@/lib/config'
import { listOrgEntries, listTypes } from '@/lib/services/catalog'
import { Card, PageHeader, EmptyState, Flash } from '@/components/ui'
import { CatalogStatusBadge } from '@/components/CatalogStatusBadge'

export const dynamic = 'force-dynamic'

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const session = await requireRole('issuer')
  if (!features().catalog) notFound()

  const [entries, types] = await Promise.all([listOrgEntries(session.orgId!), listTypes()])
  const typeName = new Map(types.map((t) => [t.id, t.name]))
  const approvalOn = features().catalogApproval

  return (
    <>
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
        <Card className="divide-y divide-ink-100 p-0">
          {entries.map((e) => (
            <Link
              key={e.id}
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
          ))}
        </Card>
      )}
    </>
  )
}
