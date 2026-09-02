'use client'

import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { createTaskAction } from '@/app/actions'
import styles from '../prototype.module.css'

/**
 * Creates the reusable definition of volunteer work without navigating away
 * from its program. Dated shifts are deliberately scheduled later from the
 * template card, so an organization can prepare the work before publishing it.
 */
export function CreateOpportunityTemplateButton({
  programId,
  programName,
  defaultLocation = '',
  redirectTo = '/aesthetic-lab/issuer/catalog?workspace=opportunities',
}: {
  programId: string | null
  programName: string
  defaultLocation?: string
  redirectTo?: string
}) {
  const [open, setOpen] = useState(false)
  const isOrganizationWide = !programId

  return <>
    <button type="button" className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} onClick={() => setOpen(true)}><Plus size={15} /> New template</button>
    {open ? <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby={`create-template-${programId ?? 'organization'}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Opportunity template</p><h2 id={`create-template-${programId ?? 'organization'}`}>Create reusable volunteer work.</h2><p>This template belongs to {isOrganizationWide ? 'your organization' : programName}. Publish individual shifts only when volunteers are ready to participate.</p></div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <form action={createTaskAction} className={styles.issuerCalendarForm} onSubmit={() => setOpen(false)}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="programId" value={programId ?? ''} />
          <input type="hidden" name="capacity" value="8" />
          <input type="hidden" name="credits" value="10" />
          <label>Template title<input name="title" required placeholder="e.g. Saturday pantry sorting" /></label>
          <label>Default location<input name="location" required defaultValue={defaultLocation} placeholder="Address or meeting point" /></label>
          <label>Description<textarea name="description" required placeholder="Explain the work, expectations, and what to bring." /></label>
          <p className={styles.publishShiftAccessHint}>You can refine this template and publish public or private shifts after it is created.</p>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit"><Plus size={15} /> Create template</button></div>
        </form>
      </section>
    </div> : null}
  </>
}
