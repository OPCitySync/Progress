'use client'

import { Check, Plus, Search, UsersRound, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createVolunteerGroupAction } from '@/app/actions'
import styles from '../prototype.module.css'

type Volunteer = {
  userId: string
  name: string
  email: string
}

type Group = {
  id: string
  name: string
  memberIds: string[]
}

export function VolunteerGroupingManager({ groups, volunteers }: { groups: Group[]; volunteers: Volunteer[] }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const volunteersById = useMemo(() => new Map(volunteers.map((volunteer) => [volunteer.userId, volunteer])), [volunteers])
  const filteredVolunteers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return volunteers
    return volunteers.filter((volunteer) => (
      volunteer.name.toLocaleLowerCase().includes(normalizedQuery)
      || volunteer.email.toLocaleLowerCase().includes(normalizedQuery)
    ))
  }, [query, volunteers])
  const selectedSet = new Set(selectedIds)
  const allFilteredSelected = filteredVolunteers.length > 0 && filteredVolunteers.every((volunteer) => selectedSet.has(volunteer.userId))

  const toggleMember = (userId: string) => {
    setSelectedIds((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId])
  }

  const toggleFilteredMembers = () => {
    const filteredIds = new Set(filteredVolunteers.map((volunteer) => volunteer.userId))
    setSelectedIds((current) => {
      if (allFilteredSelected) return current.filter((userId) => !filteredIds.has(userId))
      return Array.from(new Set([...current, ...Array.from(filteredIds)]))
    })
  }

  const close = () => {
    setOpen(false)
    setQuery('')
    setSelectedIds([])
  }

  return <section className={`${styles.labPanel} ${styles.volunteerGroupingCard}`}>
    <div className={styles.volunteerGroupingHeading}>
      <div><p className={styles.eyebrow}>Volunteer groupings</p><h2>Organize your roster your way.</h2><p>Use groups to keep crews, programs, and repeat volunteers easy to find.</p></div>
      <button type="button" className={`${styles.catalogWorkspaceAction} ${styles.groupingCreateTrigger}`} onClick={() => setOpen(true)}>Create group</button>
    </div>

    {groups.length ? <div className={styles.groupingAccordionList}>{groups.map((group) => {
      const members = group.memberIds.map((userId) => volunteersById.get(userId)).filter((volunteer): volunteer is Volunteer => Boolean(volunteer))
      return <details className={styles.groupingDetails} key={group.id}>
        <summary><span><UsersRound size={15} /></span><div><b>{group.name}</b><small>{group.memberIds.length} volunteer{group.memberIds.length === 1 ? '' : 's'}</small></div></summary>
        <div className={styles.groupingParticipants}>
          {members.length ? members.map((volunteer) => <article key={volunteer.userId}><span>{volunteer.name.slice(0, 2).toUpperCase()}</span><div><b>{volunteer.name}</b><small>{volunteer.email}</small></div></article>) : <p>This group does not have any current roster members yet.</p>}
        </div>
      </details>
    })}</div> : <div className={styles.groupingEmpty}><UsersRound size={18} /><div><b>No groups yet.</b><p>Create a grouping whenever a team, program, or crew would be useful.</p></div></div>}

    {open ? <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={close}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby="create-volunteer-group-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Volunteer groupings</p><h2 id="create-volunteer-group-title">Create a group.</h2><p>Name the group, then add people from your current roster. You can start with an empty group and add people later if needed.</p></div>
          <button type="button" aria-label="Close" onClick={close}><X size={18} /></button>
        </div>
        <form action={createVolunteerGroupAction} className={styles.issuerCalendarForm} onSubmit={close}>
          <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/volunteers" />
          {selectedIds.map((userId) => <input type="hidden" name="memberId" value={userId} key={userId} />)}
          <label>Group name<input name="name" required maxLength={80} autoFocus placeholder="e.g. Saturday crew" /></label>
          <div className={styles.groupingMemberPicker}>
            <div className={styles.groupingMemberPickerHeading}><div><b>Add volunteers</b><small>{selectedIds.length} selected</small></div><button type="button" onClick={toggleFilteredMembers} disabled={!filteredVolunteers.length}>{allFilteredSelected ? 'Clear all' : 'Select all'}</button></div>
            <label className={styles.groupingSearch}><Search size={15} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your roster" /></label>
            <div className={styles.groupingMemberList}>
              {filteredVolunteers.length ? filteredVolunteers.map((volunteer) => {
                const isSelected = selectedSet.has(volunteer.userId)
                return <button type="button" key={volunteer.userId} data-selected={isSelected ? 'true' : undefined} onClick={() => toggleMember(volunteer.userId)}>
                  <span>{isSelected ? <Check size={13} /> : volunteer.name.slice(0, 2).toUpperCase()}</span>
                  <div><b>{volunteer.name}</b><small>{volunteer.email}</small></div>
                </button>
              }) : <p>No volunteers match that search.</p>}
            </div>
          </div>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={close}>Cancel</button><button className={styles.groupingSaveButton} type="submit"><Plus size={15} /> Create group</button></div>
        </form>
      </section>
    </div> : null}
  </section>
}
