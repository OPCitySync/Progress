import { randomBytes, randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users, tasks, redemptions, posts, postHearts } from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import { hashPassword } from '@/lib/auth/password'
import type { Result } from './identity'

/**
 * Network-administration functions. Every action is ledgered — admin power
 * exists, but it cannot be exercised invisibly. That asymmetry (admins can
 * act, the public can see) is the point of the architecture.
 */

export async function setUserStatus(
  userId: string,
  status: 'active' | 'disabled',
  actorId: string,
): Promise<Result> {
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0]
  if (!user) return { ok: false, error: 'User not found.' }
  if (user.role === 'admin') return { ok: false, error: 'Admin accounts cannot be disabled from the UI.' }
  if (user.id === actorId) return { ok: false, error: 'You cannot disable your own account.' }

  await db.transaction(async (tx) => {
    await tx.update(users).set({ status }).where(eq(users.id, userId))
    await appendEvent(
      tx,
      status === 'disabled' ? EventTypes.USER_DISABLED : EventTypes.USER_ENABLED,
      { userId },
      actorId,
    )
  })
  return { ok: true }
}

/** Generate a temporary password, set it, and return it once for handoff. */
export async function resetUserPassword(
  userId: string,
  actorId: string,
): Promise<Result<{ tempPassword: string }>> {
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0]
  if (!user) return { ok: false, error: 'User not found.' }

  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(12)
  let tempPassword = ''
  for (let i = 0; i < 12; i++) tempPassword += alphabet[bytes[i] % alphabet.length]

  const passwordHash = await hashPassword(tempPassword)
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, userId))
    // Ledger records that a reset happened — never the password itself.
    await appendEvent(tx, EventTypes.USER_PASSWORD_RESET, { userId }, actorId)
  })
  return { ok: true, tempPassword }
}

/**
 * Manual credit adjustment with mandatory reason. Positive = administrative
 * mint (counts toward lifetime earned); negative = administrative burn
 * (cannot take a balance below zero). Use sparingly — every adjustment is
 * public on the ledger.
 */
export async function adjustCredits(
  userId: string,
  amount: number,
  reason: string,
  actorId: string,
): Promise<Result> {
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 100000) {
    return { ok: false, error: 'Amount must be a non-zero whole number (±100,000 max).' }
  }
  if (!reason.trim()) return { ok: false, error: 'A reason is required for credit adjustments.' }

  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0]
  if (!user) return { ok: false, error: 'User not found.' }
  if (user.role !== 'participant') return { ok: false, error: 'Only participant balances can be adjusted.' }
  if (amount < 0 && user.creditBalance + amount < 0) {
    return { ok: false, error: `Balance is ${user.creditBalance}; cannot remove ${-amount}.` }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        creditBalance: user.creditBalance + amount,
        lifetimeEarned: amount > 0 ? user.lifetimeEarned + amount : user.lifetimeEarned,
      })
      .where(eq(users.id, userId))
    await appendEvent(
      tx,
      EventTypes.CREDITS_ADJUSTED,
      { userId, amount, reason: reason.trim() },
      actorId,
    )
  })
  return { ok: true }
}

/** Remove a MyCity post (moderation). Hearts go with it; the ledger remembers. */
export async function removePost(postId: string, reason: string, actorId: string): Promise<Result> {
  const post = (await db.select().from(posts).where(eq(posts.id, postId)).limit(1))[0]
  if (!post) return { ok: false, error: 'Post not found.' }

  await db.transaction(async (tx) => {
    await tx.delete(postHearts).where(eq(postHearts.postId, postId))
    await tx.delete(posts).where(eq(posts.id, postId))
    await appendEvent(
      tx,
      EventTypes.POST_REMOVED,
      { postId, orgId: post.orgId, reason: reason.trim() || 'unspecified' },
      actorId,
    )
  })
  return { ok: true }
}

/** Admin override: close any opportunity on the network. */
export async function adminCloseTask(taskId: string, actorId: string): Promise<Result> {
  const task = (await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1))[0]
  if (!task) return { ok: false, error: 'Task not found.' }
  if (task.status === 'closed') return { ok: true }

  await db.transaction(async (tx) => {
    await tx.update(tasks).set({ status: 'closed' }).where(eq(tasks.id, taskId))
    await appendEvent(tx, EventTypes.TASK_CLOSED, { taskId, byAdmin: true }, actorId)
  })
  return { ok: true }
}

/** Admin override: cancel a pending redemption (e.g. dispute, org offboarding). */
export async function adminCancelRedemption(redemptionId: string, actorId: string): Promise<Result> {
  const redemption = (
    await db.select().from(redemptions).where(eq(redemptions.id, redemptionId)).limit(1)
  )[0]
  if (!redemption) return { ok: false, error: 'Redemption not found.' }
  if (redemption.status !== 'pending') {
    return { ok: false, error: `This redemption is already ${redemption.status}.` }
  }

  await db.transaction(async (tx) => {
    await tx.update(redemptions).set({ status: 'cancelled' }).where(eq(redemptions.id, redemptionId))
    await appendEvent(
      tx,
      EventTypes.REDEMPTION_CANCELLED,
      { redemptionId, byAdmin: true },
      actorId,
    )
  })
  return { ok: true }
}
