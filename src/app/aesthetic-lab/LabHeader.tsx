import Link from 'next/link'
import type { CSSProperties } from 'react'
import {
  Building2,
  ClipboardList,
  Compass,
  Home,
  UsersRound,
} from 'lucide-react'
import { NotificationsControl } from './NotificationsControl'
import { UserMenu } from './UserMenu'
import { WeatherWidget } from './WeatherWidget'
import { IssuerPaletteRoot } from './IssuerPaletteRoot'
import styles from './prototype.module.css'
import type { Session } from '@/lib/auth/session'
import type { CityNetwork } from '@/lib/services/city-networks'
import type { ActorContext } from '@/lib/services/identity-access'
import { getUnreadIssuerNotificationCount, getUnreadNotificationCount } from '@/lib/services/notifications'
import { getUnreadMessageCount } from '@/lib/services/roster'
import { getProfile } from '@/lib/services/profile'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { organizationBannerPalette } from '@/lib/profile/organization-appearance'

export type LabSection =
  | 'feed'
  | 'opportunities'
  | 'organizations'
  | 'history'
  | 'resources'
  | 'issuer-overview'
  | 'issuer-catalog'
  | 'issuer-volunteers'
  | 'issuer-reports'
  | 'issuer-profile'
  | 'issuer-utility'

export type LabWorkspace = 'participant' | 'issuer'

type HeaderPaletteStyle = CSSProperties & {
  '--program-palette-deep': string
  '--program-palette-mid': string
  '--program-palette-accent': string
  '--program-palette-accent-deep': string
}

const participantSections = [
  { key: 'feed', label: 'Home', href: '/aesthetic-lab', icon: Home },
  { key: 'opportunities', label: 'Discover', href: '/aesthetic-lab/opportunities', icon: Compass },
] as const

const issuerSections = [
  { key: 'issuer-overview', label: 'Home', href: '/aesthetic-lab/issuer', icon: Home },
  { key: 'issuer-catalog', label: 'Workspace', href: '/aesthetic-lab/issuer/catalog', icon: ClipboardList },
  { key: 'issuer-volunteers', label: 'Volunteers', href: '/aesthetic-lab/issuer/volunteers', icon: UsersRound },
  { key: 'issuer-profile', label: 'Public Profile', href: '/aesthetic-lab/issuer/profile', icon: Building2 },
] as const

export async function LabHeader({
  activeSection,
  workspace = 'participant',
  session,
  city,
  cities,
  contexts,
}: {
  activeSection: LabSection
  workspace?: LabWorkspace
  session?: Session
  city?: CityNetwork | null
  cities?: CityNetwork[]
  contexts?: ActorContext[]
}) {
  const isIssuer = workspace === 'issuer'
  const sections = isIssuer ? issuerSections : participantSections
  const [inboxCount, organizationProfile, participantAppearance] = await Promise.all([
    session
      ? isIssuer
        ? Promise.all([
            session.orgId ? getUnreadIssuerNotificationCount(session.sub, session.orgId) : getUnreadNotificationCount(session.sub),
            getUnreadMessageCount(session.sub),
          ]).then(([notifications, messages]) => notifications + messages)
        : Promise.all([
            getUnreadNotificationCount(session.sub, ['volunteer_reflection', 'organization_calendar']),
            getUnreadMessageCount(session.sub),
          ]).then(([updates, messages]) => updates + messages)
      : Promise.resolve(0),
    isIssuer && session?.orgId ? getProfile(session.orgId) : Promise.resolve(null),
    !isIssuer && session
      ? db
          .select({ avatarUrl: users.avatarUrl, bannerPalette: users.bannerPalette })
          .from(users)
          .where(eq(users.id, session.sub))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ])
  const issuerPalette = organizationBannerPalette(organizationProfile?.bannerPalette)
  const participantPalette = organizationBannerPalette(participantAppearance?.bannerPalette)
  const headerPalette = isIssuer ? issuerPalette : participantPalette
  const headerPaletteStyle: HeaderPaletteStyle = {
    '--program-palette-deep': headerPalette.colors[0],
    '--program-palette-mid': headerPalette.colors[1],
    '--program-palette-accent': headerPalette.colors[2],
    '--program-palette-accent-deep': headerPalette.colors[3],
  }

  return (
    <header className={styles.topbar} style={headerPaletteStyle}>
      {isIssuer ? <IssuerPaletteRoot colors={issuerPalette.colors} /> : null}
      <div className={styles.topbarInner}>
        <Link href="/aesthetic-lab" className={styles.brand} aria-label="City/Sync prototype home">
          {/* The same official wordmark used by the City/Sync application. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/citysync-wordmark-dark.svg" alt="City/Sync" />
        </Link>

        <nav className={styles.sectionNav} aria-label={isIssuer ? 'Issuer Organization sections' : 'Civic Participant sections'}>
          {sections.map((section) => {
            const Icon = section.icon
            const isActive = section.key === activeSection

            return isActive ? (
              <span className={styles.activeSection} key={section.key}>
                <Link className={styles.sectionNavActive} href={section.href} aria-current="page" aria-label={section.label}><Icon size={18} /></Link>
                <span className={styles.currentSectionName}>{section.label}</span>
              </span>
            ) : (
              <Link key={section.key} href={section.href}><Icon size={18} /><span>{section.label}</span></Link>
            )
          })}
        </nav>

        <WeatherWidget />

        <div className={styles.communicationUtilities}>
          <NotificationsControl
            count={inboxCount}
            href={isIssuer ? '/aesthetic-lab/issuer/notifications' : '/aesthetic-lab/messages'}
            label="Inbox"
            variant="messages"
          />
        </div>

        <UserMenu
          workspace={workspace}
          session={session}
          city={city}
          cities={cities}
          contexts={contexts}
          organizationLogoUrl={organizationProfile?.logoUrl}
          organizationPalette={organizationProfile?.bannerPalette}
          participantAvatarUrl={participantAppearance?.avatarUrl}
          participantPalette={participantAppearance?.bannerPalette}
        />
      </div>
    </header>
  )
}
