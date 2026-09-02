'use client'

import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { createOnboardingSessionAction } from '@/app/actions'
import styles from '../prototype.module.css'

function suggestedDateTime() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  date.setHours(10, 0, 0, 0)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

/** Create a separate onboarding program. Its title becomes the title of its
 * recurring card, while its dates and participant records remain independent. */
export function AddOnboardingSessionButton({
  defaultLocation = '',
  programs = [],
  defaultProgramId = null,
  activeProgramName,
  redirectTo = '/aesthetic-lab/issuer/catalog?workspace=onboarding',
}: {
  defaultLocation?: string
  programs?: Array<{ id: string; name: string }>
  defaultProgramId?: string | null
  activeProgramName?: string
  redirectTo?: string
}) {
  const [open, setOpen] = useState(false)

  return <>
    <button type="button" className={`${styles.onboardingWorkspaceAction} ${styles.opportunityWorkspaceButton}`} onClick={() => setOpen(true)}><Plus size={15} /> Add session</button>
    {open ? <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby="add-onboarding-session-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Onboarding session</p><h2 id="add-onboarding-session-title">Build a volunteer welcome.</h2><p>Name this onboarding session for the volunteer program it supports. You can publish and manage its dates separately after saving.</p></div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <form action={createOnboardingSessionAction} className={styles.issuerCalendarForm} onSubmit={() => setOpen(false)}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="credits" value="5" />
          {defaultProgramId ? <input type="hidden" name="programId" value={defaultProgramId} /> : null}
          <label>Session title<input name="title" required placeholder="e.g., Saturday garden orientation" /></label>
          {defaultProgramId ? <p className={styles.publishShiftAccessHint}>This onboarding pathway will be added to {activeProgramName || 'the active volunteer program'}.</p> : <label>Volunteer program <span>(optional)</span><select name="programId" defaultValue=""><option value="">Not assigned to a program</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select><small>Connect this session to the area of work it welcomes volunteers into.</small></label>}
          <label>Location<input name="location" required defaultValue={defaultLocation} placeholder="Address or meeting point" /></label>
          <label>Description<textarea name="description" required defaultValue="A welcoming local orientation for people beginning with our organization." /></label>
          <label>Before the session <span>(optional)</span><textarea name="beforeSession" placeholder="List anything participants should complete or review before they arrive." /></label>
          <label>What to bring <span>(optional)</span><textarea name="bringItems" placeholder="e.g. Photo ID, comfortable shoes, water bottle" /></label>
          <label>First session<input name="firstStartsAt" type="datetime-local" required defaultValue={suggestedDateTime()} /></label>
          <div className={styles.issuerCalendarDateGrid}><label>Capacity<input type="number" name="weeklyCapacity" min="1" required defaultValue="20" /></label><label>Duration (minutes)<input type="number" name="durationMinutes" min="30" required defaultValue="45" /></label></div>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit"><Plus size={15} /> Add session</button></div>
        </form>
      </section>
    </div> : null}
  </>
}
