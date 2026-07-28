import { randomUUID } from 'crypto'
import { and, desc, eq, isNull, lte } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { notifications, reminders, shifts, tasks, orgs, users } from '@/lib/db/schema'
import { getEmailAdapter } from '@/lib/notify/email'
import { processOverdueNoShows } from './city-participation'

const PRE_SHIFT_MS = 24 * 60 * 60 * 1000

export type NotificationRow = typeof notifications.$inferSelect
type ShiftRow = typeof shifts.$inferSelect

function whenText(shift: ShiftRow): string {
  if (shift.startsAt) {
    return new Date(shift.startsAt).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }
  return shift.label || 'a scheduled time'
}

async function insertNotification(userId: string, kind: string, title: string, body: string, link: string) {
  await db.insert(notifications).values({
    id: randomUUID(),
    userId,
    kind,
    title,
    body,
    link,
    createdAt: Date.now(),
  })
}

async function enqueue(r: {
  userId: string
  taskId: string
  shiftId: string
  kind: string
  inApp: boolean
  email: boolean
  title: string
  body: string
  link: string
  sendAfter: number
}) {
  await db.insert(reminders).values({
    id: randomUUID(),
    userId: r.userId,
    taskId: r.taskId,
    shiftId: r.shiftId,
    kind: r.kind,
    inApp: r.inApp ? 1 : 0,
    email: r.email ? 1 : 0,
    title: r.title,
    body: r.body,
    link: r.link,
    sendAfter: r.sendAfter,
    status: 'pending',
    createdAt: Date.now(),
  })
}

/**
 * After a participant signs up for a shift: immediate in-app confirmation,
 * a (deferred) email confirmation, and a pre-shift reminder when the shift has
 * a real future start time. Best-effort — never throws into the claim path.
 */
export async function notifyShiftClaimed(userId: string, shiftId: string): Promise<void> {
  try {
    const shift = (await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1))[0]
    if (!shift) return
    const task = (await db.select().from(tasks).where(eq(tasks.id, shift.taskId)).limit(1))[0]
    const org = task ? (await db.select().from(orgs).where(eq(orgs.id, task.orgId)).limit(1))[0] : undefined

    const titleBase = task?.title ?? 'your shift'
    const when = whenText(shift)
    const link = task ? `/participant/opportunities/${task.id}` : '/participant'
    const confirmBody = `${org?.name ?? 'The organization'} — ${when}.`

    await insertNotification(userId, 'confirmation', `You’re signed up: ${titleBase}`, confirmBody, link)
    await enqueue({
      userId,
      taskId: shift.taskId,
      shiftId,
      kind: 'confirmation',
      inApp: false,
      email: true,
      title: `You’re signed up: ${titleBase}`,
      body: confirmBody,
      link,
      sendAfter: Date.now(),
    })

    if (shift.startsAt && shift.startsAt - PRE_SHIFT_MS > Date.now()) {
      await enqueue({
        userId,
        taskId: shift.taskId,
        shiftId,
        kind: 'pre_shift',
        inApp: true,
        email: true,
        title: `Reminder: ${titleBase}`,
        body: `Your shift with ${org?.name ?? 'the organization'} is coming up — ${when}.`,
        link,
        sendAfter: shift.startsAt - PRE_SHIFT_MS,
      })
    }
  } catch (e) {
    console.error('notifyShiftClaimed failed', e)
  }
}

export async function cancelRemindersForClaim(userId: string, shiftId: string): Promise<void> {
  await db
    .update(reminders)
    .set({ status: 'cancelled' })
    .where(and(eq(reminders.userId, userId), eq(reminders.shiftId, shiftId), eq(reminders.status, 'pending')))
}

export async function cancelRemindersForShift(shiftId: string): Promise<void> {
  await db
    .update(reminders)
    .set({ status: 'cancelled' })
    .where(and(eq(reminders.shiftId, shiftId), eq(reminders.status, 'pending')))
}

export async function cancelRemindersForTask(taskId: string): Promise<void> {
  await db
    .update(reminders)
    .set({ status: 'cancelled' })
    .where(and(eq(reminders.taskId, taskId), eq(reminders.status, 'pending')))
}

/** Drain due pending reminders into in-app notifications and/or email. */
export async function processDueReminders(now = Date.now()): Promise<{ sent: number; failed: number; noShows: number; barred: number }> {
  const due = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.status, 'pending'), lte(reminders.sendAfter, now)))
    .limit(200)

  const email = getEmailAdapter()
  const base = process.env.APP_URL ?? ''
  let sent = 0
  let failed = 0

  for (const r of due) {
    try {
      if (r.inApp === 1) {
        await insertNotification(r.userId, r.kind, r.title, r.body, r.link)
      }
      if (r.email === 1) {
        const u = (await db.select({ email: users.email }).from(users).where(eq(users.id, r.userId)).limit(1))[0]
        if (u?.email) {
          const url = r.link ? `${base}${r.link}` : base
          await email.send({ to: u.email, subject: r.title, text: url ? `${r.body}\n\n${url}` : r.body })
        }
      }
      await db.update(reminders).set({ status: 'sent', sentAt: Date.now() }).where(eq(reminders.id, r.id))
      sent++
    } catch (e) {
      console.error('reminder delivery failed', r.id, e)
      failed++ // left pending; retried on the next run
    }
  }
  const attendance = await processOverdueNoShows(now)
  return { sent, failed, noShows: attendance.marked, barred: attendance.barred }
}

/** Alert a set of participants about a new matching opportunity (in-app now, email queued). */
export async function notifyOpportunityMatch(
  userIds: string[],
  opts: { taskId: string; title: string; body: string; link: string },
): Promise<void> {
  for (const userId of userIds) {
    await insertNotification(userId, 'match', opts.title, opts.body, opts.link)
    await enqueue({
      userId,
      taskId: opts.taskId,
      shiftId: '',
      kind: 'match',
      inApp: false,
      email: true,
      title: opts.title,
      body: opts.body,
      link: opts.link,
      sendAfter: Date.now(),
    })
  }
}

export async function getNotifications(userId: string, limit = 15): Promise<NotificationRow[]> {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: Date.now() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
}
