'use client'

import { useState, type KeyboardEvent } from 'react'
import { Camera, Pencil } from 'lucide-react'
import { saveOrganizationSettingsAction } from '@/app/actions'
import { Button, Card, Input } from '@/components/ui'

async function uploadOrganizationPicture(file: File): Promise<string> {
  const data = new FormData()
  data.append('file', file)
  const response = await fetch('/api/upload', { method: 'POST', body: data })
  const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!response.ok || !body.url) throw new Error(body.error || 'Upload failed.')
  return body.url
}

function submitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key !== 'Enter') return
  event.preventDefault()
  event.currentTarget.form?.requestSubmit()
}

export function OrganizationIdentityForm({ initial }: { initial: { name: string; logoUrl: string; contactEmail: string } }) {
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [name, setName] = useState(initial.name)
  const [contactEmail, setContactEmail] = useState(initial.contactEmail)
  const [editing, setEditing] = useState<'name' | 'email' | null>(null)
  const initialLetter = name.trim().slice(0, 1).toUpperCase() || 'O'
  const pictureChanged = logoUrl !== initial.logoUrl

  return (
    <form action={saveOrganizationSettingsAction} className="space-y-5">
      <input type="hidden" name="redirectTo" value="/settings?tab=profile" />
      <input type="hidden" name="logoUrl" value={logoUrl} />
      {editing !== 'name' ? <input type="hidden" name="organizationName" value={name} /> : null}
      {editing !== 'email' ? <input type="hidden" name="contactEmail" value={contactEmail} /> : null}
      <Card>
        <p className="text-sm font-semibold text-ink-800">Organization identity</p>
        <p className="mt-1 text-sm text-ink-500">This picture and name identify the organization—not the delegated account operating it.</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Organization" className="h-20 w-20 rounded-2xl border border-ink-200 object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-700 text-2xl font-semibold text-white">{initialLetter}</div>
          )}
          <div>
            <label className="skeuo-button skeuo-button-secondary inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-ink-700">
              {uploading ? 'Uploading…' : <><Camera size={16} /> {logoUrl ? 'Replace picture' : 'Upload picture'}</>}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                disabled={uploading}
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (!file) return
                  setUploading(true)
                  setUploadError('')
                  try {
                    setLogoUrl(await uploadOrganizationPicture(file))
                  } catch (error) {
                    setUploadError(error instanceof Error ? error.message : 'Upload failed.')
                  } finally {
                    setUploading(false)
                  }
                }}
              />
            </label>
            {logoUrl ? <button type="button" onClick={() => setLogoUrl('')} className="ml-3 text-xs font-semibold text-red-600 hover:text-red-500">Remove</button> : null}
            <p className="mt-2 text-xs text-ink-400">PNG, JPG, WEBP, or GIF · 5 MB maximum.</p>
            {uploadError ? <p className="mt-1 text-xs font-medium text-red-600">{uploadError}</p> : null}
          </div>
        </div>
        <div className="mt-5 border-t border-ink-100 pt-3">
          <div className="flex min-h-14 items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Organizational Name</p>
              {editing === 'name' ? (
                <Input id="organizationName" name="organizationName" required value={name} onChange={(event) => setName(event.target.value)} onKeyDown={submitOnEnter} maxLength={120} className="mt-1 max-w-md" autoFocus />
              ) : <p className="mt-1 truncate text-sm font-medium text-ink-900">{name}</p>}
            </div>
            <button type="button" aria-label="Edit organizational name" onClick={() => setEditing('name')} className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-50 hover:text-brand-700"><Pencil size={16} /></button>
          </div>
          <div className="flex min-h-14 items-center justify-between gap-4 border-t border-ink-100 pt-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Organizational Email</p>
              {editing === 'email' ? (
                <Input id="contactEmail" name="contactEmail" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} onKeyDown={submitOnEnter} placeholder="hello@organization.org" maxLength={150} className="mt-1 max-w-md" autoFocus />
              ) : <p className="mt-1 truncate text-sm font-medium text-ink-900">{contactEmail || 'Not set'}</p>}
            </div>
            <button type="button" aria-label="Edit organizational email" onClick={() => setEditing('email')} className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-50 hover:text-brand-700"><Pencil size={16} /></button>
          </div>
        </div>
        {pictureChanged && !editing ? <div className="mt-5 flex justify-end"><Button type="submit">Save picture</Button></div> : null}
      </Card>
    </form>
  )
}
