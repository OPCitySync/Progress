'use client'

import { useState, type KeyboardEvent } from 'react'
import { Camera, ImageIcon, Pencil } from 'lucide-react'
import { saveAccountSettingsAction } from '@/app/actions'
import { Button, Card, Input } from '@/components/ui'

async function uploadAvatar(file: File): Promise<string> {
  const data = new FormData()
  data.append('file', file)
  const response = await fetch('/api/upload/avatar', { method: 'POST', body: data })
  const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!response.ok || !body.url) throw new Error(body.error || 'Upload failed.')
  return body.url
}

function submitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key !== 'Enter') return
  event.preventDefault()
  event.currentTarget.form?.requestSubmit()
}

export function AccountSettingsForm({
  initial,
  showPicture = true,
  showPrivacy = true,
}: {
  initial: { name: string; email: string; username: string | null; avatarUrl: string }
  showPicture?: boolean
  showPrivacy?: boolean
}) {
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [name, setName] = useState(initial.name)
  const [username, setUsername] = useState(initial.username ?? '')
  const [editing, setEditing] = useState<'name' | 'username' | null>(null)
  const initials = name.trim().slice(0, 1).toUpperCase() || 'U'
  const pictureChanged = avatarUrl !== initial.avatarUrl

  return (
    <form action={saveAccountSettingsAction} className="space-y-5">
      <input type="hidden" name="redirectTo" value="/settings" />
      <input type="hidden" name="email" value={initial.email} />
      <input type="hidden" name="avatarUrl" value={avatarUrl} />
      {editing !== 'name' ? <input type="hidden" name="name" value={name} /> : null}
      {editing !== 'username' ? <input type="hidden" name="username" value={username} /> : null}

      {showPicture ? (
        <Card>
          <p className="text-sm font-semibold text-ink-800">Profile picture</p>
          <p className="mt-1 text-sm text-ink-500">Choose the image shown beside your account in City/Sync.</p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Your profile" className="h-20 w-20 rounded-2xl border border-ink-200 object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-700 text-2xl font-semibold text-white">
                {initials}
              </div>
            )}
            <div>
              <label className="skeuo-button skeuo-button-secondary inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-ink-700">
                {uploading ? 'Uploading…' : <><Camera size={16} /> {avatarUrl ? 'Replace photo' : 'Upload photo'}</>}
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
                      setAvatarUrl(await uploadAvatar(file))
                    } catch (error) {
                      setUploadError(error instanceof Error ? error.message : 'Upload failed.')
                    } finally {
                      setUploading(false)
                    }
                  }}
                />
              </label>
              {avatarUrl ? (
                <button type="button" onClick={() => setAvatarUrl('')} className="ml-3 text-xs font-semibold text-red-600 hover:text-red-500">
                  Remove
                </button>
              ) : null}
              <p className="mt-2 text-xs text-ink-400">PNG, JPG, WEBP, or GIF · 5 MB maximum.</p>
              {uploadError ? <p className="mt-1 text-xs font-medium text-red-600">{uploadError}</p> : null}
            </div>
          </div>
        </Card>
      ) : null}

      <Card>
        <p className="text-sm font-semibold text-ink-800">Account identity</p>
        <div className="mt-3 divide-y divide-ink-100">
          <div className="flex min-h-14 items-center justify-between gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Name</p>
              {editing === 'name' ? (
                <Input name="name" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={submitOnEnter} required maxLength={100} autoComplete="name" className="mt-1 max-w-md" autoFocus />
              ) : <p className="mt-1 truncate text-sm font-medium text-ink-900">{name}</p>}
            </div>
            <button type="button" aria-label="Edit name" onClick={() => setEditing('name')} className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-50 hover:text-brand-700"><Pencil size={16} /></button>
          </div>
          <div className="flex min-h-14 items-center justify-between gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Username</p>
              {editing === 'username' ? (
                <><Input name="username" value={username} onChange={(event) => setUsername(event.target.value)} onKeyDown={submitOnEnter} placeholder="e.g. alex_rivera" maxLength={30} autoCapitalize="none" className="mt-1 max-w-md" autoFocus /><p className="mt-1 text-xs text-ink-400">Optional · 3–30 lowercase letters, numbers, or underscores.</p></>
              ) : <p className="mt-1 truncate text-sm font-medium text-ink-900">{username ? `@${username}` : 'Not set'}</p>}
            </div>
            <button type="button" aria-label="Edit username" onClick={() => setEditing('username')} className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-50 hover:text-brand-700"><Pencil size={16} /></button>
          </div>
        </div>
        {pictureChanged && !editing ? <div className="mt-4 flex justify-end"><Button type="submit">Save picture</Button></div> : null}
      </Card>

      {showPrivacy ? (
        <Card className="border-brand-200 bg-brand-50">
          <div className="flex gap-3">
            <ImageIcon className="mt-0.5 shrink-0 text-brand-700" size={18} />
            <div>
              <p className="text-sm font-semibold text-ink-800">Identity &amp; privacy</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                City/Sync believes that identity should belong to the individual. You have a right to privacy, and we will never ask you to provide more information than is necessary to participate. Any identity information or claims you choose to share are handled by trusted Issuer Organizations, not by City/Sync directly. Our role is to support a system where you can decide how, when, and with whom your identity is shared, while still allowing your participation and contributions to be recognized.
              </p>
            </div>
          </div>
        </Card>
      ) : null}
    </form>
  )
}
