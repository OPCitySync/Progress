import { createHash, createHmac, randomBytes, randomUUID } from 'crypto'
import { and, eq, gte, isNull, lt, ne, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { passwordResetRequests, users } from '@/lib/db/schema'
import { hashPassword } from '@/lib/auth/password'
import { getEmailAdapter } from '@/lib/notify/email'

const TOKEN_LIFETIME_MS = 30 * 60 * 1000
const EMAIL_WINDOW_MS = 15 * 60 * 1000
const REQUESTER_WINDOW_MS = 60 * 60 * 1000
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

function resetSecret(): string {
  return process.env.AUTH_SECRET ?? 'dev-secret-change-me-in-production'
}

function privateHash(namespace: string, value: string): string {
  return createHmac('sha256', resetSecret()).update(`${namespace}:${value}`).digest('hex')
}

function digestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase().slice(0, 320)
}

function usableToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{40,100}$/.test(value)
}

export type PasswordResetRequestResult = {
  /** Available only with the non-delivering adapter in local development. */
  developmentToken?: string
}

/**
 * Create a reset request without revealing whether the submitted address is
 * registered. Known and unknown addresses both leave a small rate-limit row.
 */
export async function requestPasswordReset(input: {
  email: string
  requesterIdentifier: string
  baseUrl: string
}): Promise<PasswordResetRequestResult> {
  const now = Date.now()
  const email = normalizedEmail(input.email)
  const emailHash = privateHash('password-reset-email', email)
  const requesterHash = privateHash('password-reset-requester', input.requesterIdentifier || 'unknown')

  const [recentEmail, recentRequester] = await Promise.all([
    db
      .select({ id: passwordResetRequests.id })
      .from(passwordResetRequests)
      .where(and(
        eq(passwordResetRequests.emailHash, emailHash),
        gte(passwordResetRequests.createdAt, now - EMAIL_WINDOW_MS),
      ))
      .limit(3),
    db
      .select({ id: passwordResetRequests.id })
      .from(passwordResetRequests)
      .where(and(
        eq(passwordResetRequests.requesterHash, requesterHash),
        gte(passwordResetRequests.createdAt, now - REQUESTER_WINDOW_MS),
      ))
      .limit(20),
  ])

  // Return the same result for rate-limited and accepted requests. This keeps
  // the public form from becoming an account-discovery endpoint.
  if (recentEmail.length >= 3 || recentRequester.length >= 20) return {}

  const user = (
    await db
      .select({ id: users.id, email: users.email, status: users.status })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
  )[0]
  const eligibleUser = user?.status === 'active' ? user : null
  const rawToken = eligibleUser ? randomBytes(32).toString('base64url') : null
  const requestId = randomUUID()

  await db.insert(passwordResetRequests).values({
    id: requestId,
    userId: eligibleUser?.id ?? null,
    emailHash,
    requesterHash,
    tokenHash: rawToken ? digestToken(rawToken) : null,
    createdAt: now,
    expiresAt: now + TOKEN_LIFETIME_MS,
    usedAt: null,
  })

  // Keep this small security table bounded without requiring another cron.
  try {
    await db.delete(passwordResetRequests).where(lt(passwordResetRequests.createdAt, now - RETENTION_MS))
  } catch (error) {
    // Cleanup must never prevent an account holder from receiving a reset.
    console.error('password reset cleanup failed', error)
  }

  if (!eligibleUser || !rawToken) return {}

  const resetUrl = `${input.baseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`
  const emailAdapter = getEmailAdapter()

  // Local development intentionally does not send email. Returning the token
  // there makes the complete flow testable without exposing it in production.
  if (emailAdapter.backend === 'stub') {
    if (process.env.NODE_ENV !== 'production') return { developmentToken: rawToken }
    console.error('Password reset email was requested while EMAIL_MODE is set to stub.')
    await db.update(passwordResetRequests).set({ usedAt: now }).where(eq(passwordResetRequests.id, requestId))
    return {}
  }

  try {
    await emailAdapter.send({
      to: eligibleUser.email,
      subject: 'Reset your MyCity password',
      text: [
        'We received a request to reset the password for your MyCity account.',
        '',
        `Reset your password: ${resetUrl}`,
        '',
        'This link expires in 30 minutes and can be used only once.',
        'If you did not request this change, you can ignore this email. This mailbox is not monitored.',
      ].join('\n'),
    })
  } catch (error) {
    console.error('password reset email delivery failed', error)
    await db.update(passwordResetRequests).set({ usedAt: now }).where(eq(passwordResetRequests.id, requestId))
    return {}
  }

  // A newly delivered link replaces older unused links for the same account.
  await db
    .update(passwordResetRequests)
    .set({ usedAt: now })
    .where(and(
      eq(passwordResetRequests.userId, eligibleUser.id),
      ne(passwordResetRequests.id, requestId),
      isNull(passwordResetRequests.usedAt),
    ))

  return {}
}

export async function isPasswordResetTokenValid(token: string): Promise<boolean> {
  if (!usableToken(token)) return false
  const now = Date.now()
  const request = (
    await db
      .select({ id: passwordResetRequests.id })
      .from(passwordResetRequests)
      .where(and(
        eq(passwordResetRequests.tokenHash, digestToken(token)),
        isNull(passwordResetRequests.usedAt),
        gte(passwordResetRequests.expiresAt, now),
      ))
      .limit(1)
  )[0]
  return Boolean(request)
}

export async function resetPasswordWithToken(input: {
  token: string
  password: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!usableToken(input.token)) return { ok: false, error: 'This password reset link is invalid or has expired.' }
  if (input.password.length < 8 || input.password.length > 128) {
    return { ok: false, error: 'Choose a password between 8 and 128 characters.' }
  }

  const now = Date.now()
  const request = (
    await db
      .select()
      .from(passwordResetRequests)
      .where(and(
        eq(passwordResetRequests.tokenHash, digestToken(input.token)),
        isNull(passwordResetRequests.usedAt),
        gte(passwordResetRequests.expiresAt, now),
      ))
      .limit(1)
  )[0]
  if (!request?.userId) return { ok: false, error: 'This password reset link is invalid or has expired.' }

  const user = (
    await db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1)
  )[0]
  if (!user || user.status !== 'active') {
    return { ok: false, error: 'This password reset link is invalid or has expired.' }
  }

  const passwordHash = await hashPassword(input.password)
  try {
    await db.transaction(async (tx) => {
      // Claim the token inside the same transaction as the password update so
      // concurrent submissions cannot use a single link twice.
      const claimed = await tx
        .update(passwordResetRequests)
        .set({ usedAt: now })
        .where(and(
          eq(passwordResetRequests.id, request.id),
          isNull(passwordResetRequests.usedAt),
          gte(passwordResetRequests.expiresAt, now),
        ))
      if (Number(claimed.rowsAffected ?? 0) !== 1) throw new Error('RESET_TOKEN_ALREADY_USED')

      await tx
        .update(users)
        .set({
          passwordHash,
          sessionVersion: sql`${users.sessionVersion} + 1`,
        })
        .where(eq(users.id, user.id))
      await tx
        .update(passwordResetRequests)
        .set({ usedAt: now })
        .where(and(eq(passwordResetRequests.userId, user.id), isNull(passwordResetRequests.usedAt)))
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'RESET_TOKEN_ALREADY_USED') {
      return { ok: false, error: 'This password reset link is invalid or has expired.' }
    }
    throw error
  }

  return { ok: true }
}
