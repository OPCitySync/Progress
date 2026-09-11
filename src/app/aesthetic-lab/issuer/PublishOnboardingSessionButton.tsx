'use client'

import { CalendarDays, CalendarPlus, ChevronDown, Repeat2, X } from 'lucide-react'
import { useState } from 'react'
import {useWorkspaceSave} from './useWorkspaceSave'
import {createPortal} from 'react-dom'
import { CalendarDateTimePicker } from './AddCalendarEntryButton'
import styles from '../prototype.module.css'

function localDateTimeValue(value: Date) {
  const local = new Date(value)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(0, 16)
}

function displayDateTime(value: Date) {
  return new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }).format(value)
}

function initialDate(timestamp: number) {
  return new Date(timestamp)
}

export function PublishOnboardingSessionButton({
  taskId,
  redirectTo,
  suggestedStartsAt,
  existingFutureSessions,
}: {
  taskId: string
  redirectTo: string
  suggestedStartsAt: number
  existingFutureSessions: number
}) {
  const [open, setOpen] = useState(false)
  const [startsAt,setStartsAt]=useState(()=>initialDate(suggestedStartsAt))
  const [pickerOpen,setPickerOpen]=useState(false)
  const [pickerOriginal,setPickerOriginal]=useState<Date|null>(null)

  const close=()=>{setOpen(false);setPickerOpen(false)}
  const {submit,pending,error}=useWorkspaceSave('publishWelcome',close)
  const openModal=()=>{setStartsAt(new Date(suggestedStartsAt));setPickerOriginal(null);setPickerOpen(false);setOpen(true)}
  const openPicker=()=>{setPickerOriginal(new Date(startsAt));setPickerOpen(true)}
  const closePicker=(save:boolean)=>{if(!save&&pickerOriginal)setStartsAt(pickerOriginal);setPickerOriginal(null);setPickerOpen(false)}
  return <>
    <button type="button" className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} onClick={openModal}><CalendarPlus size={15} /> Add Date</button>
    {open ? createPortal(<div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={close}>
      <section className={`${styles.issuerCalendarModal} ${pickerOpen?styles.issuerCalendarModalPicker:''}`} role="dialog" aria-modal="true" aria-label={pickerOpen?'Onboarding session date and time picker':'Add another onboarding date'} onMouseDown={(event) => event.stopPropagation()}>
        {pickerOpen?null:<div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>New session instance</p><h2 id="publish-onboarding-title">Add another date.</h2><p>Use this same onboarding template for a new group of volunteers.</p></div>
          <button type="button" aria-label="Close" onClick={close}><X size={18} /></button>
        </div>}
        <form action={submit} aria-busy={pending} className={styles.issuerCalendarForm}>
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="startsAt" value={localDateTimeValue(startsAt)} />
          {pickerOpen?<div className={styles.issuerCalendarPickerStage}><CalendarDateTimePicker label="Session date" value={startsAt} onChange={setStartsAt} onCancel={()=>closePicker(false)} onDone={()=>closePicker(true)}/></div>:null}
          <div className={styles.issuerCalendarFormStage} hidden={pickerOpen}>
            <div className={styles.issuerCalendarDatePicker}><span>Date and time</span><button type="button" className={styles.issuerCalendarDateTrigger} onClick={openPicker}><CalendarDays size={14} aria-hidden="true"/><span>{displayDateTime(startsAt)}</span><ChevronDown size={14} aria-hidden="true"/></button></div>
            <label className={styles.onboardingRecurringChoice}><span><input type="checkbox" name="recurring" value="true" /> <Repeat2 size={15} /> Repeat weekly</span><small>City/Sync keeps one recurring session public at a time and publishes the next occurrence after the current one ends.</small></label>
            {existingFutureSessions > 1 ? <p className={styles.onboardingRecurringNotice}>This onboarding template already has {existingFutureSessions} future dates. You can add another single date, but finish those dates before switching to one-at-a-time recurring publication.</p> : null}
            <div className={styles.issuerCalendarFormActions}><button type="button" onClick={close}>Cancel</button><button type="submit" disabled={pending}><CalendarPlus size={15} /> Add Date</button></div>
            {error?<p role="alert" style={{color:'#99463f',fontSize:12}}>{error}</p>:null}
          </div>
        </form>
      </section>
    </div>,document.body) : null}
  </>
}
