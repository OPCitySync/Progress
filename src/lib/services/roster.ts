import { randomUUID } from 'crypto'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  claims,
  tasks,
  users,
  orgs,
  waiverAcceptances,
  orgMessages,
  messageRecipients,
} from '@/lib/db/schema'
import { getActiveWaiver } from './waivers'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import type { Result } from './identity'

/**
 * Volunteer roster + communication for issuer organizations.
 * Ported from the CS1 issuer workspace concept, rebuilt on real data:
 * the roster is everyone who has ever claimed one of the org's opportunities,
 * with status derived from live claim/waiver state instead of mock labels.
 */

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

export type RosterStatus = 'active' | 'committed' | 'needs-waiver' | 'inactive'

export type RosterVolunteer = {
  userId: string
  name: string
  email: string
  status: RosterStatus
  completedCount: number
  creditsEarned: number
  lastActivity: number
  activeClaims: number
  completedTaskIds: string[]
  waiverCurrent: boolean
}

export type Roster = {
  volunteers: RosterVolunteer[]
  taskGroups: { taskId: string; title: string; volunteers: RosterVolunteer[] }[]
  counts: { total: number; active: number; needsWaiver: number }
}

export async function getRoster(orgId: string, query?: string): Promise<Roster> {
  const rows = await db
    .select({ claim: claims, task: tasks, volunteer: users })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .innerJoin(users, eq(claims.userId, users.id))
    .where(eq(tasks.orgId, orgId))
    .orderBy(desc(claims.updatedAt))

  const waiver = await getActiveWaiver(orgId)
  const acceptedSet = new Set<string>()
  if (waiver) {
    const acceptances = await db
      .select({ userId: waiverAcceptances.userId })
      .from(waiverAcceptances)
      .where(eq(waiverAcceptances.waiverVersionId, waiver.id))
    for (const a of acceptances) acceptedSet.add(a.userId)
  }

  const byUser = new Map<string, RosterVolunteer>()
  for (const { claim, task, volunteer } of rows) {
    if (claim.status === 'unclaimed') continue
    let v = byUser.get(volunteer.id)
    if (!v) {
      v = {
        userId: volunteer.id,
        name: volunteer.name,
        email: volunteer.email,
        status: 'inactive',
        completedCount: 0,
        creditsEarned: 0,
        lastActivity: 0,
        activeClaims: 0,
        completedTaskIds: [],
        waiverCurrent: !waiver || acceptedSet.has(volunteer.id),
      }
      byUser.set(volunteer.id, v)
    }
    v.lastActivity = Math.max(v.lastActivity, claim.updatedAt)
    if (claim.status === 'verified') {
      v.completedCount += 1
      v.creditsEarned += task.credits
      if (!v.completedTaskIds.includes(task.id)) v.completedTaskIds.push(task.id)
    }
    if (claim.status === 'claimed' || claim.status === 'submitted') v.activeClaims += 1
  }

  const all = Array.from(byUser.values())
  const now = Date.now()
  for (const v of all) {
    if (!v.waiverCurrent) v.status = 'needs-waiver'
    else if (v.activeClaims > 0) v.status = 'committed'
    else if (v.completedCount > 0 && now - v.lastActivity < THIRTY_DAYS) v.status = 'active'
    else v.status = 'inactive'
  }

  let volunteers = all.slice().sort((a, b) => b.lastActivity - a.lastActivity)
  if (query?.trim()) {
    const q = query.trim().toLowerCase()
    volunteers = volunteers.filter((v) =>
      [v.name, v.email, v.status].join(' ').toLowerCase().includes(q),
    )
  }

  const orgTasks = await db
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(eq(tasks.orgId, orgId))
    .orderBy(desc(tasks.createdAt))

  const taskGroups = orgTasks
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      volunteers: volunteers.filter((v) => v.completedTaskIds.includes(t.id)),
    }))
    .filter((g) => g.volunteers.length > 0)

  return {
    volunteers,
    taskGroups,
    counts: {
      total: byUser.size,
      active: all.filter((v) => v.status === 'active' || v.status === 'committed').length,
      needsWaiver: all.filter((v) => v.status === 'needs-waiver').length,
    },
  }
}

/**
 * Send an in-app message to the full roster or to the group of volunteers
 * who completed a specific opportunity. Recipients are resolved and frozen
 * at send time. The ledger records the send (subject + scope + count — the
 * body stays in the application database).
 */
export async function sendRosterMessage(input: {
  orgId: string
  actorId: string
  scope: 'roster' | 'task'
  taskId?: string
  subject: string
  body: string
}): Promise<Result<{ id: string; recipientCount: number }>> {
  const subject = input.subject.trim()
  const body = input.body.trim()
  if (!subject || !body) return { ok: false, error: 'Subject and message are required.' }
  if (body.length > 5000) return { ok: false, error: 'Messages are limited to 5,000 characters.' }

  const org = (await db.select().from(orgs).where(eq(orgs.id, input.orgId)).limit(1))[0]
  if (!org || org.status !== 'approved') {
    return { ok: false, error: 'Your organization must be active to send messages.' }
  }

  if (input.scope === 'task') {
    if (!input.taskId) return { ok: false, error: 'Choose an opportunity for a group message.' }
    const task = (await db.select().from(tasks).where(eq(tasks.id, input.taskId)).limit(1))[0]
    if (!task || task.orgId !== input.orgId) return { ok: false, error: 'Opportunity not found.' }
  }

  const roster = await getRoster(input.orgId)
  const recipients =
    input.scope === 'roster'
      ? roster.volunteers
      : (roster.taskGroups.find((g) => g.taskId === input.taskId)?.volunteers ?? [])

  if (recipients.length === 0) {
    return { ok: false, error: 'No volunteers in that group yet.' }
  }

  const id = randomUUID()
  const now = Date.now()

  await db.transaction(async (tx) => {
    await tx.insert(orgMessages).values({
      id,
      orgId: input.orgId,
      senderUserId: input.actorId,
      scope: input.scope,
      taskId: input.scope === 'task' ? input.taskId! : null,
      subject,
      body,
      recipientCount: recipients.length,
      createdAt: now,
    })
    await tx.insert(messageRecipients).values(
      recipients.map((r) => ({
        id: randomUUID(),
        messageId: id,
        userId: r.userId,
        readAt: null,
        createdAt: now,
      })),
    )
    await appendEvent(
      tx,
      EventTypes.MESSAGE_SENT,
      {
        messageId: id,
        orgId: input.orgId,
        scope: input.scope,
        taskId: input.scope === 'task' ? input.taskId : undefined,
        subject,
        recipientCount: recipients.length,
      },
      input.actorId,
    )
  })

  return { ok: true, id, recipientCount: recipients.length }
}

export async function getMessagesForUser(userId: string, limit = 20) {
  const rows = await db
    .select({ recipient: messageRecipients, message: orgMessages, org: orgs })
    .from(messageRecipients)
    .innerJoin(orgMessages, eq(messageRecipients.messageId, orgMessages.id))
    .innerJoin(orgs, eq(orgMessages.orgId, orgs.id))
    .where(eq(messageRecipients.userId, userId))
    .orderBy(desc(orgMessages.createdAt))
    .limit(limit)

  return rows.map((r) => ({
    id: r.message.id,
    orgName: r.org.name,
    subject: r.message.subject,
    body: r.message.body,
    createdAt: r.message.createdAt,
    unread: r.recipient.readAt === null,
  }))
}

export async function markAllMessagesRead(userId: string) {
  await db
    .update(messageRecipients)
    .set({ readAt: Date.now() })
    .where(and(eq(messageRecipients.userId, userId), isNull(messageRecipients.readAt)))
}

export async function getSentMessages(orgId: string, limit = 10) {
  return db
    .select()
    .from(orgMessages)
    .where(eq(orgMessages.orgId, orgId))
    .orderBy(desc(orgMessages.createdAt))
    .limit(limit)
}
