'use client'

import { CalendarDays, CalendarPlus, ChevronDown, Repeat2, X } from 'lucide-react'
import { useState } from 'react'
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
}) {
  const [open, setOpen] = useState(false)
  const [visibility, setVisibility] = useState<'public' | 'private'>(defaultVisibility)
  const [capacity, setCapacity] = useState(defaultCapacity)
  const [durationMinutes, setDurationMinutes] = useState(defaultDurationMinutes)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState(() => new Date(suggestedStartsAt))
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerOriginal, setPickerOriginal] = useState<Date | null>(null)

  const close = () => {
    setOpen(false)
    setPickerOpen(false)
    setPickerOriginal(null)
    setVisibility(defaultVisibility)
    setCapacity(defaultCapacity)
    setDurationMinutes(defaultDurationMinutes)
    setTitle('')
    setDescription('')
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

  return <>
    <button type="button" className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} onClick={openModal}><CalendarPlus size={15} /> {buttonLabel}</button>

    {open ? createPortal(<div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={close}>
      <section className={`${styles.issuerCalendarModal} ${styles.scheduleNewShiftModal} ${pickerOpen ? styles.issuerCalendarModalPicker : ''}`} role="dialog" aria-modal="true" aria-label={pickerOpen ? 'Shift date and time picker' : 'Schedule a shift'} onMouseDown={(event) => event.stopPropagation()}>
        {pickerOpen ? null : <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Shift planning</p><h2 id={`schedule-new-shift-${programId ?? 'organization'}`}>Schedule a shift.</h2><p>Choose who can access the shift, then add its schedule and volunteer capacity.</p></div>
          <button type="button" aria-label="Close" onClick={close}><X size={18} /></button>
        </div>}
        <form action={submit} aria-busy={pending} className={styles.issuerCalendarForm}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="programId" value={programId ?? ''} />
          <input type="hidden" name="taskId" value="" />
          <input type="hidden" name="location" value={defaultLocation} />
          <input type="hidden" name="startsAt" value={localDateTimeValue(startsAt)} />
          <input type="hidden" name="title" value={title} />
          <input type="hidden" name="capacity" value={capacity} />
          <input type="hidden" name="durationMinutes" value={durationMinutes} />
          <input type="hidden" name="visibility" value={visibility} />
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
              <label>Volunteers/Shift<input type="number" min={1} max={10000} required value={capacity} onChange={(event) => setCapacity(Math.max(1, Number(event.target.value) || 1))} /></label>
              <label>Duration<select value={String(durationMinutes)} onChange={(event) => setDurationMinutes(Number(event.target.value))}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option><option value="180">3 hours</option><option value="240">4 hours</option><option value="480">8 hours</option></select></label>
            </div>
            <label className={styles.onboardingRecurringChoice}><span><input type="checkbox" name="recurring" value="true" /> <Repeat2 size={15} /> Repeat weekly</span><small>The first shift publishes now. Each next occurrence publishes after the current one ends.</small></label>
            <div className={styles.issuerCalendarFormActions}><button type="button" onClick={close}>Cancel</button><button type="submit" disabled={pending}><CalendarPlus size={15} /> Schedule shift</button></div>
            {error ? <p role="alert" style={{ color: '#99463f', fontSize: 12 }}>{error}</p> : null}
          </div>
        </form>
      </section>
    </div>, document.body) : null}
  </>
}
