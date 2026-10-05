/**
 * Local-only Activity Feed preview data.
 *
 * This appends a single, clearly labelled preview batch to the local hash
 * ledger so the issuer Activity Feed can be evaluated with representative
 * examples. It deliberately refuses remote database URLs.
 */
import { eq } from 'drizzle-orm'
import { db, client } from '../src/lib/db/client'
import { events, orgs, shifts, tasks } from '../src/lib/db/schema'
import { appendEvent } from '../src/lib/ledger/ledger'
import { EventTypes, type EventType } from '../src/lib/ledger/events'

const PREVIEW_RUN = 'activity-feed-preview-v1'

type PreviewEvent = {
  type: EventType
  payload: Record<string, unknown>
}

function hasPreviewMarker(payload: string) {
  try {
    return (JSON.parse(payload) as { previewRun?: string }).previewRun === PREVIEW_RUN
  } catch {
    return false
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? 'file:local.db'
  if (!databaseUrl.startsWith('file:')) {
    throw new Error('Activity Feed preview data is local-only. Refusing to write to a remote database.')
  }

  const existing = await db.select({ type: events.type, payload: events.payload }).from(events)
  const existingPreviewTypes = new Set(existing.filter((event) => hasPreviewMarker(event.payload)).map((event) => event.type))

  const organization = (await db.select().from(orgs).where(eq(orgs.type, 'issuer')).limit(1))[0]
  if (!organization) throw new Error('No issuer organization was found in the local database.')

  const [task] = await db.select().from(tasks).where(eq(tasks.orgId, organization.id)).limit(1)
  const [shift] = task
    ? await db.select().from(shifts).where(eq(shifts.taskId, task.id)).limit(1)
    : []
  const taskId = task?.id ?? 'preview-task'
  const shiftId = shift?.id ?? 'preview-shift'
  const actorId = organization.ownerUserId
  const base = { orgId: organization.id, preview: true, previewRun: PREVIEW_RUN }
  const verificationBatchId = 'preview-attendance-batch'

  const previewEvents: PreviewEvent[] = [
    { type: EventTypes.IDENTITY_CREATED, payload: { ...base, identityId: 'preview-organization-identity', kind: 'organization' } },
    { type: EventTypes.ORG_REGISTERED, payload: { ...base, organizationName: organization.name, orgType: 'issuer' } },
    { type: EventTypes.ORG_APPROVED, payload: { ...base, approvedBy: 'City/Sync preview administrator' } },
    { type: EventTypes.ORG_PROFILE_UPDATED, payload: { ...base, organizationName: organization.name, changedFields: ['Public description', 'Contact email'] } },
    { type: EventTypes.ORG_ROLE_CREATED, payload: { ...base, roleName: 'Volunteer Coordinator', permissions: ['Manage volunteers', 'Publish opportunities'] } },
    { type: EventTypes.ORG_ROLE_UPDATED, payload: { ...base, roleName: 'Volunteer Coordinator', changedFields: ['Manage volunteer groups'] } },
    { type: EventTypes.ORG_INVITE_CREATED, payload: { ...base, roleName: 'Volunteer Coordinator', expiresInDays: 7 } },
    { type: EventTypes.ORG_INVITE_ACCEPTED, payload: { ...base, userId: actorId, roleName: 'Volunteer Coordinator' } },
    { type: EventTypes.ORG_AUTHORITY_GRANTED, payload: { ...base, userId: actorId, roleName: 'Volunteer Coordinator' } },
    { type: EventTypes.ORG_AUTHORITY_REVOKED, payload: { ...base, userId: actorId, roleName: 'Volunteer Coordinator' } },
    { type: EventTypes.VOLUNTEER_ROSTER_INVITE_CREATED, payload: { ...base, inviteCode: 'PREVIEW-ROSTER' } },
    { type: EventTypes.VOLUNTEER_ROSTER_INVITE_ACCEPTED, payload: { ...base, userId: actorId, participantName: 'Preview Volunteer' } },
    { type: EventTypes.VOLUNTEER_GROUP_CREATED, payload: { ...base, groupName: 'Weekend Pantry Crew', memberCount: 4 } },
    { type: EventTypes.VOLUNTEER_GROUP_MEMBERS_UPDATED, payload: { ...base, groupName: 'Weekend Pantry Crew', addedCount: 2, removedCount: 1 } },
    { type: EventTypes.WAIVER_VERSION_CREATED, payload: { ...base, title: 'Volunteer Liability Waiver', version: 2, sha256: 'preview-waiver-hash-20260828' } },
    { type: EventTypes.WAIVER_RETIRED, payload: { ...base, title: 'Volunteer Liability Waiver', version: 1 } },
    { type: EventTypes.WAIVER_ACCEPTED, payload: { ...base, waiverVersionId: 'preview-waiver-v2', version: 2, userId: actorId } },
    { type: EventTypes.TASK_CREATED, payload: { ...base, taskId, title: 'Community pantry preparation', location: 'Riverside Food Bank', slots: 12 } },
    { type: EventTypes.TASK_UPDATED, payload: { ...base, taskId, title: 'Community pantry preparation', changedFields: ['Capacity', 'Volunteer instructions'] } },
    { type: EventTypes.ONBOARDING_SESSION_CREATED, payload: { ...base, taskId, title: 'New Volunteer Orientation', location: 'Riverside Food Bank' } },
    { type: EventTypes.ONBOARDING_SESSION_UPDATED, payload: { ...base, taskId, title: 'New Volunteer Orientation', changedFields: ['Session notes', 'Capacity'] } },
    { type: EventTypes.ONBOARDING_SESSION_PUBLISHED, payload: { ...base, taskId, shiftId, startsAt: Date.now() + 7 * 24 * 60 * 60 * 1000, capacity: 20 } },
    { type: EventTypes.ONBOARDING_SESSION_RECURRENCE_SET, payload: { ...base, taskId, recurrence: 'Weekly on Tuesdays at 6:00 PM' } },
    { type: EventTypes.TEMPLATE_EVENT_PUBLISHED, payload: { ...base, taskId, shiftId, startsAt: Date.now() + 3 * 24 * 60 * 60 * 1000, capacity: 8, visibility: 'public' } },
    { type: EventTypes.TEMPLATE_EVENT_RECURRENCE_SET, payload: { ...base, taskId, recurrence: 'Every Saturday at 9:00 AM' } },
    { type: EventTypes.SHIFT_CREATED, payload: { ...base, taskId, shiftId, startsAt: Date.now() + 2 * 24 * 60 * 60 * 1000, endsAt: Date.now() + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000, capacity: 8 } },
    { type: EventTypes.SHIFT_CLOSED, payload: { ...base, taskId, shiftId, reason: 'Weather cancellation' } },
    { type: EventTypes.TASK_CLAIMED, payload: { ...base, taskId, shiftId, userId: actorId, participantName: 'Preview Volunteer' } },
    { type: EventTypes.CLAIM_UNCLAIMED, payload: { ...base, taskId, shiftId, userId: actorId, participantName: 'Preview Volunteer', withdrawalNote: 'I have a scheduling conflict.' } },
    { type: EventTypes.CLAIM_CHECKED_IN, payload: { ...base, taskId, shiftId, userId: actorId, participantName: 'Preview Volunteer' } },
    { type: EventTypes.CLAIM_NO_SHOW, payload: { ...base, taskId, shiftId, userId: actorId, participantName: 'Preview Volunteer' } },
    { type: EventTypes.COMPLETION_SUBMITTED, payload: { ...base, taskId, shiftId, userId: actorId, contributionNote: 'Completed all assigned pantry sorting tasks.' } },
    { type: EventTypes.SHIFT_ATTENDANCE_BATCH_VERIFIED, payload: { ...base, batchId: verificationBatchId, taskId, shiftId, verifiedCount: 4, participantCount: 4, batchNote: 'All attendees completed the scheduled shift.' } },
    { type: EventTypes.COMPLETION_VERIFIED, payload: { ...base, taskId, shiftId, participantId: actorId, verificationBatchId } },
    { type: EventTypes.COMPLETION_REJECTED, payload: { ...base, taskId, shiftId, participantId: actorId, reason: 'Required shift tasks were not completed.' } },
    { type: EventTypes.MESSAGE_SENT, payload: { ...base, recipientCount: 8, audience: 'Weekend Pantry Crew', subject: 'Saturday shift details' } },
    { type: EventTypes.EVENT_CHAT_CREATED, payload: { ...base, taskId, shiftId, title: 'Saturday pantry shift chat' } },
    { type: EventTypes.POST_CREATED, payload: { ...base, postId: 'preview-city-update' } },
    { type: EventTypes.OFFERING_CREATED, payload: { ...base, offeringId: 'preview-offering', title: 'Farmers market voucher', cost: 20 } },
    { type: EventTypes.OFFERING_UPDATED, payload: { ...base, offeringId: 'preview-offering', changedFields: ['Availability'] } },
    { type: EventTypes.REDEMPTION_FINALIZED, payload: { ...base, offeringId: 'preview-offering', userId: actorId, cost: 20 } },
    { type: EventTypes.CREDITS_MINTED, payload: { ...base, userId: actorId, taskId, shiftId, amount: 15, reason: 'Verified pantry contribution' } },
  ]

  const missingPreviewEvents = previewEvents.filter((event) => !existingPreviewTypes.has(event.type))
  if (missingPreviewEvents.length === 0) {
    console.log('All Activity Feed preview records already exist in this local database.')
    return
  }

  await db.transaction(async (tx) => {
    for (const event of missingPreviewEvents) {
      await appendEvent(tx, event.type, event.payload, actorId)
    }
  })

  console.log(`Added ${missingPreviewEvents.length} Activity Feed preview records for ${organization.name}.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => client.close())
