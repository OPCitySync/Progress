'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Camera } from 'lucide-react'
import { saveParticipantAppearanceAction } from '@/app/actions'
import { OrganizationAppearancePicker } from '@/components/profile/OrganizationAppearancePicker'
import {
  organizationBannerPalette,
  type OrganizationBannerPalette,
  type OrganizationBannerStyle,
} from '@/lib/profile/organization-appearance'
import styles from './prototype.module.css'

async function uploadParticipantPicture(file: File) {
  const data = new FormData()
  data.append('file', file)
  const response = await fetch('/api/upload/avatar', { method: 'POST', body: data })
  const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!response.ok || !body.url) throw new Error(body.error || 'Upload failed.')
  return body.url
}

type PictureVariables = CSSProperties & {
  '--profile-picture-top': string
  '--profile-picture-bottom': string
}

type AppearancePaletteVariables = CSSProperties & {
  '--program-palette-deep': string
  '--program-palette-mid': string
  '--program-palette-accent': string
  '--program-palette-accent-deep': string
}

export function ParticipantAppearanceButton({
  participantName,
  initials,
  initialAvatarUrl,
  initialBannerStyle,
  initialBannerPalette,
  redirectTo,
}: {
  participantName: string
  initials: string
  initialAvatarUrl: string
  initialBannerStyle: OrganizationBannerStyle
  initialBannerPalette: OrganizationBannerPalette
  redirectTo: string
}) {
  const [open, setOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [bannerStyle, setBannerStyle] = useState(initialBannerStyle)
  const [bannerPalette, setBannerPalette] = useState(initialBannerPalette)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const palette = organizationBannerPalette(bannerPalette)
  const pictureStyle: PictureVariables = {
    '--profile-picture-top': palette.colors[2],
    '--profile-picture-bottom': palette.colors[1],
  }
  const appearancePaletteStyle: AppearancePaletteVariables = {
    '--program-palette-deep': palette.colors[0],
    '--program-palette-mid': palette.colors[1],
    '--program-palette-accent': palette.colors[2],
    '--program-palette-accent-deep': palette.colors[3],
  }

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  return (
    <>
      <button
        type="button"
        className={styles.issuerProfilePicture}
        style={pictureStyle}
        data-open={open || undefined}
        aria-label="Change profile picture and banner appearance"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {avatarUrl ? <img src={avatarUrl} alt={`${participantName} profile`} /> : initials}
      </button>

      {open ? createPortal(
        <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setOpen(false)}>
          <section className={`${styles.issuerCalendarModal} ${styles.issuerAppearanceModal}`} style={appearancePaletteStyle} role="dialog" aria-modal="true" aria-labelledby="participant-appearance-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.issuerCalendarModalHeading}>
              <div><p className={styles.eyebrow}>Civic Participant</p><h2 id="participant-appearance-title">Choose Your Appearance</h2></div>
            </div>
            <form action={saveParticipantAppearanceAction} className={`${styles.issuerCalendarForm} ${styles.issuerAppearanceForm}`} onSubmit={() => setOpen(false)}>
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <input type="hidden" name="avatarUrl" value={avatarUrl} />
              <div className={styles.issuerAppearanceLogo}>
                <span style={pictureStyle}>{avatarUrl ? <img src={avatarUrl} alt={`${participantName} profile`} /> : initials}</span>
                <div>
                  <b>Profile Picture</b>
                  <label className={styles.labLinkButton}>
                    <Camera size={14} /> {uploading ? 'Uploading…' : avatarUrl ? 'Change Picture' : 'Upload Picture'}
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
                          setAvatarUrl(await uploadParticipantPicture(file))
                        } catch (error) {
                          setUploadError(error instanceof Error ? error.message : 'Upload failed.')
                        } finally {
                          setUploading(false)
                        }
                      }}
                    />
                  </label>
                  {avatarUrl ? <button type="button" className={styles.organizationLogoRemove} onClick={() => setAvatarUrl('')}>Remove Picture</button> : null}
                  {uploadError ? <p role="alert">{uploadError}</p> : null}
                </div>
              </div>
              <OrganizationAppearancePicker
                bannerStyle={bannerStyle}
                bannerPalette={bannerPalette}
                onStyleChange={setBannerStyle}
                onPaletteChange={setBannerPalette}
                subjectLabel="Profile"
              />
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
