import Link from 'next/link'
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
import styles from './prototype.module.css'
import type { Session } from '@/lib/auth/session'
import type { CityNetwork } from '@/lib/services/city-networks'
import type { ActorContext } from '@/lib/services/identity-access'
import { getUnreadIssuerNotificationCount, getUnreadNotificationCount } from '@/lib/services/notifications'
import { getUnreadMessageCount } from '@/lib/services/roster'

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

const participantSections = [
  { key: 'feed', label: 'Home', href: '/aesthetic-lab', icon: Home },
  { key: 'opportunities', label: 'Opportunities', href: '/aesthetic-lab/opportunities', icon: Compass },
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
  const [notificationCount, inboxCount] = session
    ? isIssuer
      ? await Promise.all([
          session.orgId ? getUnreadIssuerNotificationCount(session.sub, session.orgId) : getUnreadNotificationCount(session.sub),
          getUnreadMessageCount(session.sub),
        ])
      : await Promise.all([
          Promise.resolve(0),
          Promise.all([getUnreadNotificationCount(session.sub, ['volunteer_reflection', 'organization_calendar']), getUnreadMessageCount(session.sub)]).then(([updates, messages]) => updates + messages),
        ])
    : [0, 0]

  return (
    <header className={styles.topbar}>
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
          {isIssuer ? <NotificationsControl
            count={notificationCount}
            href="/aesthetic-lab/issuer/updates"
            label="Notifications"
            variant="notifications"
          /> : null}
        </div>

        <UserMenu workspace={workspace} session={session} city={city} cities={cities} contexts={contexts} />
      </div>
    </header>
  )
}
