'use client'

import Link from 'next/link'
import { Building2, ClipboardList, FileBarChart2, FileText, FolderOpen, GripVertical, Inbox, Pencil, Plus, Trash2, UsersRound } from 'lucide-react'
import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import styles from '../prototype.module.css'

const actions = [
  { id: 'workspace', label: 'Workspace', href: '/aesthetic-lab/issuer/catalog', icon: ClipboardList },
  { id: 'documents', label: 'Document Library', href: '/aesthetic-lab/issuer/documents', icon: FolderOpen },
  { id: 'new-opportunity', label: 'Schedule Shift', href: '/aesthetic-lab/issuer/new', icon: Plus },
  { id: 'volunteers', label: 'Volunteer Roster', href: '/aesthetic-lab/issuer/volunteers', icon: UsersRound },
  { id: 'reports', label: 'Impact & Reports', href: '/aesthetic-lab/issuer/reports', icon: FileBarChart2 },
  { id: 'profile', label: 'Public Profile', href: '/aesthetic-lab/issuer/profile', icon: Building2 },
  { id: 'waiver', label: 'Liability Waivers', href: '/aesthetic-lab/issuer/waiver', icon: FileText },
  { id: 'notifications', label: 'Inbox', href: '/aesthetic-lab/issuer/notifications', icon: Inbox },
] as const

type ActionId = (typeof actions)[number]['id']
type DropEdge = 'before' | 'after'

/** Organization-local shortcuts, intentionally empty until the team pins a function. */
export function IssuerQuickActions({ organizationId }: { organizationId: string }) {
  const storageKey = `citysync.aesthetic-lab.issuer-quick-actions.${organizationId}`
  const cardRef = useRef<HTMLElement>(null)
  const [pinned, setPinned] = useState<ActionId[]>([])
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draggedId, setDraggedId] = useState<ActionId | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: ActionId; edge: DropEdge } | null>(null)

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
      if (Array.isArray(saved)) setPinned(saved.filter((id): id is ActionId => actions.some((action) => action.id === id)))
    } catch {
      setPinned([])
    }
  }, [storageKey])

  useEffect(() => {
    if (!isEditing && !isPickerOpen) return

    function closeControls(event: PointerEvent) {
      if (cardRef.current?.contains(event.target as Node)) return
      setIsEditing(false)
      setIsPickerOpen(false)
    }

    document.addEventListener('pointerdown', closeControls)
    return () => document.removeEventListener('pointerdown', closeControls)
  }, [isEditing, isPickerOpen])

  const pinnedActions = useMemo(() => pinned.flatMap((id) => {
    const action = actions.find((candidate) => candidate.id === id)
    return action ? [action] : []
  }), [pinned])
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
  }

  function startDrag(event: DragEvent<HTMLDivElement>, id: ActionId) {
    setDraggedId(id)
    setDropTarget(null)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/citysync-quick-action', id)
  }

  function dragOver(event: DragEvent<HTMLDivElement>, id: ActionId) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (id === draggedId) {
      setDropTarget(null)
      return
    }
    const bounds = event.currentTarget.getBoundingClientRect()
    const edge: DropEdge = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
    setDropTarget({ id, edge })
  }

  function drop(event: DragEvent<HTMLDivElement>, targetId: ActionId) {
    event.preventDefault()
    const transferredId = event.dataTransfer.getData('text/citysync-quick-action')
    const sourceId = draggedId ?? (actions.some((action) => action.id === transferredId) ? transferredId as ActionId : null)
    if (!sourceId || sourceId === targetId || !pinned.includes(sourceId)) {
      setDraggedId(null)
      setDropTarget(null)
      return
    }

    const edge = dropTarget?.id === targetId ? dropTarget.edge : 'before'
    const reordered = pinned.filter((id) => id !== sourceId)
    const targetIndex = reordered.indexOf(targetId)
    const insertionIndex = targetIndex + (edge === 'after' ? 1 : 0)
    reordered.splice(insertionIndex, 0, sourceId)
    save(reordered)
    setDraggedId(null)
    setDropTarget(null)
  }

  return (
    <section ref={cardRef} className={styles.issuerQuickActions} aria-label="Quick actions">
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
      <div className={styles.issuerQuickActionList}>
        {pinnedActions.map((action) => {
          const Icon = action.icon
          return <div
            className={styles.issuerQuickAction}
            key={action.id}
            draggable
            data-dragging={draggedId === action.id ? 'true' : undefined}
            data-drop-edge={dropTarget?.id === action.id ? dropTarget.edge : undefined}
            onDragStart={(event) => startDrag(event, action.id)}
            onDragOver={(event) => dragOver(event, action.id)}
            onDrop={(event) => drop(event, action.id)}
            onDragEnd={() => { setDraggedId(null); setDropTarget(null) }}
          >
            <span className={styles.issuerQuickActionGrip} aria-hidden="true" title="Drag to reorder"><GripVertical size={13} /></span>
            <Link href={action.href}><Icon size={15} /> <span>{action.label}</span></Link>
            {isEditing ? <button type="button" onClick={() => remove(action.id)} aria-label={`Remove ${action.label} from quick actions`}><Trash2 size={13} /></button> : null}
          </div>
        })}
      </div>
    </section>
  )
}
