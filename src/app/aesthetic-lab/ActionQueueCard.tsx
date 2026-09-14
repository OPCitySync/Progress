'use client'

import Link from 'next/link'
import { ChevronDown, ChevronUp, ClipboardList } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import styles from './prototype.module.css'

type ActionQueueCardProps = {
  children: ReactNode
  historyHref: string
  historyLabel: string
  className?: string
  defaultCollapsed?: boolean
}

/** A compact queue that preserves its history shortcut when the details are hidden. */
export function ActionQueueCard({ children, historyHref, historyLabel, className, defaultCollapsed = false }: ActionQueueCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return <section className={`${styles.issuerTaskQueue}${className ? ` ${className}` : ''}${collapsed ? ` ${styles.issuerTaskQueueCollapsed}` : ''}`} aria-label="Action queue">
    <div className={styles.issuerPanelHeading}>
      <div><p className={styles.eyebrow}>Action Queue</p></div>
      <div className={styles.issuerQueueHeaderActions}>
        <button
          type="button"
          className={styles.issuerQueueCollapseButton}
          onClick={() => setCollapsed((current) => !current)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand Action Queue' : 'Collapse Action Queue'}
          title={collapsed ? 'Expand Action Queue' : 'Collapse Action Queue'}
        >
          {collapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
        </button>
        <Link className={styles.issuerQueueHistoryLink} href={historyHref} aria-label={historyLabel} title={historyLabel}>
          <ClipboardList size={19} />
        </Link>
      </div>
    </div>
    {!collapsed ? children : null}
  </section>
}
