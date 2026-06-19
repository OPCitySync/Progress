import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users, orgs } from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import { hashPassword } from '@/lib/auth/password'
import { isSandbox } from '@/lib/config'
import { uniqueOrgSlug } from '@/lib/slug'

export type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string }

export async function registerParticipant(input: {
  name: string
  email: string
  password: string
}): Promise<Result<{ userId: string }>> {
  const email = input.email.trim().toLowerCase()
  if (!email || !input.name.trim() || input.password.length < 8) {
    return { ok: false, error: 'Name, email, and a password of at least 8 characters are required.' }
  }
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing.length > 0) return { ok: false, error: 'An account with that email already exists.' }

  const id = randomUUID()
  const passwordHash = await hashPassword(input.password)

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id,
      email,
      name: input.name.trim(),
      passwordHash,
      role: 'participant',
      orgId: null,
      createdAt: Date.now(),
    })
    await appendEvent(tx, EventTypes.USER_REGISTERED, { userId: id, role: 'participant' }, id)
  })

  return { ok: true, userId: id }
}

export async function registerOrg(input: {
  orgName: string
  orgType: 'issuer' | 'redeemer'
  description: string
  name: string
  email: string
  password: string
}): Promise<Result<{ userId: string; orgId: string }>> {
  const email = input.email.trim().toLowerCase()
  if (!email || !input.name.trim() || !input.orgName.trim() || input.password.length < 8) {
    return {
      ok: false,
      error: 'Organization name, contact name, email, and a password of at least 8 characters are required.',
    }
  }
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing.length > 0) return { ok: false, error: 'An account with that email already exists.' }

  const userId = randomUUID()
  const orgId = randomUUID()
  const passwordHash = await hashPassword(input.password)
  const now = Date.now()
  const sandbox = isSandbox()

  await db.transaction(async (tx) => {
    const slug = await uniqueOrgSlug(tx, input.orgName.trim())
    await tx.insert(orgs).values({
      id: orgId,
      name: input.orgName.trim(),
      slug,
      type: input.orgType,
      description: input.description.trim(),
      status: sandbox ? 'approved' : 'pending',
      ownerUserId: userId,
      createdAt: now,
    })
    await tx.insert(users).values({
      id: userId,
      email,
      name: input.name.trim(),
      passwordHash,
      role: input.orgType,
      orgId,
      createdAt: now,
    })
    await appendEvent(
      tx,
      EventTypes.ORG_REGISTERED,
      { orgId, orgType: input.orgType, name: input.orgName.trim() },
      userId,
    )
    await appendEvent(tx, EventTypes.USER_REGISTERED, { userId, role: input.orgType, orgId }, userId)
    if (sandbox) {
      await appendEvent(tx, EventTypes.ORG_APPROVED, { orgId, sandbox: true }, userId)
    }
  })

  return { ok: true, userId, orgId }
}

export async function setOrgStatus(
  orgId: string,
  status: 'approved' | 'suspended',
  actorId: string,
): Promise<Result> {
  const found = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1)
  if (found.length === 0) return { ok: false, error: 'Organization not found.' }

  await db.transaction(async (tx) => {
    await tx.update(orgs).set({ status }).where(eq(orgs.id, orgId))
    await appendEvent(
      tx,
      status === 'approved' ? EventTypes.ORG_APPROVED : EventTypes.ORG_SUSPENDED,
      { orgId },
      actorId,
    )
  })
  return { ok: true }
}
