import { createHash, randomBytes, randomUUID } from 'crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  cities,
  cityMemberships,
  claims,
  identities,
  organizationDelegations,
  organizationInvites,
  organizationRoles,
  orgProfiles,
  orgs,
  plannedRecurringAssignments,
  tasks,
  users,
  volunteerGroupMembers,
  volunteerGroups,
  volunteerRosterMembers,
  volunteerTaskEligibilityGrants,
} from '@/lib/db/schema'
import type { Session } from '@/lib/auth/session'
import { appendEvent, type DbOrTx } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import { participantDisplayName } from '@/lib/participant-name'
import { updateOrganizationAppearanceStorage } from '@/lib/profile/organization-appearance'
import { normalizeOrganizationLocation, rememberOrganizationLocation } from '@/lib/services/organization-locations'

export type AuthorityRole = 'owner' | 'manager' | 'member'

export type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string }

export const ORGANIZATION_PERMISSION_OPTIONS = [
  { key: 'opportunities.manage', label: 'Opportunities', description: 'Create and manage catalog entries, opportunities, and shifts.' },
  { key: 'participants.manage', label: 'Volunteers', description: 'View rosters, check in participants, verify completions, and manage credentials.' },
  { key: 'profile.manage', label: 'Public profile', description: 'Edit the organization’s public profile and organization picture.' },
  { key: 'waiver.manage', label: 'Liability waiver', description: 'Create and publish waiver versions.' },
  { key: 'documents.manage', label: 'Volunteer documents', description: 'Create and manage volunteer guides, safety plans, and operational templates.' },
  { key: 'reports.view', label: 'Reports', description: 'View and export organization contribution reports.' },
  { key: 'feed.manage', label: 'MyCity feed', description: 'Publish organization updates to the city feed.' },
  { key: 'offerings.manage', label: 'Redemptions', description: 'Manage partner offerings and finalize redemptions.' },
  { key: 'organization.settings', label: 'Organizational Settings', description: 'Edit organization identity, roles, delegated accounts, and invitations.', ownerOnly: true },
] as const

export type OrganizationPermission = (typeof ORGANIZATION_PERMISSION_OPTIONS)[number]['key']

const DEFAULT_TIER_PERMISSIONS: OrganizationPermission[] = [
  'opportunities.manage',
  'participants.manage',
  'profile.manage',
  'waiver.manage',
  'documents.manage',
  'reports.view',
  'feed.manage',
  'offerings.manage',
]

function addressFor(kind: 'participant' | 'organization' | 'authority') {
  const prefix = kind === 'participant' ? 'person' : kind === 'organization' ? 'org' : 'authority'
  return `cs:${prefix}:${randomUUID().replace(/-/g, '')}`
}

function parseStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function hashInviteCode(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

/** Ensure the personal actor/address for a person exists. */
export async function ensureParticipantIdentity(tx: DbOrTx, userId: string) {
  const existing = (
    await tx
      .select()
      .from(identities)
      .where(and(eq(identities.userId, userId), eq(identities.kind, 'participant')))
      .limit(1)
  )[0]
  if (existing) return existing

  const identity = {
    id: randomUUID(),
    userId,
    orgId: null,
    kind: 'participant' as const,
    address: addressFor('participant'),
    status: 'active' as const,
    createdAt: Date.now(),
  }
  await tx.insert(identities).values(identity)
  await appendEvent(tx, EventTypes.IDENTITY_CREATED, { identityId: identity.id, kind: identity.kind, userId }, userId)
  return identity
}

/** Ensure the organization itself—not any employee—has a durable actor/address. */
export async function ensureOrganizationIdentity(tx: DbOrTx, orgId: string, actorId?: string) {
  const existing = (
    await tx
      .select()
      .from(identities)
      .where(and(eq(identities.orgId, orgId), eq(identities.kind, 'organization')))
      .limit(1)
  )[0]
  if (existing) return existing

  const identity = {
    id: randomUUID(),
    userId: null,
    orgId,
    kind: 'organization' as const,
    address: addressFor('organization'),
    status: 'active' as const,
    createdAt: Date.now(),
  }
  await tx.insert(identities).values(identity)
  await appendEvent(tx, EventTypes.IDENTITY_CREATED, { identityId: identity.id, kind: identity.kind, orgId }, actorId ?? null)
  return identity
}

/** Create the non-editable owner role for a new organization. */
export async function ensureOrganizationRoles(tx: DbOrTx, orgId: string) {
  const existing = await tx
    .select()
    .from(organizationRoles)
    .where(eq(organizationRoles.orgId, orgId))
    .orderBy(organizationRoles.tierNumber)
  const now = Date.now()
  let owner = existing.find((role) => role.isOwnerRole === 1)

  if (!owner) {
    owner = {
      id: randomUUID(),
      orgId,
      tierNumber: 0,
      name: 'Owner',
      permissions: JSON.stringify(['*']),
      isOwnerRole: 1,
      createdAt: now,
      updatedAt: now,
    }
    await tx.insert(organizationRoles).values(owner)
  }
  return { owner }
}

/**
 * Active organization authority takes precedence over a volunteer role in the
 * same organization. Current-state roster links are removed, future volunteer
 * plans are released, and active claims are retained as unclaimed records so
 * the append-only history still explains what happened.
 */
async function giveStaffPriorityOverVolunteerRole(
  tx: DbOrTx,
  input: { orgId: string; userId: string; actorId: string | null },
) {
  const now = Date.now()
  const activeClaims = await tx
    .select({ claimId: claims.id, taskId: claims.taskId, shiftId: claims.shiftId, cityId: tasks.cityId })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .where(and(
      eq(tasks.orgId, input.orgId),
      eq(claims.userId, input.userId),
      eq(claims.status, 'claimed'),
    ))

  for (const claim of activeClaims) {
    await tx.update(claims).set({ status: 'unclaimed', updatedAt: now }).where(eq(claims.id, claim.claimId))
    await appendEvent(
      tx,
      EventTypes.CLAIM_UNCLAIMED,
      {
        claimId: claim.claimId,
        taskId: claim.taskId,
        shiftId: claim.shiftId,
        cityId: claim.cityId,
        reason: 'organization_staff_access_granted',
      },
      input.actorId,
    )
  }

  await tx
    .delete(volunteerRosterMembers)
    .where(and(
      eq(volunteerRosterMembers.orgId, input.orgId),
      eq(volunteerRosterMembers.userId, input.userId),
    ))

  const organizationGroups = await tx
    .select({ id: volunteerGroups.id })
    .from(volunteerGroups)
    .where(eq(volunteerGroups.orgId, input.orgId))
  if (organizationGroups.length) {
    await tx
      .delete(volunteerGroupMembers)
      .where(and(
        eq(volunteerGroupMembers.userId, input.userId),
        inArray(volunteerGroupMembers.groupId, organizationGroups.map(({ id }) => id)),
      ))
  }

  await tx
    .update(plannedRecurringAssignments)
    .set({ status: 'removed', updatedAt: now })
    .where(and(
      eq(plannedRecurringAssignments.orgId, input.orgId),
      eq(plannedRecurringAssignments.userId, input.userId),
      eq(plannedRecurringAssignments.status, 'planned'),
    ))

  await tx
    .update(volunteerTaskEligibilityGrants)
    .set({
      status: 'revoked',
      revokedByUserId: input.actorId ?? input.userId,
      revokedAt: now,
      updatedAt: now,
    })
    .where(and(
      eq(volunteerTaskEligibilityGrants.orgId, input.orgId),
      eq(volunteerTaskEligibilityGrants.userId, input.userId),
      eq(volunteerTaskEligibilityGrants.status, 'active'),
    ))
}

/**
 * Grant or restore one authority identity per person × organization pair.
 * Reinviting a former employee reactivates their existing authority address,
 * preserving the audit trail instead of creating a shared account.
 */
export async function grantOrganizationAuthority(
  tx: DbOrTx,
  input: {
    userId: string
    orgId: string
    role: AuthorityRole
    roleId?: string | null
    capabilities?: string[]
    cityIds?: string[]
    grantedByUserId?: string | null
  },
) {
  const now = Date.now()
  const existing = (
    await tx
      .select({ delegation: organizationDelegations, identity: identities })
      .from(organizationDelegations)
      .innerJoin(identities, eq(organizationDelegations.identityId, identities.id))
      .where(
        and(eq(organizationDelegations.userId, input.userId), eq(organizationDelegations.orgId, input.orgId)),
      )
      .limit(1)
  )[0]

  const capabilities = JSON.stringify(input.capabilities?.length ? input.capabilities : DEFAULT_TIER_PERMISSIONS)
  const cityIds = JSON.stringify(input.cityIds ?? [])
  await giveStaffPriorityOverVolunteerRole(tx, {
    orgId: input.orgId,
    userId: input.userId,
    actorId: input.grantedByUserId ?? input.userId,
  })
  if (existing) {
    await tx
      .update(identities)
      .set({ status: 'active' })
      .where(eq(identities.id, existing.identity.id))
    await tx
      .update(organizationDelegations)
      .set({
        role: input.role,
        roleId: input.roleId ?? existing.delegation.roleId,
        capabilities,
        cityIds,
        status: 'active',
        grantedByUserId: input.grantedByUserId ?? null,
        updatedAt: now,
        revokedAt: null,
      })
      .where(eq(organizationDelegations.id, existing.delegation.id))
    return { delegationId: existing.delegation.id, identityId: existing.identity.id, address: existing.identity.address, restored: true }
  }

  const identityId = randomUUID()
  const delegationId = randomUUID()
  const address = addressFor('authority')
  await tx.insert(identities).values({
    id: identityId,
    userId: input.userId,
    orgId: input.orgId,
    kind: 'authority',
    address,
    status: 'active',
    createdAt: now,
  })
  await tx.insert(organizationDelegations).values({
    id: delegationId,
    identityId,
    roleId: input.roleId ?? null,
    userId: input.userId,
    orgId: input.orgId,
    role: input.role,
    capabilities,
    cityIds,
    status: 'active',
    grantedByUserId: input.grantedByUserId ?? null,
    createdAt: now,
    updatedAt: now,
    revokedAt: null,
  })
  await appendEvent(
    tx,
    EventTypes.ORG_AUTHORITY_GRANTED,
    { delegationId, authorityIdentityId: identityId, userId: input.userId, orgId: input.orgId, role: input.role },
    input.grantedByUserId ?? input.userId,
  )
  return { delegationId, identityId, address, restored: false }
}

export type ActorContext = {
  identityId: string
  address: string
  kind: 'participant' | 'authority'
  label: string
  role: 'participant' | 'issuer' | 'redeemer'
  orgId: string | null
  authorityId: string | null
  authorityRole: AuthorityRole | null
  cityIds: string[]
}

/** All active identities a person may choose from in the workspace. */
export async function getActorContexts(userId: string): Promise<ActorContext[]> {
  const participant = (
    await db
      .select()
      .from(identities)
      .where(
        and(
          eq(identities.userId, userId),
          eq(identities.kind, 'participant'),
          eq(identities.status, 'active'),
        ),
      )
      .limit(1)
  )[0]

  const authorities = await db
    .select({ delegation: organizationDelegations, identity: identities, org: orgs })
    .from(organizationDelegations)
    .innerJoin(identities, eq(organizationDelegations.identityId, identities.id))
    .innerJoin(orgs, eq(organizationDelegations.orgId, orgs.id))
    .where(
      and(
        eq(organizationDelegations.userId, userId),
        eq(organizationDelegations.status, 'active'),
        eq(identities.status, 'active'),
      ),
    )
    .orderBy(orgs.name)

  const contexts: ActorContext[] = []
  if (participant) {
    contexts.push({
      identityId: participant.id,
      address: participant.address,
      kind: 'participant',
      label: 'Civic Participant',
      role: 'participant',
      orgId: null,
      authorityId: null,
      authorityRole: null,
      cityIds: [],
    })
  }
  for (const row of authorities) {
    contexts.push({
      identityId: row.identity.id,
      address: row.identity.address,
      kind: 'authority',
      label: row.org.name,
      role: row.org.type,
      orgId: row.org.id,
      authorityId: row.delegation.id,
      authorityRole: row.delegation.role,
      cityIds: parseStringArray(row.delegation.cityIds),
    })
  }
  return contexts
}

/** Build a signed-session shape for one of a person's authorized contexts. */
export async function sessionForIdentity(userId: string, identityId: string): Promise<Session | null> {
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0]
  if (!user || user.status === 'disabled') return null
  if (user.role === 'admin') {
    // Admins currently have no alternate actor. Keep their operator context
    // separate from participant and organization addresses.
    return null
  }

  const context = (await getActorContexts(userId)).find((candidate) => candidate.identityId === identityId)
  if (!context) return null
  return {
    sub: user.id,
    role: context.role,
    orgId: context.orgId,
    name: participantDisplayName(user),
    email: user.email,
    activeIdentityId: context.identityId,
    authorityId: context.authorityId,
  }
}

/** Default log-in context: preserve legacy issuer access, otherwise personal. */
export async function defaultSessionForUser(userId: string): Promise<Session | null> {
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0]
  if (!user || user.status === 'disabled') return null
  if (user.role === 'admin') {
    return { sub: user.id, role: 'admin', orgId: null, name: participantDisplayName(user), email: user.email, activeIdentityId: null, authorityId: null }
  }

  const contexts = await getActorContexts(userId)
  // Existing issuer/redeemer accounts continue to open their legacy operating
  // context on the first login after migration. New organization creators are
  // personal participants by default on later logins.
  const legacyContext =
    user.orgId && (user.role === 'issuer' || user.role === 'redeemer')
      ? contexts.find((context) => context.orgId === user.orgId && context.role === user.role)
      : undefined
  const context = legacyContext ?? contexts.find((candidate) => candidate.kind === 'participant')
  if (!context) return null
  return {
    sub: user.id,
    role: context.role,
    orgId: context.orgId,
    name: participantDisplayName(user),
    email: user.email,
    activeIdentityId: context.identityId,
    authorityId: context.authorityId,
  }
}

/** Validate the active actor on every protected request, including revocation. */
export async function validateActiveSession(session: Session): Promise<Session | null> {
  const user = (await db.select().from(users).where(eq(users.id, session.sub)).limit(1))[0]
  if (!user || user.status === 'disabled') return null
  if (session.role === 'admin') {
    return user.role === 'admin' ? { ...session, name: participantDisplayName(user), email: user.email } : null
  }

  const contexts = await getActorContexts(session.sub)
  const context = session.activeIdentityId
    ? contexts.find((candidate) => candidate.identityId === session.activeIdentityId)
    : session.role === 'participant'
      ? contexts.find((candidate) => candidate.kind === 'participant')
      : contexts.find((candidate) => candidate.orgId === session.orgId && candidate.role === session.role)
  if (!context || context.role !== session.role || context.orgId !== session.orgId) return null

  return {
    ...session,
    name: participantDisplayName(user),
    email: user.email,
    activeIdentityId: context.identityId,
    authorityId: context.authorityId,
  }
}

export async function isOrganizationOwner(userId: string, delegationId: string, orgId: string) {
  const delegation = (
    await db
      .select({ id: organizationDelegations.id })
      .from(organizationDelegations)
      .where(
        and(
          eq(organizationDelegations.id, delegationId),
          eq(organizationDelegations.userId, userId),
          eq(organizationDelegations.orgId, orgId),
          eq(organizationDelegations.role, 'owner'),
          eq(organizationDelegations.status, 'active'),
        ),
      )
      .limit(1)
  )[0]
  return Boolean(delegation)
}

/** Organization-scoped role check used anywhere volunteer authority changes. */
export async function isActiveOrganizationStaff(orgId: string, userId: string) {
  const delegation = (
    await db
      .select({ id: organizationDelegations.id })
      .from(organizationDelegations)
      .where(and(
        eq(organizationDelegations.orgId, orgId),
        eq(organizationDelegations.userId, userId),
        eq(organizationDelegations.status, 'active'),
      ))
      .limit(1)
  )[0]
  return Boolean(delegation)
}

export async function listOrganizationCities(orgId: string) {
  return db
    .select({ id: cities.id, name: cities.name })
    .from(cityMemberships)
    .innerJoin(cities, eq(cityMemberships.cityId, cities.id))
    .where(and(eq(cityMemberships.memberKind, 'organization'), eq(cityMemberships.memberId, orgId)))
    .orderBy(cities.name)
}

export async function listOrganizationRoles(orgId: string) {
  return db
    .select()
    .from(organizationRoles)
    .where(eq(organizationRoles.orgId, orgId))
    .orderBy(organizationRoles.tierNumber)
}

function normalizePermissions(values: string[]): OrganizationPermission[] {
  const allowed = new Set<string>(
    ORGANIZATION_PERMISSION_OPTIONS.filter((permission) => !isOwnerOnlyPermission(permission)).map((permission) => permission.key),
  )
  return values.filter((value, index, all): value is OrganizationPermission => allowed.has(value) && all.indexOf(value) === index)
}

function isOwnerOnlyPermission(permission: (typeof ORGANIZATION_PERMISSION_OPTIONS)[number]) {
  return 'ownerOnly' in permission && permission.ownerOnly === true
}

export async function hasOrganizationPermission(session: Session, permission: OrganizationPermission): Promise<boolean> {
  if (!session.orgId || !session.authorityId) return false
  const row = (
    await db
      .select({ delegation: organizationDelegations, role: organizationRoles })
      .from(organizationDelegations)
      .leftJoin(organizationRoles, eq(organizationDelegations.roleId, organizationRoles.id))
      .where(
        and(
          eq(organizationDelegations.id, session.authorityId),
          eq(organizationDelegations.userId, session.sub),
          eq(organizationDelegations.orgId, session.orgId),
          eq(organizationDelegations.status, 'active'),
        ),
      )
      .limit(1)
  )[0]
  if (!row) return false
  if (row.delegation.role === 'owner') return true
  const definition = ORGANIZATION_PERMISSION_OPTIONS.find((candidate) => candidate.key === permission)
  if (definition && isOwnerOnlyPermission(definition)) return false
  const powers = row.role ? parseStringArray(row.role.permissions) : parseStringArray(row.delegation.capabilities)
  return powers.includes('*') || powers.includes(permission)
}

export async function createOrganizationRole(input: {
  userId: string
  orgId: string
  authorityId: string
  name: string
  permissions: string[]
}): Promise<Result<{ roleId: string }>> {
  if (!(await isOrganizationOwner(input.userId, input.authorityId, input.orgId))) {
    return { ok: false, error: 'Only an organization owner can create a role.' }
  }
  const name = input.name.trim()
  if (!name || name.length > 50) return { ok: false, error: 'Enter a role name of up to 50 characters.' }
  const now = Date.now()
  const id = randomUUID()
  const permissions = normalizePermissions(input.permissions)
  await db.transaction(async (tx) => {
    const current = await tx
      .select({ tierNumber: organizationRoles.tierNumber })
      .from(organizationRoles)
      .where(eq(organizationRoles.orgId, input.orgId))
    const tierNumber = Math.max(0, ...current.map((role) => role.tierNumber)) + 1
    await tx.insert(organizationRoles).values({
      id,
      orgId: input.orgId,
      tierNumber,
      name,
      permissions: JSON.stringify(permissions),
      isOwnerRole: 0,
      createdAt: now,
      updatedAt: now,
    })
    await appendEvent(
      tx,
      EventTypes.ORG_ROLE_CREATED,
      { orgId: input.orgId, roleId: id, roleName: name, permissions },
      input.authorityId,
    )
  })
  return { ok: true, roleId: id }
}

export async function updateOrganizationRole(input: {
  userId: string
  orgId: string
  authorityId: string
  roleId: string
  name: string
  permissions: string[]
}): Promise<Result> {
  if (!(await isOrganizationOwner(input.userId, input.authorityId, input.orgId))) {
    return { ok: false, error: 'Only an organization owner can update a role.' }
  }
  const name = input.name.trim()
  if (!name || name.length > 50) return { ok: false, error: 'Enter a role name of up to 50 characters.' }
  const updated = await db.transaction(async (tx) => {
    const role = (
      await tx
        .select()
        .from(organizationRoles)
        .where(and(eq(organizationRoles.id, input.roleId), eq(organizationRoles.orgId, input.orgId)))
        .limit(1)
    )[0]
    if (!role) return null
    const permissions = role.isOwnerRole ? ['*'] : normalizePermissions(input.permissions)
    await tx
      .update(organizationRoles)
      .set({
        name,
        // Owner authorities always retain every capability; edits to their label
        // are allowed, but their permission set remains protected.
        permissions: JSON.stringify(permissions),
        updatedAt: Date.now(),
      })
      .where(eq(organizationRoles.id, role.id))
    await appendEvent(
      tx,
      EventTypes.ORG_ROLE_UPDATED,
      { orgId: input.orgId, roleId: role.id, roleName: name, permissions },
      input.authorityId,
    )
    return true
  })
  if (!updated) return { ok: false, error: 'That role was not found.' }
  return { ok: true }
}

export async function updateOrganizationIdentity(input: {
  userId: string
  orgId: string
  authorityId: string
  name: string
  logoUrl: string
  contactEmail: string
  phone?: string
  location?: string
  bannerStyle?: string
  bannerPalette?: string
}): Promise<Result<{ name: string; logoUrl: string; contactEmail: string; phone: string; location: string }>> {
  if (!(await isOrganizationOwner(input.userId, input.authorityId, input.orgId))) {
    return { ok: false, error: 'Only an organization owner can update organization settings.' }
  }
  const name = input.name.trim()
  const logoUrl = input.logoUrl.trim()
  const contactEmail = input.contactEmail.trim().toLowerCase()
  const existing = (await db.select().from(orgProfiles).where(eq(orgProfiles.orgId, input.orgId)).limit(1))[0]
  const phone = input.phone === undefined ? existing?.phone ?? '' : input.phone.trim()
  const location = input.location === undefined ? existing?.location ?? '' : normalizeOrganizationLocation(input.location)
  if (!name || name.length > 120) return { ok: false, error: 'Enter an organization name of up to 120 characters.' }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { ok: false, error: 'Enter a valid organizational email address.' }
  }
  if (logoUrl && !logoUrl.startsWith('/uploads/') && !/^https:\/\//.test(logoUrl)) {
    return { ok: false, error: 'Organization pictures must be uploaded through City/Sync.' }
  }
  if (phone.length > 50) return { ok: false, error: 'Phone numbers are limited to 50 characters.' }
  if (location.length > 240) return { ok: false, error: 'Locations are limited to 240 characters.' }
  const now = Date.now()
  const appearanceStorage = updateOrganizationAppearanceStorage(
    existing?.socials ?? '{}',
    input.bannerStyle,
    input.bannerPalette,
  )
  await db.transaction(async (tx) => {
    await tx.update(orgs).set({ name }).where(eq(orgs.id, input.orgId))
    if (existing) {
      await tx.update(orgProfiles).set({ logoUrl, contactEmail, phone, location, socials: appearanceStorage, updatedAt: now }).where(eq(orgProfiles.orgId, input.orgId))
    } else {
      await tx.insert(orgProfiles).values({
        orgId: input.orgId,
        tagline: '',
        mission: '',
        logoUrl,
        coverUrl: '',
        website: '',
        contactEmail,
        phone,
        location,
        socials: appearanceStorage,
        causes: '[]',
        onboardingTaskId: null,
        published: 0,
        updatedAt: now,
      })
    }
    await rememberOrganizationLocation(tx, { orgId: input.orgId, address: location, makeDefault: true })
    await appendEvent(tx, EventTypes.ORG_PROFILE_UPDATED, { orgId: input.orgId, organizationName: name, contactEmail }, input.authorityId)
  })
  return { ok: true, name, logoUrl, contactEmail, phone, location }
}

export async function listOrganizationDelegations(orgId: string) {
  return db
    .select({ delegation: organizationDelegations, identity: identities, user: users, role: organizationRoles })
    .from(organizationDelegations)
    .innerJoin(identities, eq(organizationDelegations.identityId, identities.id))
    .innerJoin(users, eq(organizationDelegations.userId, users.id))
    .leftJoin(organizationRoles, eq(organizationDelegations.roleId, organizationRoles.id))
    .where(eq(organizationDelegations.orgId, orgId))
    .orderBy(organizationDelegations.createdAt)
}

export async function createOrganizationInvite(input: {
  userId: string
  orgId: string
  authorityId: string
  roleId: string
  cityId: string
  expiresInDays: number
  ownerRoleConfirmed?: boolean
}): Promise<Result<{ code: string; expiresAt: number }>> {
  if (!(await isOrganizationOwner(input.userId, input.authorityId, input.orgId))) {
    return { ok: false, error: 'Only an organization owner can issue an access invite.' }
  }
  const organizationCities = await listOrganizationCities(input.orgId)
  if (!organizationCities.some((city) => city.id === input.cityId)) {
    return { ok: false, error: 'This organization is not onboarded in the selected city.' }
  }
  // A delegated authority is never granted a user-selected multi-city scope.
  // It follows the single city where the organization is operating when the
  // owner generates the invitation.
  const cityIds = [input.cityId]
  const role = (
    await db
      .select()
      .from(organizationRoles)
      .where(and(eq(organizationRoles.id, input.roleId), eq(organizationRoles.orgId, input.orgId)))
      .limit(1)
  )[0]
  if (!role) return { ok: false, error: 'Choose an organization role for this invite.' }
  if (role.isOwnerRole && !input.ownerRoleConfirmed) {
    return { ok: false, error: 'Confirm that this invitation grants full organization-owner access before generating the link.' }
  }
  const expiresInDays = Math.min(Math.max(Math.floor(input.expiresInDays), 1), 30)
  const now = Date.now()
  const expiresAt = now + expiresInDays * 24 * 60 * 60 * 1000
  const code = `CS-INV-${randomBytes(15).toString('base64url')}`

  await db.transaction(async (tx) => {
    await tx.insert(organizationInvites).values({
      id: randomUUID(),
      orgId: input.orgId,
      roleId: role.id,
      codeHash: hashInviteCode(code),
      role: 'member',
      capabilities: role.permissions,
      cityIds: JSON.stringify(cityIds),
      maxUses: 1,
      uses: 0,
      issuedByDelegationId: input.authorityId,
      expiresAt,
      revokedAt: null,
      createdAt: now,
    })
    await appendEvent(
      tx,
      EventTypes.ORG_INVITE_CREATED,
      { orgId: input.orgId, roleId: role.id, roleName: role.name, cityIds, expiresAt },
      input.authorityId,
    )
  })
  return { ok: true, code, expiresAt }
}

/**
 * The public-facing, non-sensitive facts needed to explain an organization
 * invite before its recipient has an account. The bearer code itself is never
 * stored—only its hash—so this deliberately exposes no authority metadata
 * beyond the organization, assigned role, and expiry.
 */
export async function getOrganizationInvitePreview(codeInput: string): Promise<Result<{
  organizationName: string
  organizationType: 'issuer' | 'redeemer'
  roleName: string
  expiresAt: number
}>> {
  const code = codeInput.trim()
  if (!code) return { ok: false, error: 'This invitation is missing its code.' }

  const row = (
    await db
      .select({ invite: organizationInvites, organization: orgs, role: organizationRoles })
      .from(organizationInvites)
      .innerJoin(orgs, eq(organizationInvites.orgId, orgs.id))
      .leftJoin(organizationRoles, eq(organizationInvites.roleId, organizationRoles.id))
      .where(eq(organizationInvites.codeHash, hashInviteCode(code)))
      .limit(1)
  )[0]

  if (!row || row.invite.revokedAt || row.invite.expiresAt <= Date.now() || row.invite.uses >= row.invite.maxUses) {
    return { ok: false, error: 'This invitation is invalid, expired, or has already been used.' }
  }
  if (!row.role || row.role.orgId !== row.organization.id) {
    return { ok: false, error: 'The role attached to this invitation is no longer available.' }
  }

  return {
    ok: true,
    organizationName: row.organization.name,
    organizationType: row.organization.type,
    roleName: row.role.name,
    expiresAt: row.invite.expiresAt,
  }
}

export async function acceptOrganizationInvite(input: {
  userId: string
  code: string
}): Promise<Result<{ identityId: string; delegationId: string; orgType: 'issuer' | 'redeemer'; orgName: string; alreadyMember: boolean }>> {
  const code = input.code.trim()
  if (!code) return { ok: false, error: 'Enter an invitation code.' }
  const invite = (
    await db.select().from(organizationInvites).where(eq(organizationInvites.codeHash, hashInviteCode(code))).limit(1)
  )[0]
  if (!invite || invite.revokedAt || invite.expiresAt <= Date.now() || invite.uses >= invite.maxUses) {
    return { ok: false, error: 'That invitation is invalid, expired, or has already been used.' }
  }
  const organization = (await db.select().from(orgs).where(eq(orgs.id, invite.orgId)).limit(1))[0]
  if (!organization) return { ok: false, error: 'The organization for this invitation is no longer available.' }

  const existing = (
    await db
      .select({ delegation: organizationDelegations, identity: identities })
      .from(organizationDelegations)
      .innerJoin(identities, eq(organizationDelegations.identityId, identities.id))
      .where(and(eq(organizationDelegations.userId, input.userId), eq(organizationDelegations.orgId, invite.orgId)))
      .limit(1)
  )[0]
  if (existing?.delegation.status === 'active') {
    await db.transaction(async (tx) => {
      await giveStaffPriorityOverVolunteerRole(tx, {
        orgId: invite.orgId,
        userId: input.userId,
        actorId: existing.identity.id,
      })
    })
    return {
      ok: true,
      identityId: existing.identity.id,
      delegationId: existing.delegation.id,
      orgType: organization.type,
      orgName: organization.name,
      alreadyMember: true,
    }
  }

  const granted = await db.transaction(async (tx) => {
    const fresh = (
      await tx
        .select()
        .from(organizationInvites)
        .where(eq(organizationInvites.id, invite.id))
        .limit(1)
    )[0]
    if (!fresh || fresh.revokedAt || fresh.expiresAt <= Date.now() || fresh.uses >= fresh.maxUses) return null
    const assignedRole = fresh.roleId
      ? (
          await tx
            .select()
            .from(organizationRoles)
            .where(and(eq(organizationRoles.id, fresh.roleId), eq(organizationRoles.orgId, fresh.orgId)))
            .limit(1)
        )[0]
      : null
    if (!assignedRole) return null

    const authority = await grantOrganizationAuthority(tx, {
      userId: input.userId,
      orgId: fresh.orgId,
      role: assignedRole.isOwnerRole ? 'owner' : 'member',
      roleId: assignedRole.id,
      capabilities: parseStringArray(assignedRole.permissions),
      cityIds: parseStringArray(fresh.cityIds),
      grantedByUserId: null,
    })
    await tx
      .update(organizationInvites)
      .set({ uses: fresh.uses + 1 })
      .where(eq(organizationInvites.id, fresh.id))
    await appendEvent(
      tx,
      EventTypes.ORG_INVITE_ACCEPTED,
      { orgId: fresh.orgId, delegationId: authority.delegationId, userId: input.userId },
      authority.identityId,
    )
    return authority
  })
  if (!granted) return { ok: false, error: 'That invitation is no longer available.' }
  return {
    ok: true,
    identityId: granted.identityId,
    delegationId: granted.delegationId,
    orgType: organization.type,
    orgName: organization.name,
    alreadyMember: false,
  }
}

export async function revokeOrganizationDelegation(input: {
  userId: string
  orgId: string
  authorityId: string
  delegationId: string
}): Promise<Result> {
  if (!(await isOrganizationOwner(input.userId, input.authorityId, input.orgId))) {
    return { ok: false, error: 'Only an organization owner can revoke access.' }
  }
  const target = (
    await db
      .select()
      .from(organizationDelegations)
      .where(and(eq(organizationDelegations.id, input.delegationId), eq(organizationDelegations.orgId, input.orgId)))
      .limit(1)
  )[0]
  if (!target) return { ok: false, error: 'That authority was not found.' }
  const organization = (await db.select({ ownerUserId: orgs.ownerUserId }).from(orgs).where(eq(orgs.id, input.orgId)).limit(1))[0]
  if (target.userId === organization?.ownerUserId) {
    return { ok: false, error: 'The organization creator cannot be revoked from this screen.' }
  }

  const now = Date.now()
  await db.transaction(async (tx) => {
    await tx
      .update(organizationDelegations)
      .set({ status: 'revoked', updatedAt: now, revokedAt: now })
      .where(eq(organizationDelegations.id, target.id))
    await tx.update(identities).set({ status: 'revoked' }).where(eq(identities.id, target.identityId))
    await appendEvent(
      tx,
      EventTypes.ORG_AUTHORITY_REVOKED,
      { orgId: input.orgId, delegationId: target.id, userId: target.userId },
      input.authorityId,
    )
  })
  return { ok: true }
}

/** Convenience for server actions that need to reject a non-owner. */
export async function activeSessionIsOrganizationOwner(session: Session) {
  if (!session.orgId || !session.authorityId) return false
  return isOrganizationOwner(session.sub, session.authorityId, session.orgId)
}
