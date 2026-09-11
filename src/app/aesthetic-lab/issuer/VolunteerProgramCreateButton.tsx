'use client'

import { FolderPlus, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useWorkspaceSave } from './useWorkspaceSave'
import { createPortal } from 'react-dom'
import styles from '../prototype.module.css'

const workspaceButtonDimensions = {
  height: '30px',
  minHeight: '30px',
  padding: '.42rem .5rem',
  fontFamily: 'inherit',
  fontSize: '.59rem',
  fontWeight: 800,
  lineHeight: 'normal',
} as const

/** Creates a lightweight organizational area without forcing the organization
 * to decide whether it represents a mission, location, project, or team. */
export function VolunteerProgramCreateButton() {
  const [open, setOpen] = useState(false)

  const {submit,pending,error}=useWorkspaceSave('program',() => setOpen(false))

  return <>
    <button type="button" className={`${styles.catalogWorkspaceAction} ${styles.volunteerProgramCreateTrigger}`} style={workspaceButtonDimensions} onClick={() => setOpen(true)}><Plus size={15} /> Create program</button>
    {open ? createPortal(<div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby="create-volunteer-program-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Volunteer program</p><h2 id="create-volunteer-program-title">Create an area of work.</h2><p>Use a program for a mission area, location, project family, team, or any structure that helps your organization coordinate volunteers.</p></div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <form action={submit} aria-busy={pending} className={styles.issuerCalendarForm}>
          <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/catalog?workspace=programs" />
          <label>Program name<input name="name" required maxLength={100} placeholder="e.g. Community Garden" /></label>
          <label>What is this program for? <span>(optional)</span><textarea name="description" maxLength={1000} placeholder="Describe the people, work, or mission this program brings together." /></label>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit" disabled={pending}><FolderPlus size={15} /> Create program</button></div>
          {error?<p role="alert" style={{color:'#99463f',fontSize:12}}>{error}</p>:null}
        </form>
      </section>
    </div>,document.body) : null}
  </>
}
