import Link from 'next/link'
import type { CSSProperties } from 'react'
import { BookOpenCheck } from 'lucide-react'
import { organizationBannerPalette, type OrganizationBannerPalette } from '@/lib/profile/organization-appearance'
import type { ParticipantActivity } from '@/lib/services/participant-activity'
import styles from '../prototype.module.css'

type ActivityPaletteStyle = CSSProperties & {
  '--activity-deep': string
  '--activity-mid': string
  '--activity-accent': string
}

const hiddenDetailFields = new Set([
  'preview',
  'orgId',
  'cityId',
  'userId',
  'participantId',
  'taskId',
  'shiftId',
  'claimId',
  'refId',
])

function formattedDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function actionLabel(type: string) {
  const labels: Record<string, string> = {
    USER_REGISTERED: 'Account Created',
    USER_PROFILE_UPDATED: 'Account Profile Updated',
    IDENTITY_CREATED: 'Participant Identity Created',
    ONBOARDING_APPLICATION_SUBMITTED: 'Application Submitted',
    PROGRAM_APPLICATION_SUBMITTED: 'Application Submitted',
    PROGRAM_CANDIDATE_REVIEWED: 'Application Reviewed',
    VOLUNTEER_ADMISSION_REVIEWED: 'Volunteer Admission Reviewed',
    ORG_INVITE_ACCEPTED: 'Organization Invitation Accepted',
    VOLUNTEER_ROSTER_INVITE_ACCEPTED: 'Roster Invitation Accepted',
    WAIVER_ACCEPTED: 'Waiver Signed',
    TASK_CLAIMED: 'Shift Reserved',
    CLAIM_UNCLAIMED: 'Commitment Withdrawn',
    CLAIM_CHECKED_IN: 'Shift Check-In Recorded',
    CLAIM_NO_SHOW: 'No-Show Recorded',
    COMPLETION_SUBMITTED: 'Completion Submitted',
    COMPLETION_VERIFIED: 'Service Verified',
    COMPLETION_REJECTED: 'Completion Not Verified',
    CREDITS_MINTED: 'Civic Credits Earned',
    CREDITS_BURNED: 'Civic Credits Redeemed',
    CREDITS_ADJUSTED: 'Civic Credits Adjusted',
    REDEMPTION_FINALIZED: 'Redemption Completed',
    POST_CREATED: 'MyCity Post Published',
  }
  return labels[type] ?? type.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function detailLabel(key: string) {
  if (key === 'changed') return 'Updated fields'
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (character) => character.toUpperCase())
}

function detailValue(value: unknown) {
  if (Array.isArray(value)) return value.map((entry) => String(entry).replace(/([a-z])([A-Z])/g, '$1 $2')).join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === null || value === undefined || value === '') return 'Not recorded'
  if (typeof value === 'string') return value.replace(/_/g, ' ')
  return String(value)
}

function payloadDetails(payload: string) {
  try {
    const parsed: unknown = JSON.parse(payload)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.entries(parsed as Record<string, unknown>).filter(([key]) => !hiddenDetailFields.has(key))
      : []
  } catch {
    return []
  }
}

export function ParticipantActivityFeed({
  activity,
  bannerPalette,
}: {
  activity: ParticipantActivity[]
  bannerPalette: OrganizationBannerPalette
}) {
  const palette = organizationBannerPalette(bannerPalette)
  const paletteStyle: ActivityPaletteStyle = {
    '--activity-deep': palette.colors[0],
    '--activity-mid': palette.colors[1],
    '--activity-accent': palette.colors[2],
  }

  return <section className={styles.manageActivityFeed} style={paletteStyle}>
    <div className={styles.manageSectionHeading}>
      <div><p className={styles.eyebrow}>Activity Feed</p></div>
      <BookOpenCheck size={19} />
    </div>
    <div className={styles.issuerOrganizationLedgerList}>
      {activity.length ? activity.map((entry) => {
        const details = payloadDetails(entry.payload)
        const eventHref = entry.taskId
          ? entry.shiftId
            ? `/aesthetic-lab/opportunities/${entry.taskId}/sessions/${entry.shiftId}`
            : `/aesthetic-lab/opportunities/${entry.taskId}`
          : null
        return <article key={entry.hash}>
          <details className={styles.issuerLedgerDetails}>
            <summary className={styles.issuerLedgerSummary}>
              <span><BookOpenCheck size={16} /></span>
              <div>
                <div className={styles.issuerLedgerEventTitle}><b>{actionLabel(entry.type)}</b></div>
                <p>{entry.organizationName || entry.taskTitle ? [entry.organizationName, entry.taskTitle].filter(Boolean).join(' · ') : `Action taken by ${entry.actorName}`}</p>
                <time dateTime={new Date(entry.ts).toISOString()}>{formattedDate(entry.ts)} · Ledger record #{entry.seq}</time>
              </div>
              <span className={styles.issuerLedgerDetailsControl}>View recorded details</span>
            </summary>
            <div className={styles.issuerLedgerDetailBody}>
              {details.length ? <dl className={styles.issuerLedgerPayload}>
                {details.map(([key, value]) => <div key={key}><dt>{detailLabel(key)}</dt><dd>{detailValue(value)}</dd></div>)}
              </dl> : <p className={styles.issuerLedgerNoPayload}>No additional action fields were recorded for this entry.</p>}
              {eventHref ? <p className={styles.issuerLedgerReason}><Link href={eventHref}>Open related volunteer event</Link></p> : null}
              <dl className={styles.issuerLedgerIntegrity}><div><dt>Record hash</dt><dd><code>{entry.hash}</code></dd></div></dl>
            </div>
          </details>
        </article>
      }) : <div className={styles.issuerNotificationHistoryEmpty}>
        <BookOpenCheck size={18} />
        <div><b>No account activity recorded yet.</b><p>Account and participation actions will appear here.</p></div>
      </div>}
    </div>
  </section>
}
