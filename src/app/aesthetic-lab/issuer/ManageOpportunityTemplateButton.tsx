'use client'

import { Edit3, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { deleteOpportunityTemplateInlineAction, updateTaskAction } from '@/app/actions'
import styles from '../prototype.module.css'
import workspaceStyles from './ProgramWorkspace.module.css'

type EditableField = 'title' | 'description'

export function ManageOpportunityTemplateButton({
  task,
  program,
  redirectTo,
}: {
  task: { id: string; title: string; description: string; location: string; slots: number; defaultDurationMinutes: number }
  program: { id: string | null; name: string }
  redirectTo: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Set<EditableField>>(() => new Set())
  const [deleteWarningOpen, setDeleteWarningOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [draft, setDraft] = useState({
    title: task.title,
    description: task.description,
  })

  const setFieldEditing = (field: EditableField) => {
    setEditing((current) => {
      const next = new Set(current)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })
  }

  const isEditing = (field: EditableField) => editing.has(field)
  const openModal = () => {
    setDraft({ title: task.title, description: task.description })
    setEditing(new Set())
    setDeleteWarningOpen(false)
    setDeleteError(null)
    setIsDeleting(false)
    setOpen(true)
  }

  const confirmDelete = async () => {
    if (isDeleting) return
    setDeleteError(null)
    setIsDeleting(true)
    const result = await deleteOpportunityTemplateInlineAction({ taskId: task.id })
    if (!result.ok) {
      setDeleteError(result.error)
      setIsDeleting(false)
      return
    }
    setDeleteWarningOpen(false)
    setOpen(false)
    router.refresh()
  }

  return <>
    <button type="button" className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} onClick={openModal}><Edit3 size={14} /> Edit</button>
    {open && typeof document !== 'undefined' ? createPortal(<div className={workspaceStyles.backdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={workspaceStyles.dialog} role="dialog" aria-modal="true" aria-labelledby={`manage-template-${task.id}`} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2 id={`manage-template-${task.id}`}>Manage Volunteer Role</h2>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </header>
        <form action={updateTaskAction} className={workspaceStyles.form} onSubmit={() => setOpen(false)}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="programId" value={program.id ?? ''} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="location" value={task.location} />
          <input type="hidden" name="slots" value={task.slots} />
          <input type="hidden" name="defaultDurationMinutes" value={task.defaultDurationMinutes} />
          <fieldset>
            <div className={workspaceStyles.managedRoleField} data-editing={isEditing('title') ? 'true' : undefined}>
              <div><span>Role Title</span><button type="button" aria-pressed={isEditing('title')} onClick={() => setFieldEditing('title')}>{isEditing('title') ? 'Done' : 'Edit'}</button></div>
              <input name="title" required maxLength={180} readOnly={!isEditing('title')} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
            </div>
            <div className={workspaceStyles.managedRoleField} data-editing={isEditing('description') ? 'true' : undefined}>
              <div><span>Role Description</span><button type="button" aria-pressed={isEditing('description')} onClick={() => setFieldEditing('description')}>{isEditing('description') ? 'Done' : 'Edit'}</button></div>
              <textarea name="description" required readOnly={!isEditing('description')} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
            </div>
          </fieldset>
          <div className={workspaceStyles.manageRoleFooter}><button type="button" className={styles.templateDeleteButton} onClick={() => { setDeleteError(null); setDeleteWarningOpen(true) }}>Delete Role</button><div><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit">Save Role</button></div></div>
        </form>
      </section>
      {deleteWarningOpen ? <div className={`${styles.issuerCalendarModalBackdrop} ${styles.templateDeleteWarningBackdrop}`} role="presentation" onMouseDown={() => setDeleteWarningOpen(false)}>
        <section className={`${styles.issuerCalendarModal} ${styles.templateDeleteWarningModal}`} role="dialog" aria-modal="true" aria-labelledby={`delete-template-${task.id}`} onMouseDown={(event) => event.stopPropagation()}>
          <div className={styles.issuerCalendarModalHeading}>
            <div><p className={styles.eyebrow}>Delete volunteer role</p><h2 id={`delete-template-${task.id}`}>Delete {task.title}?</h2><p>This removes the role from your active workspace and cancels every published shift that has not started, along with its future recurring shift plans.</p></div>
            <button type="button" aria-label="Close delete warning" onClick={() => setDeleteWarningOpen(false)}><X size={18} /></button>
          </div>
          <div className={styles.templateDeleteWarningBody}><p>Participants with a cancelled reservation will receive a City/Sync notification. Completed service records stay preserved in your organization’s history.</p><p>If a shift is currently in progress, verify and close it before deleting this role.</p></div>
          {deleteError ? <p className={styles.templateDeleteError}>{deleteError}</p> : null}
          <div className={styles.issuerCalendarFormActions}>
            <button type="button" disabled={isDeleting} onClick={() => setDeleteWarningOpen(false)}>Keep role</button><button className={styles.templateDeleteConfirm} type="button" disabled={isDeleting} onClick={confirmDelete}>{isDeleting ? 'Deleting…' : 'Delete role'}</button>
          </div>
        </section>
      </div> : null}
    </div>, document.body) : null}
  </>
}
