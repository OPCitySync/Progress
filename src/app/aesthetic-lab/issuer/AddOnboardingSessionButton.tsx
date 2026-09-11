'use client'

import { CalendarDays, ChevronDown, Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useWorkspaceSave } from './useWorkspaceSave'
import { createPortal } from 'react-dom'
import { CalendarDateTimePicker } from './AddCalendarEntryButton'
import styles from '../prototype.module.css'

function suggestedDateTime() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  date.setHours(10, 0, 0, 0)
  return date
}

function localInputValue(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function displayDateTime(value: Date) {
  return new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }).format(value)
}

/** Create a separate onboarding program. Its title becomes the title of its
 * recurring card, while its dates and participant records remain independent. */
export function AddOnboardingSessionButton({
  programs = [],
  defaultProgramId = null,
  lockProgramContext = false,
  redirectTo = '/aesthetic-lab/issuer/volunteers',
}: {
  defaultLocation?: string
  programs?: Array<{ id: string; name: string }>
  defaultProgramId?: string | null
  lockProgramContext?: boolean
  activeProgramName?: string
  redirectTo?: string
}) {
  const [open, setOpen] = useState(false)
  const [firstStartsAt,setFirstStartsAt]=useState(suggestedDateTime)
  const [pickerOpen,setPickerOpen]=useState(false)
  const [pickerOriginal,setPickerOriginal]=useState<Date|null>(null)
  const [dateSelected,setDateSelected]=useState(false)
  const [location,setLocation]=useState('')
  const [locationEditable,setLocationEditable]=useState(false)
  const locationRef=useRef<HTMLInputElement>(null)
  const hasLockedProgramContext = lockProgramContext || Boolean(defaultProgramId)

  const close=()=>{setOpen(false);setPickerOpen(false)}
  const {submit,pending,error}=useWorkspaceSave('session',close)
  const openModal=()=>{
    setFirstStartsAt(suggestedDateTime())
    setPickerOpen(false)
    setPickerOriginal(null)
    setDateSelected(false)
    setLocation('')
    setLocationEditable(false)
    setOpen(true)
  }
  const openPicker=()=>{setPickerOriginal(new Date(firstStartsAt));setPickerOpen(true)}
  const closePicker=(save:boolean)=>{
    if(!save&&pickerOriginal)setFirstStartsAt(pickerOriginal)
    if(save)setDateSelected(true)
    setPickerOriginal(null)
    setPickerOpen(false)
  }
  const changeLocation=()=>{
    setLocationEditable(true)
    window.setTimeout(()=>locationRef.current?.focus(),0)
  }

  return <>
    <button type="button" className={`${styles.onboardingWorkspaceAction} ${styles.opportunityWorkspaceButton}`} onClick={openModal}><Plus size={15} /> Add session</button>
    {open ? createPortal(<div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={close}>
      <section className={`${styles.issuerCalendarModal} ${pickerOpen?styles.issuerCalendarModalPicker:''}`} role="dialog" aria-modal="true" aria-label={pickerOpen?'Onboarding session date and time picker':'Add onboarding session'} onMouseDown={(event) => event.stopPropagation()}>
        {pickerOpen?null:<div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Onboarding session</p><h2 id="add-onboarding-session-title">Build a volunteer welcome.</h2><p>Name this onboarding session for the volunteer program it supports. You can publish and manage its dates separately after saving.</p></div>
          <button type="button" aria-label="Close" onClick={close}><X size={18} /></button>
        </div>}
        <form action={submit} aria-busy={pending} className={styles.issuerCalendarForm}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="credits" value="5" />
          <input type="hidden" name="weeklyCapacity" value="20" />
          <input type="hidden" name="bringItems" value="" />
          <input type="hidden" name="firstStartsAt" value={localInputValue(firstStartsAt)} />
          {hasLockedProgramContext ? <input type="hidden" name="programId" value={defaultProgramId ?? ''} /> : null}
          {pickerOpen?<div className={styles.issuerCalendarPickerStage}><CalendarDateTimePicker label="First session" value={firstStartsAt} onChange={setFirstStartsAt} onCancel={()=>closePicker(false)} onDone={()=>closePicker(true)}/></div>:null}
          <div className={styles.issuerCalendarFormStage} hidden={pickerOpen}>
            <label>Session title<input name="title" required placeholder="e.g., Saturday garden orientation" /></label>
            {!hasLockedProgramContext ? <label>Volunteer program <span>(optional)</span><select name="programId" defaultValue=""><option value="">Not assigned to a program</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select><small>Connect this session to the area of work it welcomes volunteers into.</small></label> : null}
            <div className={styles.onboardingLocationField}><label>Address<input ref={locationRef} name="location" required readOnly={!locationEditable} value={location} onChange={event=>setLocation(event.target.value)} placeholder={locationEditable?'Enter the session address':'No location selected'} /></label><button type="button" onClick={changeLocation}>Change Location</button></div>
            <label>Description<textarea name="description" required defaultValue="A welcoming local orientation for people beginning with our organization." /></label>
            <label>Things to Consider <span>(optional)</span><textarea name="beforeSession" placeholder="Share anything participants should know, review, or bring before they arrive." /></label>
            <div className={styles.issuerCalendarDateGrid}><div className={styles.issuerCalendarDatePicker} data-selected={dateSelected||undefined}><span>First session</span><button type="button" className={styles.issuerCalendarDateTrigger} onClick={openPicker}><CalendarDays size={14} aria-hidden="true"/><span>{displayDateTime(firstStartsAt)}</span><ChevronDown size={14} aria-hidden="true"/></button></div><label>Duration (minutes)<input type="number" name="durationMinutes" min="30" required defaultValue="45" /></label></div>
            <div className={styles.issuerCalendarFormActions}><button type="button" onClick={close}>Cancel</button><button type="submit" disabled={pending}><Plus size={15} /> Add session</button></div>
            {error?<p role="alert" style={{color:'#99463f',fontSize:12}}>{error}</p>:null}
          </div>
        </form>
      </section>
    </div>,document.body) : null}
  </>
}
