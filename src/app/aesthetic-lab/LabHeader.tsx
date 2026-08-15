import Link from 'next/link'
import {
  Bookmark,
  Building2,
  ClipboardList,
  Compass,
  FileBarChart2,
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

export type LabSection =
  | 'feed'
  | 'opportunities'
  | 'organizations'
  | 'history'
  | 'issuer-overview'
  | 'issuer-catalog'
  | 'issuer-volunteers'
  | 'issuer-reports'
  | 'issuer-profile'

export type LabWorkspace = 'participant' | 'issuer'

const participantSections = [
  { key: 'feed', label: 'Home', href: '/aesthetic-lab', icon: Home },
  { key: 'opportunities', label: 'Opportunities', href: '/aesthetic-lab/opportunities', icon: Compass },
  { key: 'organizations', label: 'Discover Organizations', href: '/aesthetic-lab/organizations', icon: Building2 },
  { key: 'history', label: 'Service History', href: '/aesthetic-lab/history', icon: Bookmark },
] as const

const issuerSections = [
  { key: 'issuer-overview', label: 'Overview', href: '/aesthetic-lab/issuer', icon: Home },
  { key: 'issuer-catalog', label: 'Opportunity Catalog', href: '/aesthetic-lab/issuer/catalog', icon: ClipboardList },
  { key: 'issuer-volunteers', label: 'Volunteers', href: '/aesthetic-lab/issuer/volunteers', icon: UsersRound },
  { key: 'issuer-reports', label: 'Reports', href: '/aesthetic-lab/issuer/reports', icon: FileBarChart2 },
  { key: 'issuer-profile', label: 'Public Profile', href: '/aesthetic-lab/issuer/profile', icon: Building2 },
] as const

export function LabHeader({
  activeSection,
  workspace = 'participant',
  session,
  city,
  contexts,
}: {
  activeSection: LabSection
  workspace?: LabWorkspace
  session?: Session
  city?: CityNetwork | null
  contexts?: ActorContext[]
}) {
  const isIssuer = workspace === 'issuer'
  const sections = isIssuer ? issuerSections : participantSections

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

        <NotificationsControl />

        <UserMenu workspace={workspace} session={session} city={city} contexts={contexts} />
      </div>
    </header>
  )
}
