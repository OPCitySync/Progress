import Link from 'next/link'
import type { CSSProperties } from 'react'
import {
  Building2,
  ClipboardList,
  Compass,
  Home,
  ContactRound,
  UsersRound,
} from 'lucide-react'
import { NotificationsControl } from './NotificationsControl'
import { UserMenu } from './UserMenu'
import { IssuerPaletteRoot } from './IssuerPaletteRoot'
import shell from './CoordinationHeader.module.css'
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
  | 'passport'
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
  { key: 'opportunities', label: 'Opportunities', href: '/aesthetic-lab/opportunities', icon: Compass },
  { key: 'passport', label: 'Passport', href: '/aesthetic-lab/passport', icon: ContactRound },
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
    <header className={shell.header} style={headerPaletteStyle} data-workspace={workspace}>
      {isIssuer ? <IssuerPaletteRoot colors={issuerPalette.colors} /> : null}
      <div className={shell.studio}><span>MYCITY · COMMUNITY COORDINATION</span><span>{isIssuer ? 'Organization workspace' : 'Volunteer workspace'}{city ? ` · ${city.name}` : ''}</span></div>
      <div className={shell.mainbar}>
        <Link href={isIssuer ? "/aesthetic-lab/issuer" : "/aesthetic-lab"} className={shell.brand} aria-label="MyCity home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mycity-logo-gold-white-transparent.svg" alt="mycity" />
        </Link>

        <nav className={shell.navigation} aria-label={isIssuer ? 'Issuer Organization sections' : 'Civic Participant sections'}>
          {sections.map((section) => {
            const Icon = section.icon
            const isActive = section.key === activeSection || (section.key === 'passport' && activeSection === 'history')
            return <Link key={section.key} className={isActive ? shell.active : undefined} href={section.href} aria-current={isActive ? 'page' : undefined}><Icon size={18} /><span>{section.label}</span></Link>
          })}
        </nav>

        <div className={shell.account}>
          <NotificationsControl
            count={inboxCount}
            href={isIssuer ? '/aesthetic-lab/issuer/notifications' : '/aesthetic-lab/messages'}
            label="Conversations"
            variant="messages"
          />

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
      </div>
    </header>
  )
}
