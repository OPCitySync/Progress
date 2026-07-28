import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { features } from '@/lib/config'
import { listSubmittedEntries, listTypes } from '@/lib/services/catalog'
import { getActiveCity } from '@/lib/services/city-networks'
import { reviewCatalogEntryAction } from '@/app/actions'
import { Card, PageHeader, EmptyState, Flash, Input, Label, Button } from '@/components/ui'

export const dynamic = 'force-dynamic'

const selectClass =
  'w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200'

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const session = await requireRole('admin')
  if (!features().catalogApproval) notFound()
  const city = await getActiveCity(session)
  const [queue, types] = await Promise.all([listSubmittedEntries(city?.id), listTypes()])

  return (
    <>
      <PageHeader
        title="Catalog review"
        subtitle={city ? `Review templates submitted by organizations in ${city.name}.` : 'Choose a city network to review its templates.'}
      />
      <Flash searchParams={searchParams} />

      {queue.length === 0 ? (
        <EmptyState title="Nothing to review" body="Submitted templates appear here for approval." />
      ) : (
        <div className="space-y-4">
          {queue.map(({ entry, orgName }) => (
            <Card key={entry.id}>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-800">{entry.title}</p>
                <p className="text-xs text-ink-400">
                  {orgName}
                  {entry.location ? ` · ${entry.location}` : ''}
                </p>
              </div>
              {entry.description ? (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-600">{entry.description}</p>
              ) : null}

              <form action={reviewCatalogEntryAction} className="mt-4 space-y-3 border-t border-ink-100 pt-4">
                <input type="hidden" name="entryId" value={entry.id} />
                <input type="hidden" name="redirectTo" value="/admin/catalog" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`type-${entry.id}`}>Opportunity type</Label>
                    <select id={`type-${entry.id}`} name="typeId" className={selectClass} defaultValue={entry.typeId ?? ''}>
                      <option value="">— Unassigned —</option>
                      {types.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.category ? `${t.category}: ` : ''}
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor={`note-${entry.id}`}>Note to the organization</Label>
                    <Input id={`note-${entry.id}`} name="note" placeholder="Required when requesting changes" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" name="decision" value="approved">
                    Approve
                  </Button>
                  <Button type="submit" name="decision" value="needs_changes" variant="secondary">
                    Request changes
                  </Button>
                  <Button type="submit" name="decision" value="rejected" variant="danger">
                    Reject
                  </Button>
                </div>
              </form>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
