'use client'

import { CalendarPlus, X } from 'lucide-react'
import { useState } from 'react'
import { createOrganizationCalendarEntryAction } from '@/app/actions'
import styles from '../prototype.module.css'

function localInputValue(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

const initialStart = new Date()
initialStart.setMinutes(0, 0, 0)
initialStart.setHours(initialStart.getHours() + 1)
const initialEnd = new Date(initialStart.getTime() + 60 * 60 * 1000)

/** A compact modal for private, organization-owned planning entries. */
export function AddCalendarEntryButton() {
  const [open, setOpen] = useState(false)

  return <>
    <button type="button" className={styles.issuerAddCalendarButton} onClick={() => setOpen(true)}>
      <CalendarPlus size={14} /> <span>Add to calendar</span>
    </button>
    {open ? <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby="calendar-entry-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Organization calendar</p><h2 id="calendar-entry-title">Add an important date.</h2><p>This stays private to your organization and appears beside volunteer shifts.</p></div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <form action={createOrganizationCalendarEntryAction} className={styles.issuerCalendarForm}>
          <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer" />
          <label>Title<input name="title" required maxLength={140} placeholder="e.g. Confirm supply delivery" /></label>
          <label>Details <span>(optional)</span><textarea name="details" maxLength={500} placeholder="Add context your team will need." /></label>
          <div className={styles.issuerCalendarDateGrid}>
            <label>Starts<input name="startsAt" type="datetime-local" required defaultValue={localInputValue(initialStart)} /></label>
            <label>Ends<input name="endsAt" type="datetime-local" required defaultValue={localInputValue(initialEnd)} /></label>
          </div>
          <label>Color<select name="color" defaultValue="blue"><option value="blue">Blue</option><option value="gold">Gold</option><option value="mint">Mint</option><option value="coral">Coral</option></select></label>
          <label>Notification<select name="reminder" defaultValue="none"><option value="none">No notification</option><option value="at_start">At the start time</option><option value="one_hour_before">1 hour before</option><option value="one_day_before">1 day before</option></select><small>Sends you an in-app reminder.</small></label>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit"><CalendarPlus size={15} /> Add to calendar</button></div>
        </form>
      </section>
    </div> : null}
  </>
}
