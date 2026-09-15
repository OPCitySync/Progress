import type { CSSProperties } from 'react'
import { saveAccountSettingsAction } from '@/app/actions'
import { organizationBannerPalette, type OrganizationBannerPalette } from '@/lib/profile/organization-appearance'
import styles from '../prototype.module.css'

type IdentityPaletteStyle = CSSProperties & {
  '--identity-deep': string
  '--identity-mid': string
  '--identity-accent': string
}

export function ParticipantAccountIdentityForm({
  name,
  email,
  username,
  avatarUrl,
  bannerPalette,
}: {
  name: string
  email: string
  username: string
  avatarUrl: string
  bannerPalette: OrganizationBannerPalette
}) {
  const palette = organizationBannerPalette(bannerPalette)
  const paletteStyle: IdentityPaletteStyle = {
    '--identity-deep': palette.colors[0],
    '--identity-mid': palette.colors[1],
    '--identity-accent': palette.colors[2],
  }

  return (
    <section className={styles.settingsIdentityCard} style={paletteStyle}>
      <header className={styles.settingsIdentityHeader}>
        <div><p>Personal Identity</p></div>
      </header>
      <form action={saveAccountSettingsAction} className={styles.settingsIdentityForm}>
        <input type="hidden" name="redirectTo" value="/aesthetic-lab/settings" />
        <div className={styles.settingsIdentityFields}>
          <label>Name<input name="name" defaultValue={name} maxLength={100} required /></label>
          <label>Email<input type="email" name="email" defaultValue={email} required /></label>
          <label>Username<input name="username" defaultValue={username} maxLength={30} placeholder="your_username" /></label>
          <label>Profile picture URL<input name="avatarUrl" defaultValue={avatarUrl} placeholder="https://…" /></label>
        </div>
        <div className={styles.settingsIdentityActions}>
          <small>These details identify your Civic Participant account throughout City/Sync.</small>
          <button className={styles.labButton} type="submit">Save Account</button>
        </div>
      </form>
    </section>
  )
}
