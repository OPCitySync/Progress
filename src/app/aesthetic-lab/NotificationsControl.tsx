'use client'

import { useState } from 'react'
import { Bell } from 'lucide-react'
import styles from './prototype.module.css'

export function NotificationsControl() {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <nav className={styles.utilityNav} aria-label="Participant utilities">
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Hide Notifications label' : 'Show Notifications label'}
        onClick={() => setIsExpanded((expanded) => !expanded)}
      >
        <Bell size={19} />
        {isExpanded && <span>Notifications</span>}
        <b>2</b>
      </button>
    </nav>
  )
}
