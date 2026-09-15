import { desc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { events, orgs, tasks, users } from '@/lib/db/schema'
import { participantDisplayName } from '@/lib/participant-name'

type ActivityPayload = Record<string, unknown>

export type ParticipantActivity = {
  seq: number
  type: string
  payload: string
  actorName: string
  ts: number
  hash: string
  taskId: string | null
  shiftId: string | null
  taskTitle: string | null
  organizationName: string | null
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

const participantActivityTypes = new Set([
  'USER_REGISTERED',
  'USER_PROFILE_UPDATED',
  'IDENTITY_CREATED',
  'VOLUNTEER_ROSTER_INVITE_ACCEPTED',
  'ONBOARDING_APPLICATION_SUBMITTED',
  'PROGRAM_APPLICATION_SUBMITTED',
  'PROGRAM_CANDIDATE_REVIEWED',
  'VOLUNTEER_ADMISSION_REVIEWED',
  'PROGRAM_DOCUMENT_RECEIVED',
  'WAIVER_ACCEPTED',
  'TASK_CLAIMED',
  'CLAIM_UNCLAIMED',
  'CLAIM_CHECKED_IN',
  'CLAIM_NO_SHOW',
  'COMPLETION_SUBMITTED',
  'COMPLETION_VERIFIED',
  'COMPLETION_REJECTED',
  'CREDITS_MINTED',
  'CREDITS_BURNED',
  'CREDITS_ADJUSTED',
  'REDEMPTION_REQUESTED',
  'REDEMPTION_FINALIZED',
  'REDEMPTION_CANCELLED',
])

/** Account and participation ledger records that materially involve one person. */
export async function listParticipantActivity(userId: string): Promise<ParticipantActivity[]> {
  const eventRows = await db.select().from(events).orderBy(desc(events.seq))
  const relevantEvents = eventRows.filter((event) => {
    const payload = parsePayload(event.payload)
    if (!participantActivityTypes.has(event.type)) return false
    if (event.type === 'IDENTITY_CREATED' && stringValue(payload, 'kind') !== 'participant') return false
    return event.actorId === userId || stringValue(payload, 'userId') === userId || stringValue(payload, 'participantId') === userId
  }).slice(0, 50)

  const taskIds = Array.from(new Set(relevantEvents.map((event) => stringValue(parsePayload(event.payload), 'taskId')).filter((value): value is string => Boolean(value))))
  const actorIds = Array.from(new Set(relevantEvents.map((event) => event.actorId).filter((value): value is string => Boolean(value))))
  const [taskRows, actorRows] = await Promise.all([
    taskIds.length ? db.select({ id: tasks.id, title: tasks.title, orgId: tasks.orgId }).from(tasks).where(inArray(tasks.id, taskIds)) : Promise.resolve([]),
    actorIds.length ? db.select({ id: users.id, name: users.name, username: users.username }).from(users).where(inArray(users.id, actorIds)) : Promise.resolve([]),
  ])
  const taskById = new Map(taskRows.map((task) => [task.id, task]))
  const organizationIds = Array.from(new Set(taskRows.map((task) => task.orgId)))
  const organizationRows = organizationIds.length
    ? await db.select({ id: orgs.id, name: orgs.name }).from(orgs).where(inArray(orgs.id, organizationIds))
    : []
  const organizationById = new Map(organizationRows.map((organization) => [organization.id, organization.name]))
  const actorById = new Map(actorRows.map((actor) => [actor.id, participantDisplayName(actor)]))

  return relevantEvents.map((event) => {
    const payload = parsePayload(event.payload)
    const taskId = stringValue(payload, 'taskId')
    const task = taskId ? taskById.get(taskId) : null
    const organizationId = stringValue(payload, 'orgId') ?? task?.orgId ?? null
    return {
      seq: event.seq,
      type: event.type,
      payload: event.payload,
      actorName: event.actorId === userId ? 'You' : event.actorId ? actorById.get(event.actorId) ?? 'Organization staff' : 'City/Sync system',
      ts: event.ts,
      hash: event.hash,
      taskId,
      shiftId: stringValue(payload, 'shiftId'),
      taskTitle: task?.title ?? null,
      organizationName: organizationId ? organizationById.get(organizationId) ?? null : null,
    }
  })
}
