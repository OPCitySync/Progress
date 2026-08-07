import { randomUUID } from 'crypto'
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  claims,
  tasks,
  users,
  orgs,
  waiverAcceptances,
  orgMessages,
  messageRecipients,
  volunteerGroups,
  volunteerGroupMembers,
} from '@/lib/db/schema'
import { getActiveWaiver } from './waivers'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import type { Result } from './identity'
import { participantDisplayName } from '@/lib/participant-name'

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

export type VolunteerGroup = {
  id: string
  name: string
  memberIds: string[]
  createdAt: number
  updatedAt: number
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
        name: participantDisplayName(volunteer),
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

/** Organization-defined volunteer groupings and their current membership. */
export async function getVolunteerGroups(orgId: string): Promise<VolunteerGroup[]> {
  const groups = await db
    .select()
    .from(volunteerGroups)
    .where(eq(volunteerGroups.orgId, orgId))
    .orderBy(asc(volunteerGroups.name))

  if (groups.length === 0) return []

  const members = await db
    .select({ groupId: volunteerGroupMembers.groupId, userId: volunteerGroupMembers.userId })
    .from(volunteerGroupMembers)
  const membersByGroup = new Map<string, string[]>()
  for (const member of members) {
    const list = membersByGroup.get(member.groupId) ?? []
    list.push(member.userId)
    membersByGroup.set(member.groupId, list)
  }

  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    memberIds: membersByGroup.get(group.id) ?? [],
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  }))
}

function normalizeGroupName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

async function eligibleRosterMemberIds(orgId: string, memberIds: string[]) {
  const roster = await getRoster(orgId)
  const eligible = new Set(roster.volunteers.map((volunteer) => volunteer.userId))
  return Array.from(new Set(memberIds)).filter((id) => eligible.has(id))
}

/** Create an issuer-owned grouping. Members are restricted to that issuer's roster. */
export async function createVolunteerGroup(input: {
  orgId: string
  actorId: string
  name: string
  memberIds: string[]
}): Promise<Result<{ id: string }>> {
  const name = normalizeGroupName(input.name)
  if (!name) return { ok: false, error: 'Give the grouping a name.' }
  if (name.length > 80) return { ok: false, error: 'Grouping names are limited to 80 characters.' }

  const duplicate = (
    await db
      .select({ id: volunteerGroups.id })
      .from(volunteerGroups)
      .where(and(eq(volunteerGroups.orgId, input.orgId), sql`lower(${volunteerGroups.name}) = lower(${name})`))
      .limit(1)
  )[0]
  if (duplicate) return { ok: false, error: 'A grouping with that name already exists.' }

  const memberIds = await eligibleRosterMemberIds(input.orgId, input.memberIds)
  const id = randomUUID()
  const now = Date.now()

  await db.transaction(async (tx) => {
    await tx.insert(volunteerGroups).values({
      id,
      orgId: input.orgId,
      name,
      createdByUserId: input.actorId,
      createdAt: now,
      updatedAt: now,
    })
    if (memberIds.length > 0) {
      await tx.insert(volunteerGroupMembers).values(
        memberIds.map((userId) => ({ id: randomUUID(), groupId: id, userId, createdAt: now })),
      )
    }
    await appendEvent(
      tx,
      EventTypes.VOLUNTEER_GROUP_CREATED,
      { groupId: id, orgId: input.orgId, name, memberCount: memberIds.length },
      input.actorId,
    )
  })

  return { ok: true, id }
}

/** Replace a grouping's member list with the issuer-selected roster members. */
export async function updateVolunteerGroupMembers(input: {
  orgId: string
  actorId: string
  groupId: string
  memberIds: string[]
}): Promise<Result> {
  const group = (
    await db
      .select({ id: volunteerGroups.id, name: volunteerGroups.name })
      .from(volunteerGroups)
      .where(and(eq(volunteerGroups.id, input.groupId), eq(volunteerGroups.orgId, input.orgId)))
      .limit(1)
  )[0]
  if (!group) return { ok: false, error: 'That grouping could not be found.' }

  const memberIds = await eligibleRosterMemberIds(input.orgId, input.memberIds)
  const now = Date.now()
  await db.transaction(async (tx) => {
    await tx.delete(volunteerGroupMembers).where(eq(volunteerGroupMembers.groupId, group.id))
    if (memberIds.length > 0) {
      await tx.insert(volunteerGroupMembers).values(
        memberIds.map((userId) => ({ id: randomUUID(), groupId: group.id, userId, createdAt: now })),
      )
    }
    await tx.update(volunteerGroups).set({ updatedAt: now }).where(eq(volunteerGroups.id, group.id))
    await appendEvent(
      tx,
      EventTypes.VOLUNTEER_GROUP_MEMBERS_UPDATED,
      { groupId: group.id, orgId: input.orgId, name: group.name, memberCount: memberIds.length },
      input.actorId,
    )
  })

  return { ok: true }
}

/**
 * Send an in-app message to the full roster or one saved grouping. The issuer
 * can include every person in that audience or choose a smaller subset.
 * Recipients are resolved and frozen at send time.
 */
export async function sendRosterMessage(input: {
  orgId: string
  actorId: string
  audience: 'roster' | 'group'
  groupId?: string
  allRecipients: boolean
  memberIds?: string[]
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

  const roster = await getRoster(input.orgId)
  let audienceVolunteers = roster.volunteers
  if (input.audience === 'group') {
    if (!input.groupId) return { ok: false, error: 'Choose a volunteer grouping.' }
    const group = (
      await db
        .select({ id: volunteerGroups.id })
        .from(volunteerGroups)
        .where(and(eq(volunteerGroups.id, input.groupId), eq(volunteerGroups.orgId, input.orgId)))
        .limit(1)
    )[0]
    if (!group) return { ok: false, error: 'That volunteer grouping could not be found.' }
    const members = await db
      .select({ userId: volunteerGroupMembers.userId })
      .from(volunteerGroupMembers)
      .where(eq(volunteerGroupMembers.groupId, group.id))
    const memberIds = new Set(members.map((member) => member.userId))
    audienceVolunteers = roster.volunteers.filter((volunteer) => memberIds.has(volunteer.userId))
  }
  const selectedIds = new Set(input.memberIds ?? [])
  const recipients = input.allRecipients
    ? audienceVolunteers
    : audienceVolunteers.filter((volunteer) => selectedIds.has(volunteer.userId))

  if (recipients.length === 0) {
    return { ok: false, error: 'Choose at least one volunteer to message.' }
  }

  const id = randomUUID()
  const now = Date.now()
  const scope = input.allRecipients ? input.audience : 'members'

  await db.transaction(async (tx) => {
    await tx.insert(orgMessages).values({
      id,
      orgId: input.orgId,
      senderUserId: input.actorId,
      scope,
      taskId: null,
      groupId: input.audience === 'group' ? input.groupId! : null,
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
        scope,
        groupId: input.audience === 'group' ? input.groupId : undefined,
        selectedMemberIds: scope === 'members' ? recipients.map((recipient) => recipient.userId) : undefined,
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

export async function getUnreadMessageCount(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(messageRecipients)
    .where(and(eq(messageRecipients.userId, userId), isNull(messageRecipients.readAt)))
  return Number(rows[0]?.count ?? 0)
}

export async function markMessageRead(messageId: string, userId: string) {
  await db
    .update(messageRecipients)
    .set({ readAt: Date.now() })
    .where(and(eq(messageRecipients.messageId, messageId), eq(messageRecipients.userId, userId), isNull(messageRecipients.readAt)))
}

export async function markAllMessagesRead(userId: string) {
  await db
    .update(messageRecipients)
    .set({ readAt: Date.now() })
    .where(and(eq(messageRecipients.userId, userId), isNull(messageRecipients.readAt)))
}

export async function getSentMessages(orgId: string, limit = 10) {
  const rows = await db
    .select({ message: orgMessages, groupName: volunteerGroups.name })
    .from(orgMessages)
    .leftJoin(volunteerGroups, eq(orgMessages.groupId, volunteerGroups.id))
    .where(eq(orgMessages.orgId, orgId))
    .orderBy(desc(orgMessages.createdAt))
    .limit(limit)
  return rows.map(({ message, groupName }) => ({ ...message, groupName }))
}
