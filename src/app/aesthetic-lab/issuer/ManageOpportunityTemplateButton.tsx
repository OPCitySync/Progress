'use client'

import { Edit3, X } from 'lucide-react'
import { useState } from 'react'
import { updateTaskAction } from '@/app/actions'
import styles from '../prototype.module.css'

export function ManageOpportunityTemplateButton({
  task,
  program,
  redirectTo,
}: {
  task: { id: string; title: string; description: string; location: string }
  program: { id: string; name: string }
  redirectTo: string
}) {
  const [open, setOpen] = useState(false)

  return <>
    <button type="button" className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} onClick={() => setOpen(true)}><Edit3 size={14} /> Manage</button>
    {open ? <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby={`manage-template-${task.id}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Opportunity template</p><h2 id={`manage-template-${task.id}`}>Manage {task.title}.</h2><p>Update the reusable volunteer plan without changing any shifts that are already published.</p></div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <form action={updateTaskAction} className={styles.issuerCalendarForm} onSubmit={() => setOpen(false)}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="programId" value={program.id} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <label>Template title<input name="title" required defaultValue={task.title} /></label>
          <label>Default location<input name="location" required defaultValue={task.location} /></label>
          <label>Description<textarea name="description" required defaultValue={task.description} /></label>
          <p className={styles.publishShiftAccessHint}>This template belongs to {program.name}. Published shifts retain their existing reservations and dates.</p>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit"><Edit3 size={15} /> Save template</button></div>
        </form>
      </section>
    </div> : null}
  </>
}
