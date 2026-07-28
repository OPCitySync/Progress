import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { catalogEntries, events, identities, offerings, organizationDelegations, shifts, tasks, users } from '@/lib/db/schema'
import { participantDisplayName } from '@/lib/participant-name'

type ActivityPayload = Record<string, unknown>

export type OrganizationActivity = {
  seq: number
  type: string
  payload: string
  actorId: string | null
  actorName: string
  ts: number
  hash: string
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
  const [eventRows, orgTasks, orgShifts, orgOfferings, orgCatalogEntries, delegations, allUsers] = await Promise.all([
    db.select().from(events).orderBy(desc(events.seq)),
    db.select({ id: tasks.id }).from(tasks).where(eq(tasks.orgId, orgId)),
    db.select({ id: shifts.id }).from(shifts).where(eq(shifts.orgId, orgId)),
    db.select({ id: offerings.id }).from(offerings).where(eq(offerings.orgId, orgId)),
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
  const catalogEntryIds = new Set(orgCatalogEntries.map((entry) => entry.id))
  const actorNames = new Map(allUsers.map((user) => [user.id, participantDisplayName(user)]))
  for (const { delegationId, identityId, user } of delegations) {
    const name = participantDisplayName(user)
    actorNames.set(delegationId, name)
    actorNames.set(identityId, name)
  }

  return eventRows
    .filter((event) => {
      const payload = parsePayload(event.payload)
      return (
        stringValue(payload, 'orgId') === orgId ||
        taskIds.has(stringValue(payload, 'taskId') ?? '') ||
        shiftIds.has(stringValue(payload, 'shiftId') ?? '') ||
        offeringIds.has(stringValue(payload, 'offeringId') ?? '') ||
        catalogEntryIds.has(stringValue(payload, 'entryId') ?? '')
      )
    })
    .map((event) => ({
      seq: event.seq,
      type: event.type,
      payload: event.payload,
      actorId: event.actorId,
      actorName: event.actorId ? actorNames.get(event.actorId) ?? 'Unknown account' : 'City/Sync system',
      ts: event.ts,
      hash: event.hash,
    }))
}
