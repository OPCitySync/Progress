'use client'

import { FileText, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useWorkspaceSave } from './useWorkspaceSave'
import { createPortal } from 'react-dom'
import styles from '../prototype.module.css'

const workspaceButtonDimensions = {
  height: '30px',
  minHeight: '30px',
  padding: '.42rem .5rem',
  fontSize: '.59rem',
  fontWeight: 800,
  lineHeight: 'normal',
} as const

/** Opens the dedicated creation flow without taking the issuer away from the
 * active-waiver list they are managing. */
export function WaiverCreateButton({
  programs = [],
  defaultProgramId = null,
  lockProgramContext = false,
  activeProgramName,
  redirectTo = '/aesthetic-lab/issuer/waiver',
  buttonLabel = 'Add Waiver',
}: {
  programs?: Array<{ id: string; name: string }>
  defaultProgramId?: string | null
  lockProgramContext?: boolean
  activeProgramName?: string
  redirectTo?: string
  buttonLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const hasLockedProgramContext = lockProgramContext || Boolean(defaultProgramId)

  const {submit,pending,error}=useWorkspaceSave('waiver',() => setOpen(false))

  return <>
    <button type="button" className={`${styles.catalogWorkspaceAction} ${styles.waiverAddButton}`} style={workspaceButtonDimensions} onClick={() => setOpen(true)}>
      <Plus size={15} /> {buttonLabel}
    </button>
    {open ? createPortal(<div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby="add-waiver-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Onboarding requirement</p><h2 id="add-waiver-title">Add a waiver.</h2><p>This waiver will be automatically included with future onboarding sessions. Add accessible text, a source file, or both.</p></div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <form action={submit} aria-busy={pending} className={styles.issuerCalendarForm}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          {hasLockedProgramContext ? <input type="hidden" name="programId" value={defaultProgramId ?? ''} /> : null}
          <label>Waiver title<input name="title" required maxLength={180} placeholder="e.g. Volunteer Liability Release" /></label>
          {hasLockedProgramContext ? <p className={styles.publishShiftAccessHint}>This waiver will be added to {activeProgramName === 'Organization' ? 'your organization-wide resources' : activeProgramName || 'the active volunteer program'}.</p> : <label>Volunteer program <span>(optional)</span><select name="programId" defaultValue=""><option value="">Applies across the organization</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select><small>Use a program tag when this waiver supports a particular area of volunteer work.</small></label>}
          <label>Waiver text <span>(optional with source file)</span><textarea name="body" placeholder="Paste the approved waiver text so participants can read it in City/Sync." /></label>
          <label>Upload waiver <span>(optional with text)</span><input name="document" type="file" accept="application/pdf,.doc,.docx" /><small>Upload a PDF, DOC, or DOCX up to 10 MB. Add either waiver text or a source file.</small></label>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit" disabled={pending}><FileText size={15} /> Add Waiver</button></div>
          {error?<p role="alert" style={{color:'#99463f',fontSize:12}}>{error}</p>:null}
        </form>
      </section>
    </div>,document.body) : null}
  </>
}
