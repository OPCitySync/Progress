import type { CSSProperties, ReactNode } from 'react'
import {
  organizationBannerPalette,
  normalizeOrganizationBannerPalette,
  normalizeOrganizationBannerStyle,
  type OrganizationBannerPalette,
  type OrganizationBannerStyle,
} from '@/lib/profile/organization-appearance'
import styles from './OrganizationBanner.module.css'

type BannerVariables = CSSProperties & {
  '--banner-deep': string
  '--banner-mid': string
  '--banner-accent': string
  '--banner-accent-deep': string
}

export function OrganizationBanner({
  bannerStyle,
  bannerPalette,
  coverUrl = '',
  className = '',
  children,
}: {
  bannerStyle: OrganizationBannerStyle | string
  bannerPalette: OrganizationBannerPalette | string
  coverUrl?: string
  className?: string
  children?: ReactNode
}) {
  const style = normalizeOrganizationBannerStyle(bannerStyle)
  const paletteName = normalizeOrganizationBannerPalette(bannerPalette)
  const palette = organizationBannerPalette(paletteName)
  const variables: BannerVariables = {
    '--banner-deep': palette.colors[0],
    '--banner-mid': palette.colors[1],
    '--banner-accent': palette.colors[2],
    '--banner-accent-deep': palette.colors[3],
  }

  return (
    <div className={`${styles.banner} ${className}`} style={variables} data-banner-style={style}>
      {coverUrl ? <img src={coverUrl} alt="" className={styles.coverImage} /> : null}
      <div className={styles.wash} />
      <div className={styles.art} aria-hidden="true">
        {style === 'original' ? <><i className={styles.originalRing} /><i className={styles.originalSquare} /></> : null}
        {style === 'folded-ribbon' ? <><i className={styles.foldOne} /><i className={styles.foldTwo} /><i className={styles.foldThree} /></> : null}
        {style === 'confluence' ? <><i className={styles.loopOne} /><i className={styles.loopTwo} /><i className={styles.loopDot} /></> : null}
        {style === 'civic-mosaic' ? <div className={styles.mosaic}><span /><span /><span /><span /></div> : null}
      </div>
      {children}
    </div>
  )
}
