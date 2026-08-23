'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowLeftRight,
  Bell,
  ChevronDown,
  CircleHelp,
  FileBarChart2,
  LogOut,
  MapPinned,
  Settings2,
} from 'lucide-react'
import { signOutAction, switchCityAction, switchIdentityAction } from '@/app/actions'
import type { Session } from '@/lib/auth/session'
import type { CityNetwork } from '@/lib/services/city-networks'
import type { ActorContext } from '@/lib/services/identity-access'
import styles from './prototype.module.css'

function labDestination(role: ActorContext['role']) {
  return role === 'issuer' ? '/aesthetic-lab/issuer' : '/aesthetic-lab'
}

export function UserMenu({
  workspace = 'participant',
  session,
  city,
  cities = [],
  contexts = [],
}: {
  workspace?: 'participant' | 'issuer'
  session?: Session
  city?: CityNetwork | null
  cities?: CityNetwork[]
  contexts?: ActorContext[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const isIssuer = workspace === 'issuer'
  const activeContext = contexts.find((context) => context.identityId === session?.activeIdentityId)
  const identityName = isIssuer ? activeContext?.label ?? 'Issuer organization' : session?.name ?? 'Civic participant'
  const identityDescription = isIssuer
    ? `Issuer Organization${city ? ` · ${city.name}` : ''}`
    : `Civic Participant${city ? ` · ${city.name}` : ''}`
  const switchTargets = session ? contexts.filter((context) => context.identityId !== session.activeIdentityId) : []
  const currentPath = isIssuer ? '/aesthetic-lab/issuer' : '/aesthetic-lab'

  return (
    <div className={styles.userMenu}>
      <button
        className={styles.profileButton}
        type="button"
        aria-label="Open account menu"
        aria-expanded={isOpen}
        aria-controls="account-menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className={`${styles.avatarSmall} ${isIssuer ? styles.organizationAvatar : ''}`}>
          {isIssuer ? identityName.slice(0, 2).toUpperCase() : identityName.slice(0, 1).toUpperCase() || 'U'}
        </span>
        <ChevronDown className={isOpen ? styles.profileChevronOpen : undefined} size={15} />
      </button>

      {isOpen && (
        <section className={styles.userPopover} id="account-menu" aria-label="Account menu">
          <div className={styles.userIdentity}>
            <span className={`${styles.avatarSmall} ${isIssuer ? styles.organizationAvatar : ''}`}>
              {isIssuer ? identityName.slice(0, 2).toUpperCase() : identityName.slice(0, 1).toUpperCase() || 'U'}
            </span>
            <div><strong>{identityName}</strong><span>{identityDescription}</span></div>
          </div>

          {switchTargets.length > 0 ? <div className={styles.userMenuSection}>
            <p className={styles.eyebrow}>Workspace</p>
            {switchTargets.map((target) => (
              <form action={switchIdentityAction} key={target.identityId}>
                <input type="hidden" name="identityId" value={target.identityId} />
                <input type="hidden" name="redirectTo" value={labDestination(target.role)} />
                <button className={styles.workspaceSwitch} type="submit">
                  <ArrowLeftRight size={17} />
                  <span><small>Switch to</small>{target.kind === 'authority' ? target.label : target.label || session?.name}</span>
                </button>
              </form>
            ))}
          </div> : null}

          <div className={styles.userMenuSection}>
            <p className={styles.eyebrow}>{isIssuer ? 'Organization' : 'Account'}</p>
            {isIssuer ? <Link href="/aesthetic-lab/issuer/reports" onClick={() => setIsOpen(false)}><FileBarChart2 size={17} /><span>Reports<small>Impact, exports, and activity</small></span></Link> : null}
            <Link href="/aesthetic-lab/cities" onClick={() => setIsOpen(false)}><MapPinned size={17} /><span>My Cities<small>{city?.name ?? 'Choose a city'}</small></span></Link>
            <Link href="/aesthetic-lab/settings" onClick={() => setIsOpen(false)}><Settings2 size={17} /><span>{isIssuer ? 'Settings' : 'Profile &amp; settings'}{isIssuer ? <small>Organization and account controls</small> : null}</span></Link>
            {!isIssuer ? <Link href="/aesthetic-lab/notifications" onClick={() => setIsOpen(false)}><Bell size={17} /><span>Notifications</span></Link> : null}
          </div>

          <div className={styles.userMenuSection}>
            <p className={styles.eyebrow}>Preferences</p>
            <a href="mailto:support@city-sync.org?subject=City%2FSync%20help"><CircleHelp size={17} /><span>Help &amp; support</span></a>
          </div>

          {cities.length > 0 ? <div className={styles.userMenuSection}>
            <p className={styles.eyebrow}>Switch city</p>
            {cities.map((network) => (
              <form action={switchCityAction} key={network.id}>
                <input type="hidden" name="cityId" value={network.id} />
                <input type="hidden" name="redirectTo" value={currentPath} />
                <button type="submit" disabled={network.id === city?.id}><MapPinned size={17} /><span>{network.name}<small>{network.id === city?.id ? 'Selected city network' : 'Switch to this city'}</small></span></button>
              </form>
            ))}
          </div> : null}

          <form action={signOutAction}>
            <button className={styles.signOutButton} type="submit"><LogOut size={17} /> Sign out</button>
          </form>
        </section>
      )}
    </div>
  )
}
