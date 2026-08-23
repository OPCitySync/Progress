'use client'

import Link from 'next/link'
import { Building2, CalendarDays, ClipboardList, FileBarChart2, FileText, Inbox, MapPinned, Pencil, Plus, Trash2, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import styles from '../prototype.module.css'

const actions = [
  { id: 'workspace', label: 'Workspace', href: '/aesthetic-lab/issuer/catalog', icon: ClipboardList },
  { id: 'new-opportunity', label: 'New opportunity', href: '/aesthetic-lab/issuer/new', icon: Plus },
  { id: 'schedule', label: 'Organization schedule', href: '/aesthetic-lab/issuer', icon: CalendarDays },
  { id: 'volunteers', label: 'Volunteer roster', href: '/aesthetic-lab/issuer/volunteers', icon: UsersRound },
  { id: 'reports', label: 'Impact & reports', href: '/aesthetic-lab/issuer/reports', icon: FileBarChart2 },
  { id: 'profile', label: 'Public profile', href: '/aesthetic-lab/issuer/profile', icon: Building2 },
  { id: 'waiver', label: 'Liability waivers', href: '/aesthetic-lab/issuer/waiver', icon: FileText },
  { id: 'events', label: 'Today’s city events', href: '/aesthetic-lab/issuer/events', icon: MapPinned },
  { id: 'notifications', label: 'Inbox', href: '/aesthetic-lab/issuer/notifications', icon: Inbox },
] as const

type ActionId = (typeof actions)[number]['id']

/** Organization-local shortcuts, intentionally empty until the team pins a function. */
export function IssuerQuickActions({ organizationId }: { organizationId: string }) {
  const storageKey = `citysync.aesthetic-lab.issuer-quick-actions.${organizationId}`
  const [pinned, setPinned] = useState<ActionId[]>([])
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
      if (Array.isArray(saved)) setPinned(saved.filter((id): id is ActionId => actions.some((action) => action.id === id)))
    } catch {
      setPinned([])
    }
  }, [storageKey])

  const pinnedActions = useMemo(() => actions.filter((action) => pinned.includes(action.id)), [pinned])
  const availableActions = useMemo(() => actions.filter((action) => !pinned.includes(action.id)), [pinned])

  function save(next: ActionId[]) {
    setPinned(next)
    window.localStorage.setItem(storageKey, JSON.stringify(next))
  }

  function add(id: string) {
    if (!actions.some((action) => action.id === id) || pinned.includes(id as ActionId)) return
    save([...pinned, id as ActionId])
    setIsPickerOpen(false)
  }

  function remove(id: ActionId) {
    save(pinned.filter((item) => item !== id))
    setIsEditing(false)
  }

  return (
    <section className={styles.issuerQuickActions} aria-label="Quick actions">
      <div className={styles.issuerQuickActionsHeading}>
        <div><p className={styles.eyebrow}>Quick actions</p><span>Customize your shortcuts</span></div>
        <div className={styles.issuerQuickActionControls}>
          <div className={styles.issuerQuickActionPicker}>
            <button type="button" className={styles.issuerQuickActionAddButton} onClick={() => { setIsPickerOpen((open) => !open); setIsEditing(false) }} aria-expanded={isPickerOpen} aria-label="Add a quick action"><Plus size={17} /></button>
            {isPickerOpen ? <div className={styles.issuerQuickActionPickerPopover}>
              <p>Add a function</p>
              {availableActions.length ? <div>{availableActions.map((action) => {
                const Icon = action.icon
                return <button type="button" key={action.id} onClick={() => add(action.id)}><Icon size={14} /><span>{action.label}</span></button>
              })}</div> : <span className={styles.issuerQuickActionPickerEmpty}>All available functions are already pinned.</span>}
            </div> : null}
          </div>
          <button type="button" className={`${styles.issuerQuickActionEditButton}${isEditing ? ` ${styles.issuerQuickActionEditButtonActive}` : ''}`} onClick={() => { setIsEditing((editing) => !editing); setIsPickerOpen(false) }} aria-pressed={isEditing} aria-label={isEditing ? 'Finish editing quick actions' : 'Edit quick actions'}><Pencil size={14} /></button>
        </div>
      </div>
      {pinnedActions.length ? <div className={styles.issuerQuickActionList}>
        {pinnedActions.map((action) => {
          const Icon = action.icon
          return <div className={styles.issuerQuickAction} key={action.id}>
            <Link href={action.href}><Icon size={15} /> <span>{action.label}</span></Link>
            {isEditing ? <button type="button" onClick={() => remove(action.id)} aria-label={`Remove ${action.label} from quick actions`}><Trash2 size={13} /></button> : null}
          </div>
        })}
      </div> : <p className={styles.issuerQuickActionsEmpty}>Pin the functions your organization uses most.</p>}
    </section>
  )
}
