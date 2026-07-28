import { createHash, createHmac, randomBytes, randomUUID } from 'crypto'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { provisionCityDatabase } from '@/lib/db/city-client'
import {
  cities,
  cityLaunchApplications,
  cityMemberships,
  identities,
  organizationDelegations,
  orgProfiles,
  orgs,
  users,
} from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import {
  ensureOrganizationIdentity,
  ensureOrganizationRoles,
  grantOrganizationAuthority,
  isOrganizationOwner,
  type Result,
} from '@/lib/services/identity-access'

const CLAIM_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

function hashCode(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

function claimCodeFor(applicationId: string) {
  const proof = createHmac('sha256', process.env.AUTH_SECRET ?? 'dev-secret-change-me-in-production')
    .update(`city-launch:${applicationId}`)
    .digest('base64url')
    .slice(0, 24)
  return `CS-CLAIM-${applicationId}.${proof}`
}

function citySlug(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
  )
}

function organizationSlug(name: string, cityId: string, orgId: string) {
  const base = citySlug(name) || 'organization'
  return `${base.slice(0, 45)}-${cityId}-${orgId.slice(0, 6)}`
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export type CityLaunchApplication = typeof cityLaunchApplications.$inferSelect

/** Issuer-facing history, including the claim code only while it is actionable. */
export async function listCityLaunchApplicationsForSponsor(orgId: string) {
  return db
    .select()
    .from(cityLaunchApplications)
    .where(eq(cityLaunchApplications.sponsorOrgId, orgId))
    .orderBy(desc(cityLaunchApplications.createdAt))
}

/** A sponsor can regenerate this deterministic, secret-bound claim link while it is active. */
export function cityLaunchClaimCode(application: CityLaunchApplication) {
  return application.status === 'awaiting_owner' && application.ownershipExpiresAt && application.ownershipExpiresAt > Date.now()
    ? claimCodeFor(application.id)
    : null
}

/** Review queue for City/Sync administrators. */
export async function listCityLaunchApplicationsForAdmin() {
  return db
    .select({ application: cityLaunchApplications, sponsor: orgs, bootstrapUser: users })
    .from(cityLaunchApplications)
    .innerJoin(orgs, eq(cityLaunchApplications.sponsorOrgId, orgs.id))
    .innerJoin(users, eq(cityLaunchApplications.bootstrapUserId, users.id))
    .orderBy(desc(cityLaunchApplications.createdAt))
}

export async function submitCityLaunchApplication(input: {
  sponsorOrgId: string
  bootstrapUserId: string
  authorityId: string
  cityName: string
  cityDescription: string
  proposedOwnerName: string
  proposedOwnerEmail: string
}): Promise<Result<{ applicationId: string; cityName: string }>> {
  if (!(await isOrganizationOwner(input.bootstrapUserId, input.authorityId, input.sponsorOrgId))) {
    return { ok: false, error: 'Only an organization owner can request a new city network.' }
  }

  const name = input.cityName.trim().replace(/\s+/g, ' ')
  const slug = citySlug(name)
  const description = input.cityDescription.trim()
  const ownerName = input.proposedOwnerName.trim().replace(/\s+/g, ' ')
  const ownerEmail = input.proposedOwnerEmail.trim().toLowerCase()
  if (name.length < 2 || name.length > 100 || !slug) {
    return { ok: false, error: 'Enter a city name between 2 and 100 characters.' }
  }
  if (description.length > 600) return { ok: false, error: 'Keep the city description to 600 characters or fewer.' }
  if (ownerName.length < 2 || ownerName.length > 120) {
    return { ok: false, error: 'Enter the proposed local owner’s name.' }
  }
  if (!validEmail(ownerEmail)) return { ok: false, error: 'Enter a valid local-owner email address.' }

  const [existingCity, existingApplications, sponsor] = await Promise.all([
    db.select({ id: cities.id }).from(cities).where(eq(cities.slug, slug)).limit(1),
    db.select({ status: cityLaunchApplications.status }).from(cityLaunchApplications).where(eq(cityLaunchApplications.citySlug, slug)),
    db.select({ id: orgs.id, status: orgs.status, type: orgs.type }).from(orgs).where(eq(orgs.id, input.sponsorOrgId)).limit(1),
  ])
  if (!sponsor[0] || sponsor[0].type !== 'issuer' || sponsor[0].status !== 'approved') {
    return { ok: false, error: 'Only an approved issuer organization can launch a new city network.' }
  }
  if (existingCity[0] || existingApplications.some((application) => application.status !== 'rejected')) {
    return { ok: false, error: 'That city already has an active City/Sync network or application.' }
  }

  const now = Date.now()
  const applicationId = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(cityLaunchApplications).values({
      id: applicationId,
      sponsorOrgId: input.sponsorOrgId,
      bootstrapUserId: input.bootstrapUserId,
      createdByDelegationId: input.authorityId,
      cityName: name,
      citySlug: slug,
      cityDescription: description,
      proposedOwnerName: ownerName,
      proposedOwnerEmail: ownerEmail,
      status: 'submitted',
      cityId: null,
      localOrgId: null,
      ownershipCodeHash: null,
      ownershipExpiresAt: null,
      ownershipAcceptedAt: null,
      ownerUserId: null,
      reviewerNote: '',
      approvedByUserId: null,
      createdAt: now,
      reviewedAt: null,
      updatedAt: now,
    })
    await appendEvent(
      tx,
      EventTypes.CITY_LAUNCH_REQUESTED,
      { orgId: input.sponsorOrgId, applicationId, cityName: name, cityId: slug, proposedOwnerEmail: ownerEmail },
      input.authorityId,
    )
  })
  return { ok: true, applicationId, cityName: name }
}

/**
 * Provision the city ledger database first, then atomically create the
 * control-plane city, city-local organization, temporary sponsor authority,
 * and targeted ownership claim in the central database.
 */
export async function approveCityLaunchApplication(input: {
  applicationId: string
  adminUserId: string
}): Promise<Result<{ cityName: string; localOrgName: string; code: string }>> {
  const application = (
    await db.select().from(cityLaunchApplications).where(eq(cityLaunchApplications.id, input.applicationId)).limit(1)
  )[0]
  if (!application) return { ok: false, error: 'That city launch application was not found.' }
  if (application.status !== 'submitted') return { ok: false, error: 'That application has already been reviewed.' }

  const [sponsor, sponsorProfile, conflict] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, application.sponsorOrgId)).limit(1),
    db.select().from(orgProfiles).where(eq(orgProfiles.orgId, application.sponsorOrgId)).limit(1),
    db.select({ id: cities.id }).from(cities).where(eq(cities.slug, application.citySlug)).limit(1),
  ])
  if (!sponsor[0]) return { ok: false, error: 'The sponsoring organization is no longer available.' }
  if (conflict[0]) return { ok: false, error: 'A city network already uses this city name.' }

  // This has no control-plane side effects beyond creating an empty, isolated
  // city database and is intentionally idempotent for a safe retry.
  try {
    await provisionCityDatabase(application.citySlug)
  } catch {
    return { ok: false, error: 'The city database could not be provisioned. The application remains pending.' }
  }

  const now = Date.now()
  const code = claimCodeFor(application.id)
  const codeHash = hashCode(code)
  const localOrgId = randomUUID()
  const localOrgName = sponsor[0].name
  const claimExpiresAt = now + CLAIM_WINDOW_MS

  const created = await db.transaction(async (tx) => {
    const fresh = (
      await tx.select().from(cityLaunchApplications).where(eq(cityLaunchApplications.id, application.id)).limit(1)
    )[0]
    if (!fresh || fresh.status !== 'submitted') return false
    const cityAlreadyExists = (
      await tx.select({ id: cities.id }).from(cities).where(eq(cities.slug, fresh.citySlug)).limit(1)
    )[0]
    if (cityAlreadyExists) return false

    await tx.insert(cities).values({
      id: fresh.citySlug,
      name: fresh.cityName,
      slug: fresh.citySlug,
      description: fresh.cityDescription,
      joinCode: `CITY-${randomBytes(9).toString('base64url').toUpperCase()}`,
      createdAt: now,
    })
    await tx.insert(orgs).values({
      id: localOrgId,
      name: localOrgName,
      slug: organizationSlug(localOrgName, fresh.citySlug, localOrgId),
      type: sponsor[0].type,
      description: sponsor[0].description,
      status: 'approved',
      requestedCityId: fresh.citySlug,
      parentOrgId: sponsor[0].id,
      ownerUserId: fresh.bootstrapUserId,
      createdAt: now,
    })
    await tx.insert(cityMemberships).values({
      id: randomUUID(),
      cityId: fresh.citySlug,
      memberKind: 'organization',
      memberId: localOrgId,
      joinedAt: now,
    })
    const source = sponsorProfile[0]
    await tx.insert(orgProfiles).values({
      orgId: localOrgId,
      tagline: source?.tagline ?? '',
      mission: source?.mission ?? sponsor[0].description,
      logoUrl: source?.logoUrl ?? '',
      coverUrl: source?.coverUrl ?? '',
      website: source?.website ?? '',
      contactEmail: source?.contactEmail ?? '',
      phone: source?.phone ?? '',
      location: fresh.cityName,
      socials: source?.socials ?? '{}',
      causes: source?.causes ?? '[]',
      onboardingTaskId: null,
      published: 0,
      updatedAt: now,
    })
    await ensureOrganizationIdentity(tx, localOrgId, input.adminUserId)
    const roles = await ensureOrganizationRoles(tx, localOrgId)
    await grantOrganizationAuthority(tx, {
      userId: fresh.bootstrapUserId,
      orgId: localOrgId,
      role: 'owner',
      roleId: roles.owner.id,
      capabilities: ['*'],
      cityIds: [fresh.citySlug],
      grantedByUserId: fresh.bootstrapUserId,
    })
    await tx
      .update(cityLaunchApplications)
      .set({
        status: 'awaiting_owner',
        cityId: fresh.citySlug,
        localOrgId,
        ownershipCodeHash: codeHash,
        ownershipExpiresAt: claimExpiresAt,
        approvedByUserId: input.adminUserId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(cityLaunchApplications.id, fresh.id))
    await appendEvent(
      tx,
      EventTypes.CITY_LAUNCH_APPROVED,
      { orgId: fresh.sponsorOrgId, applicationId: fresh.id, cityId: fresh.citySlug, cityName: fresh.cityName, localOrgId },
      input.adminUserId,
    )
    return true
  })

  if (!created) return { ok: false, error: 'This city launch application was already reviewed or conflicts with an existing city.' }
  return { ok: true, cityName: application.cityName, localOrgName, code }
}

export async function claimCityLaunchOwnership(input: {
  userId: string
  code: string
}): Promise<Result<{ identityId: string; orgName: string; cityName: string }>> {
  const code = input.code.trim()
  if (!code) return { ok: false, error: 'Enter the ownership claim code.' }
  const application = (
    await db
      .select()
      .from(cityLaunchApplications)
      .where(eq(cityLaunchApplications.ownershipCodeHash, hashCode(code)))
      .limit(1)
  )[0]
  if (!application || application.status !== 'awaiting_owner' || !application.localOrgId || !application.cityId) {
    return { ok: false, error: 'That ownership claim is not available.' }
  }
  if (!application.ownershipExpiresAt || application.ownershipExpiresAt <= Date.now()) {
    return { ok: false, error: 'That ownership claim has expired. Ask the sponsoring organization to contact City/Sync.' }
  }
  const [candidate, participantIdentity, organization] = await Promise.all([
    db.select().from(users).where(eq(users.id, input.userId)).limit(1),
    db
      .select({ id: identities.id })
      .from(identities)
      .where(and(eq(identities.userId, input.userId), eq(identities.kind, 'participant'), eq(identities.status, 'active')))
      .limit(1),
    db.select().from(orgs).where(eq(orgs.id, application.localOrgId)).limit(1),
  ])
  if (!candidate[0] || !participantIdentity[0]) {
    return { ok: false, error: 'Sign in with a Civic Participant account before claiming this organization.' }
  }
  if (candidate[0].email.trim().toLowerCase() !== application.proposedOwnerEmail) {
    return { ok: false, error: 'This claim is reserved for the Civic Participant account using the invited email address.' }
  }
  if (!organization[0]) return { ok: false, error: 'The city-local organization is no longer available.' }

  const now = Date.now()
  const granted = await db.transaction(async (tx) => {
    const fresh = (
      await tx.select().from(cityLaunchApplications).where(eq(cityLaunchApplications.id, application.id)).limit(1)
    )[0]
    if (!fresh || fresh.status !== 'awaiting_owner' || fresh.ownershipCodeHash !== hashCode(code) || !fresh.localOrgId || !fresh.cityId) return null
    if (!fresh.ownershipExpiresAt || fresh.ownershipExpiresAt <= now) return null

    const roles = await ensureOrganizationRoles(tx, fresh.localOrgId)
    // The sponsor only receives bootstrap authority while the ownership claim
    // is outstanding. It is revoked on a successful transfer, leaving the
    // new city-local owner as the organization’s controlling authority.
    if (fresh.bootstrapUserId !== input.userId) {
      const bootstrap = (
        await tx
          .select()
          .from(organizationDelegations)
          .where(and(eq(organizationDelegations.userId, fresh.bootstrapUserId), eq(organizationDelegations.orgId, fresh.localOrgId)))
          .limit(1)
      )[0]
      if (bootstrap) {
        await tx
          .update(organizationDelegations)
          .set({ status: 'revoked', updatedAt: now, revokedAt: now })
          .where(eq(organizationDelegations.id, bootstrap.id))
        await tx.update(identities).set({ status: 'revoked' }).where(eq(identities.id, bootstrap.identityId))
        await appendEvent(
          tx,
          EventTypes.ORG_AUTHORITY_REVOKED,
          { orgId: fresh.localOrgId, delegationId: bootstrap.id, userId: fresh.bootstrapUserId, reason: 'city_launch_owner_assigned' },
          input.userId,
        )
      }
    }

    const authority = await grantOrganizationAuthority(tx, {
      userId: input.userId,
      orgId: fresh.localOrgId,
      role: 'owner',
      roleId: roles.owner.id,
      capabilities: ['*'],
      cityIds: [fresh.cityId],
      grantedByUserId: input.userId,
    })
    await tx.update(orgs).set({ ownerUserId: input.userId }).where(eq(orgs.id, fresh.localOrgId))
    await tx
      .update(cityLaunchApplications)
      .set({
        status: 'owner_assigned',
        ownerUserId: input.userId,
        ownershipAcceptedAt: now,
        updatedAt: now,
      })
      .where(eq(cityLaunchApplications.id, fresh.id))
    await appendEvent(
      tx,
      EventTypes.CITY_LAUNCH_OWNER_ASSIGNED,
      { orgId: fresh.localOrgId, sponsorOrgId: fresh.sponsorOrgId, applicationId: fresh.id, cityId: fresh.cityId, cityName: fresh.cityName, ownerUserId: input.userId },
      authority.identityId,
    )
    return authority
  })

  if (!granted) return { ok: false, error: 'That ownership claim is no longer available.' }
  return { ok: true, identityId: granted.identityId, orgName: organization[0].name, cityName: application.cityName }
}
