import Link from 'next/link'
import { Bell, Inbox } from 'lucide-react'
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
  const Icon = variant === 'messages' ? Inbox : Bell

  return (
    <nav className={styles.utilityNav} data-utility={variant} aria-label={`${label} utilities`}>
      <Link
        href={href}
        aria-label={`Open ${label}`}
        title={label}
      >
        <Icon size={19} />
        {count > 0 ? <b>{count > 99 ? '99+' : count}</b> : null}
      </Link>
    </nav>
  )
}
