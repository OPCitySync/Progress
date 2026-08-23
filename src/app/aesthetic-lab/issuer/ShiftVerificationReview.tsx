'use client'

import Link from 'next/link'
import { Check, ClipboardCheck, FileSignature, RotateCcw, UserRoundCheck, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { verifyShiftAttendanceAction } from '@/app/actions'
import styles from '../prototype.module.css'

type Participant = {
  claimId: string
  userId: string
  name: string
  email: string
  status: 'claimed' | 'submitted'
  checkedInAt: number | null
  waiverCollectionMethod: 'digital' | 'in_person' | null
  paperWaiverConfirmedAt: number | null
}

type Shift = {
  id: string
  title: string
  label: string
  startsAt: number | null
  endsAt: number | null
  location: string
  isOnboarding: boolean
  canVerify: boolean
}

function dateAndTime(value: number | null) {
  if (!value) return 'Date and time not recorded'
  return new Date(value).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** Shift-level confirmation UI; the server still records every person individually. */
export function ShiftVerificationReview({ shift, participants }: { shift: Shift; participants: Participant[] }) {
  const [selectedClaimIds, setSelectedClaimIds] = useState(() => participants.map((participant) => participant.claimId))
  const selected = useMemo(() => new Set(selectedClaimIds), [selectedClaimIds])
  const selectedParticipants = participants.filter((participant) => selected.has(participant.claimId))
  const paperWaiverRequired = selectedParticipants.some((participant) => participant.waiverCollectionMethod === 'in_person' && !participant.paperWaiverConfirmedAt)
  const selectedCount = selectedParticipants.length

  function toggle(claimId: string) {
    setSelectedClaimIds((current) => current.includes(claimId) ? current.filter((id) => id !== claimId) : [...current, claimId])
  }

  return <section className={styles.shiftVerificationCard}>
    <header className={styles.shiftVerificationHeader}>
      <span><ClipboardCheck size={21} /></span>
      <div>
        <p className={styles.eyebrow}>{shift.isOnboarding ? 'Onboarding attendance' : 'Shift attendance'}</p>
        <h2>{shift.title}</h2>
        <p>{dateAndTime(shift.startsAt)}{shift.label ? ` · ${shift.label}` : ''}{shift.location ? ` · ${shift.location}` : ''}</p>
      </div>
    </header>

    {!participants.length ? <div className={styles.shiftVerificationEmpty}>
      <Check size={22} />
      <div><h3>This shift is fully resolved.</h3><p>There are no remaining attendee records ready for verification.</p></div>
    </div> : <form action={verifyShiftAttendanceAction} className={styles.shiftVerificationForm}>
      <input type="hidden" name="shiftId" value={shift.id} />
      <input type="hidden" name="redirectTo" value={`/aesthetic-lab/issuer/shifts/${shift.id}/verify`} />
      <div className={styles.shiftVerificationIntro}>
        <div><p className={styles.eyebrow}>Attendance roster</p><h3>Confirm everyone who was present.</h3><p>Select the people who attended. One confirmation gives every selected person their own verified service record and credit entry.</p></div>
        <div className={styles.shiftVerificationRosterControls}>
          <button type="button" onClick={() => setSelectedClaimIds(participants.map((participant) => participant.claimId))}><UsersRound size={14} /> Select all</button>
          <button type="button" onClick={() => setSelectedClaimIds([])} disabled={selectedCount === 0}><RotateCcw size={14} /> Clear</button>
        </div>
      </div>

      <div className={styles.shiftVerificationRoster}>
        {participants.map((participant) => {
          const included = selected.has(participant.claimId)
          const paperWaiverPending = participant.waiverCollectionMethod === 'in_person' && !participant.paperWaiverConfirmedAt
          return <article key={participant.claimId} data-selected={included ? 'true' : undefined}>
            <label>
              <input type="checkbox" name="claimId" value={participant.claimId} checked={included} onChange={() => toggle(participant.claimId)} />
              <span className={styles.shiftVerificationCheck}>{included ? <Check size={14} /> : null}</span>
              <span className={styles.shiftVerificationAvatar}>{participant.name.slice(0, 2).toUpperCase()}</span>
              <span className={styles.shiftVerificationPerson}><b>{participant.name}</b><small>{participant.email}</small></span>
              <span className={styles.shiftVerificationStates}>
                <em>{participant.checkedInAt ? 'Checked in' : participant.status === 'submitted' ? 'Completion submitted' : 'Signed up'}</em>
                {paperWaiverPending ? <em data-tone="paper"><FileSignature size={12} /> Paper waiver to confirm</em> : null}
              </span>
            </label>
            <Link href={`/aesthetic-lab/issuer/volunteers/${participant.userId}`}><UserRoundCheck size={14} /> Profile</Link>
          </article>
        })}
      </div>

      <div className={styles.shiftVerificationFooter}>
        <div className={styles.shiftVerificationSummary}><ClipboardCheck size={17} /><p><b>{selectedCount} attendee{selectedCount === 1 ? '' : 's'} selected.</b> Selected people will be marked present and verified together; anyone left unchecked remains available for separate review.</p></div>
        {paperWaiverRequired ? <label className={styles.shiftVerificationWaiver}><input type="checkbox" name="paperWaiverReceived" required /><span><FileSignature size={16} /></span><p><b>Paper waivers received</b> Confirm each selected attendee who requires an in-person waiver provided their signed copy.</p></label> : null}
        <label className={styles.shiftVerificationNote}>Verification note <textarea name="note" rows={3} maxLength={2000} placeholder="Optional note for this verification batch — e.g., hours, weather, or a delivery outcome." /></label>
        {!shift.canVerify ? <p className={styles.shiftVerificationUnavailable}>This shift has not ended yet. Attendance can be confirmed after its scheduled end time.</p> : null}
        <button className={styles.shiftVerificationSubmit} type="submit" disabled={!shift.canVerify || selectedCount === 0}><ClipboardCheck size={15} /> Verify {selectedCount || ''} attendee{selectedCount === 1 ? '' : 's'}</button>
      </div>
    </form>}
  </section>
}
