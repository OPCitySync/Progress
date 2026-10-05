'use client'

import { Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useWorkspaceSave } from './useWorkspaceSave'
import { createPortal } from 'react-dom'
import { OnboardingSessionPackageFields, type OnboardingDocumentOption, type OnboardingWaiverOption } from './OnboardingSessionPackageFields'
import styles from '../prototype.module.css'

/** Create a separate onboarding program. Its title becomes the title of its
 * recurring card, while its dates and participant records remain independent. */
export function AddOnboardingSessionButton({
  programs = [],
  defaultProgramId = null,
  lockProgramContext = false,
  documents = [],
  waivers = [],
  redirectTo = '/aesthetic-lab/issuer/volunteers',
}: {
  defaultLocation?: string
  programs?: Array<{ id: string; name: string }>
  defaultProgramId?: string | null
  lockProgramContext?: boolean
  activeProgramName?: string
  documents?: OnboardingDocumentOption[]
  waivers?: OnboardingWaiverOption[]
  redirectTo?: string
}) {
  const [open, setOpen] = useState(false)
  const [location,setLocation]=useState('')
  const [locationEditable,setLocationEditable]=useState(false)
  const locationRef=useRef<HTMLInputElement>(null)
  const hasLockedProgramContext = lockProgramContext || Boolean(defaultProgramId)

  const close=()=>setOpen(false)
  const {submit,pending,error}=useWorkspaceSave('session',close)
  const openModal=()=>{
    setLocation('')
    setLocationEditable(false)
    setOpen(true)
  }
  const changeLocation=()=>{
    setLocationEditable(true)
    window.setTimeout(()=>locationRef.current?.focus(),0)
  }

  return <>
    <button type="button" className={`${styles.onboardingWorkspaceAction} ${styles.opportunityWorkspaceButton}`} onClick={openModal}><Plus size={15} /> Create Template</button>
    {open ? createPortal(<div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={close}>
      <section className={`${styles.issuerCalendarModal} ${styles.manageOnboardingSessionModal}`} role="dialog" aria-modal="true" aria-label="Create onboarding template" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Onboarding template</p><h2 id="add-onboarding-session-title">New Volunteer Orientation</h2><p>Prepare the title, notes, location, and materials for this reusable orientation.</p></div>
          <button type="button" aria-label="Close" onClick={close}><X size={18} /></button>
        </div>
        <form action={submit} aria-busy={pending} className={styles.issuerCalendarForm}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="description" value="A welcoming local orientation for people beginning with our organization." />
          <input type="hidden" name="credits" value="5" />
          <input type="hidden" name="weeklyCapacity" value="20" />
          <input type="hidden" name="durationMinutes" value="45" />
          <input type="hidden" name="bringItems" value="" />
          {hasLockedProgramContext ? <input type="hidden" name="programId" value={defaultProgramId ?? ''} /> : null}
          <div className={styles.issuerCalendarFormStage}>
            <label>Session Title<input name="title" required defaultValue="New Volunteer Orientation" /></label>
            {!hasLockedProgramContext ? <label>Volunteer program <span>(optional)</span><select name="programId" defaultValue=""><option value="">Not assigned to a program</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select><small>Connect this session to the area of work it welcomes volunteers into.</small></label> : null}
            <label>Notes for New Volunteers <span>(optional)</span><textarea name="beforeSession" placeholder="Share anything participants should know, review, or bring before they arrive." /></label>
            <div className={styles.onboardingLocationField}><label>Address<input ref={locationRef} name="location" required readOnly={!locationEditable} value={location} onChange={event=>setLocation(event.target.value)} placeholder={locationEditable?'Enter the session address':'No location selected'} /></label><button type="button" onClick={changeLocation}>Change Location</button></div>
            <OnboardingSessionPackageFields documents={documents} waivers={waivers} />
            <div className={styles.issuerCalendarFormActions}><button type="button" onClick={close}>Cancel</button><button type="submit" disabled={pending}><Plus size={15} /> Create Template</button></div>
            {error?<p role="alert" style={{color:'#99463f',fontSize:12}}>{error}</p>:null}
          </div>
        </form>
      </section>
    </div>,document.body) : null}
  </>
}
