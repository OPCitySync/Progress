'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell, MessageCircle } from 'lucide-react'
import styles from './prototype.module.css'

export function NotificationsControl({
  count = 0,
  href = '/aesthetic-lab/notifications',
  label = 'Notifications',
  variant = 'notifications',
}: {
  count?: number
  href?: string
  label?: string
  variant?: 'notifications' | 'messages'
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const Icon = variant === 'messages' ? MessageCircle : Bell
  const showLabel = variant === 'messages' || isExpanded

  return (
    <nav className={styles.utilityNav} aria-label={`${label} utilities`}>
      <Link
        href={href}
        type="button"
        aria-expanded={variant === 'notifications' ? isExpanded : undefined}
        aria-label={variant === 'messages' ? `Open ${label}` : isExpanded ? `Open ${label}` : `Show ${label} label`}
        onClick={(event) => {
          if (variant === 'notifications' && !isExpanded) {
            event.preventDefault()
            setIsExpanded(true)
          }
        }}
      >
        <Icon size={19} />
        {showLabel && <span>{label}</span>}
        {count > 0 ? <b>{count > 99 ? '99+' : count}</b> : null}
      </Link>
    </nav>
  )
}
