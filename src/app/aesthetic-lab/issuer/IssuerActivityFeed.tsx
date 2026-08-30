import { BookOpenCheck } from 'lucide-react'
import Link from 'next/link'
import { listOrganizationActivity } from '@/lib/services/organization-activity'
import styles from '../prototype.module.css'

type OrganizationActivity = Awaited<ReturnType<typeof listOrganizationActivity>>
type ActivityAudience = 'Civic Participant' | 'Issuer Organization' | 'Redeemer Organization' | 'Admin'

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
  if (type === 'SHIFT_ATTENDANCE_FINALIZED') return 'Attendance Finalized'
  return type
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function detailLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/Id$/i, ' ID')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase())
}

const hiddenPayloadFields = new Set([
  'preview',
  'previewRun',
  'orgId',
  'cityId',
  'userId',
  'participantId',
  'taskId',
  'shiftId',
  'claimId',
  'refId',
  // Older local preview data included a hand-written post summary. The source
  // post is the record of truth and is linked directly in Recorded Details.
  'summary',
])

function ledgerPayloadEntries(payload: string) {
  try {
    const parsed: unknown = JSON.parse(payload)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []
    return Object.entries(parsed as Record<string, unknown>).filter(([key]) => !hiddenPayloadFields.has(key))
  } catch {
    return []
  }
}

function ledgerValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === '') return 'Not recorded'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number' && /(?:at|timestamp)$/i.test(key) && value > 1_000_000_000_000) return formattedDate(value)
  if (typeof value === 'string') return value.replace(/_/g, ' ')
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function readableReason(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return 'Verified contribution'
  return value.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase())
}

function activityDetailLabel(type: string, key: string) {
  if (type === 'CLAIM_UNCLAIMED' && (key === 'reason' || key === 'withdrawalNote')) return 'Participant note'
  if (type === 'SHIFT_ATTENDANCE_FINALIZED') {
    if (key === 'verifiedCount') return 'Verified attendees'
    if (key === 'noShowCount') return 'No-shows'
    if (key === 'finalizedAt') return 'Finalized at'
  }
  return detailLabel(key)
}

/**
 * A preview aid for deciding which role's front-facing activity surface
 * should receive each event type. These are presentation audiences, not
 * authorization rules; the ledger itself remains more restrictive.
 */
function audiencesForActivity(type: string): ActivityAudience[] {
  switch (type) {
    case 'IDENTITY_CREATED':
    case 'ORG_REGISTERED':
      return ['Admin']
    case 'ORG_APPROVED':
      return ['Issuer Organization', 'Admin']
    case 'ORG_PROFILE_UPDATED':
    case 'ORG_ROLE_CREATED':
    case 'ORG_ROLE_UPDATED':
    case 'ORG_INVITE_CREATED':
    case 'ORG_AUTHORITY_GRANTED':
    case 'ORG_AUTHORITY_REVOKED':
    case 'VOLUNTEER_ROSTER_INVITE_CREATED':
    case 'VOLUNTEER_GROUP_CREATED':
    case 'VOLUNTEER_GROUP_MEMBERS_UPDATED':
    case 'WAIVER_VERSION_CREATED':
    case 'WAIVER_RETIRED':
    case 'WAIVER_RECEIPT_ATTESTED':
    case 'IDENTITY_MATCH_ATTESTED':
    case 'TASK_CREATED':
    case 'TASK_UPDATED':
    case 'ONBOARDING_SESSION_CREATED':
    case 'ONBOARDING_SESSION_UPDATED':
    case 'ONBOARDING_SESSION_RECURRENCE_SET':
    case 'TEMPLATE_EVENT_RECURRENCE_SET':
    case 'TASK_CLOSED':
    case 'TASK_REOPENED':
    case 'SHIFT_CREATED':
      return ['Issuer Organization']
    case 'ORG_INVITE_ACCEPTED':
    case 'VOLUNTEER_ROSTER_INVITE_ACCEPTED':
    case 'WAIVER_ACCEPTED':
    case 'TASK_CLAIMED':
    case 'CLAIM_UNCLAIMED':
    case 'CLAIM_CHECKED_IN':
    case 'CLAIM_NO_SHOW':
    case 'COMPLETION_SUBMITTED':
    case 'COMPLETION_VERIFIED':
    case 'COMPLETION_REJECTED':
    case 'EVENT_CHAT_CREATED':
      return ['Civic Participant', 'Issuer Organization']
    case 'MESSAGE_SENT':
      return ['Issuer Organization']
    case 'EVENT_CHAT_ARCHIVED':
      return ['Admin']
    case 'ONBOARDING_SESSION_PUBLISHED':
    case 'TEMPLATE_EVENT_PUBLISHED':
      return ['Civic Participant', 'Issuer Organization']
    case 'SHIFT_CLOSED':
      return ['Civic Participant', 'Issuer Organization']
    case 'SHIFT_ATTENDANCE_BATCH_VERIFIED':
    case 'SHIFT_ATTENDANCE_FINALIZED':
      return ['Issuer Organization']
    case 'POST_CREATED':
      return ['Civic Participant', 'Issuer Organization']
    // Reactions are lightweight, reversible feed state. Keep any event record
    // available to administrators, but do not surface a person’s hearts in
    // participant or issuer-facing activity history.
    case 'POST_HEARTED':
    case 'POST_UNHEARTED':
      return ['Admin']
    case 'POST_REMOVED':
      return ['Issuer Organization', 'Admin']
    case 'OFFERING_CREATED':
    case 'OFFERING_UPDATED':
      return ['Redeemer Organization']
    case 'REDEMPTION_FINALIZED':
      return ['Civic Participant', 'Redeemer Organization']
    case 'CREDITS_MINTED':
      return ['Civic Participant', 'Issuer Organization']
    case 'CREDITS_BURNED':
      return ['Civic Participant', 'Redeemer Organization']
    case 'CREDITS_ADJUSTED':
      return ['Civic Participant', 'Admin']
    default:
      return ['Admin']
  }
}

function PersonLink({ name, userId }: { name: string; userId: string | null }) {
  return userId
    ? <Link className={styles.issuerLedgerPersonLink} href={`/aesthetic-lab/issuer/volunteers/${userId}`}>{name}</Link>
    : <strong>{name}</strong>
}

export function IssuerActivityFeed({ activity }: { activity: OrganizationActivity }) {
  return <section className={styles.manageActivityFeed}>
    <div className={styles.manageSectionHeading}>
      <div><p className={styles.eyebrow}>Activity Feed</p></div>
      <BookOpenCheck size={19} />
    </div>
    <div className={styles.issuerOrganizationLedgerList}>
      {activity.length ? activity.map((entry) => {
        const details = ledgerPayloadEntries(entry.payload).filter(([key, value]) =>
          !(entry.type === 'COMPLETION_VERIFIED' && key === 'credits') &&
          !(entry.type === 'SHIFT_ATTENDANCE_FINALIZED' && key === 'batchId' && !value),
        )
        const payload = (() => {
          try {
            const parsed: unknown = JSON.parse(entry.payload)
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
          } catch {
            return {}
          }
        })()
        const isCreditsMinted = entry.type === 'CREDITS_MINTED'
        const audiences = audiencesForActivity(entry.type)
        const eventHref = entry.shiftId
          ? `/aesthetic-lab/issuer/catalog?workspace=${entry.isOnboarding ? 'onboarding' : 'opportunities'}&event=${entry.shiftId}#event-${entry.shiftId}`
          : entry.taskId
            ? entry.isOnboarding
              ? '/aesthetic-lab/issuer/catalog?workspace=onboarding'
              : `/aesthetic-lab/issuer/opportunities/${entry.taskId}`
            : null
        const postHref = entry.postId ? `/aesthetic-lab/issuer/feed#post-${entry.postId}` : null
        const messageHref = entry.messageId
          ? `/aesthetic-lab/issuer/notifications?pane=outbound&message=${encodeURIComponent(entry.messageId)}`
          : null
        return <article key={entry.hash}>
          <details className={styles.issuerLedgerDetails}>
            <summary className={styles.issuerLedgerSummary}>
              <span><BookOpenCheck size={16} /></span>
              <div>
                <div className={styles.issuerLedgerEventTitle}><b>{actionLabel(entry.type)}</b><span className={styles.issuerLedgerAudienceTags}>{audiences.map((audience) => <i key={audience} data-audience={audience}>{audience}</i>)}</span></div>
                <p>Action taken by <PersonLink name={entry.actorName} userId={entry.actorUserId} /></p>
                <time dateTime={new Date(entry.ts).toISOString()}>{formattedDate(entry.ts)} · Ledger record #{entry.seq}</time>
              </div>
              <span className={styles.issuerLedgerDetailsControl}>View recorded details</span>
            </summary>
            <div className={styles.issuerLedgerDetailBody}>
              {isCreditsMinted ? <dl className={styles.issuerLedgerPayload}>
                <div><dt>Amount</dt><dd>{ledgerValue('amount', payload.amount)} Civic Credits</dd></div>
                <div><dt>Reason</dt><dd className={styles.issuerLedgerReason}>{readableReason(payload.reason)}{eventHref ? <Link href={eventHref}>Open event card</Link> : null}</dd></div>
                <div><dt>Recipient</dt><dd>{entry.recipientName ? <PersonLink name={entry.recipientName} userId={entry.recipientUserId} /> : 'Participant name unavailable'}</dd></div>
              </dl> : details.length ? <dl className={styles.issuerLedgerPayload}>
                {details.map(([key, value]) => <div key={key}>
                  <dt>{activityDetailLabel(entry.type, key)}</dt>
                  <dd>{ledgerValue(key, value)}</dd>
                </div>)}
              </dl> : <p className={styles.issuerLedgerNoPayload}>No additional action fields were recorded for this entry.</p>}
              {!isCreditsMinted && (postHref || eventHref || messageHref) ? <dl className={styles.issuerLedgerPayload}>
                {postHref ? <div><dt>Related post</dt><dd className={styles.issuerLedgerReason}><Link href={postHref}>Open MyCity post</Link></dd></div> : null}
                {eventHref ? <div><dt>Related event</dt><dd className={styles.issuerLedgerReason}><Link href={eventHref}>{entry.shiftId ? 'Open event card' : 'Open opportunity template'}</Link></dd></div> : null}
                {messageHref ? <div><dt>Outbound message</dt><dd className={styles.issuerLedgerReason}><Link href={messageHref}>Open in Outbox</Link></dd></div> : null}
              </dl> : null}
              <dl className={styles.issuerLedgerIntegrity}>
                <div><dt>Record hash</dt><dd><code>{entry.hash}</code></dd></div>
              </dl>
            </div>
          </details>
        </article>
      }) : <div className={styles.issuerNotificationHistoryEmpty}>
        <BookOpenCheck size={18} />
        <div><b>No organizational actions recorded yet.</b><p>Actions taken in this organization will appear here.</p></div>
      </div>}
    </div>
  </section>
}
