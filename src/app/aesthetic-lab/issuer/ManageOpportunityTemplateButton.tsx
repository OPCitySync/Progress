'use client'

import { Check, Edit3, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { deleteOpportunityTemplateInlineAction, previewTaskCapacityChangeInlineAction, updateTaskAction } from '@/app/actions'
import styles from '../prototype.module.css'

type EditableField = 'title' | 'location' | 'capacity' | 'duration' | 'description'

function formatDuration(minutes: number) {
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? '' : 's'}`
  if (minutes < 60) return `${minutes} minutes`
  return `${Math.floor(minutes / 60)} hours ${minutes % 60} minutes`
}

function formatOccurrence(startsAt: number | null) {
  if (!startsAt) return 'Date and time to be confirmed'
  return new Date(startsAt).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

type CapacityConflicts = {
  published: Array<{ shiftId: string; title: string; startsAt: number | null; assignedVolunteerCount: number; currentCapacity: number }>
  planned: Array<{ occurrenceStartsAt: number; assignedVolunteerCount: number }>
}

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
  const formRef = useRef<HTMLFormElement>(null)
  const [capacityConflicts, setCapacityConflicts] = useState<CapacityConflicts | null>(null)
  const [capacityCheckError, setCapacityCheckError] = useState<string | null>(null)
  const [isCheckingCapacity, setIsCheckingCapacity] = useState(false)
  const [capacityChangeConfirmed, setCapacityChangeConfirmed] = useState(false)
  const [deleteWarningOpen, setDeleteWarningOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [draft, setDraft] = useState({
    title: task.title,
    location: task.location,
    slots: task.slots,
    defaultDurationMinutes: task.defaultDurationMinutes,
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
    setDraft({ title: task.title, location: task.location, slots: task.slots, defaultDurationMinutes: task.defaultDurationMinutes, description: task.description })
    setEditing(new Set())
    setCapacityConflicts(null)
    setCapacityCheckError(null)
    setIsCheckingCapacity(false)
    setCapacityChangeConfirmed(false)
    setDeleteWarningOpen(false)
    setDeleteError(null)
    setIsDeleting(false)
    setOpen(true)
  }

  useEffect(() => {
    if (capacityChangeConfirmed) formRef.current?.requestSubmit()
  }, [capacityChangeConfirmed])

  const submitTemplate = async (event: FormEvent<HTMLFormElement>) => {
    if (capacityChangeConfirmed || draft.slots === task.slots) {
      setOpen(false)
      return
    }
    event.preventDefault()
    if (isCheckingCapacity) return
    setCapacityCheckError(null)
    setIsCheckingCapacity(true)
    const result = await previewTaskCapacityChangeInlineAction({ taskId: task.id, slots: draft.slots })
    setIsCheckingCapacity(false)
    if (!result.ok) {
      setCapacityCheckError(result.error)
      return
    }
    if (result.published.length || result.planned.length) {
      setCapacityConflicts(result)
      return
    }
    setCapacityChangeConfirmed(true)
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
    <button type="button" className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} onClick={openModal}><Edit3 size={14} /> Manage</button>
    {open && typeof document !== 'undefined' ? createPortal(<div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby={`manage-template-${task.id}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Opportunity template</p><h2 id={`manage-template-${task.id}`}>Manage {task.title}.</h2><p>Update the reusable volunteer plan without changing any shifts that are already published.</p></div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <form ref={formRef} action={updateTaskAction} className={`${styles.issuerCalendarForm} ${styles.templateManageForm}`} onSubmit={submitTemplate}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="programId" value={program.id ?? ''} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="allowCapacityConflicts" value={capacityChangeConfirmed ? 'true' : ''} />
          <div className={styles.templateManageField} data-editing={isEditing('title') ? 'true' : undefined}>
            <div><span>Template title</span><button type="button" aria-pressed={isEditing('title')} onClick={() => setFieldEditing('title')}>{isEditing('title') ? <Check size={13} /> : <Edit3 size={13} />}{isEditing('title') ? 'Done' : 'Edit'}</button></div>
            {isEditing('title') ? <input name="title" required value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /> : <><input type="hidden" name="title" value={draft.title} /><p>{draft.title}</p></>}
          </div>
          <div className={styles.templateManageField} data-editing={isEditing('location') ? 'true' : undefined}>
            <div><span>Default location</span><button type="button" aria-pressed={isEditing('location')} onClick={() => setFieldEditing('location')}>{isEditing('location') ? <Check size={13} /> : <Edit3 size={13} />}{isEditing('location') ? 'Done' : 'Edit'}</button></div>
            {isEditing('location') ? <input name="location" required value={draft.location} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} /> : <><input type="hidden" name="location" value={draft.location} /><p>{draft.location}</p></>}
          </div>
          <div className={styles.templateManageField} data-editing={isEditing('capacity') ? 'true' : undefined}>
            <div><span>Volunteer slots</span><button type="button" aria-pressed={isEditing('capacity')} onClick={() => setFieldEditing('capacity')}>{isEditing('capacity') ? <Check size={13} /> : <Edit3 size={13} />}{isEditing('capacity') ? 'Done' : 'Edit'}</button></div>
            {isEditing('capacity') ? <input name="slots" type="number" min={1} max={10000} required value={draft.slots} onChange={(event) => setDraft((current) => ({ ...current, slots: Math.max(1, Number(event.target.value) || 1) }))} /> : <><input type="hidden" name="slots" value={draft.slots} /><p>{draft.slots} volunteer slot{draft.slots === 1 ? '' : 's'}</p></>}
          </div>
          <div className={styles.templateManageField} data-editing={isEditing('duration') ? 'true' : undefined}>
            <div><span>Default shift duration</span><button type="button" aria-pressed={isEditing('duration')} onClick={() => setFieldEditing('duration')}>{isEditing('duration') ? <Check size={13} /> : <Edit3 size={13} />}{isEditing('duration') ? 'Done' : 'Edit'}</button></div>
            {isEditing('duration') ? <select name="defaultDurationMinutes" value={String(draft.defaultDurationMinutes)} onChange={(event) => setDraft((current) => ({ ...current, defaultDurationMinutes: Number(event.target.value) }))}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option><option value="180">3 hours</option><option value="240">4 hours</option><option value="480">8 hours</option></select> : <><input type="hidden" name="defaultDurationMinutes" value={draft.defaultDurationMinutes} /><p>{formatDuration(draft.defaultDurationMinutes)}</p></>}
          </div>
          <div className={styles.templateManageField} data-editing={isEditing('description') ? 'true' : undefined}>
            <div><span>Description</span><button type="button" aria-pressed={isEditing('description')} onClick={() => setFieldEditing('description')}>{isEditing('description') ? <Check size={13} /> : <Edit3 size={13} />}{isEditing('description') ? 'Done' : 'Edit'}</button></div>
            {isEditing('description') ? <textarea name="description" required value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /> : <><input type="hidden" name="description" value={draft.description} /><p>{draft.description || 'No description added.'}</p></>}
          </div>
          <p className={styles.publishShiftAccessHint}>This template belongs to {program.name}. Published shifts retain their existing reservations and dates.</p>
          {capacityCheckError ? <p className={styles.templateCapacityCheckError}>{capacityCheckError}</p> : null}
          <div className={styles.templateManageFooter}><button type="button" className={styles.templateDeleteButton} onClick={() => { setDeleteError(null); setDeleteWarningOpen(true) }}>Delete template</button><div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit" disabled={isCheckingCapacity}>{isCheckingCapacity ? 'Checking schedule…' : <><Edit3 size={15} /> Save template</>}</button></div></div>
        </form>
      </section>
      {capacityConflicts ? <div className={`${styles.issuerCalendarModalBackdrop} ${styles.templateCapacityConflictBackdrop}`} role="presentation" onMouseDown={() => setCapacityConflicts(null)}>
        <section className={`${styles.issuerCalendarModal} ${styles.templateCapacityConflictModal}`} role="dialog" aria-modal="true" aria-labelledby={`template-capacity-warning-${task.id}`} onMouseDown={(event) => event.stopPropagation()}>
          <div className={styles.issuerCalendarModalHeading}>
            <div><p className={styles.eyebrow}>Capacity check</p><h2 id={`template-capacity-warning-${task.id}`}>Lower the volunteer limit?</h2><p>{capacityConflicts.published.length + capacityConflicts.planned.length} scheduled occurrence{capacityConflicts.published.length + capacityConflicts.planned.length === 1 ? '' : 's'} already ha{capacityConflicts.published.length + capacityConflicts.planned.length === 1 ? 's' : 've'} more than {draft.slots} volunteer{draft.slots === 1 ? '' : 's'} assigned.</p></div>
            <button type="button" aria-label="Close capacity warning" onClick={() => setCapacityConflicts(null)}><X size={18} /></button>
          </div>
          <div className={styles.templateCapacityConflictBody}>
            <p>Existing published shifts keep their current capacity and assignments. Future recurring shifts will use the new limit.</p>
            {capacityConflicts.published.length ? <section><b>Published opportunities</b><ul>{capacityConflicts.published.map((conflict) => <li key={conflict.shiftId}><span>{conflict.title}<small>{formatOccurrence(conflict.startsAt)}</small></span><em>{conflict.assignedVolunteerCount} assigned</em></li>)}</ul></section> : null}
            {capacityConflicts.planned.length ? <section><b>Planned recurring shifts</b><ul>{capacityConflicts.planned.map((conflict) => <li key={conflict.occurrenceStartsAt}><span>{formatOccurrence(conflict.occurrenceStartsAt)}<small>Will notify volunteers when this shift publishes.</small></span><em>{conflict.assignedVolunteerCount} planned</em></li>)}</ul></section> : null}
          </div>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setCapacityConflicts(null)}>Keep current limit</button><button type="button" onClick={() => { setCapacityConflicts(null); setCapacityChangeConfirmed(true) }}><Check size={15} /> Save new limit</button></div>
        </section>
      </div> : null}
      {deleteWarningOpen ? <div className={`${styles.issuerCalendarModalBackdrop} ${styles.templateDeleteWarningBackdrop}`} role="presentation" onMouseDown={() => setDeleteWarningOpen(false)}>
        <section className={`${styles.issuerCalendarModal} ${styles.templateDeleteWarningModal}`} role="dialog" aria-modal="true" aria-labelledby={`delete-template-${task.id}`} onMouseDown={(event) => event.stopPropagation()}>
          <div className={styles.issuerCalendarModalHeading}>
            <div><p className={styles.eyebrow}>Delete opportunity template</p><h2 id={`delete-template-${task.id}`}>Delete {task.title}?</h2><p>This permanently removes the template from your active workspace and cancels every published shift that has not started, along with its future recurring shift plans.</p></div>
            <button type="button" aria-label="Close delete warning" onClick={() => setDeleteWarningOpen(false)}><X size={18} /></button>
          </div>
          <div className={styles.templateDeleteWarningBody}><p>Participants with a cancelled reservation will receive a City/Sync notification. Completed service records stay preserved in your organization’s history.</p><p>If a shift is currently in progress, verify and close it before deleting this template.</p></div>
          {deleteError ? <p className={styles.templateDeleteError}>{deleteError}</p> : null}
          <div className={styles.issuerCalendarFormActions}>
            <button type="button" disabled={isDeleting} onClick={() => setDeleteWarningOpen(false)}>Keep template</button><button className={styles.templateDeleteConfirm} type="button" disabled={isDeleting} onClick={confirmDelete}>{isDeleting ? 'Deleting…' : 'Delete template'}</button>
          </div>
        </section>
      </div> : null}
    </div>, document.body) : null}
  </>
}
