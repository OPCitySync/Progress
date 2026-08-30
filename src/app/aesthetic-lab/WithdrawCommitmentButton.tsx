'use client'

import { CalendarX2, X } from 'lucide-react'
import { useState } from 'react'
import { unclaimClaimAction } from '@/app/actions'
import styles from './prototype.module.css'

/**
 * Keeps a cancellation simple while giving participants a genuinely optional
 * way to share context with the organization. The note is not a requirement
 * and is only recorded when the participant chooses to add it.
 */
export function WithdrawCommitmentButton({
  claimId,
  redirectTo,
  organizationName,
  label,
}: {
  claimId: string
  redirectTo: string
  organizationName: string
  label: string
}) {
  const [open, setOpen] = useState(false)

  return <>
    <button type="button" className={styles.onboardingReservationCancelButton} onClick={() => setOpen(true)}>{label}</button>
    {open ? <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={`${styles.issuerCalendarModal} ${styles.participantWithdrawalModal}`} role="dialog" aria-modal="true" aria-labelledby={`withdraw-commitment-${claimId}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div>
            <p className={styles.eyebrow}>Your commitment</p>
            <h2 id={`withdraw-commitment-${claimId}`}>{label}?</h2>
            <p>Your spot will be released for another Civic Participant. You may leave a note for {organizationName}, but it is entirely optional.</p>
          </div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <form action={unclaimClaimAction} className={`${styles.issuerCalendarForm} ${styles.participantWithdrawalForm}`} onSubmit={() => setOpen(false)}>
          <input type="hidden" name="claimId" value={claimId} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <label>
            Note for {organizationName} <span>(optional)</span>
            <textarea name="withdrawalNote" maxLength={600} placeholder="For example, I have a scheduling conflict." />
            <small>This is shared only with this organization to help them plan. You do not need to explain your cancellation.</small>
          </label>
          <div className={styles.issuerCalendarFormActions}>
            <button type="button" onClick={() => setOpen(false)}>Keep reservation</button>
            <button type="submit" className={styles.participantWithdrawalConfirm}><CalendarX2 size={15} /> {label}</button>
          </div>
        </form>
      </section>
    </div> : null}
  </>
}
