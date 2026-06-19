import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { features } from '@/lib/config'
import { getEntry, listTypes, isEntryUsable } from '@/lib/services/catalog'
import {
  updateCatalogEntryAction,
  submitCatalogEntryAction,
  scheduleFromCatalogAction,
} from '@/app/actions'
import { Card, PageHeader, Flash, Input, Label, Textarea, Button } from '@/components/ui'
import { CredentialPicker } from '@/components/CredentialPicker'
import { CatalogStatusBadge } from '@/components/CatalogStatusBadge'
import { parseCredentialList } from '@/lib/credentials'

export const dynamic = 'force-dynamic'

const selectClass =
  'w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200'

export default async function CatalogEntryPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { error?: string; ok?: string }
}) {
  const session = await requireRole('issuer')
  if (!features().catalog) notFound()
  const entry = await getEntry(params.id)
  if (!entry || entry.orgId !== session.orgId) notFound()

  const types = await listTypes()
  const selectedType = types.find((t) => t.id === entry.typeId)
  const approvalOn = features().catalogApproval
  const showCredits = features().credits
  const editable = entry.status === 'draft' || entry.status === 'needs_changes'
  const usable = isEntryUsable(entry.status)
  const redirectTo = `/issuer/catalog/${entry.id}`

  const suggested =
    selectedType && (selectedType.suggestedMin != null || selectedType.suggestedTypical != null)
      ? `${selectedType.suggestedMin ?? selectedType.suggestedTypical}–${selectedType.suggestedMax ?? selectedType.suggestedTypical}`
      : null

  return (
    <>
      <Link href="/issuer/catalog" className="mb-4 inline-block text-sm text-ink-400 hover:text-ink-600">
        ← Catalog
      </Link>
      <PageHeader
        title={entry.title}
        subtitle={selectedType ? selectedType.name : 'No type'}
        action={<CatalogStatusBadge status={entry.status} />}
      />
      <Flash searchParams={searchParams} />

      {entry.status === 'needs_changes' && entry.reviewNote ? (
        <Card className="mb-4 border-brand-200 bg-brand-50">
          <p className="text-sm text-ink-700">
            <span className="font-semibold">Reviewer note:</span> {entry.reviewNote}
          </p>
        </Card>
      ) : null}
      {entry.status === 'rejected' && entry.reviewNote ? (
        <Card className="mb-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">
            <span className="font-semibold">Rejected:</span> {entry.reviewNote}
          </p>
        </Card>
      ) : null}

      {editable ? (
        <Card className="mb-6 max-w-2xl">
          <p className="mb-3 text-sm font-semibold text-ink-800">Template details</p>
          <form action={updateCatalogEntryAction} className="space-y-4">
            <input type="hidden" name="entryId" value={entry.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required defaultValue={entry.title} />
            </div>
            <div>
              <Label htmlFor="description">Description &amp; success criteria</Label>
              <Textarea id="description" name="description" rows={4} defaultValue={entry.description} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="location">Default location</Label>
                <Input id="location" name="location" defaultValue={entry.location} />
              </div>
              <div>
                <Label htmlFor="typeId">Opportunity type</Label>
                <select id="typeId" name="typeId" className={selectClass} defaultValue={entry.typeId ?? ''}>
                  <option value="">— Select a type —</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.category ? `${t.category}: ` : ''}
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>Required credentials (optional)</Label>
              <CredentialPicker selected={parseCredentialList(entry.requiredCredentials)} />
            </div>
            <Button type="submit" variant="secondary">
              Save template
            </Button>
          </form>

          {approvalOn ? (
            <form action={submitCatalogEntryAction} className="mt-4 border-t border-ink-100 pt-4">
              <input type="hidden" name="entryId" value={entry.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <Button type="submit">Submit for approval</Button>
              <p className="mt-1 text-xs text-ink-400">
                Save your edits first. An admin reviews the template before it can be scheduled.
              </p>
            </form>
          ) : null}
        </Card>
      ) : (
        <Card className="mb-6 max-w-2xl">
          {entry.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">{entry.description}</p>
          ) : (
            <p className="text-sm text-ink-400">No description.</p>
          )}
          {entry.location ? <p className="mt-2 text-xs text-ink-400">📍 {entry.location}</p> : null}
        </Card>
      )}

      {usable ? (
        <>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">Schedule an opportunity</h2>
          <Card className="max-w-2xl">
            <form action={scheduleFromCatalogAction} className="space-y-4">
              <input type="hidden" name="entryId" value={entry.id} />
              {showCredits ? (
                <div>
                  <Label htmlFor="credits">Credits per completion</Label>
                  <Input
                    id="credits"
                    name="credits"
                    type="number"
                    min={1}
                    required
                    defaultValue={selectedType?.suggestedTypical ?? 10}
                  />
                  {suggested ? (
                    <p className="mt-1 text-xs text-ink-400">
                      Committee suggestion for {selectedType?.name}: {suggested} credits. Set what your need requires.
                    </p>
                  ) : null}
                </div>
              ) : (
                <input type="hidden" name="credits" value={String(entry.defaultCredits ?? 1)} />
              )}

              <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
                <p className="text-sm font-semibold text-ink-700">First shift</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="shiftStartsAt">Starts</Label>
                    <Input id="shiftStartsAt" name="shiftStartsAt" type="datetime-local" />
                  </div>
                  <div>
                    <Label htmlFor="shiftEndsAt">Ends (optional)</Label>
                    <Input id="shiftEndsAt" name="shiftEndsAt" type="datetime-local" />
                  </div>
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="capacity">Capacity</Label>
                    <Input id="capacity" name="capacity" type="number" min={1} required defaultValue={1} />
                  </div>
                  <div>
                    <Label htmlFor="shiftLabel">Label (optional)</Label>
                    <Input id="shiftLabel" name="shiftLabel" placeholder="e.g. Morning crew" />
                  </div>
                </div>
              </div>
              <Button type="submit">Schedule opportunity</Button>
            </form>
          </Card>
        </>
      ) : approvalOn && entry.status !== 'rejected' ? (
        <Card>
          <p className="text-sm text-ink-500">
            This template must be approved before you can schedule opportunities from it.
          </p>
        </Card>
      ) : null}
    </>
  )
}
