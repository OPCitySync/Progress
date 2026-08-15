'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowLeftRight,
  Bell,
  ChevronDown,
  CircleHelp,
  LogOut,
  MapPinned,
  Settings2,
  Sun,
} from 'lucide-react'
import styles from './prototype.module.css'

export function UserMenu({ workspace = 'participant' }: { workspace?: 'participant' | 'issuer' }) {
  const [isOpen, setIsOpen] = useState(false)
  const isIssuer = workspace === 'issuer'
  const identityName = isIssuer ? 'East Bay Food Collective' : 'naynaysoo'
  const identityDescription = isIssuer ? 'Issuer Organization · Berkeley, CA' : 'Civic Participant · Berkeley, CA'
  const destination = isIssuer ? '/aesthetic-lab' : '/aesthetic-lab/issuer'
  const destinationName = isIssuer ? 'naynaysoo' : 'East Bay Food Collective'

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
        <span className={styles.avatarSmall}>N</span>
        <ChevronDown className={isOpen ? styles.profileChevronOpen : undefined} size={15} />
      </button>

      {isOpen && (
        <section className={styles.userPopover} id="account-menu" aria-label="Account menu">
          <div className={styles.userIdentity}>
            <span className={`${styles.avatarSmall} ${isIssuer ? styles.organizationAvatar : ''}`}>{isIssuer ? 'EB' : 'N'}</span>
            <div><strong>{identityName}</strong><span>{identityDescription}</span></div>
          </div>

          <div className={styles.userMenuSection}>
            <p className={styles.eyebrow}>Workspace</p>
            <Link className={styles.workspaceSwitch} href={destination} onClick={() => setIsOpen(false)}>
              <ArrowLeftRight size={17} />
              <span><small>Switch to</small>{destinationName}</span>
            </Link>
          </div>

          <div className={styles.userMenuSection}>
            <p className={styles.eyebrow}>Account</p>
            <button type="button"><MapPinned size={17} /><span>My Cities<small>Berkeley, CA</small></span></button>
            <button type="button"><Settings2 size={17} /><span>Profile &amp; settings</span></button>
            <button type="button"><Bell size={17} /><span>Notifications<small>2 unread</small></span></button>
          </div>

          <div className={styles.userMenuSection}>
            <p className={styles.eyebrow}>Preferences</p>
            <button type="button"><Sun size={17} /><span>Appearance<small>Light theme</small></span></button>
            <button type="button"><CircleHelp size={17} /><span>Help &amp; support</span></button>
          </div>

          <button className={styles.signOutButton} type="button"><LogOut size={17} /> Sign out</button>
        </section>
      )}
    </div>
  )
}
