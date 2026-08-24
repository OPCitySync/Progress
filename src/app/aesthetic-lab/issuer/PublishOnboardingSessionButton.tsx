'use client'

import { CalendarPlus, Repeat2, X } from 'lucide-react'
import { useState } from 'react'
import { publishOnboardingSessionAction } from '@/app/actions'
import styles from '../prototype.module.css'

function localDateTimeValue(timestamp: number) {
  const value = new Date(timestamp)
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset())
  return value.toISOString().slice(0, 16)
}

export function PublishOnboardingSessionButton({
  taskId,
  redirectTo,
  suggestedStartsAt,
  existingFutureSessions,
}: {
  taskId: string
  redirectTo: string
  suggestedStartsAt: number
  existingFutureSessions: number
}) {
  const [open, setOpen] = useState(false)

  return <>
    <button type="button" className={styles.onboardingWorkspaceAction} onClick={() => setOpen(true)}><CalendarPlus size={15} /> Publish session</button>
    {open ? <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby="publish-onboarding-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Onboarding</p><h2 id="publish-onboarding-title">Publish an onboarding session.</h2><p>Choose the date and time participants will see. Your current capacity and duration are used automatically.</p></div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <form action={publishOnboardingSessionAction} className={styles.issuerCalendarForm} onSubmit={() => setOpen(false)}>
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <label>Date and time<input name="startsAt" type="datetime-local" required defaultValue={localDateTimeValue(suggestedStartsAt)} /></label>
          <label className={styles.onboardingRecurringChoice}><span><input type="checkbox" name="recurring" value="true" /> <Repeat2 size={15} /> Set up as recurring</span><small>City/Sync keeps one session public at a time. After that session ends, the next weekly occurrence will publish automatically.</small></label>
          {existingFutureSessions > 1 ? <p className={styles.onboardingRecurringNotice}>This program currently has {existingFutureSessions} future sessions published. You can publish another single session, but resolve those future sessions before turning on one-at-a-time recurring publication.</p> : null}
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit"><CalendarPlus size={15} /> Publish session</button></div>
        </form>
      </section>
    </div> : null}
  </>
}
