import { randomUUID } from 'crypto'
import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { cities, cityMemberships, cityParticipantStatuses, orgProfiles, orgs, users } from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import { hashPassword } from '@/lib/auth/password'
import { isSandbox } from '@/lib/config'
import { uniqueOrgSlug } from '@/lib/slug'
import {
  ensureOrganizationIdentity,
  ensureOrganizationRoles,
  ensureParticipantIdentity,
  grantOrganizationAuthority,
} from '@/lib/services/identity-access'
import { normalizeOrganizationLocation, rememberOrganizationLocation } from './organization-locations'

export type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string }

/** Update the account-holder fields that City/Sync keeps in the control plane. */
export async function updateAccountIdentity(input: {
  userId: string
  name: string
  email: string
  username: string
  avatarUrl: string
}): Promise<Result<{ name: string; email: string; username: string | null; avatarUrl: string }>> {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  const username = input.username.trim().toLowerCase().replace(/^@+/, '')
  const avatarUrl = input.avatarUrl.trim()

  if (!name || name.length > 100) return { ok: false, error: 'Enter a name of up to 100 characters.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' }
  if (username && !/^[a-z0-9_]{3,30}$/.test(username)) {
    return { ok: false, error: 'Usernames use 3–30 lowercase letters, numbers, or underscores.' }
  }
  if (avatarUrl && !avatarUrl.startsWith('/uploads/avatars/') && !/^https:\/\//.test(avatarUrl)) {
    return { ok: false, error: 'Profile pictures must be uploaded through City/Sync.' }
  }

  const user = (await db.select().from(users).where(eq(users.id, input.userId)).limit(1))[0]
  if (!user) return { ok: false, error: 'Account not found.' }

  const emailTaken = (
    await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), ne(users.id, input.userId)))
      .limit(1)
  )[0]
  if (emailTaken) return { ok: false, error: 'That email is already connected to another account.' }

  if (username) {
    const usernameTaken = (
      await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, username), ne(users.id, input.userId)))
        .limit(1)
    )[0]
    if (usernameTaken) return { ok: false, error: 'That username is already in use.' }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ name, email, username: username || null, avatarUrl })
      .where(eq(users.id, input.userId))
    await appendEvent(
      tx,
      EventTypes.USER_PROFILE_UPDATED,
      { userId: input.userId, changed: ['name', 'email', 'username', 'avatarUrl'].filter((key) => {
        if (key === 'name') return user.name !== name
        if (key === 'email') return user.email !== email
        if (key === 'username') return (user.username ?? '') !== username
        return user.avatarUrl !== avatarUrl
      }) },
      input.userId,
    )
  })

  return { ok: true, name, email, username: username || null, avatarUrl }
}

export async function registerParticipant(input: {
  name: string
  email: string
  password: string
  homeCityId: string
}): Promise<Result<{ userId: string }>> {
  const email = input.email.trim().toLowerCase()
  if (!email || !input.name.trim() || input.password.length < 8) {
    return { ok: false, error: 'Name, email, and a password of at least 8 characters are required.' }
  }
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing.length > 0) return { ok: false, error: 'An account with that email already exists.' }
  const city = (await db.select({ id: cities.id }).from(cities).where(eq(cities.id, input.homeCityId)).limit(1))[0]
  if (!city) return { ok: false, error: 'Choose Berkeley or Mexico City to continue.' }

  const id = randomUUID()
  const passwordHash = await hashPassword(input.password)
  const now = Date.now()

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id,
      email,
      name: input.name.trim(),
      passwordHash,
      role: 'participant',
      orgId: null,
      homeCityId: city.id,
      createdAt: now,
    })
    await tx.insert(cityMemberships).values({
      id: randomUUID(),
      cityId: city.id,
      memberKind: 'user',
      memberId: id,
      joinedAt: now,
    })
    await tx.insert(cityParticipantStatuses).values({
      id: randomUUID(),
      cityId: city.id,
      userId: id,
      status: 'new',
      noShowCount: 0,
      barredUntil: null,
      activatedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    await appendEvent(tx, EventTypes.USER_REGISTERED, { userId: id, role: 'participant', cityId: city.id }, id)
    await ensureParticipantIdentity(tx, id)
  })

  return { ok: true, userId: id }
}

export async function registerOrg(input: {
  orgName: string
  orgType: 'issuer' | 'redeemer'
  description: string
  address?: string
  name: string
  email: string
  password: string
  cityId: string
}): Promise<Result<{ userId: string; orgId: string; authorityId: string; authorityIdentityId: string }>> {
  const email = input.email.trim().toLowerCase()
  const address = normalizeOrganizationLocation(input.address ?? '')
  if (!email || !input.name.trim() || !input.orgName.trim() || input.password.length < 8) {
    return {
      ok: false,
      error: 'Organization name, contact name, email, and a password of at least 8 characters are required.',
    }
  }
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing.length > 0) return { ok: false, error: 'An account with that email already exists.' }
  const city = (await db.select({ id: cities.id }).from(cities).where(eq(cities.id, input.cityId)).limit(1))[0]
  if (!city) return { ok: false, error: 'Choose the city where your organization operates.' }
  if (address.length > 240) return { ok: false, error: 'Organization addresses are limited to 240 characters.' }

  const userId = randomUUID()
  const orgId = randomUUID()
  const passwordHash = await hashPassword(input.password)
  const now = Date.now()
  const sandbox = isSandbox()
  let ownerAuthority: { delegationId: string; identityId: string } | null = null

  await db.transaction(async (tx) => {
    const slug = await uniqueOrgSlug(tx, input.orgName.trim())
    await tx.insert(orgs).values({
      id: orgId,
      name: input.orgName.trim(),
      slug,
      type: input.orgType,
      description: input.description.trim(),
      status: sandbox ? 'approved' : 'pending',
      requestedCityId: city.id,
      ownerUserId: userId,
      createdAt: now,
    })
    await tx.insert(users).values({
      id: userId,
      email,
      name: input.name.trim(),
      passwordHash,
      // The creator is first a person. Their organization authority is a
      // separate delegation, not a property of this account.
      role: 'participant',
      orgId: null,
      homeCityId: city.id,
      createdAt: now,
    })
    if (address) {
      await rememberOrganizationLocation(tx, { orgId, address, makeDefault: true })
      // Keep the public-profile editor in sync, but leave the profile as a
      // draft; organizations still choose when and whether to publish it.
      await tx.insert(orgProfiles).values({ orgId, location: address, updatedAt: now })
    }
    await tx.insert(cityMemberships).values({
      id: randomUUID(),
      cityId: city.id,
      memberKind: 'user',
      memberId: userId,
      joinedAt: now,
    })
    await tx.insert(cityParticipantStatuses).values({
      id: randomUUID(),
      cityId: city.id,
      userId,
      status: 'new',
      noShowCount: 0,
      barredUntil: null,
      activatedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    // In production, city admins attach the organization to the requested
    // city at approval. Sandbox retains the same outcome automatically so the
    // local demo stays usable.
    if (sandbox) {
      await tx.insert(cityMemberships).values({
        id: randomUUID(),
        cityId: city.id,
        memberKind: 'organization',
        memberId: orgId,
        joinedAt: now,
      })
    }
    await appendEvent(
      tx,
      EventTypes.ORG_REGISTERED,
      { orgId, orgType: input.orgType, name: input.orgName.trim(), cityId: city.id },
      userId,
    )
    await appendEvent(tx, EventTypes.USER_REGISTERED, { userId, role: 'participant', cityId: city.id }, userId)
    await ensureParticipantIdentity(tx, userId)
    await ensureOrganizationIdentity(tx, orgId, userId)
    const roles = await ensureOrganizationRoles(tx, orgId)
    ownerAuthority = await grantOrganizationAuthority(tx, {
      userId,
      orgId,
      role: 'owner',
      roleId: roles.owner.id,
      capabilities: ['*'],
      cityIds: [city.id],
      grantedByUserId: userId,
    })
    if (sandbox) {
      await appendEvent(tx, EventTypes.ORG_APPROVED, { orgId, cityId: city.id, sandbox: true }, userId)
    }
  })

  return { ok: true, userId, orgId, authorityId: ownerAuthority!.delegationId, authorityIdentityId: ownerAuthority!.identityId }
}

export async function setOrgStatus(
  orgId: string,
  status: 'approved' | 'suspended',
  actorId: string,
  cityId?: string,
): Promise<Result> {
  const found = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1)
  if (found.length === 0) return { ok: false, error: 'Organization not found.' }

  const approvedCityId = cityId || found[0].requestedCityId
  if (status === 'approved' && !approvedCityId) {
    return { ok: false, error: 'Choose a city before approving this organization.' }
  }
  if (status === 'approved' && approvedCityId) {
    const city = (await db.select({ id: cities.id }).from(cities).where(eq(cities.id, approvedCityId)).limit(1))[0]
    if (!city) return { ok: false, error: 'That city is not available.' }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(orgs)
      .set({ status, ...(status === 'approved' && approvedCityId ? { requestedCityId: approvedCityId } : {}) })
      .where(eq(orgs.id, orgId))
    if (status === 'approved' && approvedCityId) {
      await tx
        .insert(cityMemberships)
        .values({
          id: randomUUID(),
          cityId: approvedCityId,
          memberKind: 'organization',
          memberId: orgId,
          joinedAt: Date.now(),
        })
        .onConflictDoNothing()
    }
    await appendEvent(
      tx,
      status === 'approved' ? EventTypes.ORG_APPROVED : EventTypes.ORG_SUSPENDED,
      { orgId, cityId: approvedCityId ?? found[0].requestedCityId ?? undefined },
      actorId,
    )
  })
  return { ok: true }
}
