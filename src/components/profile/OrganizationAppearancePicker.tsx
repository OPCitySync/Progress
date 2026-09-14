'use client'

import { Check } from 'lucide-react'
import {
  ORGANIZATION_BANNER_PALETTES,
  ORGANIZATION_BANNER_STYLES,
  type OrganizationBannerPalette,
  type OrganizationBannerStyle,
} from '@/lib/profile/organization-appearance'
import { OrganizationBanner } from './OrganizationBanner'
import styles from './OrganizationAppearancePicker.module.css'

export function OrganizationAppearancePicker({
  bannerStyle,
  bannerPalette,
  onStyleChange,
  onPaletteChange,
}: {
  bannerStyle: OrganizationBannerStyle
  bannerPalette: OrganizationBannerPalette
  onStyleChange: (style: OrganizationBannerStyle) => void
  onPaletteChange: (palette: OrganizationBannerPalette) => void
}) {
  return (
    <section className={styles.picker} aria-label="Organization banner appearance">
      <input type="hidden" name="bannerStyle" value={bannerStyle} />
      <input type="hidden" name="bannerPalette" value={bannerPalette} />
      <div className={styles.heading}><b>Organization Banner</b><span>Used throughout City/Sync</span></div>
      <div className={styles.templates} role="group" aria-label="Banner template">
        {ORGANIZATION_BANNER_STYLES.map((option) => (
          <button key={option.value} type="button" className={styles.template} aria-pressed={bannerStyle === option.value} onClick={() => onStyleChange(option.value)}>
            <OrganizationBanner bannerStyle={option.value} bannerPalette={bannerPalette} className={styles.preview} />
            <span className={styles.templateLabel}>{option.label}{bannerStyle === option.value ? <Check size={14} /> : null}</span>
          </button>
        ))}
      </div>
      <div className={styles.palettes} role="group" aria-label="Banner color palette">
        {ORGANIZATION_BANNER_PALETTES.map((option) => (
          <button key={option.value} type="button" className={styles.palette} aria-pressed={bannerPalette === option.value} onClick={() => onPaletteChange(option.value)}>
            <span className={styles.swatches} aria-hidden="true">{option.colors.map((color) => <i key={color} style={{ background: color }} />)}</span>
            {option.label}
          </button>
        ))}
      </div>
    </section>
  )
}
