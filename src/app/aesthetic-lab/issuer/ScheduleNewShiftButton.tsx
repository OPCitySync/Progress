'use client'

import { CalendarDays, CalendarPlus, ChevronDown, Repeat2, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDateTimePicker } from './AddCalendarEntryButton'
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
  defaultVisibility = 'public',
  buttonLabel = 'Schedule shift',
  templates = [],
}: {
  programId: string | null
  redirectTo: string
  suggestedStartsAt: number
  defaultLocation?: string
  defaultCapacity?: number
  defaultDurationMinutes?: number
  defaultVisibility?: 'public' | 'private'
  buttonLabel?: string
  templates?: Array<{
    id: string
    title: string
    description: string
    location: string
    capacity: number
    durationMinutes: number
    visibility: 'public' | 'private'
  }>
}) {
  const [open, setOpen] = useState(false)
  const [visibility, setVisibility] = useState<'public' | 'private'>(defaultVisibility)
  const [capacity, setCapacity] = useState(defaultCapacity)
  const [durationMinutes, setDurationMinutes] = useState(defaultDurationMinutes)
  const [title, setTitle] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
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
    setSelectedTemplateId('')
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
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null

  const chooseTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId)
    const template = templates.find((item) => item.id === templateId)
    if (template) {
      setTitle(template.title)
      setCapacity(template.capacity)
      setDurationMinutes(template.durationMinutes)
      setVisibility(template.visibility)
      return
    }
    setTitle('')
    setCapacity(defaultCapacity)
    setDurationMinutes(defaultDurationMinutes)
    setVisibility(defaultVisibility)
  }

  return <>
    <button type="button" className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} onClick={openModal}><CalendarPlus size={15} /> {buttonLabel}</button>

    {open ? createPortal(<div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={close}>
      <section className={`${styles.issuerCalendarModal} ${pickerOpen ? styles.issuerCalendarModalPicker : ''}`} role="dialog" aria-modal="true" aria-label={pickerOpen ? 'Shift date and time picker' : 'Schedule a shift'} onMouseDown={(event) => event.stopPropagation()}>
        {pickerOpen ? null : <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Shift planning</p><h2 id={`schedule-new-shift-${programId ?? 'organization'}`}>Schedule a shift.</h2><p>Set the date, access, and number of volunteers needed. City/Sync will keep the shift details available for reuse.</p></div>
          <button type="button" aria-label="Close" onClick={close}><X size={18} /></button>
        </div>}
        <form action={submit} aria-busy={pending} className={styles.issuerCalendarForm}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="programId" value={programId ?? ''} />
          <input type="hidden" name="taskId" value={selectedTemplateId} />
          <input type="hidden" name="description" value={selectedTemplate?.description ?? title} />
          <input type="hidden" name="location" value={selectedTemplate?.location ?? defaultLocation} />
          <input type="hidden" name="startsAt" value={localDateTimeValue(startsAt)} />
          <input type="hidden" name="title" value={title} />
          <input type="hidden" name="capacity" value={capacity} />
          <input type="hidden" name="durationMinutes" value={durationMinutes} />
          <input type="hidden" name="visibility" value={visibility} />
          {pickerOpen ? <div className={styles.issuerCalendarPickerStage}><CalendarDateTimePicker label="Shift date" value={startsAt} onChange={setStartsAt} onCancel={() => closePicker(false)} onDone={() => closePicker(true)} /></div> : null}
          <div className={styles.issuerCalendarFormStage} hidden={pickerOpen}>
            <label>Use existing template<select value={selectedTemplateId} onChange={(event) => chooseTemplate(event.target.value)}><option value="">No template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}</select></label>
            <div className={selectedTemplate ? styles.publishShiftTemplateLocked : undefined}>
              <label>Shift Title<input required readOnly={Boolean(selectedTemplate)} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Saturday pantry sorting" /></label>
            </div>
            <div className={styles.issuerCalendarDatePicker}>
              <span>Date and time</span>
              <button type="button" className={styles.issuerCalendarDateTrigger} onClick={openPicker}><CalendarDays size={14} aria-hidden="true" /><span>{displayDateTime(startsAt)}</span><ChevronDown size={14} aria-hidden="true" /></button>
            </div>
            <div className={selectedTemplate ? styles.publishShiftTemplateLocked : undefined}>
            <div className={styles.publishShiftDefaults}>
              <label>Volunteers/Shift<input type="number" min={1} max={10000} required readOnly={Boolean(selectedTemplate)} value={capacity} onChange={(event) => setCapacity(Math.max(1, Number(event.target.value) || 1))} /></label>
              <label>Duration<select disabled={Boolean(selectedTemplate)} value={String(durationMinutes)} onChange={(event) => setDurationMinutes(Number(event.target.value))}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option><option value="180">3 hours</option><option value="240">4 hours</option><option value="480">8 hours</option></select></label>
            </div>
            <fieldset className={styles.publishShiftAccessChoices}>
              <legend>Shift access</legend>
              <label data-selected={visibility === 'public' ? 'true' : undefined}><input type="radio" name="visibilityChoice" value="public" disabled={Boolean(selectedTemplate)} checked={visibility === 'public'} onChange={() => setVisibility('public')} /><span><b>Public</b><small>Eligible Civic Participants can find and claim a spot.</small></span></label>
              <label data-selected={visibility === 'private' ? 'true' : undefined}><input type="radio" name="visibilityChoice" value="private" disabled={Boolean(selectedTemplate)} checked={visibility === 'private'} onChange={() => setVisibility('private')} /><span><b>Private</b><small>Keep this shift off public listings and assign its roster from Shift Planning.</small></span></label>
            </fieldset>
            </div>
            <label className={styles.onboardingRecurringChoice}><span><input type="checkbox" name="recurring" value="true" /> <Repeat2 size={15} /> Repeat weekly</span><small>The first shift publishes now. Each next occurrence publishes after the current one ends.</small></label>
            {!selectedTemplate ? <p className={styles.publishShiftAccessHint}>A reusable template will be saved from this shift.</p> : null}
            <div className={styles.issuerCalendarFormActions}><button type="button" onClick={close}>Cancel</button><button type="submit" disabled={pending}><CalendarPlus size={15} /> Schedule shift</button></div>
            {error ? <p role="alert" style={{ color: '#99463f', fontSize: 12 }}>{error}</p> : null}
          </div>
        </form>
      </section>
    </div>, document.body) : null}
  </>
}
