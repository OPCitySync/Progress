import Link from 'next/link'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import type { Session } from '@/lib/auth/session'
import type { CityNetwork } from '@/lib/services/city-networks'
import { OrganizationBanner } from '@/components/profile/OrganizationBanner'
import {
  normalizeOrganizationBannerPalette,
  normalizeOrganizationBannerStyle,
  organizationInitials,
} from '@/lib/profile/organization-appearance'
import { ParticipantAppearanceButton } from './ParticipantAppearanceButton'
import styles from './prototype.module.css'

export async function ParticipantIdentityCard({
  session,
  city,
  redirectTo,
}: {
  session: Session
  city: CityNetwork | null
  redirectTo: string
}) {
  const account = (await db
    .select({
      avatarUrl: users.avatarUrl,
      bannerStyle: users.bannerStyle,
      bannerPalette: users.bannerPalette,
    })
    .from(users)
    .where(eq(users.id, session.sub))
    .limit(1))[0]
  const bannerStyle = normalizeOrganizationBannerStyle(account?.bannerStyle)
  const bannerPalette = normalizeOrganizationBannerPalette(account?.bannerPalette)
  const cityLabel = city ? (city.id === 'mexico-city' ? 'Mexico City, Mexico' : `${city.name}, California`) : 'Choose a city'
  const participation = city?.participation?.status
  const statusLabel = participation === 'active' ? 'City Member' : participation === 'barred' ? 'Participation restricted' : 'New participant'
  const statusCopy = participation === 'active'
    ? 'Your local participation is verified.'
    : participation === 'barred'
      ? 'Your participation is temporarily paused.'
      : 'Complete one local onboarding session to become a City Member.'

  return (
    <section className={styles.issuerIdentityCard}>
      <OrganizationBanner bannerStyle={bannerStyle} bannerPalette={bannerPalette} className={styles.issuerCover} />
      <ParticipantAppearanceButton
        participantName={session.name}
        initials={organizationInitials(session.name, 'U')}
        initialAvatarUrl={account?.avatarUrl ?? ''}
        initialBannerStyle={bannerStyle}
        initialBannerPalette={bannerPalette}
        redirectTo={redirectTo}
      />
      <div className={styles.issuerIdentityBody}>
        <h1>{session.name} <Sparkles size={16} /></h1>
        <p>{cityLabel}</p>
        <div className={styles.participantIdentityStatus}>
          <span><Sparkles size={14} /> {statusLabel}</span>
          <small>{statusCopy}</small>
          {participation !== 'active' && participation !== 'barred' ? <Link href="/aesthetic-lab/opportunities">Find onboarding <ArrowUpRight size={13} /></Link> : null}
        </div>
      </div>
    </section>
  )
}
