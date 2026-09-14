import Link from 'next/link'
import {
  ArrowLeft,
  BadgeCheck,
  Compass,
  ShieldCheck,
} from 'lucide-react'
import styles from '../prototype.module.css'
import { IssuerQuickActions } from './IssuerQuickActions'
import { OrganizationBanner } from '@/components/profile/OrganizationBanner'
import { getProfile } from '@/lib/services/profile'
import { OrganizationAppearanceButton } from './OrganizationAppearanceButton'
import { organizationInitials } from '@/lib/profile/organization-appearance'

export async function IssuerLabSidebar({
  organizationName = 'Issuer organization',
  organizationId,
  cityName,
  isMyCityFeed = false,
}: {
  organizationName?: string
  organizationId?: string
  cityName?: string
  isMyCityFeed?: boolean
}) {
  const profile = organizationId ? await getProfile(organizationId) : null
  const initials = organizationInitials(organizationName)
  return (
    <aside className={styles.leftRail}>
      <section className={styles.issuerIdentityCard}>
        <OrganizationBanner bannerStyle={profile?.bannerStyle ?? 'original'} bannerPalette={profile?.bannerPalette ?? 'citysync'} coverUrl={profile?.coverUrl} className={styles.issuerCover} />
        <OrganizationAppearanceButton organizationName={organizationName} initials={initials} profile={profile} />
        <div className={styles.issuerIdentityBody}>
          <h1>{organizationName} <BadgeCheck size={17} /></h1>
          {cityName ? <p>{cityName}</p> : null}
          <div className={styles.issuerIdentityLinks}>
            <Link className={styles.issuerMyCityLink} href={isMyCityFeed ? '/aesthetic-lab/issuer' : '/aesthetic-lab/issuer/feed'}>
              {isMyCityFeed ? <ArrowLeft size={13} /> : <Compass size={13} />}
              {isMyCityFeed ? 'Return to Organization' : 'MyCity Feed'}
            </Link>
          </div>
        </div>
      </section>

      <IssuerQuickActions organizationId={organizationId ?? organizationName} />

      <section className={styles.issuerTrustCard}>
        <ShieldCheck size={19} />
        <div><b>Verified organization</b><span>Your current waiver and public profile are complete.</span></div>
      </section>
    </aside>
  )
}
