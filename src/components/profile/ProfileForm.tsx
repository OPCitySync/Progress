'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ImageIcon } from 'lucide-react'
import { Card, Input, Textarea, Label, Button } from '@/components/ui'
import { saveProfileAction } from '@/app/actions'

type Socials = { twitter?: string; instagram?: string; facebook?: string; linkedin?: string }

export type ProfileFormInitial = {
  tagline: string
  mission: string
  logoUrl: string
  coverUrl: string
  website: string
  contactEmail: string
  phone: string
  location: string
  socials: Record<string, string>
  causes: string[]
  onboardingTaskId: string | null
  published: boolean
}

export type TaskOption = { id: string; title: string; status: string }

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  let json: { url?: string; error?: string } = {}
  try {
    json = await res.json()
  } catch {
    /* ignore */
  }
  if (!res.ok || !json.url) throw new Error(json.error || 'Upload failed.')
  return json.url
}

function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-16 w-16 rounded-lg border border-ink-200 object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-ink-300 text-ink-300">
            <ImageIcon size={18} />
          </div>
        )}
        <div>
          <label className="inline-block cursor-pointer rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50">
            {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              disabled={busy}
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                setErr('')
                setBusy(true)
                try {
                  onChange(await uploadFile(f))
                } catch (ex) {
                  setErr(ex instanceof Error ? ex.message : 'Upload failed.')
                } finally {
                  setBusy(false)
                }
              }}
            />
          </label>
          {value ? (
            <button type="button" onClick={() => onChange('')} className="ml-2 text-xs text-red-600 hover:underline">
              Remove
            </button>
          ) : null}
          {err ? <p className="mt-1 text-xs text-red-600">{err}</p> : null}
        </div>
      </div>
    </div>
  )
}

export function ProfileForm({
  initial,
  tasks,
}: {
  initial: ProfileFormInitial
  tasks: TaskOption[]
}) {
  const [meta, setMeta] = useState({
    tagline: initial.tagline,
    logoUrl: initial.logoUrl,
    coverUrl: initial.coverUrl,
    website: initial.website,
    contactEmail: initial.contactEmail,
    phone: initial.phone,
    location: initial.location,
  })
  const [mission, setMission] = useState(initial.mission)
  const [socials, setSocials] = useState<Socials>({
    twitter: initial.socials.twitter ?? '',
    instagram: initial.socials.instagram ?? '',
    facebook: initial.socials.facebook ?? '',
    linkedin: initial.socials.linkedin ?? '',
  })
  const [causesStr, setCausesStr] = useState(initial.causes.join(', '))
  const [onboardingTaskId, setOnboardingTaskId] = useState(initial.onboardingTaskId ?? '')

  const setM = (k: keyof typeof meta, v: string) => setMeta((m) => ({ ...m, [k]: v }))

  const payload = JSON.stringify({
    ...meta,
    mission,
    socials,
    causes: causesStr.split(',').map((s) => s.trim()).filter(Boolean),
    onboardingTaskId,
  })

  return (
    <form action={saveProfileAction}>
      <input type="hidden" name="payload" value={payload} />
      <input type="hidden" name="redirectTo" value="/issuer/profile" />

      <Card className="mb-5">
        <p className="text-sm font-semibold text-ink-800">Header</p>
        <p className="mb-4 mt-0.5 text-xs text-ink-400">Shown at the top of your public page.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ImageField label="Logo" value={meta.logoUrl} onChange={(u) => setM('logoUrl', u)} />
          <ImageField label="Cover image" value={meta.coverUrl} onChange={(u) => setM('coverUrl', u)} />
        </div>
        <div className="mt-4">
          <Label htmlFor="tagline">Tagline</Label>
          <Input id="tagline" value={meta.tagline} onChange={(e) => setM('tagline', e.target.value)} placeholder="One line about your organization" maxLength={120} />
        </div>
        <div className="mt-4">
          <Label htmlFor="location">Location</Label>
          <Input id="location" value={meta.location} onChange={(e) => setM('location', e.target.value)} placeholder="City, neighborhood" />
        </div>
      </Card>

      <Card className="mb-5">
        <p className="text-sm font-semibold text-ink-800">About</p>
        <p className="mb-3 mt-0.5 text-xs text-ink-400">A short description of your mission and who you serve.</p>
        <Textarea rows={5} value={mission} onChange={(e) => setMission(e.target.value)} maxLength={1200} placeholder="What does your organization do?" />
        <p className="mt-1 text-right text-xs text-ink-400">{mission.length}/1200</p>
      </Card>

      <Card className="mb-5">
        <p className="text-sm font-semibold text-ink-800">Onboarding</p>
        <p className="mb-3 mt-0.5 text-xs text-ink-400">
          Choose your recurring new-volunteer task. It’s featured above your open opportunities and is the
          starting point for newcomers.
        </p>
        {tasks.length === 0 ? (
          <p className="rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-500">
            You haven’t created any opportunities yet.{' '}
            <Link href="/issuer/tasks/new" className="font-semibold text-brand-600 hover:text-brand-500">
              Create one
            </Link>{' '}
            to set it as onboarding.
          </p>
        ) : (
          <select
            value={onboardingTaskId}
            onChange={(e) => setOnboardingTaskId(e.target.value)}
            className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="">— No onboarding opportunity —</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
                {t.status === 'closed' ? ' (closed)' : ''}
              </option>
            ))}
          </select>
        )}
      </Card>

      <Card className="mb-5">
        <p className="text-sm font-semibold text-ink-800">Contact &amp; links</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="website">Website</Label>
            <Input id="website" value={meta.website} onChange={(e) => setM('website', e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input id="contactEmail" value={meta.contactEmail} onChange={(e) => setM('contactEmail', e.target.value)} placeholder="hello@org.org" />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={meta.phone} onChange={(e) => setM('phone', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="causes">Causes (comma separated)</Label>
            <Input id="causes" value={causesStr} onChange={(e) => setCausesStr(e.target.value)} placeholder="Food security, Seniors" />
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(['twitter', 'instagram', 'facebook', 'linkedin'] as const).map((k) => (
            <div key={k}>
              <Label htmlFor={`s_${k}`}>{k[0].toUpperCase() + k.slice(1)}</Label>
              <Input
                id={`s_${k}`}
                value={socials[k] ?? ''}
                onChange={(e) => setSocials((s) => ({ ...s, [k]: e.target.value }))}
                placeholder="https://…"
              />
            </div>
          ))}
        </div>
      </Card>

      <div className="sticky bottom-4 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-ink-200 bg-white/95 px-5 py-3 shadow-card backdrop-blur">
        <span className="mr-auto text-xs text-ink-400">
          {initial.published ? 'Your page is live.' : 'Draft — not visible to the public yet.'}
        </span>
        <Button type="submit" name="published" value="false" variant="secondary">
          Save draft
        </Button>
        <Button type="submit" name="published" value="true">
          Publish
        </Button>
      </div>
    </form>
  )
}
