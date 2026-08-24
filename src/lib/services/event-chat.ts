import { randomUUID } from 'crypto'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { claims, eventChatMessages, eventChats, orgs, shifts, tasks, users } from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import { participantDisplayName } from '@/lib/participant-name'
import type { Result } from './identity'

// Only people currently expected at a shift remain in its chat. A no-show,
// rejected, or cancelled reservation immediately loses access.
const CHAT_CLAIM_STATUSES = ['claimed', 'submitted', 'verified'] as const
export const EVENT_CHAT_ARCHIVE_RETENTION_MS = 14 * 24 * 60 * 60 * 1000

type ChatWithShift = {
  chat: typeof eventChats.$inferSelect
  shift: typeof shifts.$inferSelect
  task: typeof tasks.$inferSelect
}

function isExpired(chat: typeof eventChats.$inferSelect, shift: typeof shifts.$inferSelect, now: number) {
  return chat.status !== 'open' || shift.status !== 'open' || chat.closesAt <= now || (shift.endsAt !== null && shift.endsAt <= now)
}

async function messageCountByChat(chatIds: string[]) {
  if (chatIds.length === 0) return new Map<string, number>()
  const rows = await db
    .select({ chatId: eventChatMessages.chatId })
    .from(eventChatMessages)
    .where(inArray(eventChatMessages.chatId, chatIds))
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.chatId, (counts.get(row.chatId) ?? 0) + 1)
  return counts
}

async function participantCountByShift(shiftIds: string[]) {
  if (shiftIds.length === 0) return new Map<string, number>()
  const rows = await db
    .select({ shiftId: claims.shiftId, userId: claims.userId })
    .from(claims)
    .where(and(inArray(claims.shiftId, shiftIds), inArray(claims.status, [...CHAT_CLAIM_STATUSES])))
  const usersByShift = new Map<string, Set<string>>()
  for (const row of rows) {
    if (!row.shiftId) continue
    const set = usersByShift.get(row.shiftId) ?? new Set<string>()
    set.add(row.userId)
    usersByShift.set(row.shiftId, set)
  }
  return new Map(Array.from(usersByShift.entries(), ([shiftId, memberIds]) => [shiftId, memberIds.size]))
}

async function archiveChats(chats: ChatWithShift[], now: number) {
  if (chats.length === 0) return 0
  await db.transaction(async (tx) => {
    for (const item of chats) {
      // For completed shifts, anchor retention to the event ending rather
      // than to the next scheduled cleanup. A cancelled event archives from
      // the moment it is cancelled.
      const archivedAt = item.shift.status === 'open'
        ? Math.min(now, item.chat.closesAt, item.shift.endsAt ?? item.chat.closesAt)
        : now
      await tx.update(eventChats).set({ status: 'archived', closedAt: archivedAt }).where(eq(eventChats.id, item.chat.id))
      // The audit records lifecycle state only; message content never leaves
      // the organization database.
      await appendEvent(
        tx,
        EventTypes.EVENT_CHAT_ARCHIVED,
        { chatId: item.chat.id, taskId: item.task.id, shiftId: item.shift.id, orgId: item.chat.orgId, archivedAt, deleteAfter: archivedAt + EVENT_CHAT_ARCHIVE_RETENTION_MS },
        null,
        item.task.cityId,
      )
    }
  })
  return chats.length
}

async function deleteChats(chats: ChatWithShift[], now: number) {
  if (chats.length === 0) return 0
  await db.transaction(async (tx) => {
    for (const item of chats) {
      await tx.delete(eventChatMessages).where(eq(eventChatMessages.chatId, item.chat.id))
      await tx.delete(eventChats).where(eq(eventChats.id, item.chat.id))
      // The audit states only that the archive retention period elapsed;
      // message contents and participant lists never leave the organization database.
      await appendEvent(
        tx,
        EventTypes.EVENT_CHAT_DELETED,
        { chatId: item.chat.id, taskId: item.task.id, shiftId: item.shift.id, orgId: item.chat.orgId, reason: 'archive_retention_elapsed' },
        null,
        item.task.cityId,
      )
    }
  })
  return chats.length
}

/**
 * Archive ended rooms, then permanently remove archives after 14 days.
 * Safe to call repeatedly from page reads or the scheduled maintenance job.
 */
export async function cleanupExpiredEventChats(now = Date.now()): Promise<{ archived: number; deleted: number }> {
  const openRows = await db
    .select({ chat: eventChats, shift: shifts, task: tasks })
    .from(eventChats)
    .innerJoin(shifts, eq(eventChats.shiftId, shifts.id))
    .innerJoin(tasks, eq(eventChats.taskId, tasks.id))
    .where(eq(eventChats.status, 'open'))
  const archived = await archiveChats(openRows.filter((row) => isExpired(row.chat, row.shift, now)), now)

  const archivedRows = await db
    .select({ chat: eventChats, shift: shifts, task: tasks })
    .from(eventChats)
    .innerJoin(shifts, eq(eventChats.shiftId, shifts.id))
    .innerJoin(tasks, eq(eventChats.taskId, tasks.id))
    .where(eq(eventChats.status, 'archived'))
  const deleted = await deleteChats(archivedRows.filter((row) => {
    const archivedAt = row.chat.closedAt ?? row.chat.closesAt
    return archivedAt + EVENT_CHAT_ARCHIVE_RETENTION_MS <= now
  }), now)
  return { archived, deleted }
}

/** Shifts that can still receive a new live event chat. */
export async function getUpcomingShiftsForEventChat(orgId: string, now = Date.now()) {
  await cleanupExpiredEventChats(now)
  const rows = await db
    .select({ shift: shifts, task: tasks, chatId: eventChats.id })
    .from(shifts)
    .innerJoin(tasks, eq(shifts.taskId, tasks.id))
    .leftJoin(eventChats, eq(eventChats.shiftId, shifts.id))
    .where(and(eq(shifts.orgId, orgId), eq(shifts.status, 'open'), eq(tasks.status, 'open')))
    .orderBy(asc(shifts.startsAt), asc(shifts.createdAt))

  const eligible = rows.filter((row) => (
    row.chatId === null
    && row.shift.startsAt !== null
    && row.shift.endsAt !== null
    && row.shift.startsAt > now
    && row.shift.endsAt > now
  ))
  const participantCounts = await participantCountByShift(eligible.map((row) => row.shift.id))
  return eligible.map((row) => ({
    ...row,
    participantCount: participantCounts.get(row.shift.id) ?? 0,
  }))
}

/** Create exactly one temporary participant chat for an upcoming shift. */
export async function createEventChat(input: {
  orgId: string
  actorId: string
  shiftId: string
}): Promise<Result<{ id: string }>> {
  const now = Date.now()
  await cleanupExpiredEventChats(now)
  const row = (await db
    .select({ shift: shifts, task: tasks, org: orgs })
    .from(shifts)
    .innerJoin(tasks, eq(shifts.taskId, tasks.id))
    .innerJoin(orgs, eq(shifts.orgId, orgs.id))
    .where(and(eq(shifts.id, input.shiftId), eq(shifts.orgId, input.orgId)))
    .limit(1))[0]

  if (!row || row.task.status !== 'open' || row.shift.status !== 'open') {
    return { ok: false, error: 'That event is no longer available for a group chat.' }
  }
  if (!row.shift.startsAt || !row.shift.endsAt || row.shift.startsAt <= now || row.shift.endsAt <= now) {
    return { ok: false, error: 'Choose an upcoming event with both a start and end time.' }
  }
  if (row.org.status !== 'approved') return { ok: false, error: 'Your organization must be active to start an event chat.' }

  const existing = (await db.select({ id: eventChats.id }).from(eventChats).where(eq(eventChats.shiftId, row.shift.id)).limit(1))[0]
  if (existing) return { ok: true, id: existing.id }

  const id = randomUUID()
  const title = row.shift.label.trim() || row.task.title
  await db.transaction(async (tx) => {
    await tx.insert(eventChats).values({
      id,
      orgId: input.orgId,
      taskId: row.task.id,
      shiftId: row.shift.id,
      createdByUserId: input.actorId,
      title,
      closesAt: row.shift.endsAt!,
      status: 'open',
      createdAt: now,
      closedAt: null,
    })
    await appendEvent(
      tx,
      EventTypes.EVENT_CHAT_CREATED,
      { chatId: id, taskId: row.task.id, shiftId: row.shift.id, orgId: input.orgId, closesAt: row.shift.endsAt },
      input.actorId,
      row.task.cityId,
    )
  })
  return { ok: true, id }
}

export async function getEventChatsForOrg(orgId: string, now = Date.now()) {
  await cleanupExpiredEventChats(now)
  const rows = await db
    .select({ chat: eventChats, shift: shifts, task: tasks })
    .from(eventChats)
    .innerJoin(shifts, eq(eventChats.shiftId, shifts.id))
    .innerJoin(tasks, eq(eventChats.taskId, tasks.id))
    .where(and(eq(eventChats.orgId, orgId), eq(eventChats.status, 'open')))
    .orderBy(asc(shifts.startsAt), asc(eventChats.createdAt))
  const active = rows.filter((row) => !isExpired(row.chat, row.shift, now))
  const [messageCounts, participantCounts] = await Promise.all([
    messageCountByChat(active.map((item) => item.chat.id)),
    participantCountByShift(active.map((item) => item.shift.id)),
  ])
  return active.map((item) => ({
    ...item,
    messageCount: messageCounts.get(item.chat.id) ?? 0,
    participantCount: participantCounts.get(item.shift.id) ?? 0,
  }))
}

/** Archived group chats stay readable to the organization for 14 days. */
export async function getArchivedEventChatsForOrg(orgId: string, now = Date.now()) {
  await cleanupExpiredEventChats(now)
  const rows = await db
    .select({ chat: eventChats, shift: shifts, task: tasks })
    .from(eventChats)
    .innerJoin(shifts, eq(eventChats.shiftId, shifts.id))
    .innerJoin(tasks, eq(eventChats.taskId, tasks.id))
    .where(and(eq(eventChats.orgId, orgId), eq(eventChats.status, 'archived')))
    .orderBy(desc(eventChats.closedAt), desc(eventChats.createdAt))
  const [messageCounts, participantCounts, details] = await Promise.all([
    messageCountByChat(rows.flatMap((item) => item.chat.id ? [item.chat.id] : [])),
    participantCountByShift(rows.flatMap((item) => item.shift.id ? [item.shift.id] : [])),
    Promise.all(rows.flatMap((item) => item.chat.id ? [getChatWithMessages(item.chat.id)] : [])),
  ])
  const detailsById = new Map(details.filter((item): item is NonNullable<typeof item> => item !== null).flatMap((item) => item.chat.id ? [[item.chat.id, item] as const] : []))
  return rows.map((item) => ({
    ...item,
    messageCount: item.chat.id ? messageCounts.get(item.chat.id) ?? 0 : 0,
    participantCount: item.shift.id ? participantCounts.get(item.shift.id) ?? 0 : 0,
    messages: item.chat.id ? detailsById.get(item.chat.id)?.messages ?? [] : [],
    archivedAt: item.chat.closedAt ?? item.chat.closesAt,
    deleteAt: (item.chat.closedAt ?? item.chat.closesAt) + EVENT_CHAT_ARCHIVE_RETENTION_MS,
  }))
}

async function getChatWithMessages(chatId: string) {
  const row = (await db
    .select({ chat: eventChats, shift: shifts, task: tasks })
    .from(eventChats)
    .innerJoin(shifts, eq(eventChats.shiftId, shifts.id))
    .innerJoin(tasks, eq(eventChats.taskId, tasks.id))
    .where(eq(eventChats.id, chatId))
    .limit(1))[0]
  if (!row) return null
  const messages = await db
    .select({ message: eventChatMessages, sender: users })
    .from(eventChatMessages)
    .innerJoin(users, eq(eventChatMessages.senderUserId, users.id))
    .where(eq(eventChatMessages.chatId, chatId))
    .orderBy(asc(eventChatMessages.createdAt))
  return {
    ...row,
    messages: messages.map(({ message, sender }) => ({ ...message, senderName: participantDisplayName(sender) })),
  }
}

export async function getEventChatForOrg(chatId: string, orgId: string, now = Date.now()) {
  await cleanupExpiredEventChats(now)
  const chat = await getChatWithMessages(chatId)
  if (!chat || chat.chat.orgId !== orgId || isExpired(chat.chat, chat.shift, now)) return null
  return chat
}

export async function getEventChatsForParticipant(userId: string, now = Date.now()) {
  await cleanupExpiredEventChats(now)
  const rows = await db
    .select({ chat: eventChats, shift: shifts, task: tasks })
    .from(claims)
    .innerJoin(eventChats, eq(claims.shiftId, eventChats.shiftId))
    .innerJoin(shifts, eq(eventChats.shiftId, shifts.id))
    .innerJoin(tasks, eq(eventChats.taskId, tasks.id))
    .where(and(eq(claims.userId, userId), inArray(claims.status, [...CHAT_CLAIM_STATUSES]), eq(eventChats.status, 'open')))
    .orderBy(asc(shifts.startsAt))
  return rows.filter((row) => !isExpired(row.chat, row.shift, now))
}

/**
 * Finished event chats remain visible to their signed-up participants for the
 * same fourteen-day retention period used by the organization. The chat is
 * read-only here: it is a short-term record of the event conversation, not a
 * permanent participant message history.
 */
export async function getArchivedEventChatsForParticipant(userId: string, now = Date.now()) {
  await cleanupExpiredEventChats(now)
  const rows = await db
    .select({ chat: eventChats, shift: shifts, task: tasks })
    .from(claims)
    .innerJoin(eventChats, eq(claims.shiftId, eventChats.shiftId))
    .innerJoin(shifts, eq(eventChats.shiftId, shifts.id))
    .innerJoin(tasks, eq(eventChats.taskId, tasks.id))
    .where(and(eq(claims.userId, userId), inArray(claims.status, [...CHAT_CLAIM_STATUSES]), eq(eventChats.status, 'archived')))
    .orderBy(desc(eventChats.closedAt), desc(eventChats.createdAt))

  const details = await Promise.all(rows.map((item) => getChatWithMessages(item.chat.id)))
  const detailsById = new Map(
    details
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map((item) => [item.chat.id, item] as const),
  )

  return rows.map((item) => {
    const archivedAt = item.chat.closedAt ?? item.chat.closesAt
    return {
      ...item,
      messages: detailsById.get(item.chat.id)?.messages ?? [],
      archivedAt,
      deleteAt: archivedAt + EVENT_CHAT_ARCHIVE_RETENTION_MS,
    }
  })
}

export async function getEventChatForParticipant(chatId: string, userId: string, now = Date.now()) {
  await cleanupExpiredEventChats(now)
  const allowed = (await db
    .select({ chatId: eventChats.id })
    .from(eventChats)
    .innerJoin(claims, eq(eventChats.shiftId, claims.shiftId))
    .where(and(eq(eventChats.id, chatId), eq(claims.userId, userId), inArray(claims.status, [...CHAT_CLAIM_STATUSES])))
    .limit(1))[0]
  if (!allowed) return null
  const chat = await getChatWithMessages(chatId)
  if (!chat || isExpired(chat.chat, chat.shift, now)) return null
  return chat
}

/** Add a message only if the actor is an authorized issuer or an active participant for this shift. */
export async function postEventChatMessage(input: {
  chatId: string
  senderUserId: string
  body: string
  issuerOrgId?: string
}): Promise<Result<{}>> {
  const body = input.body.trim()
  if (!body) return { ok: false, error: 'Write a message before sending it.' }
  if (body.length > 2000) return { ok: false, error: 'Event-chat messages are limited to 2,000 characters.' }

  const now = Date.now()
  await cleanupExpiredEventChats(now)
  const chat = await getChatWithMessages(input.chatId)
  if (!chat || isExpired(chat.chat, chat.shift, now)) return { ok: false, error: 'This event chat has closed.' }

  if (input.issuerOrgId) {
    if (chat.chat.orgId !== input.issuerOrgId) return { ok: false, error: 'This chat belongs to another organization.' }
  } else {
    const claim = (await db
      .select({ id: claims.id })
      .from(claims)
      .where(and(eq(claims.shiftId, chat.shift.id), eq(claims.userId, input.senderUserId), inArray(claims.status, [...CHAT_CLAIM_STATUSES])))
      .limit(1))[0]
    if (!claim) return { ok: false, error: 'Only signed-up participants can use this event chat.' }
  }

  await db.insert(eventChatMessages).values({
    id: randomUUID(),
    chatId: input.chatId,
    senderUserId: input.senderUserId,
    body,
    createdAt: now,
  })
  return { ok: true }
}
