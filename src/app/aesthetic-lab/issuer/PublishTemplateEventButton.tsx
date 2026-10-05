'use client'

import { CalendarPlus, Check, Repeat2, Search, UsersRound, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import {useWorkspaceSave} from './useWorkspaceSave'
import {createPortal} from 'react-dom'
import styles from '../prototype.module.css'

function localDateTimeValue(timestamp: number) {
  const value = new Date(timestamp)
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset())
  return value.toISOString().slice(0, 16)
}

type Template = { id: string; title: string; capacity: number; defaultDurationMinutes?: number }
type Volunteer = { userId: string; name: string; email: string }

/** A template becomes a dated shift here. Private shifts can be staffed before
 * publication, so volunteers receive their assignment as soon as it exists. */
export function PublishTemplateEventButton({
  templates,
  volunteers = [],
  redirectTo,
  suggestedStartsAt,
  buttonLabel = 'Schedule shift',
  defaultVisibility = 'public',
  defaultDurationMinutes = 120,
}: {
  templates: Template[]
  volunteers?: Volunteer[]
  redirectTo: string
  suggestedStartsAt: number
  buttonLabel?: string
  defaultVisibility?: 'public' | 'private'
  defaultDurationMinutes?: number
}) {
  const [open, setOpen] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [visibility, setVisibility] = useState<'public' | 'private'>(defaultVisibility)
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? '')
  const [shiftCapacity, setShiftCapacity] = useState(templates[0]?.capacity ?? 1)
  const [shiftDurationMinutes, setShiftDurationMinutes] = useState(templates[0]?.defaultDurationMinutes ?? defaultDurationMinutes)
  const [query, setQuery] = useState('')
  const [selectedVolunteerIds, setSelectedVolunteerIds] = useState<string[]>([])
  const hasTemplates = templates.length > 0
  const oneTemplate = templates.length === 1
  const capacity = shiftCapacity
  const selectedVolunteerSet = new Set(selectedVolunteerIds)
  const selectedVolunteers = volunteers.filter((volunteer) => selectedVolunteerSet.has(volunteer.userId))
  const filteredVolunteers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return volunteers
    return volunteers.filter((volunteer) => `${volunteer.name} ${volunteer.email}`.toLowerCase().includes(normalized))
  }, [query, volunteers])

  const close = () => {
    setOpen(false)
    setRosterOpen(false)
    setVisibility(defaultVisibility)
    setSelectedTemplateId(templates[0]?.id ?? '')
    setShiftCapacity(templates[0]?.capacity ?? 1)
    setShiftDurationMinutes(templates[0]?.defaultDurationMinutes ?? defaultDurationMinutes)
    setQuery('')
    setSelectedVolunteerIds([])
  }
  const toggleVolunteer = (userId: string) => {
    setSelectedVolunteerIds((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : current.length >= capacity ? current : [...current, userId])
  }
  const setTemplate = (taskId: string) => {
    setSelectedTemplateId(taskId)
    const selectedTemplate = templates.find((template) => template.id === taskId)
    const nextCapacity = selectedTemplate?.capacity ?? 0
    setShiftCapacity(Math.max(1, nextCapacity))
    setShiftDurationMinutes(selectedTemplate?.defaultDurationMinutes ?? defaultDurationMinutes)
    setSelectedVolunteerIds((current) => current.slice(0, nextCapacity))
  }

  const {submit,pending,error}=useWorkspaceSave('publishShift',close)
  return <>
    <button
      type="button"
      className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`}
      disabled={!hasTemplates}
      title={hasTemplates ? 'Choose a volunteer role, then schedule its next shift' : 'Create a volunteer role first'}
      onClick={() => setOpen(true)}
    ><CalendarPlus size={15} /> {buttonLabel}</button>

    {open ? createPortal(<div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={close}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby="publish-template-event-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Shift planning</p><h2 id="publish-template-event-title">Schedule a shift for a volunteer role.</h2><p>Choose the work first, then set its time and decide whether people can sign up or be assigned directly.</p></div>
          <button type="button" aria-label="Close" onClick={close}><X size={18} /></button>
        </div>
        <form action={submit} aria-busy={pending} className={styles.issuerCalendarForm}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          {oneTemplate ? <input type="hidden" name="taskId" value={templates[0].id} /> : <label>Volunteer role
            <select name="taskId" required value={selectedTemplateId} onChange={(event) => setTemplate(event.target.value)}>
              <option value="" disabled>Select a volunteer role</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}
            </select>
          </label>}
          <label>Date and time<input name="startsAt" type="datetime-local" required defaultValue={localDateTimeValue(suggestedStartsAt)} /></label>
          <div className={styles.publishShiftDefaults}>
            <label>Capacity<input name="capacity" type="number" min={1} max={10000} required value={capacity} onChange={(event) => {
              const nextCapacity = Math.max(1, Number(event.target.value) || 1)
              setShiftCapacity(nextCapacity)
              setSelectedVolunteerIds((current) => current.slice(0, nextCapacity))
            }} /></label>
            <label>Duration<select name="durationMinutes" value={String(shiftDurationMinutes)} onChange={(event) => setShiftDurationMinutes(Number(event.target.value))}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option><option value="180">3 hours</option><option value="240">4 hours</option><option value="480">8 hours</option></select></label>
          </div>
          <fieldset className={styles.publishShiftAccessChoices}>
            <legend>Shift access</legend>
            <label data-selected={visibility === 'public' ? 'true' : undefined}><input type="radio" name="visibility" value="public" checked={visibility === 'public'} onChange={() => setVisibility('public')} /><span><b>Public</b><small>Eligible Civic Participants can find and claim a spot.</small></span></label>
            <label data-selected={visibility === 'private' ? 'true' : undefined}><input type="radio" name="visibility" value="private" checked={visibility === 'private'} onChange={() => setVisibility('private')} /><span><b>Private</b><small>Only your organization can assign volunteers from its roster.</small></span></label>
          </fieldset>
          {visibility === 'private' ? <>
            <div className={styles.publishPrivateRoster}>
              <div><b>{selectedVolunteerIds.length ? `${selectedVolunteerIds.length} volunteer${selectedVolunteerIds.length === 1 ? '' : 's'} selected` : 'No volunteers selected yet'}</b><small>{capacity} available spot{capacity === 1 ? '' : 's'} for this shift.</small></div>
              <button type="button" className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} disabled={!volunteers.length || capacity < 1} onClick={() => setRosterOpen(true)}><UsersRound size={14} /> Add Volunteer</button>
            </div>
            {selectedVolunteers.length ? <div className={styles.publishPrivateRosterList} aria-label="Selected volunteers">
              <p>Selected volunteers</p>
              {selectedVolunteers.map((volunteer) => <article key={volunteer.userId}>
                <span>{volunteer.name.slice(0, 2).toUpperCase()}</span>
                <div><b>{volunteer.name}</b><small>{volunteer.email}</small></div>
                <button type="button" aria-label={`Remove ${volunteer.name}`} onClick={() => toggleVolunteer(volunteer.userId)}><X size={13} /></button>
              </article>)}
            </div> : null}
          </> : null}
          {visibility === 'private' ? selectedVolunteerIds.map((userId) => <input type="hidden" key={userId} name="assignedUserId" value={userId} />) : null}
          <p className={styles.publishShiftAccessHint}>{visibility === 'private'
            ? 'This shift will stay out of City/Sync’s public opportunities. Selected volunteers will be notified when it is published.'
            : 'Eligible Civic Participants can find this shift and claim an open spot. You can still add roster members directly later.'}</p>
          <label className={styles.onboardingRecurringChoice}><span><input type="checkbox" name="recurring" value="true" /> <Repeat2 size={15} /> Set up as recurring</span><small>City/Sync keeps one active occurrence at a time, then publishes the next date after the current shift ends.</small></label>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={close}>Cancel</button><button type="submit" disabled={pending}><CalendarPlus size={15} /> Schedule shift</button></div>
          {error?<p role="alert" style={{color:'#99463f',fontSize:12}}>{error}</p>:null}
        </form>
      </section>
    </div>,document.body) : null}

    {open && rosterOpen ? createPortal(<div className={styles.issuerNestedModalBackdrop} role="presentation" onMouseDown={() => setRosterOpen(false)}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby="private-shift-roster-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Private shift roster</p><h2 id="private-shift-roster-title">Add volunteers.</h2><p>Select up to {capacity} person{capacity === 1 ? '' : 's'} from your organization’s full roster. They will receive the shift after it is published.</p></div>
          <button type="button" aria-label="Close" onClick={() => setRosterOpen(false)}><X size={18} /></button>
        </div>
        <div className={styles.issuerCalendarForm}>
          <div className={styles.shiftAssignmentSummary}><span>{capacity} spot{capacity === 1 ? '' : 's'} available</span><b>{selectedVolunteerIds.length} selected</b></div>
          <div className={styles.groupingMemberPicker}>
            <label className={styles.groupingSearch}><Search size={15} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your roster" /></label>
            <div className={styles.groupingMemberList}>
              {filteredVolunteers.length ? filteredVolunteers.map((volunteer) => {
                const selected = selectedVolunteerSet.has(volunteer.userId)
                const disabled = !selected && selectedVolunteerIds.length >= capacity
                return <button type="button" key={volunteer.userId} data-selected={selected ? 'true' : undefined} disabled={disabled} onClick={() => toggleVolunteer(volunteer.userId)}>
                  <span>{selected ? <Check size={13} /> : volunteer.name.slice(0, 2).toUpperCase()}</span>
                  <div><b>{volunteer.name}</b><small>{volunteer.email}</small></div>
                </button>
              }) : <p>No volunteers match that search.</p>}
            </div>
          </div>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setRosterOpen(false)}>Done</button></div>
        </div>
      </section>
    </div>,document.body) : null}
  </>
}
