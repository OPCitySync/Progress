'use client'

import Link from 'next/link'
import { Check, ClipboardCheck, FileSignature, HeartHandshake, UserRoundCheck, UsersRound } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { verifyShiftAttendanceAction } from '@/app/actions'
import styles from '../prototype.module.css'

type Participant = {
  claimId: string
  userId: string
  name: string
  email: string
  waiverCollectionMethod: 'digital' | 'in_person' | null
  paperWaiverConfirmedAt: number | null
  identityMatchRequired: boolean
  identityMatchConfirmed: boolean
}

type Shift = {
  id: string
  title: string
  label: string
  startsAt: number | null
  endsAt: number | null
  location: string
  isOnboarding: boolean
  canFinalize: boolean
}

function dateAndTime(value: number | null) {
  if (!value) return 'Date and time not recorded'
  return new Date(value).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** Shift-level confirmation UI; the server still records every person individually. */
export function ShiftVerificationReview({
  shift,
  participants,
  headerAction,
}: {
  shift: Shift
  participants: Participant[]
  headerAction?: ReactNode
}) {
  const [selectedClaimIds, setSelectedClaimIds] = useState(() => participants.map((participant) => participant.claimId))
  const selected = useMemo(() => new Set(selectedClaimIds), [selectedClaimIds])
  const selectedParticipants = participants.filter((participant) => selected.has(participant.claimId))
  const selectedCount = selectedParticipants.length
  const everyoneSelected = participants.length > 0 && selectedCount === participants.length

  function toggle(claimId: string) {
    setSelectedClaimIds((current) => current.includes(claimId) ? current.filter((id) => id !== claimId) : [...current, claimId])
  }

  function toggleAll() {
    setSelectedClaimIds(everyoneSelected ? [] : participants.map((participant) => participant.claimId))
  }

  return <section className={styles.shiftVerificationCard}>
    <header className={styles.shiftVerificationHeader}>
      <span><ClipboardCheck size={21} /></span>
      <div>
        <p className={styles.eyebrow}>{shift.isOnboarding ? 'Onboarding attendance' : 'Shift attendance'}</p>
        <h2>{shift.title}</h2>
        <p>{dateAndTime(shift.startsAt)}{shift.label ? ` · ${shift.label}` : ''}{shift.location ? ` · ${shift.location}` : ''}</p>
      </div>
      {headerAction ? <div className={styles.shiftVerificationHeaderAction}>{headerAction}</div> : null}
    </header>

    {!participants.length && !shift.canFinalize ? <div className={styles.shiftVerificationEmpty}>
      <Check size={22} />
      <div><h3>Attendance is finalized.</h3><p>There are no remaining attendee records to resolve for this shift.</p></div>
    </div> : <form action={verifyShiftAttendanceAction} className={styles.shiftVerificationForm}>
      <input type="hidden" name="shiftId" value={shift.id} />
      <input type="hidden" name="redirectTo" value={`/aesthetic-lab/issuer/shifts/${shift.id}/verify`} />
      <div className={styles.shiftVerificationIntro}>
        <p className={styles.eyebrow}>Attendance roster</p>
        {participants.length && !shift.isOnboarding ? <div className={styles.shiftVerificationRosterControls}>
          <button type="button" onClick={toggleAll}><UsersRound size={14} /> {everyoneSelected ? 'Clear Selected' : 'Select All'}</button>
        </div> : null}
      </div>

      {participants.length ? <div className={styles.shiftVerificationRoster}>
        {participants.map((participant) => {
          const included = selected.has(participant.claimId)
          const paperWaiverRequired = participant.waiverCollectionMethod === 'in_person' && !participant.paperWaiverConfirmedAt
          const identityMatchRequired = participant.identityMatchRequired && !participant.identityMatchConfirmed
          const showOnboardingConfirmations = shift.isOnboarding && included && (paperWaiverRequired || identityMatchRequired)
          return <article key={participant.claimId} data-selected={included ? 'true' : undefined}>
            <label>
              <input type="checkbox" name="claimId" value={participant.claimId} checked={included} onChange={() => toggle(participant.claimId)} />
              <span className={styles.shiftVerificationCheck}>{included ? <Check size={14} /> : null}</span>
              <span className={styles.shiftVerificationAvatar}>{participant.name.slice(0, 2).toUpperCase()}</span>
              <span className={styles.shiftVerificationPerson}><b>{participant.name}</b><small>{participant.email}</small></span>
            </label>
            <Link href={`/aesthetic-lab/issuer/volunteers/${participant.userId}`}><UserRoundCheck size={12} /> View Profile</Link>
            {showOnboardingConfirmations ? <div className={styles.shiftVerificationParticipantConfirmations}>
              {paperWaiverRequired ? <label>
                <input type="checkbox" name="paperWaiverReceived" required />
                <span><FileSignature size={15} /></span>
                <span><b>Paper Waiver Received</b><small>Confirm this volunteer provided their signed paper waiver.</small></span>
              </label> : null}
              {identityMatchRequired ? <label>
                <input type="checkbox" name="identityMatchesConfirmed" required />
                <span><UserRoundCheck size={15} /></span>
                <span><b>Identity Confirmed</b><small>Confirm this volunteer matches the City/Sync account used for the session.</small></span>
              </label> : null}
            </div> : null}
          </article>
        })}
      </div> : <div className={styles.shiftVerificationEmpty}>
        <Check size={22} />
        <div><h3>No active reservations.</h3><p>Finalize attendance to close this shift without recording a no-show.</p></div>
      </div>}

      <div className={styles.shiftVerificationFooter}>
        <label className={styles.shiftVerificationNote}>Verification note <textarea name="note" rows={3} maxLength={2000} placeholder="Optional note for this verification batch — e.g., hours, weather, or a delivery outcome." /></label>
        <label className={styles.shiftVerificationLetter}><span><HeartHandshake size={17} /></span><span><b>Thank You Letter</b><small>Optional · sent to everyone marked present</small></span><textarea name="thankYouLetter" rows={5} maxLength={3000} disabled={!selectedCount} placeholder="Tell the team what their contribution made possible." /></label>
        {!shift.canFinalize ? <p className={styles.shiftVerificationUnavailable}>A shift can be finalized once its scheduled start time has arrived.</p> : null}
        <button className={styles.shiftVerificationSubmit} type="submit" disabled={!shift.canFinalize}><ClipboardCheck size={15} /> Finalize Attendance</button>
      </div>
    </form>}
  </section>
}
