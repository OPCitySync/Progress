'use client'

import { Check, Search, UserPlus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { assignVolunteersToShiftAction } from '@/app/actions'
import styles from '../prototype.module.css'

type Volunteer = {
  userId: string
  name: string
  email: string
}

/** Staff can add existing roster members to either a public or private shift.
 * The assignment is recorded as a normal commitment and sends the volunteer a
 * direct in-app notification. */
export function ShiftRosterAssignmentButton({
  shiftId,
  title,
  capacity,
  taken,
  visibility,
  volunteers,
  redirectTo,
}: {
  shiftId: string
  title: string
  capacity: number
  taken: number
  visibility: 'public' | 'private'
  volunteers: Volunteer[]
  redirectTo: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const slotsLeft = Math.max(0, capacity - taken)
  const filteredVolunteers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return volunteers
    return volunteers.filter((volunteer) => `${volunteer.name} ${volunteer.email}`.toLowerCase().includes(normalized))
  }, [query, volunteers])
  const selectedSet = new Set(selectedIds)

  const close = () => {
    setOpen(false)
    setQuery('')
    setSelectedIds([])
  }
  const toggleVolunteer = (userId: string) => {
    setSelectedIds((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : current.length >= slotsLeft ? current : [...current, userId])
  }

  return <>
    <button type="button" className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} disabled={!volunteers.length || slotsLeft === 0} onClick={() => setOpen(true)}><UserPlus size={14} /> Assign volunteers</button>
    {open ? <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={close}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby={`assign-shift-${shiftId}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>{visibility === 'private' ? 'Private roster shift' : 'Published shift'}</p><h2 id={`assign-shift-${shiftId}`}>Assign volunteers.</h2><p>Add people already in your roster to {title}. They will receive a City/Sync notification with the shift details.</p></div>
          <button type="button" aria-label="Close" onClick={close}><X size={18} /></button>
        </div>
        <form action={assignVolunteersToShiftAction} className={styles.issuerCalendarForm} onSubmit={close}>
          <input type="hidden" name="shiftId" value={shiftId} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          {selectedIds.map((userId) => <input type="hidden" key={userId} name="userId" value={userId} />)}
          <div className={styles.shiftAssignmentSummary}><span>{slotsLeft} spot{slotsLeft === 1 ? '' : 's'} remaining</span><b>{selectedIds.length} selected</b></div>
          <div className={styles.groupingMemberPicker}>
            <label className={styles.groupingSearch}><Search size={15} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your roster" /></label>
            <div className={styles.groupingMemberList}>
              {filteredVolunteers.length ? filteredVolunteers.map((volunteer) => {
                const selected = selectedSet.has(volunteer.userId)
                const disabled = !selected && selectedIds.length >= slotsLeft
                return <button type="button" key={volunteer.userId} data-selected={selected ? 'true' : undefined} disabled={disabled} onClick={() => toggleVolunteer(volunteer.userId)}>
                  <span>{selected ? <Check size={13} /> : volunteer.name.slice(0, 2).toUpperCase()}</span>
                  <div><b>{volunteer.name}</b><small>{volunteer.email}</small></div>
                </button>
              }) : <p>No volunteers match that search.</p>}
            </div>
          </div>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={close}>Cancel</button><button type="submit" disabled={!selectedIds.length}><UserPlus size={15} /> Assign selected</button></div>
        </form>
      </section>
    </div> : null}
  </>
}
