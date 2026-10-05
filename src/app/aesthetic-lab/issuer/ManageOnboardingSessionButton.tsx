'use client'

import { Edit3, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {useWorkspaceSave} from './useWorkspaceSave'
import {createPortal} from 'react-dom'
import { deleteOnboardingSessionTemplateInlineAction } from '@/app/actions'
import { OnboardingSessionPackageFields, type OnboardingDocumentOption, type OnboardingWaiverOption } from './OnboardingSessionPackageFields'
import styles from '../prototype.module.css'
import workspaceStyles from './ProgramWorkspace.module.css'

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
  documents = [],
  waivers = [],
  attachedDocumentIds = [],
  attachedWaiverIds,
}: {
  task: { id: string; title: string; description: string; location: string; beforeSession: string; bringItems: string; credits: number; programId: string | null }
  nextStartsAt: number | null
  durationMinutes: number
  weeklyCapacity: number
  programs: Array<{ id: string; name: string }>
  redirectTo?: string
  lockedProgram?: { id: string | null; name: string }
  documents?: OnboardingDocumentOption[]
  waivers?: OnboardingWaiverOption[]
  attachedDocumentIds?: string[]
  attachedWaiverIds?: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [locationEditable, setLocationEditable] = useState(false)
  const [deleteWarningOpen, setDeleteWarningOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const locationRef = useRef<HTMLInputElement>(null)
  const {submit,pending,error}=useWorkspaceSave('manageWelcome',() => setOpen(false))
  const considerations = [task.beforeSession, task.bringItems].filter(Boolean).join('\n')
  const changeLocation = () => {
    setLocationEditable(true)
    window.setTimeout(() => locationRef.current?.focus(), 0)
  }
  const openModal = () => {
    setLocationEditable(false)
    setDeleteWarningOpen(false)
    setDeleteError(null)
    setIsDeleting(false)
    setOpen(true)
  }
  const confirmDelete = async () => {
    if (isDeleting) return
    setDeleteError(null)
    setIsDeleting(true)
    const result = await deleteOnboardingSessionTemplateInlineAction({ taskId: task.id })
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
    <button type="button" className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton} ${styles.onboardingEditIconButton}`} aria-label={`Edit ${task.title}`} title={`Edit ${task.title}`} onClick={openModal}><Edit3 size={15} aria-hidden="true" /></button>
    {open ? createPortal(<div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={`${styles.issuerCalendarModal} ${styles.manageOnboardingSessionModal}`} role="dialog" aria-modal="true" aria-labelledby="manage-onboarding-session-title" onMouseDown={(event) => event.stopPropagation()}>
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
          <OnboardingSessionPackageFields documents={documents} waivers={waivers} selectedDocumentIds={attachedDocumentIds} selectedWaiverIds={attachedWaiverIds} />
          <label>Duration (minutes)<input type="number" name="durationMinutes" min="30" required defaultValue={durationMinutes} /></label>
          <div className={workspaceStyles.manageRoleFooter}><button type="button" className={styles.templateDeleteButton} onClick={() => { setDeleteError(null); setDeleteWarningOpen(true) }}>Delete template</button><div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit" disabled={pending}><Edit3 size={15} /> Save session</button></div></div>
          {error?<p role="alert" style={{color:'#99463f',fontSize:12}}>{error}</p>:null}
        </form>
      </section>
      {deleteWarningOpen ? <div className={`${styles.issuerCalendarModalBackdrop} ${styles.templateDeleteWarningBackdrop}`} role="presentation" onMouseDown={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) setDeleteWarningOpen(false) }}>
        <section className={`${styles.issuerCalendarModal} ${styles.templateDeleteWarningModal}`} role="dialog" aria-modal="true" aria-labelledby={`delete-onboarding-template-${task.id}`} onMouseDown={(event) => event.stopPropagation()}>
          <div className={styles.issuerCalendarModalHeading}>
            <div><p className={styles.eyebrow}>Delete onboarding template</p><h2 id={`delete-onboarding-template-${task.id}`}>Delete {task.title}?</h2><p>This removes the reusable template from the active workspace and cancels its scheduled orientation dates.</p></div>
            <button type="button" aria-label="Close delete warning" onClick={() => setDeleteWarningOpen(false)}><X size={18} /></button>
          </div>
          <div className={styles.templateDeleteWarningBody}><p>Volunteers with future reservations will be released and notified. Completed sessions and their participation records remain preserved.</p><p>A session currently in progress or past attendance awaiting verification must be resolved before the template can be deleted.</p></div>
          {deleteError ? <p className={styles.templateDeleteError}>{deleteError}</p> : null}
          <div className={styles.issuerCalendarFormActions}><button type="button" disabled={isDeleting} onClick={() => setDeleteWarningOpen(false)}>Keep template</button><button className={styles.templateDeleteConfirm} type="button" disabled={isDeleting} onClick={confirmDelete}>{isDeleting ? 'Deleting…' : 'Delete template'}</button></div>
        </section>
      </div> : null}
    </div>,document.body) : null}
  </>
}
