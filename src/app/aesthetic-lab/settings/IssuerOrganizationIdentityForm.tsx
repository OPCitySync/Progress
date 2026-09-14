import type { CSSProperties } from 'react'
import { Building2 } from 'lucide-react'
import { saveOrganizationSettingsAction } from '@/app/actions'
import { organizationBannerPalette } from '@/lib/profile/organization-appearance'
import type { OrgProfile } from '@/lib/services/profile'
import styles from '../prototype.module.css'

type IdentityPaletteStyle = CSSProperties & {
  '--identity-deep': string
  '--identity-mid': string
  '--identity-accent': string
}

export function IssuerOrganizationIdentityForm({ organizationId, organizationName, profile }: { organizationId: string; organizationName: string; profile: OrgProfile }) {
  const palette = organizationBannerPalette(profile.bannerPalette)
  const paletteStyle: IdentityPaletteStyle = {
    '--identity-deep': palette.colors[0],
    '--identity-mid': palette.colors[1],
    '--identity-accent': palette.colors[2],
  }

  return (
    <section className={styles.settingsIdentityCard} style={paletteStyle}>
      <header className={styles.settingsIdentityHeader}>
        <div>
          <p>Organization identity</p>
          <h2>{organizationName}</h2>
        </div>
        <div className={styles.settingsIdentityHeaderMeta}>
          <span><small>Organizational ID</small><code>{organizationId}</code></span>
          <Building2 size={20} aria-hidden="true" />
        </div>
      </header>
      <form action={saveOrganizationSettingsAction} className={styles.settingsIdentityForm}>
        <input type="hidden" name="redirectTo" value="/aesthetic-lab/settings" />
        <input type="hidden" name="logoUrl" value={profile.logoUrl} />
        <div className={styles.settingsIdentityFields}>
          <label>Organization name<input name="organizationName" defaultValue={organizationName} maxLength={120} required /></label>
          <label>Organization email<input type="email" name="contactEmail" defaultValue={profile.contactEmail} maxLength={150} placeholder="hello@organization.org" /></label>
          <label>Location<input name="location" defaultValue={profile.location} maxLength={240} placeholder="Organization address" /></label>
          <label>Phone number<input type="tel" name="phone" defaultValue={profile.phone} maxLength={50} placeholder="Organization phone" /></label>
        </div>
        <div className={styles.settingsIdentityActions}>
          <small>This is the only place where the organization name can be changed.</small>
          <button className={styles.labButton} type="submit">Save Organization</button>
        </div>
      </form>
    </section>
  )
}
