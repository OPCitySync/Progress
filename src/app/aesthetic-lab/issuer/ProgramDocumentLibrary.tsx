'use client'

import Link from 'next/link'
import { FileText, FolderOpen, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { DocumentCreateButton } from './DocumentCreateButton'
import { DocumentOverflowActions } from './DocumentOverflowActions'
import styles from '../prototype.module.css'

type TaskOption = { id: string; title: string }
type ProgramOption = { id: string; name: string }
type Resource = {
  id: string
  kind: 'document' | 'waiver'
  title: string
  area: string
  updatedLabel: string
  taskIds: string[]
  publications: string[]
  programId: string | null
  href: string
}

/** A contextual window into the organization-wide library. The files remain
 * shared; opening this from a program only supplies a useful default tag. */
export function ProgramDocumentLibrary({
  program,
  resources,
  tasks,
  programs,
  redirectTo,
}: {
  program: { id: string | null; name: string }
  resources: Resource[]
  tasks: TaskOption[]
  programs: ProgramOption[]
  redirectTo: string
}) {
  const [open, setOpen] = useState(false)

  return <>
    <button type="button" className={styles.catalogWorkspaceAction} onClick={() => setOpen(true)}><FolderOpen size={15} /> Documents</button>
    {open ? createPortal(<div className={`${styles.issuerCalendarModalBackdrop} ${styles.programDocumentModalBackdrop}`} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={`${styles.issuerCalendarModal} ${styles.programDocumentModal}`} role="dialog" aria-modal="true" aria-labelledby="program-document-library-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Organization library</p><h2 id="program-document-library-title">Documents for {program.name}</h2><p>Choose from your organization’s shared resources or upload something new for this program.</p></div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <div className={styles.programDocumentModalToolbar}>
          <DocumentCreateButton
            tasks={tasks}
            programs={programs}
            defaultProgramId={program.id}
            lockProgramContext
            activeProgramName={program.name}
            redirectTo={redirectTo}
            buttonLabel="Upload New"
          />
          <Link className={styles.catalogWorkspaceAction} href="/aesthetic-lab/issuer/documents">Open Document Library</Link>
        </div>
        {resources.length ? <div className={`${styles.workspaceDocumentProgramList} ${styles.programDocumentModalList}`}>
          {resources.map((resource) => <article key={`${resource.kind}-${resource.id}`}>
            <span><FileText size={17} /></span>
            <div><p>{resource.area}</p><h3>{resource.title}</h3><small>{resource.updatedLabel}</small></div>
            <div className={styles.workspaceDocumentActions}>
              <Link className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} href={resource.href}>Manage</Link>
              <DocumentOverflowActions resource={resource} tasks={tasks} programs={programs} redirectTo={redirectTo} />
            </div>
          </article>)}
        </div> : <div className={styles.workspaceDocumentProgramEmpty}><FileText size={18} /><div><b>No documents yet.</b><p>Upload a waiver or document when it supports this program.</p></div></div>}
      </section>
    </div>, document.body) : null}
  </>
}
