'use client'

import { Edit3, X } from 'lucide-react'
import { useRef, useState } from 'react'
import {useWorkspaceSave} from './useWorkspaceSave'
import {createPortal} from 'react-dom'
import styles from '../prototype.module.css'

function localDateTimeValue(timestamp: number | null) {
  if (!timestamp) return ''
  const value = new Date(timestamp)
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset())
  return value.toISOString().slice(0, 16)
}

/** Keeps routine onboarding edits with the volunteer-management workflow. Date publication stays in
 * the separate Publish Session flow so changing copy or capacity cannot
 * accidentally reschedule people who are already signed up. */
export function ManageOnboardingSessionButton({
  task,
  nextStartsAt,
  durationMinutes,
  weeklyCapacity,
  programs,
  redirectTo,
  lockedProgram,
}: {
  task: { id: string; title: string; description: string; location: string; beforeSession: string; bringItems: string; credits: number; programId: string | null }
  nextStartsAt: number | null
  durationMinutes: number
  weeklyCapacity: number
  programs: Array<{ id: string; name: string }>
  redirectTo?: string
  lockedProgram?: { id: string | null; name: string }
}) {
  const [open, setOpen] = useState(false)
  const [locationEditable, setLocationEditable] = useState(false)
  const locationRef = useRef<HTMLInputElement>(null)
  const {submit,pending,error}=useWorkspaceSave('manageWelcome',() => setOpen(false))
  const considerations = [task.beforeSession, task.bringItems].filter(Boolean).join('\n')
  const changeLocation = () => {
    setLocationEditable(true)
    window.setTimeout(() => locationRef.current?.focus(), 0)
  }
  return <>
    <button type="button" className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} onClick={() => { setLocationEditable(false); setOpen(true) }}><Edit3 size={15} /> Edit</button>
    {open ? createPortal(<div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby="manage-onboarding-session-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Onboarding session</p><h2 id="manage-onboarding-session-title">Manage your onboarding session.</h2><p>Update the session details your participants see. Published dates are managed separately to protect existing reservations.</p></div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <form action={submit} aria-busy={pending} className={styles.issuerCalendarForm}>
          <input type="hidden" name="taskId" value={task.id} />
          {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
          <input type="hidden" name="credits" value={task.credits} />
          <input type="hidden" name="firstStartsAt" value={localDateTimeValue(nextStartsAt)} />
          <input type="hidden" name="weeklyCapacity" value={weeklyCapacity} />
          <input type="hidden" name="bringItems" value="" />
          {lockedProgram ? <input type="hidden" name="programId" value={lockedProgram.id ?? ''} /> : null}
          <label>Session title<input name="title" required defaultValue={task.title} /></label>
          {lockedProgram ? <p className={styles.publishShiftAccessHint}>This onboarding pathway belongs to {lockedProgram.name}.</p> : <label>Volunteer program <span>(optional)</span><select name="programId" defaultValue={task.programId ?? ''}><option value="">Not assigned to a program</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>}
          <div className={styles.onboardingLocationField}><label>Address<input ref={locationRef} name="location" required readOnly={!locationEditable} defaultValue={task.location} placeholder="No location selected" /></label><button type="button" onClick={changeLocation}>Change Location</button></div>
          <label>Description<textarea name="description" required defaultValue={task.description} /></label>
          <label>Things to Consider <span>(optional)</span><textarea name="beforeSession" defaultValue={considerations} placeholder="Share anything participants should know, review, or bring before they arrive." /></label>
          <label>Duration (minutes)<input type="number" name="durationMinutes" min="30" required defaultValue={durationMinutes} /></label>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit" disabled={pending}><Edit3 size={15} /> Save session</button></div>
          {error?<p role="alert" style={{color:'#99463f',fontSize:12}}>{error}</p>:null}
        </form>
      </section>
    </div>,document.body) : null}
  </>
}
