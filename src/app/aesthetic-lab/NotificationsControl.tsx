'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import styles from './prototype.module.css'

export function NotificationsControl({ count = 0 }: { count?: number }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <nav className={styles.utilityNav} aria-label="Participant utilities">
      <Link
        href="/aesthetic-lab/notifications"
        type="button"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Hide Notifications label' : 'Show Notifications label'}
        onClick={(event) => {
          if (!isExpanded) {
            event.preventDefault()
            setIsExpanded(true)
          }
        }}
      >
        <Bell size={19} />
        {isExpanded && <span>Notifications</span>}
        {count > 0 ? <b>{count > 99 ? '99+' : count}</b> : null}
      </Link>
    </nav>
  )
}
