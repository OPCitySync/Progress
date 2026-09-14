'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, X } from 'lucide-react'
import { saveProfileAction } from '@/app/actions'
import { OrganizationAppearancePicker } from '@/components/profile/OrganizationAppearancePicker'
import {
  DEFAULT_ORGANIZATION_BANNER_PALETTE,
  DEFAULT_ORGANIZATION_BANNER_STYLE,
} from '@/lib/profile/organization-appearance'
import type { OrgProfile } from '@/lib/services/profile'
import styles from '../prototype.module.css'

async function uploadOrganizationLogo(file: File) {
  const data = new FormData()
  data.append('file', file)
  const response = await fetch('/api/upload', { method: 'POST', body: data })
  const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!response.ok || !body.url) throw new Error(body.error || 'Upload failed.')
  return body.url
}

export function OrganizationAppearanceButton({
  organizationName,
  initials,
  profile,
  placement = 'sidebar',
}: {
  organizationName: string
  initials: string
  profile: OrgProfile | null
  placement?: 'sidebar' | 'profile'
}) {
  const [open, setOpen] = useState(false)
  const [logoUrl, setLogoUrl] = useState(profile?.logoUrl ?? '')
  const [bannerStyle, setBannerStyle] = useState(profile?.bannerStyle ?? DEFAULT_ORGANIZATION_BANNER_STYLE)
  const [bannerPalette, setBannerPalette] = useState(profile?.bannerPalette ?? DEFAULT_ORGANIZATION_BANNER_PALETTE)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  const payload = JSON.stringify({
    tagline: profile?.tagline ?? '',
    mission: profile?.mission ?? '',
    logoUrl,
    coverUrl: profile?.coverUrl ?? '',
    website: profile?.website ?? '',
    contactEmail: profile?.contactEmail ?? '',
    phone: profile?.phone ?? '',
    location: profile?.location ?? '',
    socials: profile?.socials ?? {},
    causes: profile?.causes ?? [],
    onboardingTaskId: profile?.onboardingTaskId ?? '',
    bannerStyle,
    bannerPalette,
  })

  return (
    <>
      <button
        type="button"
        className={placement === 'profile' ? styles.publicOrgMarkButton : styles.issuerProfilePicture}
        data-open={open || undefined}
        aria-label="Change organization logo and banner appearance"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {logoUrl ? <img src={logoUrl} alt={`${organizationName} logo`} /> : initials}
      </button>

      {open ? createPortal(
        <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setOpen(false)}>
          <section className={`${styles.issuerCalendarModal} ${styles.issuerAppearanceModal}`} role="dialog" aria-modal="true" aria-labelledby="organization-appearance-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.issuerCalendarModalHeading}>
              <div><p className={styles.eyebrow}>Organization Identity</p><h2 id="organization-appearance-title">Choose Your Appearance</h2></div>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            <form action={saveProfileAction} className={`${styles.issuerCalendarForm} ${styles.issuerAppearanceForm}`}>
              <input type="hidden" name="payload" value={payload} />
              <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer" />
              <div className={styles.issuerAppearanceLogo}>
                <span>{logoUrl ? <img src={logoUrl} alt={`${organizationName} logo`} /> : initials}</span>
                <div>
                  <b>Profile Picture</b>
                  <label className={styles.labLinkButton}>
                    <Camera size={14} /> {uploading ? 'Uploading…' : logoUrl ? 'Change Picture' : 'Upload Picture'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      hidden
                      disabled={uploading}
                      onChange={async (event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (!file) return
                        setUploading(true)
                        setUploadError('')
                        try {
                          setLogoUrl(await uploadOrganizationLogo(file))
                        } catch (error) {
                          setUploadError(error instanceof Error ? error.message : 'Upload failed.')
                        } finally {
                          setUploading(false)
                        }
                      }}
                    />
                  </label>
                  {logoUrl ? <button type="button" className={styles.organizationLogoRemove} onClick={() => setLogoUrl('')}>Remove Picture</button> : null}
                  {uploadError ? <p role="alert">{uploadError}</p> : null}
                </div>
              </div>
              <OrganizationAppearancePicker bannerStyle={bannerStyle} bannerPalette={bannerPalette} onStyleChange={setBannerStyle} onPaletteChange={setBannerPalette} />
              <div className={styles.issuerCalendarFormActions}>
                <button type="button" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" disabled={uploading}>Save Appearance</button>
              </div>
            </form>
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  )
}
