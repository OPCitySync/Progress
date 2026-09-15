'use client'

import { useState } from 'react'
import { claimShiftAction } from '@/app/actions'
import styles from './prototype.module.css'

type ShiftSignupFormProps = {
  taskId: string
  shiftId: string
  redirectTo: string
  successRedirectTo: string
  waiverReady: boolean
}

/**
 * Keeps the attendance commitment and final sign-up action together while
 * making the required waiver state visible and impossible to bypass in the UI.
 * The action repeats both checks on the server before reserving capacity.
 */
export function ShiftSignupForm({ taskId, shiftId, redirectTo, successRedirectTo, waiverReady }: ShiftSignupFormProps) {
  const [attendanceConfirmed, setAttendanceConfirmed] = useState(false)
  const canSubmit = waiverReady && attendanceConfirmed

  return <form action={claimShiftAction} className={styles.directShiftSignupForm}>
    <input type="hidden" name="taskId" value={taskId} />
    <input type="hidden" name="shiftId" value={shiftId} />
    <input type="hidden" name="redirectTo" value={redirectTo} />
    <input type="hidden" name="successRedirectTo" value={successRedirectTo} />
    <input type="hidden" name="waiverCollectionMethod" value="digital" />
    <label className={styles.reservationAcknowledgement}>
      <input
        type="checkbox"
        name="attendanceAcknowledgement"
        value="yes"
        required
        checked={attendanceConfirmed}
        onChange={(event) => setAttendanceConfirmed(event.target.checked)}
      />
      <span>
        <b>I intend to attend this shift.</b>
        <small>If my plans change, I will withdraw before the 24-hour cancellation cutoff.</small>
      </span>
    </label>
    <div className={styles.directShiftSignupActions}>
      <span>{waiverReady ? 'Confirm your intent to activate sign up.' : 'Sign every required waiver above to activate sign up.'}</span>
      <button type="submit" disabled={!canSubmit}>Sign Up</button>
    </div>
  </form>
}
