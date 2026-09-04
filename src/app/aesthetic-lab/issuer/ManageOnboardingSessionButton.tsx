'use client'

import { Edit3, X } from 'lucide-react'
import { useState } from 'react'
import { updateOnboardingSessionAction } from '@/app/actions'
import styles from '../prototype.module.css'

function localDateTimeValue(timestamp: number | null) {
  if (!timestamp) return ''
  const value = new Date(timestamp)
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset())
  return value.toISOString().slice(0, 16)
}

/** Keeps routine onboarding edits in the Workspace. Date publication stays in
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
}: {
  task: { id: string; title: string; description: string; location: string; beforeSession: string; bringItems: string; credits: number; programId: string | null }
  nextStartsAt: number | null
  durationMinutes: number
  weeklyCapacity: number
  programs: Array<{ id: string; name: string }>
  redirectTo?: string
  lockedProgram?: { id: string | null; name: string }
}) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className={styles.onboardingWorkspaceAction} onClick={() => setOpen(true)}><Edit3 size={15} /> Manage session</button>
    {open ? <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby="manage-onboarding-session-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Onboarding session</p><h2 id="manage-onboarding-session-title">Manage your onboarding session.</h2><p>Update the session details your participants see. Published dates are managed separately to protect existing reservations.</p></div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <form action={updateOnboardingSessionAction} className={styles.issuerCalendarForm} onSubmit={() => setOpen(false)}>
          <input type="hidden" name="taskId" value={task.id} />
          {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
          <input type="hidden" name="credits" value={task.credits} />
          <input type="hidden" name="firstStartsAt" value={localDateTimeValue(nextStartsAt)} />
          {lockedProgram ? <input type="hidden" name="programId" value={lockedProgram.id ?? ''} /> : null}
          <label>Session title<input name="title" required defaultValue={task.title} /></label>
          {lockedProgram ? <p className={styles.publishShiftAccessHint}>This onboarding pathway belongs to {lockedProgram.name}.</p> : <label>Volunteer program <span>(optional)</span><select name="programId" defaultValue={task.programId ?? ''}><option value="">Not assigned to a program</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>}
          <label>Location<input name="location" required defaultValue={task.location} placeholder="Address or meeting point" /></label>
          <label>Description<textarea name="description" required defaultValue={task.description} /></label>
          <label>Before the session <span>(optional)</span><textarea name="beforeSession" defaultValue={task.beforeSession} placeholder="List anything participants should complete or review before they arrive." /></label>
          <label>What to bring <span>(optional)</span><textarea name="bringItems" defaultValue={task.bringItems} placeholder="e.g. Photo ID, comfortable shoes, water bottle" /></label>
          <div className={styles.issuerCalendarDateGrid}><label>Weekly capacity<input type="number" name="weeklyCapacity" min="1" required defaultValue={weeklyCapacity} /></label><label>Duration (minutes)<input type="number" name="durationMinutes" min="30" required defaultValue={durationMinutes} /></label></div>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit"><Edit3 size={15} /> Save session</button></div>
        </form>
      </section>
    </div> : null}
  </>
}
