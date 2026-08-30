import { desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { catalogEntries, claims, events, identities, offerings, organizationDelegations, posts, shifts, tasks, users } from '@/lib/db/schema'
import { participantDisplayName } from '@/lib/participant-name'

type ActivityPayload = Record<string, unknown>

export type OrganizationActivity = {
  seq: number
  type: string
  payload: string
  actorId: string | null
  actorName: string
  actorUserId: string | null
  ts: number
  hash: string
  postId: string | null
  messageId: string | null
  taskId: string | null
  shiftId: string | null
  taskTitle: string | null
  isOnboarding: boolean
  recipientName: string | null
  recipientUserId: string | null
}

function parsePayload(value: string): ActivityPayload {
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as ActivityPayload : {}
  } catch {
    return {}
  }
}

function stringValue(payload: ActivityPayload, key: string) {
  const value = payload[key]
  return typeof value === 'string' ? value : null
}

/**
 * Returns the audit records materially connected to one organization.
 * Relationship matching uses immutable ids in the event payload, rather than
 * a person's current role, so past actions remain visible after a revocation.
 */
export async function listOrganizationActivity(orgId: string): Promise<OrganizationActivity[]> {
  const [eventRows, orgTasks, orgShifts, orgOfferings, orgPosts, orgCatalogEntries, delegations, allUsers] = await Promise.all([
    db.select().from(events).orderBy(desc(events.seq)),
    db.select({ id: tasks.id, title: tasks.title, isOnboarding: tasks.isOnboarding }).from(tasks).where(eq(tasks.orgId, orgId)),
    db.select({ id: shifts.id }).from(shifts).where(eq(shifts.orgId, orgId)),
    db.select({ id: offerings.id }).from(offerings).where(eq(offerings.orgId, orgId)),
    db.select({ id: posts.id }).from(posts).where(eq(posts.orgId, orgId)),
    db.select({ id: catalogEntries.id }).from(catalogEntries).where(eq(catalogEntries.orgId, orgId)),
    db
      .select({ delegationId: organizationDelegations.id, identityId: identities.id, user: users })
      .from(organizationDelegations)
      .innerJoin(identities, eq(organizationDelegations.identityId, identities.id))
      .innerJoin(users, eq(organizationDelegations.userId, users.id))
      .where(eq(organizationDelegations.orgId, orgId)),
    db.select({ id: users.id, name: users.name, username: users.username }).from(users),
  ])

  const taskIds = new Set(orgTasks.map((task) => task.id))
  const shiftIds = new Set(orgShifts.map((shift) => shift.id))
  const offeringIds = new Set(orgOfferings.map((offering) => offering.id))
  const postIds = new Set(orgPosts.map((post) => post.id))
  const taskTitles = new Map(orgTasks.map((task) => [task.id, task.title]))
  const taskIsOnboarding = new Map(orgTasks.map((task) => [task.id, task.isOnboarding === 1]))
  const catalogEntryIds = new Set(orgCatalogEntries.map((entry) => entry.id))
  // Preserve compatibility with the original local activity preview, which
  // predates the verificationBatchId field on each individual completion.
  const previewBatchEventKeys = new Set(
    eventRows
      .filter((event) => event.type === 'SHIFT_ATTENDANCE_BATCH_VERIFIED')
      .map((event) => parsePayload(event.payload))
      .filter((payload) => payload.preview === true)
      .map((payload) => `${stringValue(payload, 'taskId') ?? ''}:${stringValue(payload, 'shiftId') ?? ''}`),
  )
  const actorNames = new Map(allUsers.map((user) => [user.id, participantDisplayName(user)]))
  const userIdByActor = new Map(allUsers.map((user) => [user.id, user.id]))
  for (const { delegationId, identityId, user } of delegations) {
    const name = participantDisplayName(user)
    actorNames.set(delegationId, name)
    actorNames.set(identityId, name)
    userIdByActor.set(delegationId, user.id)
    userIdByActor.set(identityId, user.id)
  }
  const orgClaims = taskIds.size
    ? await db.select({ id: claims.id, taskId: claims.taskId, shiftId: claims.shiftId }).from(claims).where(inArray(claims.taskId, Array.from(taskIds)))
    : []
  const claimsById = new Map(orgClaims.map((claim) => [claim.id, claim]))
  // Legacy local preview records predate the task/shift reference now used by
  // credit minting. Resolve only those clearly marked records to their most
  // recent verified contribution so the preview demonstrates the intended UI.
  const previewVerifiedContributionByParticipant = new Map<string, { taskId: string; shiftId: string | null }>()
  for (const event of eventRows) {
    if (event.type !== 'COMPLETION_VERIFIED') continue
    const payload = parsePayload(event.payload)
    const participantId = stringValue(payload, 'participantId')
    const taskId = stringValue(payload, 'taskId')
    if (participantId && taskId && taskIds.has(taskId) && !previewVerifiedContributionByParticipant.has(participantId)) {
      previewVerifiedContributionByParticipant.set(participantId, { taskId, shiftId: stringValue(payload, 'shiftId') })
    }
  }

  return eventRows
    .filter((event) => {
      const payload = parsePayload(event.payload)
      // The local preview previously demonstrated a pending-code cancellation.
      // Redemption is moving to immediate QR completion, so omit those obsolete
      // samples while preserving the immutable local test ledger itself.
      if ((event.type === 'REDEMPTION_REQUESTED' || event.type === 'REDEMPTION_CANCELLED') && payload.preview === true) return false
      // Chat archival and retention purges are automatic housekeeping, not
      // organization-facing activity. Keep their audit traces internal.
      if (event.type === 'EVENT_CHAT_ARCHIVED' || event.type === 'EVENT_CHAT_DELETED') return false
      // Batch verification is the organization-facing receipt. Its per-person
      // completion records remain immutable for participant history, but do
      // not repeat beside the batch in the Issuer Activity Feed.
      if (
        event.type === 'COMPLETION_VERIFIED' &&
        (Boolean(stringValue(payload, 'verificationBatchId')) ||
          (payload.preview === true && previewBatchEventKeys.has(`${stringValue(payload, 'taskId') ?? ''}:${stringValue(payload, 'shiftId') ?? ''}`)))
      ) return false
      return (
        stringValue(payload, 'orgId') === orgId ||
        taskIds.has(stringValue(payload, 'taskId') ?? '') ||
        shiftIds.has(stringValue(payload, 'shiftId') ?? '') ||
        offeringIds.has(stringValue(payload, 'offeringId') ?? '') ||
        postIds.has(stringValue(payload, 'postId') ?? '') ||
        catalogEntryIds.has(stringValue(payload, 'entryId') ?? '')
      )
    })
    .map((event) => {
      const payload = parsePayload(event.payload)
      const claimReference = stringValue(payload, 'refId')?.startsWith('claim:')
        ? claimsById.get(stringValue(payload, 'refId')!.slice('claim:'.length))
        : undefined
      const recipientId = stringValue(payload, 'participantId') ?? stringValue(payload, 'userId')
      const previewContribution = payload.preview === true && recipientId
        ? previewVerifiedContributionByParticipant.get(recipientId)
        : undefined
      const taskId = stringValue(payload, 'taskId') ?? claimReference?.taskId ?? previewContribution?.taskId ?? null
      const shiftId = stringValue(payload, 'shiftId') ?? claimReference?.shiftId ?? previewContribution?.shiftId ?? null
      const namedRecipient = stringValue(payload, 'participantName')
      return {
        seq: event.seq,
        type: event.type,
        payload: event.payload,
        actorId: event.actorId,
        actorName: event.actorId ? actorNames.get(event.actorId) ?? 'Unknown account' : 'City/Sync system',
        actorUserId: event.actorId ? userIdByActor.get(event.actorId) ?? null : null,
        ts: event.ts,
        hash: event.hash,
        postId: stringValue(payload, 'postId'),
        messageId: stringValue(payload, 'messageId'),
        taskId,
        shiftId,
        taskTitle: taskId ? taskTitles.get(taskId) ?? null : null,
        isOnboarding: taskId ? taskIsOnboarding.get(taskId) ?? false : false,
        recipientName: namedRecipient ?? (recipientId ? actorNames.get(recipientId) ?? null : null),
        recipientUserId: recipientId ? userIdByActor.get(recipientId) ?? null : null,
      }
    })
}
