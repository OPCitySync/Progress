import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { features } from '@/lib/config'
import { listTypes } from '@/lib/services/catalog'
import { createCatalogEntryAction } from '@/app/actions'
import { Card, PageHeader, Flash, Input, Label, Textarea, Button } from '@/components/ui'
import { CredentialPicker } from '@/components/CredentialPicker'

const selectClass =
  'w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200'

export default async function NewCatalogEntryPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  await requireRole('issuer')
  if (!features().catalog) notFound()
  const types = await listTypes()

  return (
    <>
      <Link href="/issuer/catalog" className="mb-4 inline-block text-sm text-ink-400 hover:text-ink-600">
        ← Catalog
      </Link>
      <PageHeader title="New template" subtitle="A reusable opportunity you can schedule again and again." />
      <Flash searchParams={searchParams} />

      <Card className="max-w-2xl">
        <form action={createCatalogEntryAction} className="space-y-4">
          <input type="hidden" name="redirectTo" value="/issuer/catalog/new" />
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="e.g. Lake cleanup" />
          </div>
          <div>
            <Label htmlFor="description">Description &amp; success criteria</Label>
            <Textarea id="description" name="description" rows={4} placeholder="Scope, time commitment, what counts as completed…" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="location">Default location</Label>
              <Input id="location" name="location" placeholder="e.g. Riverside Park" />
            </div>
            <div>
              <Label htmlFor="typeId">Opportunity type</Label>
              <select id="typeId" name="typeId" className={selectClass} defaultValue="">
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
            <p className="mb-2 text-xs text-ink-400">Volunteers must hold these before they can sign up.</p>
            <CredentialPicker />
          </div>
          <Button type="submit">Create template</Button>
        </form>
      </Card>
    </>
  )
}
