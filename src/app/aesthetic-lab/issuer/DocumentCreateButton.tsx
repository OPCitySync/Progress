'use client'

import { FileText, X } from 'lucide-react'
import { useState } from 'react'
import { createOrganizationDocumentAction } from '@/app/actions'
import type { OrganizationDocumentCategory } from '@/lib/services/organization-documents'
import styles from '../prototype.module.css'

type TaskOption = { id: string; title: string }
type ProgramOption = { id: string; name: string }

const documentTriggerDimensions = {
  height: '30px',
  minHeight: '30px',
  padding: '.42rem .5rem',
  fontFamily: 'inherit',
  fontSize: '.59rem',
  fontWeight: 800,
  lineHeight: 'normal',
} as const

const copy: Record<OrganizationDocumentCategory, { eyebrow: string; title: string; helper: string; placeholder: string }> = {
  guide: {
    eyebrow: 'Volunteer guide',
    title: 'Add a volunteer guide.',
    helper: 'Create a handbook, role guide, training note, or event-day briefing your team can reuse.',
    placeholder: 'Add the instructions, key contacts, or context a volunteer needs.',
  },
  safety: {
    eyebrow: 'Safety & operations',
    title: 'Add a safety or operations document.',
    helper: 'Keep emergency instructions, site procedures, equipment lists, and operational plans in one clear place.',
    placeholder: 'Add safety instructions, site procedures, key contacts, or equipment details.',
  },
  template: {
    eyebrow: 'Additional document',
    title: 'Add an additional document.',
    helper: 'Save a checklist, project plan, after-action report, or other team-ready resource for future work.',
    placeholder: 'Add the reusable structure, prompts, or steps for your team to follow.',
  },
}

/** Keeps document creation in the Workspace so a new organization never has
 * to leave its setup checklist just to add one resource. */
export function DocumentCreateButton({ category, tasks, programs }: { category: OrganizationDocumentCategory; tasks: TaskOption[]; programs: ProgramOption[] }) {
  const [open, setOpen] = useState(false)
  const formCopy = copy[category]

  return <>
    <button type="button" className={`${styles.catalogWorkspaceAction} ${styles.documentCreateTrigger}`} style={documentTriggerDimensions} aria-haspopup="dialog" onClick={() => setOpen(true)}>Add Document</button>
    {open ? <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby={`add-${category}-document-title`} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>{formCopy.eyebrow}</p><h2 id={`add-${category}-document-title`}>{formCopy.title}</h2><p>{formCopy.helper} Add written guidance, a source file, or both.</p></div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <form action={createOrganizationDocumentAction} className={styles.issuerCalendarForm} onSubmit={() => setOpen(false)}>
          <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/catalog?workspace=documentation" />
          <input type="hidden" name="successRedirectTo" value="/aesthetic-lab/issuer/catalog?workspace=documentation" />
          <input type="hidden" name="category" value={category} />
          <label>Document title<input name="title" required maxLength={180} placeholder="e.g. Community garden volunteer guide" /></label>
          <label>Volunteer program <span>(optional)</span><select name="programId" defaultValue=""><option value="">Organization-wide / not assigned</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select><small>Tag this resource to the volunteer program where it belongs.</small></label>
          <label>Written guidance <span>(optional with source file)</span><textarea name="body" placeholder={formCopy.placeholder} /></label>
          <label>Attach a source file <span>(optional with written guidance)</span><input name="document" type="file" accept="application/pdf,.doc,.docx" /><small>Upload a PDF, DOC, or DOCX up to 10 MB.</small></label>
          <fieldset className={styles.documentAssignmentFieldset}>
            <legend>Attach to opportunities <span>(optional)</span></legend>
            {tasks.length > 0 ? <div>{tasks.map((task) => <label key={task.id}><input type="checkbox" name="taskIds" value={task.id} /><span>{task.title}</span></label>)}</div> : <p>No opportunities are available in this city yet. You can attach this document later.</p>}
          </fieldset>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit"><FileText size={15} /> Save Document</button></div>
        </form>
      </section>
    </div> : null}
  </>
}
