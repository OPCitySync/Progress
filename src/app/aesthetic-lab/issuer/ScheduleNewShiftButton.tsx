'use client'

import { ArrowLeft, CalendarDays, CalendarPlus, Check, ChevronDown, Repeat2, Search, UserRoundCog, UsersRound, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDateTimePicker } from './AddCalendarEntryButton'
import { OnboardingSessionPackageFields, type OnboardingDocumentOption, type OnboardingWaiverOption } from './OnboardingSessionPackageFields'
import { useWorkspaceSave } from './useWorkspaceSave'
import styles from '../prototype.module.css'

function localDateTimeValue(value: Date) {
  const local = new Date(value)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(0, 16)
}

function displayDateTime(value: Date) {
  return new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }).format(value)
}

/**
 * Schedules a shift directly and quietly saves its reusable fields as the
 * volunteer role behind it. Roster assignments remain in Shift Planning.
 */
export function ScheduleNewShiftButton({
  programId,
  redirectTo,
  suggestedStartsAt,
  defaultLocation = '',
  defaultCapacity = 2,
  defaultDurationMinutes = 120,
  defaultVisibility = 'private',
  documents = [],
  waivers = [],
  buttonLabel = 'Schedule shift',
  triggerClassName = '',
  privateRosterFlow = false,
  volunteers = [],
  staff = [],
}: {
  programId: string | null
  redirectTo: string
  suggestedStartsAt: number
  defaultLocation?: string
  defaultCapacity?: number
  defaultDurationMinutes?: number
  defaultVisibility?: 'public' | 'private'
  documents?: OnboardingDocumentOption[]
  waivers?: OnboardingWaiverOption[]
  buttonLabel?: string
  triggerClassName?: string
  privateRosterFlow?: boolean
  volunteers?: Array<{ userId: string; name: string; email: string; status?: string }>
  staff?: Array<{ userId: string; name: string; email: string; roleLabel: string }>
}) {
  const [open, setOpen] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [visibility, setVisibility] = useState<'public' | 'private'>(defaultVisibility)
  const [capacity, setCapacity] = useState(defaultCapacity)
  const [durationMinutes, setDurationMinutes] = useState(defaultDurationMinutes)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState(() => new Date(suggestedStartsAt))
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerOriginal, setPickerOriginal] = useState<Date | null>(null)
  const [rosterQuery, setRosterQuery] = useState('')
  const [selectedVolunteerIds, setSelectedVolunteerIds] = useState<string[]>([])
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
  const formRef = useRef<HTMLFormElement>(null)
  const normalizedRosterQuery = rosterQuery.trim().toLowerCase()
  const filteredVolunteers = useMemo(() => !normalizedRosterQuery
    ? volunteers
    : volunteers.filter((person) => `${person.name} ${person.email} ${person.status ?? ''}`.toLowerCase().includes(normalizedRosterQuery)), [normalizedRosterQuery, volunteers])
  const filteredStaff = useMemo(() => !normalizedRosterQuery
    ? staff
    : staff.filter((person) => `${person.name} ${person.email} ${person.roleLabel}`.toLowerCase().includes(normalizedRosterQuery)), [normalizedRosterQuery, staff])
  const selectedVolunteerSet = new Set(selectedVolunteerIds)
  const selectedStaffSet = new Set(selectedStaffIds)
  const selectedRosterCount = selectedVolunteerIds.length + selectedStaffIds.length

  const close = () => {
    setOpen(false)
    setRosterOpen(false)
    setPickerOpen(false)
    setPickerOriginal(null)
    setVisibility(defaultVisibility)
    setCapacity(defaultCapacity)
    setDurationMinutes(defaultDurationMinutes)
    setTitle('')
    setDescription('')
    setRosterQuery('')
    setSelectedVolunteerIds([])
    setSelectedStaffIds([])
  }
  const openModal = () => {
    setStartsAt(new Date(suggestedStartsAt))
    setPickerOpen(false)
    setPickerOriginal(null)
    setOpen(true)
  }
  const openPicker = () => {
    setPickerOriginal(new Date(startsAt))
    setPickerOpen(true)
  }
  const closePicker = (save: boolean) => {
    if (!save && pickerOriginal) setStartsAt(pickerOriginal)
    setPickerOriginal(null)
    setPickerOpen(false)
  }
  const { submit, pending, error } = useWorkspaceSave('shift', close)
  const toggleVolunteer = (userId: string) => {
    setSelectedVolunteerIds((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : current.length >= capacity ? current : [...current, userId])
  }
  const toggleStaff = (userId: string) => {
    setSelectedStaffIds((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId])
  }
  const openRoster = () => {
    if (!formRef.current?.reportValidity()) return
    setRosterOpen(true)
  }
  const submitFromRoster = () => formRef.current?.requestSubmit()

  return <>
    <button type="button" className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton} ${triggerClassName}`} onClick={openModal}><CalendarPlus size={15} /> {buttonLabel}</button>

    {open ? createPortal(<div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={close}>
      <section className={`${styles.issuerCalendarModal} ${styles.scheduleNewShiftModal} ${pickerOpen ? styles.issuerCalendarModalPicker : ''}`} role="dialog" aria-modal="true" aria-label={pickerOpen ? 'Shift date and time picker' : 'Schedule a shift'} onMouseDown={(event) => event.stopPropagation()}>
        {pickerOpen ? null : <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Shift planning</p><h2 id={`schedule-new-shift-${programId ?? 'organization'}`}>Schedule a shift.</h2><p>Choose who can access the shift, then add its schedule and volunteer capacity.</p></div>
          <button type="button" aria-label="Close" onClick={close}><X size={18} /></button>
        </div>}
        <form ref={formRef} action={submit} aria-busy={pending} className={styles.issuerCalendarForm}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="programId" value={programId ?? ''} />
          <input type="hidden" name="taskId" value="" />
          <input type="hidden" name="location" value={defaultLocation} />
          <input type="hidden" name="startsAt" value={localDateTimeValue(startsAt)} />
          <input type="hidden" name="title" value={title} />
          <input type="hidden" name="capacity" value={capacity} />
          <input type="hidden" name="durationMinutes" value={durationMinutes} />
          <input type="hidden" name="visibility" value={visibility} />
          {privateRosterFlow ? <input type="hidden" name="requirePrivateRosterSelection" value="true" /> : null}
          {visibility === 'private' ? selectedVolunteerIds.map((userId) => <input type="hidden" name="assignedUserId" value={userId} key={`volunteer-${userId}`} />) : null}
          {visibility === 'private' ? selectedStaffIds.map((userId) => <input type="hidden" name="assignedStaffUserId" value={userId} key={`staff-${userId}`} />) : null}
          {pickerOpen ? <div className={styles.issuerCalendarPickerStage}><CalendarDateTimePicker label="Shift date" value={startsAt} onChange={setStartsAt} onCancel={() => closePicker(false)} onDone={() => closePicker(true)} /></div> : null}
          <div className={styles.issuerCalendarFormStage} hidden={pickerOpen}>
            <fieldset className={`${styles.publishShiftAccessChoices} ${styles.scheduleShiftAccessFirst}`}>
              <legend>Who can access this shift?</legend>
              <label data-selected={visibility === 'private' ? 'true' : undefined}><input type="radio" name="visibilityChoice" value="private" checked={visibility === 'private'} onChange={() => setVisibility('private')} /><span><b>Private</b><small>Plan internally and assign people from your roster.</small></span></label>
              <label data-selected={visibility === 'public' ? 'true' : undefined}><input type="radio" name="visibilityChoice" value="public" checked={visibility === 'public'} onChange={() => setVisibility('public')} /><span><b>Public</b><small>List this shift so eligible Civic Participants can find and claim a spot.</small></span></label>
            </fieldset>
            <label>Shift Title<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Saturday pantry sorting" /></label>
            <section className={styles.scheduleShiftPublicDetails} hidden={visibility !== 'public'} aria-label="Public opportunity details">
              <div><p className={styles.eyebrow}>Public Opportunity Details</p><small>This information helps Civic Participants understand the shift before joining.</small></div>
              <label>Public Description<textarea name="description" required={visibility === 'public'} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what volunteers will do and what they should expect." /></label>
              <OnboardingSessionPackageFields
                documents={documents}
                waivers={waivers}
                defaultSelectAllWaivers={false}
                pickerDescription="Select the waivers and materials participants should receive with this public shift."
              />
            </section>
            <div className={styles.issuerCalendarDatePicker}>
              <span>Date and time</span>
              <button type="button" className={styles.issuerCalendarDateTrigger} onClick={openPicker}><CalendarDays size={14} aria-hidden="true" /><span>{displayDateTime(startsAt)}</span><ChevronDown size={14} aria-hidden="true" /></button>
            </div>
            <div className={styles.publishShiftDefaults}>
              <label>Volunteers/Shift<input type="number" min={1} max={10000} required value={capacity} onChange={(event) => {
                const nextCapacity = Math.max(1, Number(event.target.value) || 1)
                setCapacity(nextCapacity)
                setSelectedVolunteerIds((current) => current.slice(0, nextCapacity))
              }} /></label>
              <label>Duration<select value={String(durationMinutes)} onChange={(event) => setDurationMinutes(Number(event.target.value))}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option><option value="180">3 hours</option><option value="240">4 hours</option><option value="480">8 hours</option></select></label>
            </div>
            {privateRosterFlow ? null : <label className={styles.onboardingRecurringChoice}><span><input type="checkbox" name="recurring" value="true" /> <Repeat2 size={15} /> Repeat weekly</span><small>The first shift publishes now. Each next occurrence publishes after the current one ends.</small></label>}
            <div className={styles.issuerCalendarFormActions}><button type="button" onClick={close}>Cancel</button>{privateRosterFlow && visibility === 'private'
              ? <button type="button" className={styles.scheduleShiftNextButton} disabled={pending} onClick={openRoster}><UsersRound size={15} /> Add Volunteers</button>
              : <button type="submit" disabled={pending}><CalendarPlus size={15} /> Schedule shift</button>}</div>
            {error ? <p role="alert" style={{ color: '#99463f', fontSize: 12 }}>{error}</p> : null}
          </div>
        </form>
      </section>
    </div>, document.body) : null}

    {open && rosterOpen ? createPortal(<div className={`${styles.issuerNestedModalBackdrop} ${styles.scheduleShiftRosterBackdrop}`} role="presentation" onMouseDown={() => setRosterOpen(false)}>
      <section className={`${styles.issuerCalendarModal} ${styles.scheduleShiftRosterModal}`} role="dialog" aria-modal="true" aria-labelledby="schedule-shift-roster-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Private shift roster</p><h2 id="schedule-shift-roster-title">Add volunteers and staff.</h2><p>Select the people working this shift. Staff support does not use the {capacity} volunteer spot{capacity === 1 ? '' : 's'}.</p></div>
          <button type="button" aria-label="Close roster selection" onClick={() => setRosterOpen(false)}><X size={18} /></button>
        </div>
        <div className={`${styles.issuerCalendarForm} ${styles.scheduleShiftRosterBody}`}>
          <div className={styles.shiftAssignmentSummary}><span>{selectedVolunteerIds.length} of {capacity} volunteer spot{capacity === 1 ? '' : 's'} filled</span><b>{selectedStaffIds.length} staff · {selectedRosterCount} total</b></div>
          <label className={styles.groupingSearch}><Search size={15} /><input type="search" value={rosterQuery} onChange={(event) => setRosterQuery(event.target.value)} placeholder="Search staff and volunteers" autoFocus /></label>
          <div className={styles.scheduleShiftRosterGroups}>
            <section>
              <div className={styles.scheduleShiftRosterGroupHeading}><UserRoundCog size={15} /><b>Organizational staff</b><small>{staff.length} available</small></div>
              <div className={styles.groupingMemberList}>
                {filteredStaff.length ? filteredStaff.map((person) => {
                  const selected = selectedStaffSet.has(person.userId)
                  return <button type="button" key={person.userId} aria-pressed={selected} data-selected={selected ? 'true' : undefined} disabled={pending} onClick={() => toggleStaff(person.userId)}>
                    <span>{selected ? <Check size={13} /> : person.name.slice(0, 2).toUpperCase()}</span>
                    <div><b>{person.name}</b><small>{person.roleLabel} · {person.email}</small></div>
                  </button>
                }) : <p>No staff match this search.</p>}
              </div>
            </section>
            <section>
              <div className={styles.scheduleShiftRosterGroupHeading}><UsersRound size={15} /><b>Volunteer roster</b><small>{selectedVolunteerIds.length} / {capacity} selected</small></div>
              <div className={styles.groupingMemberList}>
                {filteredVolunteers.length ? filteredVolunteers.map((person) => {
                  const selected = selectedVolunteerSet.has(person.userId)
                  const disabled = pending || (!selected && selectedVolunteerIds.length >= capacity)
                  return <button type="button" key={person.userId} aria-pressed={selected} data-selected={selected ? 'true' : undefined} disabled={disabled} onClick={() => toggleVolunteer(person.userId)}>
                    <span>{selected ? <Check size={13} /> : person.name.slice(0, 2).toUpperCase()}</span>
                    <div><b>{person.name}</b><small>{person.email}</small></div>
                  </button>
                }) : <p>No volunteers match this search.</p>}
              </div>
            </section>
          </div>
          {error ? <p role="alert" className={styles.scheduleShiftRosterError}>{error}</p> : null}
          <div className={styles.issuerCalendarFormActions}><button type="button" disabled={pending} onClick={() => setRosterOpen(false)}><ArrowLeft size={15} /> Back</button><button type="button" className={styles.scheduleShiftRosterConfirm} disabled={pending || selectedRosterCount === 0} onClick={submitFromRoster}><CalendarPlus size={15} /> {pending ? 'Scheduling…' : 'Schedule shift'}</button></div>
        </div>
      </section>
    </div>, document.body) : null}
  </>
}
