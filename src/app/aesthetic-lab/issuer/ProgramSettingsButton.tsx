'use client'

import { Settings2, X } from 'lucide-react'
import { useState } from 'react'
import { updateVolunteerProgramSettingsAction } from '@/app/actions'
import styles from '../prototype.module.css'

type OnboardingPreference = 'optional' | 'recommended' | 'not_needed'

export function ProgramSettingsButton({
  program,
  redirectTo,
}: {
  program: {
    id: string
    name: string
    defaultVisibility: 'public' | 'private'
    defaultLocation: string
    defaultCapacity: number
    defaultDurationMinutes: number
    onboardingPreference: OnboardingPreference
  }
  redirectTo: string
}) {
  const [open, setOpen] = useState(false)
  const [defaultVisibility, setDefaultVisibility] = useState<'public' | 'private'>(program.defaultVisibility)

  return <>
    <button type="button" className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} onClick={() => setOpen(true)}><Settings2 size={14} /> Program Settings</button>
    {open ? <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={`${styles.issuerCalendarModal} ${styles.programSettingsModal}`} role="dialog" aria-modal="true" aria-labelledby="program-settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>{program.name}</p><h2 id="program-settings-title">Set program defaults.</h2><p>These defaults prefill future work in this Program. Individual shifts can still be published for open signup or assigned directly from your roster.</p></div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <form action={updateVolunteerProgramSettingsAction} className={styles.issuerCalendarForm} onSubmit={() => setOpen(false)}>
          <input type="hidden" name="programId" value={program.id} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className={styles.programSettingsDefaults}>
            <label>Default shift access<select name="defaultVisibility" value={defaultVisibility} onChange={(event) => setDefaultVisibility(event.target.value === 'private' ? 'private' : 'public')}><option value="public">Open signup</option><option value="private">Organization assigned</option></select><small>This is only the starting choice for a new shift.</small></label>
            <label>Default capacity<input name="defaultCapacity" type="number" min={1} max={10000} required defaultValue={program.defaultCapacity} /></label>
            <label>Default duration<select name="defaultDurationMinutes" defaultValue={String(program.defaultDurationMinutes)}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option><option value="180">3 hours</option><option value="240">4 hours</option><option value="480">8 hours</option></select></label>
            <label>Onboarding<select name="onboardingPreference" defaultValue={program.onboardingPreference}><option value="optional">Optional</option><option value="recommended">Recommended for this program</option><option value="not_needed">Not needed</option></select></label>
          </div>
          <label>Default location <span>(optional)</span><input name="defaultLocation" maxLength={240} defaultValue={program.defaultLocation} placeholder="Address or meeting point" /></label>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit"><Settings2 size={15} /> Save Settings</button></div>
        </form>
      </section>
    </div> : null}
  </>
}
