'use server'

import { createHash, randomUUID } from 'crypto'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { claims, organizationDocumentAssignments, organizationDocuments, organizationQueueAcknowledgements, organizationResourcePublications, tasks, users, volunteerEligibilityRecords, volunteerIdentityVerifications, volunteerTaskEligibilityGrants, waiverTaskAssignments, waiverVersions } from '@/lib/db/schema'
import { verifyPassword } from '@/lib/auth/password'
import { aestheticHomeFor, createSession, clearSession, getSession, homeFor, type Session } from '@/lib/auth/session'
import { participantCreditsEnabled } from '@/lib/config'
import { registerParticipant, registerOrg, setOrgStatus, updateAccountIdentity } from '@/lib/services/identity'
import {
  createTask,
  updateTask,
  createShift,
  assignVolunteersToShift,
  closeShift,
  cancelUpcomingShiftAndNotify,
  claimShift,
  unclaimClaim,
  submitCompletion,
  verifyCompletion,
  verifyShiftAttendance,
  rejectCompletion,
  selfCheckIn,
  issuerCheckIn,
  setTaskCredentials,
} from '@/lib/services/opportunities'
import { grantCredential, revokeCredential } from '@/lib/services/credentials'
import {
  createEntry,
  updateEntry,
  submitEntry,
  reviewEntry,
  getUsableEntry,
  type ReviewDecision,
} from '@/lib/services/catalog'
import { parseCredentialList } from '@/lib/credentials'
import { setInterests, setNeighborhood, notifyMatchingParticipants } from '@/lib/services/interests'
import { setResumePublic } from '@/lib/services/resume'
import {
  createWaiverVersion,
  normalizeOnboardingIdentityCheck,
  normalizeOnboardingWaiverMethod,
  retireWaiverVersion,
  setOnboardingWaiverRequirements,
  signWaiver,
} from '@/lib/services/waivers'
import {
  ALLOWED_ORGANIZATION_DOCUMENT_TYPES,
  ALLOWED_WAIVER_DOCUMENT_TYPES,
  getPrivateStorageAdapter,
  MAX_ORGANIZATION_DOCUMENT_BYTES,
  MAX_WAIVER_DOCUMENT_BYTES,
} from '@/lib/storage/storage'
import { isOrganizationDocumentCategory } from '@/lib/services/organization-documents'
import { RESOURCE_DESTINATIONS, type OrganizationResourceKind } from '@/lib/services/organization-resources'
import { saveProfile } from '@/lib/services/profile'
import { cancelOnboardingSession, createRecurringOnboardingSession, publishOnboardingSession, updateRecurringOnboardingSession } from '@/lib/services/onboarding-session'
import { publishTemplateEvent } from '@/lib/services/recurring-template-events'
import { createVolunteerProgram, programBelongsToOrganization } from '@/lib/services/volunteer-programs'
import { createOrganizationCalendarEntry } from '@/lib/services/organization-calendar'
import { markNotificationRead, markNotificationsRead, processDueReminders } from '@/lib/services/notifications'
import { submitVolunteerReflection } from '@/lib/services/volunteer-reflections'
import {
  createOffering,
  setOfferingActive,
  requestRedemption,
  finalizeRedemption,
  cancelRedemption,
} from '@/lib/services/redemption'
import { createCityAnchor } from '@/lib/protocol/city-anchor'
import { createPost, toggleHeart } from '@/lib/services/feed'
import { toggleSavedItem, type SavedItemKind } from '@/lib/services/saved-items'
import {
  createVolunteerGroup,
  createVolunteerRosterInvite,
  acceptVolunteerRosterInvite,
  markAllMessagesRead,
  markMessageRead,
  sendRosterMessage,
  updateVolunteerGroupMembers,
} from '@/lib/services/roster'
import { createEventChat, markEventChatRead, postEventChatMessage } from '@/lib/services/event-chat'
import { getActiveCity, joinCityNetwork, setActiveCity } from '@/lib/services/city-networks'
import { participantDisplayName } from '@/lib/participant-name'
import {
  acceptOrganizationInvite,
  createOrganizationRole,
  createOrganizationInvite,
  defaultSessionForUser,
  getOrganizationInvitePreview,
  hasOrganizationPermission,
  revokeOrganizationDelegation,
  sessionForIdentity,
  updateOrganizationIdentity,
  updateOrganizationRole,
  validateActiveSession,
  type OrganizationPermission,
} from '@/lib/services/identity-access'
import {
  approveCityLaunchApplication,
  claimCityLaunchOwnership,
  submitCityLaunchApplication,
} from '@/lib/services/city-launch'
import {
  setUserStatus,
  resetUserPassword,
  adjustCredits,
  removePost,
  adminCloseTask,
  adminCancelRedemption,
} from '@/lib/services/admin'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function str(formData: FormData, key: string): string {
  const v = formData.get(key)
  return typeof v === 'string' ? v : ''
}

function int(formData: FormData, key: string): number {
  return parseInt(str(formData, key), 10)
}

function strList(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((v): v is string => typeof v === 'string')
}

/** Parse a datetime-local form value (local time) to epoch ms, or null. */
function parseDateTime(formData: FormData, key: string): number | null {
  const s = str(formData, key).trim()
  if (!s) return null
  const t = new Date(s).getTime()
  return Number.isFinite(t) ? t : null
}

/**
 * Validate a post-auth redirect target. Only same-origin relative paths are
 * allowed (must start with a single '/'), preventing open-redirect abuse.
 */
function safeNext(formData: FormData): string | null {
  const next = str(formData, 'next').trim()
  if (next.startsWith('/') && !next.startsWith('//')) return next
  return null
}

/** A feed attachment must come from this organization's image-upload path. */
function organizationPostImageUrl(value: string, orgId: string): string | null {
  const url = value.trim()
  if (!url) return null
  const pathPrefix = `/orgs/${orgId}/`
  if (url.startsWith(`/uploads${pathPrefix}`)) return url
  try {
    const parsed = new URL(url)
    const isVercelBlob = parsed.hostname.endsWith('.blob.vercel-storage.com')
      || parsed.hostname.endsWith('.public.blob.vercel-storage.com')
    return parsed.protocol === 'https:' && isVercelBlob && parsed.pathname.startsWith(pathPrefix) ? url : null
  } catch {
    return null
  }
}

/** Extract the invite code only from City/Sync's own volunteer-invite path. */
function volunteerRosterInviteFromPath(path: string | null): string {
  if (!path) return ''
  const url = new URL(path, 'http://local')
  return url.pathname === '/volunteer-invite' ? (url.searchParams.get('code') ?? '').trim() : ''
}

function back(
  formData: FormData,
  fallback: string,
  params?: Record<string, string>,
  honorRedirectTarget = true,
): never {
  const target = (honorRedirectTarget ? str(formData, 'redirectTo') : '') || fallback
  const url = new URL(target, 'http://local')
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v)
  revalidatePath('/', 'layout')
  redirect(url.pathname + url.search)
}

async function requireActor(role?: Session['role'], permission?: OrganizationPermission): Promise<Session> {
  const session = await getSession()
  if (!session) redirect('/login')
  const activeSession = await validateActiveSession(session)
  if (!activeSession) {
    clearSession()
    redirect('/login?error=' + encodeURIComponent('This identity is no longer authorized to act.'))
  }
  if (role && activeSession.role !== role) redirect(homeFor(activeSession.role))
  if (permission && (activeSession.role === 'issuer' || activeSession.role === 'redeemer')) {
    if (!(await hasOrganizationPermission(activeSession, permission))) {
      redirect(`${homeFor(activeSession.role)}?error=${encodeURIComponent('Your organization role does not have permission for that action.')}`)
    }
  }
  // Disabled accounts keep a valid cookie but lose the ability to act.
  const row = (await db.select({ status: users.status }).from(users).where(eq(users.id, activeSession.sub)).limit(1))[0]
  if (!row || row.status === 'disabled') {
    clearSession()
    redirect('/login?error=' + encodeURIComponent('This account has been disabled.'))
  }
  return activeSession
}

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

export async function signInAction(formData: FormData) {
  const email = str(formData, 'email').trim().toLowerCase()
  const password = str(formData, 'password')

  const user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0]
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    back(formData, '/login', { error: 'Invalid email or password.' })
  }
  if (user.status === 'disabled') {
    back(formData, '/login', { error: 'This account has been disabled. Contact the network administrator.' })
  }

  const session = await defaultSessionForUser(user.id)
  if (!session) back(formData, '/login', { error: 'Your account is missing an active identity. Contact support.' })
  const rosterInvite = volunteerRosterInviteFromPath(safeNext(formData))
  if (rosterInvite && session.role === 'participant') {
    const inviteResult = await acceptVolunteerRosterInvite({ userId: user.id, code: rosterInvite })
    if (!inviteResult.ok) back(formData, '/login', { error: inviteResult.error })
  }
  await createSession(session)
  redirect(rosterInvite ? aestheticHomeFor(session.role) : safeNext(formData) ?? aestheticHomeFor(session.role))
}

export async function signUpAction(formData: FormData) {
  const kind = str(formData, 'kind')
  const name = str(formData, 'name')
  const email = str(formData, 'email')
  const password = str(formData, 'password')

  if (kind === 'participant') {
    const organizationInvite = str(formData, 'organizationInvite')
    if (organizationInvite) {
      const preview = await getOrganizationInvitePreview(organizationInvite)
      if (!preview.ok) back(formData, '/signup', { error: preview.error })
    }
    const result = await registerParticipant({ name, email, password, homeCityId: str(formData, 'cityId') })
    if (!result.ok) back(formData, '/signup', { error: result.error })
    const rosterInvite = str(formData, 'rosterInvite')
    if (rosterInvite) {
      const inviteResult = await acceptVolunteerRosterInvite({ userId: result.userId, code: rosterInvite })
      if (!inviteResult.ok) back(formData, '/signup', { error: inviteResult.error })
    }
    const session = await defaultSessionForUser(result.userId)
    if (!session) back(formData, '/signup', { error: 'We could not provision your participant identity.' })

    // A role invite is intentionally redeemed as part of creating the personal
    // account. The new user keeps their participant identity and gains a
    // separate, role-limited authority for the inviting organization.
    if (organizationInvite) {
      const inviteResult = await acceptOrganizationInvite({ userId: result.userId, code: organizationInvite })
      if (!inviteResult.ok) {
        await createSession(session)
        redirect(`/aesthetic-lab/invite?code=${encodeURIComponent(organizationInvite)}&error=${encodeURIComponent(inviteResult.error)}`)
      }
      const organizationSession = await sessionForIdentity(result.userId, inviteResult.identityId)
      if (!organizationSession) {
        await createSession(session)
        redirect(`/aesthetic-lab/invite?code=${encodeURIComponent(organizationInvite)}&error=${encodeURIComponent('Your account was created, but the organization role could not be activated.')}`)
      }
      await createSession(organizationSession)
      redirect(aestheticHomeFor(organizationSession.role))
    }

    await createSession(session)
    redirect(safeNext(formData) ?? aestheticHomeFor(session.role))
  }

  if (kind === 'issuer' || kind === 'redeemer') {
    const result = await registerOrg({
      orgName: str(formData, 'orgName'),
      orgType: kind,
      description: str(formData, 'orgDescription'),
      address: str(formData, 'orgAddress'),
      name,
      email,
      password,
      cityId: str(formData, 'cityId'),
    })
    if (!result.ok) back(formData, '/signup', { error: result.error })
    const session = await sessionForIdentity(result.userId, result.authorityIdentityId)
    if (!session) back(formData, '/signup', { error: 'We could not provision the organization authority.' })
    await createSession(session)
    redirect(aestheticHomeFor(session.role))
  }

  back(formData, '/signup', { error: 'Choose an account type.' })
}

export async function signOutAction() {
  clearSession()
  redirect('/login')
}

/** Switch the active actor without creating another login or sharing access. */
export async function switchIdentityAction(formData: FormData) {
  const current = await getSession()
  if (!current) redirect('/login')
  const row = (await db.select({ status: users.status }).from(users).where(eq(users.id, current.sub)).limit(1))[0]
  if (!row || row.status === 'disabled') {
    clearSession()
    redirect('/login?error=' + encodeURIComponent('This account has been disabled.'))
  }
  const next = await sessionForIdentity(current.sub, str(formData, 'identityId'))
  if (!next) back(formData, aestheticHomeFor(current.role), { error: 'That identity is not available to this account.' })
  await createSession(next)
  const destination = str(formData, 'redirectTo')
  redirect(destination.startsWith('/') && !destination.startsWith('//') ? destination : aestheticHomeFor(next.role))
}

export async function saveAccountSettingsAction(formData: FormData) {
  const session = await requireActor()
  const result = await updateAccountIdentity({
    userId: session.sub,
    name: str(formData, 'name'),
    email: str(formData, 'email'),
    username: str(formData, 'username'),
    avatarUrl: str(formData, 'avatarUrl'),
  })
  if (!result.ok) back(formData, '/settings', { error: result.error })

  await createSession({
    sub: session.sub,
    role: session.role,
    orgId: session.orgId,
    name: participantDisplayName({ name: result.name, username: result.username }),
    email: result.email,
    activeIdentityId: session.activeIdentityId,
    authorityId: session.authorityId,
  })
  back(formData, '/settings', { ok: 'Account settings saved.' })
}

// ---------------------------------------------------------------------------
// organization authorities and invitations
// ---------------------------------------------------------------------------

export async function saveOrganizationSettingsAction(formData: FormData) {
  const session = await requireActor('issuer', 'profile.manage')
  if (!session.orgId || !session.authorityId) redirect('/issuer')
  const result = await updateOrganizationIdentity({
    userId: session.sub,
    orgId: session.orgId,
    authorityId: session.authorityId,
    name: str(formData, 'organizationName'),
    logoUrl: str(formData, 'logoUrl'),
    contactEmail: str(formData, 'contactEmail'),
  })
  back(formData, '/settings', result.ok ? { ok: 'Organization settings saved.' } : { error: result.error })
}

export async function createOrganizationRoleAction(formData: FormData) {
  const session = await requireActor('issuer')
  if (!session.orgId || !session.authorityId) redirect('/issuer')
  const result = await createOrganizationRole({
    userId: session.sub,
    orgId: session.orgId,
    authorityId: session.authorityId,
    name: str(formData, 'roleName'),
    permissions: strList(formData, 'permission'),
  })
  back(formData, '/settings', result.ok ? { ok: 'New organization role created.' } : { error: result.error })
}

export async function updateOrganizationRoleAction(formData: FormData) {
  const session = await requireActor('issuer')
  if (!session.orgId || !session.authorityId) redirect('/issuer')
  const result = await updateOrganizationRole({
    userId: session.sub,
    orgId: session.orgId,
    authorityId: session.authorityId,
    roleId: str(formData, 'roleId'),
    name: str(formData, 'roleName'),
    permissions: strList(formData, 'permission'),
  })
  back(formData, '/settings', result.ok ? { ok: 'Organization role saved.' } : { error: result.error })
}

export async function createOrganizationInviteAction(formData: FormData) {
  const session = await requireActor('issuer')
  if (!session.orgId || !session.authorityId) redirect('/issuer')
  const city = await getActiveCity(session)
  if (!city) back(formData, '/settings', { error: 'Select an organization city before creating an invite.' })
  const result = await createOrganizationInvite({
    userId: session.sub,
    orgId: session.orgId,
    authorityId: session.authorityId,
    roleId: str(formData, 'roleId'),
    cityId: city.id,
    expiresInDays: int(formData, 'expiresInDays') || 7,
    ownerRoleConfirmed: str(formData, 'confirmOwnerRole') === 'yes',
  })
  back(
    formData,
    '/settings',
    result.ok
      ? { invite: result.code, inviteRole: str(formData, 'roleId'), ok: 'Invite created. Share it only with the intended teammate.' }
      : { error: result.error },
  )
}

export async function acceptOrganizationInviteAction(formData: FormData) {
  const session = await requireActor()
  const code = str(formData, 'code')
  const result = await acceptOrganizationInvite({ userId: session.sub, code })
  if (!result.ok) back(formData, '/aesthetic-lab/invite', { code, error: result.error })
  const next = await sessionForIdentity(session.sub, result.identityId)
  if (!next) back(formData, '/aesthetic-lab/invite', { code, error: 'The authority was created, but could not be activated.' })
  await createSession(next)
  redirect(aestheticHomeFor(next.role))
}

export async function revokeOrganizationDelegationAction(formData: FormData) {
  const session = await requireActor('issuer')
  if (!session.orgId || !session.authorityId) redirect('/issuer')
  const result = await revokeOrganizationDelegation({
    userId: session.sub,
    orgId: session.orgId,
    authorityId: session.authorityId,
    delegationId: str(formData, 'delegationId'),
  })
  back(formData, '/settings', result.ok ? { ok: 'Organization authority revoked.' } : { error: result.error })
}

// ---------------------------------------------------------------------------
// city launch applications
// ---------------------------------------------------------------------------

export async function createCityLaunchApplicationAction(formData: FormData) {
  const session = await requireActor('issuer', 'organization.settings')
  if (!session.orgId || !session.authorityId) redirect('/issuer')
  const result = await submitCityLaunchApplication({
    sponsorOrgId: session.orgId,
    bootstrapUserId: session.sub,
    authorityId: session.authorityId,
    cityName: str(formData, 'cityName'),
    cityDescription: str(formData, 'cityDescription'),
    proposedOwnerName: str(formData, 'proposedOwnerName'),
    proposedOwnerEmail: str(formData, 'proposedOwnerEmail'),
  })
  back(
    formData,
    '/settings?tab=locations',
    result.ok
      ? { ok: `${result.cityName} was submitted for City/Sync review.` }
      : { error: result.error },
  )
}

export async function approveCityLaunchApplicationAction(formData: FormData) {
  const session = await requireActor('admin')
  const result = await approveCityLaunchApplication({ applicationId: str(formData, 'applicationId'), adminUserId: session.sub })
  back(
    formData,
    '/admin',
    result.ok
      ? { ok: `${result.cityName} was provisioned. The local-owner claim is ready.` }
      : { error: result.error },
  )
}

export async function claimCityLaunchOwnershipAction(formData: FormData) {
  const session = await requireActor()
  const code = str(formData, 'code')
  const fallback = `/city-launch/claim?code=${encodeURIComponent(code)}`
  const result = await claimCityLaunchOwnership({ userId: session.sub, code })
  if (!result.ok) back(formData, fallback, { error: result.error })
  const next = await sessionForIdentity(session.sub, result.identityId)
  if (!next) back(formData, fallback, { error: 'Ownership was recorded, but the organization identity could not be activated.' })
  await createSession(next)
  redirect('/issuer?ok=' + encodeURIComponent(`You now control ${result.orgName} in ${result.cityName}.`))
}

// ---------------------------------------------------------------------------
// city networks
// ---------------------------------------------------------------------------

export async function joinCityNetworkAction(formData: FormData) {
  const session = await requireActor()
  const result = await joinCityNetwork({
    cityId: str(formData, 'cityId'),
    session,
  })

  if (!result.ok) back(formData, '/cities', { error: result.error })
  back(formData, '/cities', {
    ok: result.alreadyMember
      ? `${result.cityName} is already in your city networks.`
      : `You added ${result.cityName}. Complete an onboarding task there to become a City Member.`,
  })
}

export async function switchCityAction(formData: FormData) {
  const session = await requireActor()
  const switched = await setActiveCity(session, str(formData, 'cityId'))
  const fallback = homeFor(session.role)
  back(formData, fallback, switched ? { ok: 'City network switched.' } : { error: 'You do not belong to that city network.' })
}

// ---------------------------------------------------------------------------
// issuer
// ---------------------------------------------------------------------------

export async function createOrganizationCalendarEntryAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/aesthetic-lab/issuer')
  const city = await getActiveCity(session)
  if (!city) back(formData, '/aesthetic-lab/issuer', { error: 'Choose an organization city before adding a calendar item.' })

  const startsAt = parseDateTime(formData, 'startsAt')
  const endsAt = parseDateTime(formData, 'endsAt')
  const result = await createOrganizationCalendarEntry({
    orgId: session.orgId,
    cityId: city.id,
    createdByUserId: session.sub,
    title: str(formData, 'title'),
    details: str(formData, 'details'),
    startsAt: startsAt ?? Number.NaN,
    endsAt: endsAt ?? Number.NaN,
    color: str(formData, 'color'),
    reminder: str(formData, 'reminder'),
  })
  back(formData, '/aesthetic-lab/issuer', result.ok ? { ok: 'Calendar item added.' } : { error: result.error })
}

/** Dismiss a private dashboard prompt without changing the underlying record. */
export async function acknowledgeOrganizationQueueAction(formData: FormData) {
  const session = await requireActor('issuer')
  if (!session.orgId) redirect('/aesthetic-lab/issuer')
  const actionKey = str(formData, 'actionKey').trim()
  if (!actionKey || actionKey.length > 240) {
    back(formData, '/aesthetic-lab/issuer', { error: 'That queue item could not be acknowledged.' })
  }

  await db
    .insert(organizationQueueAcknowledgements)
    .values({
      id: randomUUID(),
      orgId: session.orgId,
      actionKey,
      acknowledgedByUserId: session.sub,
      acknowledgedAt: Date.now(),
    })
    .onConflictDoNothing()

  back(formData, '/aesthetic-lab/issuer')
}

export async function createVolunteerProgramAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const destination = str(formData, 'redirectTo') || '/aesthetic-lab/issuer/catalog?workspace=programs'
  const result = await createVolunteerProgram({
    orgId: session.orgId,
    actorId: session.sub,
    name: str(formData, 'name'),
    description: str(formData, 'description'),
  })
  back(formData, destination, result.ok ? { ok: 'Volunteer program created.' } : { error: result.error })
}

export async function createTaskAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const city = await getActiveCity(session)
  if (!city) back(formData, '/issuer/tasks/new', { error: 'Your organization must be onboarded into a city before it can publish opportunities.' })
  const requestedCapacity = str(formData, 'capacity')
  const capacity = requestedCapacity ? int(formData, 'capacity') : 8
  const requestedCredits = str(formData, 'credits')
  const credits = requestedCredits ? int(formData, 'credits') : 10
  const label = str(formData, 'shiftLabel')
  const startsAt = parseDateTime(formData, 'shiftStartsAt')
  const endsAt = parseDateTime(formData, 'shiftEndsAt')
  const wantsFirstSession = Boolean(str(formData, 'shiftStartsAt').trim() || str(formData, 'shiftEndsAt').trim())
  if (wantsFirstSession && (!startsAt || !endsAt)) {
    back(formData, '/issuer/tasks/new', { error: 'Enter both a start and end time for the first session, or leave both blank.' })
  }
  const task = await createTask({
    orgId: session.orgId,
    cityId: city.id,
    actorId: session.sub,
    title: str(formData, 'title'),
    description: str(formData, 'description'),
    location: str(formData, 'location'),
    credits,
    slots: Number.isInteger(capacity) && capacity > 0 ? capacity : 1,
    startsAt: label,
    requiredCredentials: strList(formData, 'cred'),
    programId: str(formData, 'programId') || null,
  })
  if (!task.ok) back(formData, '/issuer/tasks/new', { error: task.error })
  if (wantsFirstSession) {
    const shift = await createShift({
      taskId: task.id,
      orgId: session.orgId,
      actorId: session.sub,
      startsAt,
      endsAt,
      label,
      capacity,
    })
    if (!shift.ok) {
      back(formData, `/aesthetic-lab/issuer/opportunities/${task.id}`, { error: `Opportunity created, but the first session wasn’t: ${shift.error}` })
    }
    // Alert participants whose interests match this org's causes (best-effort)
    // only once there is a session they can actually claim.
    await notifyMatchingParticipants(task.id)
    back(formData, `/aesthetic-lab/issuer/opportunities/${task.id}`, { ok: 'Opportunity created and its first session published.' })
  }
  back(formData, `/aesthetic-lab/issuer/opportunities/${task.id}`, { ok: 'Opportunity created. Add a session when you’re ready to publish it.' })
}

export async function updateTaskAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const taskId = str(formData, 'taskId')
  const result = await updateTask({
    taskId,
    orgId: session.orgId,
    actorId: session.sub,
    title: str(formData, 'title'),
    description: str(formData, 'description'),
    location: str(formData, 'location'),
    credits: str(formData, 'credits') ? int(formData, 'credits') : undefined,
    slots: str(formData, 'slots') ? int(formData, 'slots') : undefined,
    programId: str(formData, 'programId') || null,
  })
  back(formData, `/aesthetic-lab/issuer/opportunities/${taskId}`, result.ok ? { ok: 'Opportunity details saved.' } : { error: result.error })
}

export async function createShiftAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const result = await createShift({
    taskId: str(formData, 'taskId'),
    orgId: session.orgId,
    actorId: session.sub,
    startsAt: parseDateTime(formData, 'shiftStartsAt'),
    endsAt: parseDateTime(formData, 'shiftEndsAt'),
    label: str(formData, 'shiftLabel'),
    capacity: int(formData, 'capacity'),
  })
  const destination = str(formData, 'redirectTo') || '/issuer'
  back(formData, destination, result.ok ? { ok: 'Session published.' } : { error: result.error })
}

export async function createOnboardingSessionAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const city = await getActiveCity(session)
  if (!city) back(formData, '/issuer/catalog', { error: 'Your organization must be onboarded into a city before it can create an onboarding session.' })

  const result = await createRecurringOnboardingSession({
    orgId: session.orgId,
    cityId: city.id,
    actorId: session.sub,
    title: str(formData, 'title'),
    description: str(formData, 'description'),
    location: str(formData, 'location'),
    beforeSession: str(formData, 'beforeSession'),
    bringItems: str(formData, 'bringItems'),
    credits: int(formData, 'credits'),
    firstStartsAt: parseDateTime(formData, 'firstStartsAt'),
    durationMinutes: int(formData, 'durationMinutes'),
    weeklyCapacity: int(formData, 'weeklyCapacity'),
    programId: str(formData, 'programId') || null,
    onboardingWaiverMethod: normalizeOnboardingWaiverMethod(str(formData, 'onboardingWaiverMethod')),
    onboardingIdentityCheck: normalizeOnboardingIdentityCheck(str(formData, 'onboardingIdentityCheck')),
  })
  const destination = str(formData, 'redirectTo') || '/aesthetic-lab/issuer/catalog?workspace=onboarding'
  if (result.ok) await notifyMatchingParticipants(result.taskId)
  back(formData, destination, result.ok ? { ok: 'Onboarding session created.' } : { error: result.error })
}

export async function updateOnboardingSessionAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const result = await updateRecurringOnboardingSession({
    taskId: str(formData, 'taskId'),
    orgId: session.orgId,
    actorId: session.sub,
    title: str(formData, 'title'),
    description: str(formData, 'description'),
    location: str(formData, 'location'),
    beforeSession: str(formData, 'beforeSession'),
    bringItems: str(formData, 'bringItems'),
    credits: int(formData, 'credits'),
    nextStartsAt: parseDateTime(formData, 'firstStartsAt'),
    durationMinutes: int(formData, 'durationMinutes'),
    weeklyCapacity: int(formData, 'weeklyCapacity'),
    programId: str(formData, 'programId') || null,
    onboardingWaiverMethod: normalizeOnboardingWaiverMethod(str(formData, 'onboardingWaiverMethod')),
    onboardingIdentityCheck: normalizeOnboardingIdentityCheck(str(formData, 'onboardingIdentityCheck')),
  })
  back(formData, '/aesthetic-lab/issuer/catalog?workspace=onboarding', result.ok ? { ok: 'Onboarding session saved.' } : { error: result.error })
}

export async function publishOnboardingSessionAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const destination = str(formData, 'redirectTo') || '/aesthetic-lab/issuer/catalog?workspace=onboarding'
  const result = await publishOnboardingSession({
    taskId: str(formData, 'taskId'),
    orgId: session.orgId,
    actorId: session.sub,
    startsAt: parseDateTime(formData, 'startsAt'),
    recurring: str(formData, 'recurring') === 'true',
  })
  back(formData, destination, result.ok
    ? { ok: result.mode === 'scheduled' ? 'Recurring onboarding is set. The selected next session will publish after the current session ends.' : 'Onboarding session published.' }
    : { error: result.error })
}

export async function publishTemplateEventAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const city = await getActiveCity(session)
  if (!city) back(formData, '/aesthetic-lab/issuer/catalog?workspace=opportunities', { error: 'Choose an organization city before publishing an event.' })
  const destination = str(formData, 'redirectTo') || '/aesthetic-lab/issuer/catalog?workspace=opportunities'
  const visibility = str(formData, 'visibility') === 'private' ? 'private' : 'public'
  const assignedUserIds = visibility === 'private' ? strList(formData, 'assignedUserId') : []
  // Do this check before publishing so a role that can schedule shifts but
  // cannot manage people cannot create a partially completed roster action.
  if (assignedUserIds.length) await requireActor('issuer', 'participants.manage')
  const result = await publishTemplateEvent({
    taskId: str(formData, 'taskId'),
    orgId: session.orgId,
    cityId: city.id,
    actorId: session.sub,
    startsAt: parseDateTime(formData, 'startsAt'),
    recurring: str(formData, 'recurring') === 'true',
    visibility,
  })
  if (result.ok && result.mode === 'published' && visibility === 'public') await notifyMatchingParticipants(result.taskId)
  if (result.ok && assignedUserIds.length) {
    if (!result.shiftId) {
      back(formData, destination, { ok: 'Recurring private schedule saved. Add volunteers when its first shift is published.' })
    }
    const assignment = await assignVolunteersToShift({
      shiftId: result.shiftId,
      orgId: session.orgId,
      actorId: session.sub,
      userIds: assignedUserIds,
    })
    if (!assignment.ok) back(formData, destination, { error: `Shift published, but volunteers could not be assigned: ${assignment.error}` })
    back(formData, destination, { ok: `Private shift published and ${assignment.assigned} volunteer${assignment.assigned === 1 ? '' : 's'} added.` })
  }
  back(formData, destination, result.ok
    ? { ok: result.mode === 'scheduled' ? 'Recurring event is set. The next date will publish after the current event ends.' : 'Event published.' }
    : { error: result.error })
}

export async function assignVolunteersToShiftAction(formData: FormData) {
  const session = await requireActor('issuer', 'participants.manage')
  if (!session.orgId) redirect('/issuer')
  const destination = str(formData, 'redirectTo') || '/aesthetic-lab/issuer/catalog?workspace=opportunities'
  const result = await assignVolunteersToShift({
    shiftId: str(formData, 'shiftId'),
    orgId: session.orgId,
    actorId: session.sub,
    userIds: strList(formData, 'userId'),
  })
  back(formData, destination, result.ok
    ? { ok: result.assigned ? `${result.assigned} volunteer${result.assigned === 1 ? '' : 's'} added to this shift.` : 'Those volunteers are already assigned to this shift.' }
    : { error: result.error })
}

export async function cancelOnboardingSessionAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const destination = str(formData, 'redirectTo') || '/aesthetic-lab/issuer/catalog?workspace=onboarding'
  const result = await cancelOnboardingSession({
    shiftId: str(formData, 'shiftId'),
    orgId: session.orgId,
    actorId: session.sub,
  })
  back(formData, destination, result.ok
    ? { ok: result.notified > 0 ? `Session cancelled and ${result.notified} participant${result.notified === 1 ? '' : 's'} notified.` : 'Session cancelled.' }
    : { error: result.error })
}

export async function closeShiftAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const result = await closeShift(str(formData, 'shiftId'), session.orgId, session.sub)
  back(formData, '/issuer', result.ok ? { ok: 'Shift closed.' } : { error: result.error })
}

export async function cancelShiftAndNotifyAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const destination = str(formData, 'redirectTo') || '/aesthetic-lab/issuer'
  const result = await cancelUpcomingShiftAndNotify({
    shiftId: str(formData, 'shiftId'),
    orgId: session.orgId,
    actorId: session.sub,
  })
  back(formData, destination, result.ok
    ? { ok: result.notified > 0 ? `Event cancelled and ${result.notified} participant${result.notified === 1 ? '' : 's'} notified.` : 'Event cancelled.' }
    : { error: result.error })
}

// ---------------------------------------------------------------------------
// Opportunity Catalog
// ---------------------------------------------------------------------------

export async function createCatalogEntryAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const result = await createEntry({
    orgId: session.orgId,
    actorId: session.sub,
    typeId: str(formData, 'typeId') || undefined,
    title: str(formData, 'title'),
    description: str(formData, 'description'),
    location: str(formData, 'location'),
    requiredCredentials: strList(formData, 'cred'),
  })
  if (!result.ok) back(formData, '/issuer/catalog/new', { error: result.error })
  back(formData, `/issuer/catalog/${result.id}`, { ok: 'Template created.' })
}

export async function updateCatalogEntryAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const entryId = str(formData, 'entryId')
  const result = await updateEntry(entryId, session.orgId, {
    typeId: str(formData, 'typeId') || undefined,
    title: str(formData, 'title'),
    description: str(formData, 'description'),
    location: str(formData, 'location'),
    requiredCredentials: strList(formData, 'cred'),
  })
  back(formData, `/issuer/catalog/${entryId}`, result.ok ? { ok: 'Template saved.' } : { error: result.error })
}

export async function submitCatalogEntryAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const entryId = str(formData, 'entryId')
  const result = await submitEntry(entryId, session.orgId, session.sub)
  if (!result.ok) back(formData, `/issuer/catalog/${entryId}`, { error: result.error })
  back(formData, '/issuer/catalog', { ok: 'Submitted for approval.' }, false)
}

export async function reviewCatalogEntryAction(formData: FormData) {
  const session = await requireActor('admin')
  const decision = str(formData, 'decision')
  if (decision !== 'approved' && decision !== 'rejected' && decision !== 'needs_changes') {
    back(formData, '/admin/catalog', { error: 'Invalid decision.' })
  }
  const result = await reviewEntry(
    str(formData, 'entryId'),
    session.sub,
    decision as ReviewDecision,
    str(formData, 'note'),
    str(formData, 'typeId') || undefined,
  )
  back(formData, '/admin/catalog', result.ok ? { ok: 'Review recorded.' } : { error: result.error })
}

export async function scheduleFromCatalogAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const city = await getActiveCity(session)
  if (!city) back(formData, '/issuer/catalog', { error: 'Your organization must be onboarded into a city before it can schedule opportunities.' })
  const entryId = str(formData, 'entryId')
  const entry = await getUsableEntry(entryId, session.orgId)
  if (!entry) back(formData, `/issuer/catalog/${entryId}`, { error: 'This template can’t be scheduled yet.' })

  const capacity = int(formData, 'capacity')
  const label = str(formData, 'shiftLabel')
  const task = await createTask({
    orgId: session.orgId,
    cityId: city.id,
    actorId: session.sub,
    title: entry!.title,
    description: entry!.description,
    location: entry!.location,
    credits: int(formData, 'credits'),
    slots: Number.isInteger(capacity) && capacity > 0 ? capacity : 1,
    startsAt: label,
    requiredCredentials: parseCredentialList(entry!.requiredCredentials),
    catalogEntryId: entry!.id,
  })
  if (!task.ok) back(formData, `/issuer/catalog/${entryId}`, { error: task.error })
  const shift = await createShift({
    taskId: task.id,
    orgId: session.orgId,
    actorId: session.sub,
    startsAt: parseDateTime(formData, 'shiftStartsAt'),
    endsAt: parseDateTime(formData, 'shiftEndsAt'),
    label,
    capacity,
  })
  if (!shift.ok) {
    back(formData, `/issuer/tasks/${task.id}`, { error: `Opportunity created, but the first shift wasn’t: ${shift.error}` })
  }
  await notifyMatchingParticipants(task.id)
  back(formData, `/issuer/tasks/${task.id}`, { ok: 'Opportunity scheduled from your catalog.' })
}

export async function setTaskCredentialsAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const result = await setTaskCredentials(str(formData, 'taskId'), session.orgId, strList(formData, 'cred'))
  back(formData, '/issuer', result.ok ? { ok: 'Requirements updated.' } : { error: result.error })
}

// Credentials may be granted/revoked by network admins or issuer orgs; the
// credential then satisfies that requirement at every org (portable).
export async function grantCredentialAction(formData: FormData) {
  const session = await requireActor()
  if (session.role !== 'admin' && session.role !== 'issuer') {
    back(formData, homeFor(session.role), { error: 'Not authorized.' })
  }
  if (session.role === 'issuer' && !(await hasOrganizationPermission(session, 'participants.manage'))) {
    back(formData, '/issuer/volunteers', { error: 'Your organization role cannot manage participant credentials.' })
  }
  const orgId = session.role === 'issuer' ? session.orgId : null
  const result = await grantCredential({
    userId: str(formData, 'userId'),
    type: str(formData, 'type'),
    actorId: session.sub,
    orgId,
    note: str(formData, 'note'),
  })
  back(formData, '/issuer/volunteers', result.ok ? { ok: 'Credential granted.' } : { error: result.error })
}

export async function revokeCredentialAction(formData: FormData) {
  const session = await requireActor()
  if (session.role !== 'admin' && session.role !== 'issuer') {
    back(formData, homeFor(session.role), { error: 'Not authorized.' })
  }
  if (session.role === 'issuer' && !(await hasOrganizationPermission(session, 'participants.manage'))) {
    back(formData, '/issuer/volunteers', { error: 'Your organization role cannot manage participant credentials.' })
  }
  const result = await revokeCredential({
    userId: str(formData, 'userId'),
    type: str(formData, 'type'),
    actorId: session.sub,
  })
  back(formData, '/issuer/volunteers', result.ok ? { ok: 'Credential revoked.' } : { error: result.error })
}

export async function verifyClaimAction(formData: FormData) {
  const session = await requireActor('issuer', 'participants.manage')
  if (!session.orgId) redirect('/issuer')
  const result = await verifyCompletion(
    str(formData, 'claimId'),
    session.orgId,
    session.sub,
    str(formData, 'paperWaiverReceived') === 'on',
    undefined,
    str(formData, 'identityMatchesConfirmed') === 'on',
  )
  back(formData, '/issuer', result.ok ? { ok: 'Completion verified — credits minted.' } : { error: result.error })
}

/** Finalize attendance for one organization-controlled shift. */
export async function verifyShiftAttendanceAction(formData: FormData) {
  const session = await requireActor('issuer', 'participants.manage')
  if (!session.orgId) redirect('/issuer')
  const destination = str(formData, 'redirectTo') || `/aesthetic-lab/issuer/shifts/${str(formData, 'shiftId')}/verify`
  const result = await verifyShiftAttendance({
    shiftId: str(formData, 'shiftId'),
    claimIds: strList(formData, 'claimId'),
    orgId: session.orgId,
    actorId: session.sub,
    note: str(formData, 'note'),
    paperWaiverReceived: str(formData, 'paperWaiverReceived') === 'on',
    identityMatchesConfirmed: str(formData, 'identityMatchesConfirmed') === 'on',
  })
  back(
    formData,
    destination,
    result.ok
      ? { ok: `Attendance finalized — ${result.verifiedCount} verified, ${result.noShowCount} marked no-show.` }
      : { error: result.error },
  )
}

export async function rejectClaimAction(formData: FormData) {
  const session = await requireActor('issuer', 'participants.manage')
  if (!session.orgId) redirect('/issuer')
  const result = await rejectCompletion(str(formData, 'claimId'), session.orgId, session.sub)
  back(formData, '/issuer', result.ok ? { ok: 'Completion rejected.' } : { error: result.error })
}

export async function createWaiverAction(formData: FormData) {
  const session = await requireActor('issuer', 'waiver.manage')
  if (!session.orgId) redirect('/issuer')
  const destination = str(formData, 'redirectTo') || '/issuer/waiver'
  const title = str(formData, 'title')
  const body = str(formData, 'body')
  const file = formData.get('document')
  const hasDocument = file instanceof File && file.size > 0
  if (!title.trim() || (!body.trim() && !hasDocument)) {
    back(formData, destination, { error: 'Give the waiver a title and add either waiver text or a source file.' })
  }

  let document:
    | { url: string; name: string; mimeType: string; sha256: string }
    | undefined
  if (hasDocument && file instanceof File) {
    const ext = ALLOWED_WAIVER_DOCUMENT_TYPES[file.type]
    if (!ext) {
      back(formData, destination, { error: 'Upload a PDF, DOC, or DOCX waiver document.' })
    }
    if (file.size > MAX_WAIVER_DOCUMENT_BYTES) {
      back(formData, destination, { error: 'Waiver documents must be 10 MB or smaller.' })
    }
    try {
      const bytes = Buffer.from(await file.arrayBuffer())
      const stored = await getPrivateStorageAdapter().put({
        key: `waivers/${session.orgId}/${randomUUID()}.${ext}`,
        bytes,
        contentType: file.type,
      })
      document = {
        url: stored.url,
        name: file.name,
        mimeType: file.type,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      }
    } catch (error) {
      console.error('waiver upload failed', error)
      back(formData, destination, { error: 'Could not upload the waiver document. Please try again.' })
    }
  }

  const result = await createWaiverVersion({
    orgId: session.orgId,
    actorId: session.sub,
    title,
    body,
    document,
    programId: str(formData, 'programId') || null,
    onboardingWaiverMethod: formData.has('onboardingWaiverMethod')
      ? (normalizeOnboardingWaiverMethod(str(formData, 'onboardingWaiverMethod')) ?? 'digital')
      : undefined,
  })
  if (!result.ok) back(formData, destination, { error: result.error })
  back(formData, destination, { ok: 'Waiver published and included with future onboarding sessions.' })
}

export async function setOnboardingWaiverRequirementsAction(formData: FormData) {
  const session = await requireActor('issuer', 'waiver.manage')
  if (!session.orgId) redirect('/issuer')
  const destination = str(formData, 'redirectTo') || '/issuer/waiver'
  const method = normalizeOnboardingWaiverMethod(str(formData, 'onboardingWaiverMethod')) ?? 'digital'
  const identityCheck = normalizeOnboardingIdentityCheck(str(formData, 'onboardingIdentityCheck')) ?? 'not_required'
  const result = await setOnboardingWaiverRequirements({ orgId: session.orgId, method, identityCheck })
  back(
    formData,
    destination,
    result.ok
      ? { ok: 'Onboarding waiver requirements saved.' }
      : { error: result.error },
  )
}

/** Compatibility alias for any older form that still imports this action. */
export const setOnboardingWaiverMethodAction = setOnboardingWaiverRequirementsAction

export async function retireWaiverAction(formData: FormData) {
  const session = await requireActor('issuer', 'waiver.manage')
  if (!session.orgId) redirect('/issuer')
  const destination = str(formData, 'redirectTo') || '/aesthetic-lab/issuer/catalog?workspace=documentation'
  const result = await retireWaiverVersion({
    orgId: session.orgId,
    waiverVersionId: str(formData, 'waiverVersionId'),
    actorId: session.sub,
  })
  if (result.ok) {
    const waiverVersionId = str(formData, 'waiverVersionId')
    await db.transaction(async (tx) => {
      await tx.delete(waiverTaskAssignments).where(eq(waiverTaskAssignments.waiverVersionId, waiverVersionId))
      await tx.delete(organizationResourcePublications).where(and(
        eq(organizationResourcePublications.orgId, session.orgId!),
        eq(organizationResourcePublications.resourceKind, 'waiver'),
        eq(organizationResourcePublications.resourceId, waiverVersionId),
      ))
    })
  }
  back(formData, destination, result.ok ? undefined : { error: result.error })
}

/** Program placement is organizational metadata only: it never alters a
 * published waiver's version, source file, or participant acceptance record. */
export async function setWaiverProgramAction(formData: FormData) {
  const session = await requireActor('issuer', 'waiver.manage')
  if (!session.orgId) redirect('/issuer')
  const waiverVersionId = str(formData, 'waiverVersionId')
  const destination = str(formData, 'redirectTo') || '/aesthetic-lab/issuer/waiver'
  const programId = str(formData, 'programId') || null
  if (!waiverVersionId) back(formData, destination, { error: 'Choose a waiver to update.' })
  if (!(await programBelongsToOrganization(session.orgId, programId))) {
    back(formData, destination, { error: 'Choose a volunteer program belonging to your organization.' })
  }
  const waiver = await db
    .select({ id: waiverVersions.id })
    .from(waiverVersions)
    .where(and(eq(waiverVersions.id, waiverVersionId), eq(waiverVersions.orgId, session.orgId), eq(waiverVersions.active, 1)))
    .limit(1)
  if (!waiver[0]) back(formData, destination, { error: 'Waiver not found.' })
  await db.update(waiverVersions).set({ programId }).where(eq(waiverVersions.id, waiverVersionId))
  back(formData, destination, { ok: 'Waiver program saved.' })
}

export async function createOrganizationDocumentAction(formData: FormData) {
  const session = await requireActor('issuer', 'documents.manage')
  if (!session.orgId) redirect('/issuer')
  const destination = str(formData, 'redirectTo') || '/aesthetic-lab/issuer/documents'
  const successDestination = str(formData, 'successRedirectTo') || '/aesthetic-lab/issuer/catalog'
  const category = str(formData, 'category')
  const title = str(formData, 'title')
  const body = str(formData, 'body')

  if (!isOrganizationDocumentCategory(category)) {
    back(formData, destination, { error: 'Choose Volunteer Guides, Safety & Operations, or Additional Documents.' })
  }
  if (!title.trim()) back(formData, destination, { error: 'Give this document a title.' })

  let attachment: { url: string; name: string; mimeType: string; sha256: string } | undefined
  const file = formData.get('document')
  if (file instanceof File && file.size > 0) {
    const ext = ALLOWED_ORGANIZATION_DOCUMENT_TYPES[file.type]
    if (!ext) back(formData, destination, { error: 'Upload a PDF, DOC, or DOCX document.' })
    if (file.size > MAX_ORGANIZATION_DOCUMENT_BYTES) {
      back(formData, destination, { error: 'Documents must be 10 MB or smaller.' })
    }
    try {
      const bytes = Buffer.from(await file.arrayBuffer())
      const stored = await getPrivateStorageAdapter().put({
        key: `organization-documents/${session.orgId}/${randomUUID()}.${ext}`,
        bytes,
        contentType: file.type,
      })
      attachment = {
        url: stored.url,
        name: file.name,
        mimeType: file.type,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      }
    } catch (error) {
      console.error('organization document upload failed', error)
      back(formData, destination, { error: 'Could not upload the document. Please try again.' })
    }
  }
  if (!body.trim() && !attachment) {
    back(formData, destination, { error: 'Add written guidance, attach a file, or both.' })
  }

  const taskIds = Array.from(new Set(formData.getAll('taskIds').filter((value): value is string => typeof value === 'string' && value.trim().length > 0)))
  const programId = str(formData, 'programId') || null
  if (!(await programBelongsToOrganization(session.orgId, programId))) {
    back(formData, destination, { error: 'Choose a volunteer program belonging to your organization.' })
  }
  if (taskIds.length > 0) {
    const permittedTasks = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.orgId, session.orgId), inArray(tasks.id, taskIds)))
    if (permittedTasks.length !== taskIds.length) {
      back(formData, destination, { error: 'One of the selected opportunities is no longer available to your organization.' })
    }
  }

  const now = Date.now()
  const documentId = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(organizationDocuments).values({
      id: documentId,
      orgId: session.orgId!,
      programId,
      category,
      title: title.trim(),
      body: body.trim(),
      documentUrl: attachment?.url ?? null,
      documentName: attachment?.name ?? null,
      documentMimeType: attachment?.mimeType ?? null,
      documentSha256: attachment?.sha256 ?? null,
      active: 1,
      createdByUserId: session.sub,
      createdAt: now,
      updatedAt: now,
    })
    if (taskIds.length > 0) {
      await tx.insert(organizationDocumentAssignments).values(taskIds.map((taskId) => ({
        id: randomUUID(),
        documentId,
        taskId,
        createdAt: now,
      })))
    }
  })
  back(formData, successDestination, { ok: 'Document saved to your organization library.' }, false)
}

export async function archiveOrganizationDocumentAction(formData: FormData) {
  const session = await requireActor('issuer', 'documents.manage')
  if (!session.orgId) redirect('/issuer')
  const destination = str(formData, 'redirectTo') || '/aesthetic-lab/issuer/documents'
  const documentId = str(formData, 'documentId')
  if (!documentId) back(formData, destination, { error: 'Document not found.' })
  await db.transaction(async (tx) => {
    await tx
      .update(organizationDocuments)
      .set({ active: 0, updatedAt: Date.now() })
      .where(and(eq(organizationDocuments.id, documentId), eq(organizationDocuments.orgId, session.orgId!)))
    await tx.delete(organizationDocumentAssignments).where(eq(organizationDocumentAssignments.documentId, documentId))
    await tx.delete(organizationResourcePublications).where(and(
      eq(organizationResourcePublications.orgId, session.orgId!),
      eq(organizationResourcePublications.resourceKind, 'document'),
      eq(organizationResourcePublications.resourceId, documentId),
    ))
  })
  back(formData, destination)
}

function resourceKind(formData: FormData): OrganizationResourceKind | null {
  const value = str(formData, 'resourceKind')
  return value === 'document' || value === 'waiver' ? value : null
}

async function assertOrganizationResource(input: { orgId: string; kind: OrganizationResourceKind; id: string }) {
  if (input.kind === 'document') {
    const document = await db
      .select({ id: organizationDocuments.id })
      .from(organizationDocuments)
      .where(and(eq(organizationDocuments.id, input.id), eq(organizationDocuments.orgId, input.orgId), eq(organizationDocuments.active, 1)))
      .limit(1)
    return Boolean(document[0])
  }
  const waiver = await db
    .select({ id: waiverVersions.id })
    .from(waiverVersions)
    .where(and(eq(waiverVersions.id, input.id), eq(waiverVersions.orgId, input.orgId), eq(waiverVersions.active, 1)))
    .limit(1)
  return Boolean(waiver[0])
}

/** Replaces the task placements selected from the resource's Attach To… dialog.
 * Waiver placements are reference visibility only; onboarding acceptance keeps
 * using the active-waiver policy. */
export async function setOrganizationResourceAssignmentsAction(formData: FormData) {
  const kind = resourceKind(formData)
  const session = await requireActor('issuer', kind === 'waiver' ? 'waiver.manage' : 'documents.manage')
  if (!session.orgId) redirect('/issuer')
  const destination = str(formData, 'redirectTo') || '/aesthetic-lab/issuer/catalog?workspace=documentation'
  const resourceId = str(formData, 'resourceId')
  if (!kind || !resourceId || !await assertOrganizationResource({ orgId: session.orgId, kind, id: resourceId })) {
    back(formData, destination, { error: 'That resource is no longer available.' })
  }

  const taskIds = Array.from(new Set(strList(formData, 'taskIds').filter(Boolean)))
  if (taskIds.length) {
    const permitted = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.orgId, session.orgId), inArray(tasks.id, taskIds)))
    if (permitted.length !== taskIds.length) {
      back(formData, destination, { error: 'One of the selected tasks is no longer available to your organization.' })
    }
  }

  const now = Date.now()
  await db.transaction(async (tx) => {
    if (kind === 'document') {
      await tx.delete(organizationDocumentAssignments).where(eq(organizationDocumentAssignments.documentId, resourceId))
      if (taskIds.length) await tx.insert(organizationDocumentAssignments).values(taskIds.map((taskId) => ({ id: randomUUID(), documentId: resourceId, taskId, createdAt: now })))
    } else {
      await tx.delete(waiverTaskAssignments).where(eq(waiverTaskAssignments.waiverVersionId, resourceId))
      if (taskIds.length) await tx.insert(waiverTaskAssignments).values(taskIds.map((taskId) => ({ id: randomUUID(), waiverVersionId: resourceId, taskId, createdAt: now })))
    }
  })
  back(formData, destination)
}

/** Replaces the public destinations selected from the resource's Publish To… dialog. */
export async function setOrganizationResourcePublicationsAction(formData: FormData) {
  const kind = resourceKind(formData)
  const session = await requireActor('issuer', kind === 'waiver' ? 'waiver.manage' : 'documents.manage')
  if (!session.orgId) redirect('/issuer')
  const destination = str(formData, 'redirectTo') || '/aesthetic-lab/issuer/catalog?workspace=documentation'
  const resourceId = str(formData, 'resourceId')
  if (!kind || !resourceId || !await assertOrganizationResource({ orgId: session.orgId, kind, id: resourceId })) {
    back(formData, destination, { error: 'That resource is no longer available.' })
  }

  const destinations = Array.from(new Set(strList(formData, 'destinations').filter((value): value is (typeof RESOURCE_DESTINATIONS)[number] => RESOURCE_DESTINATIONS.includes(value as (typeof RESOURCE_DESTINATIONS)[number]))))
  await db.transaction(async (tx) => {
    await tx.delete(organizationResourcePublications).where(and(
      eq(organizationResourcePublications.orgId, session.orgId!),
      eq(organizationResourcePublications.resourceKind, kind),
      eq(organizationResourcePublications.resourceId, resourceId),
    ))
    if (destinations.length) await tx.insert(organizationResourcePublications).values(destinations.map((publicationDestination) => ({
      id: randomUUID(),
      orgId: session.orgId!,
      resourceKind: kind,
      resourceId,
      destination: publicationDestination,
      createdAt: Date.now(),
    })))
  })
  back(formData, destination)
}

/** Updates only the organizational context for an existing document. This
 * deliberately leaves its legal/source content and opportunity attachments intact. */
export async function setOrganizationDocumentProgramAction(formData: FormData) {
  const session = await requireActor('issuer', 'documents.manage')
  if (!session.orgId) redirect('/issuer')
  const documentId = str(formData, 'documentId')
  const destination = str(formData, 'redirectTo') || `/aesthetic-lab/issuer/documents/${documentId}`
  const programId = str(formData, 'programId') || null
  if (!documentId) back(formData, destination, { error: 'Choose a document to update.' })
  if (!(await programBelongsToOrganization(session.orgId, programId))) {
    back(formData, destination, { error: 'Choose a volunteer program belonging to your organization.' })
  }
  const document = await db
    .select({ id: organizationDocuments.id })
    .from(organizationDocuments)
    .where(and(eq(organizationDocuments.id, documentId), eq(organizationDocuments.orgId, session.orgId), eq(organizationDocuments.active, 1)))
    .limit(1)
  if (!document[0]) back(formData, destination, { error: 'Document not found.' })
  await db
    .update(organizationDocuments)
    .set({ programId, updatedAt: Date.now() })
    .where(eq(organizationDocuments.id, documentId))
  back(formData, destination, { ok: 'Document program saved.' })
}

export async function attachOrganizationDocumentAction(formData: FormData) {
  const session = await requireActor('issuer', 'documents.manage')
  if (!session.orgId) redirect('/issuer')
  const destination = str(formData, 'redirectTo') || '/aesthetic-lab/issuer/catalog'
  const documentId = str(formData, 'documentId')
  const taskId = str(formData, 'taskId')
  if (!documentId || !taskId) back(formData, destination, { error: 'Choose an opportunity to attach.' })

  const [document, task] = await Promise.all([
    db.select({ id: organizationDocuments.id }).from(organizationDocuments).where(and(eq(organizationDocuments.id, documentId), eq(organizationDocuments.orgId, session.orgId), eq(organizationDocuments.active, 1))).limit(1),
    db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.orgId, session.orgId))).limit(1),
  ])
  if (!document[0] || !task[0]) back(formData, destination, { error: 'That document or opportunity is no longer available.' })

  const existing = await db
    .select({ id: organizationDocumentAssignments.id })
    .from(organizationDocumentAssignments)
    .where(and(eq(organizationDocumentAssignments.documentId, documentId), eq(organizationDocumentAssignments.taskId, taskId)))
    .limit(1)
  if (existing[0]) back(formData, destination, { error: 'This document is already attached to that opportunity.' })

  await db.insert(organizationDocumentAssignments).values({
    id: randomUUID(),
    documentId,
    taskId,
    createdAt: Date.now(),
  })
  back(formData, destination, { ok: 'Document attached to the opportunity.' })
}

export async function updateOrganizationDocumentAction(formData: FormData) {
  const session = await requireActor('issuer', 'documents.manage')
  if (!session.orgId) redirect('/issuer')
  const documentId = str(formData, 'documentId')
  const destination = str(formData, 'redirectTo') || `/aesthetic-lab/issuer/documents/${documentId}`
  const title = str(formData, 'title')
  const body = str(formData, 'body')
  const programId = formData.has('programId') ? str(formData, 'programId') || null : undefined
  if (!documentId || !title.trim()) back(formData, destination, { error: 'Document title is required.' })

  const document = await db
    .select({ id: organizationDocuments.id, documentUrl: organizationDocuments.documentUrl })
    .from(organizationDocuments)
    .where(and(eq(organizationDocuments.id, documentId), eq(organizationDocuments.orgId, session.orgId), eq(organizationDocuments.active, 1)))
    .limit(1)
  if (!document[0]) back(formData, destination, { error: 'Document not found.' })
  if (!body.trim() && !document[0].documentUrl) {
    back(formData, destination, { error: 'Keep written guidance or an attached source file.' })
  }
  if (programId !== undefined && !(await programBelongsToOrganization(session.orgId, programId))) {
    back(formData, destination, { error: 'Choose a volunteer program belonging to your organization.' })
  }

  const taskIds = Array.from(new Set(formData.getAll('taskIds').filter((value): value is string => typeof value === 'string' && value.trim().length > 0)))
  if (taskIds.length > 0) {
    const permittedTasks = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.orgId, session.orgId), inArray(tasks.id, taskIds)))
    if (permittedTasks.length !== taskIds.length) {
      back(formData, destination, { error: 'One of the selected opportunities is no longer available to your organization.' })
    }
  }

  const now = Date.now()
  await db.transaction(async (tx) => {
    await tx
      .update(organizationDocuments)
      .set({ title: title.trim(), body: body.trim(), ...(programId !== undefined ? { programId } : {}), updatedAt: now })
      .where(eq(organizationDocuments.id, documentId))
    await tx.delete(organizationDocumentAssignments).where(eq(organizationDocumentAssignments.documentId, documentId))
    if (taskIds.length > 0) {
      await tx.insert(organizationDocumentAssignments).values(taskIds.map((taskId) => ({
        id: randomUUID(),
        documentId,
        taskId,
        createdAt: now,
      })))
    }
  })
  back(formData, destination, { ok: 'Document settings saved.' })
}

export async function saveProfileAction(formData: FormData) {
  const session = await requireActor('issuer', 'profile.manage')
  if (!session.orgId) redirect('/issuer')

  let data: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(str(formData, 'payload') || '{}')
    if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>
  } catch {
    back(formData, '/issuer/profile', { error: 'Could not read the profile data. Please try again.' })
  }

  const published = str(formData, 'published') === 'true'
  const socialsRaw = data.socials
  const socials =
    socialsRaw && typeof socialsRaw === 'object' && !Array.isArray(socialsRaw)
      ? (Object.fromEntries(
          Object.entries(socialsRaw as Record<string, unknown>)
            .filter(([, v]) => typeof v === 'string' && (v as string).trim())
            .map(([k, v]) => [k, v as string]),
        ) as Record<string, string>)
      : {}
  const causes = Array.isArray(data.causes)
    ? (data.causes.filter((c) => typeof c === 'string' && c.trim()) as string[])
    : []
  const s = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : '')
  const onboardingTaskId = typeof data.onboardingTaskId === 'string' && data.onboardingTaskId ? data.onboardingTaskId : null

  const result = await saveProfile({
    orgId: session.orgId,
    actorId: session.sub,
    tagline: s('tagline'),
    mission: s('mission'),
    logoUrl: s('logoUrl'),
    coverUrl: s('coverUrl'),
    website: s('website'),
    contactEmail: s('contactEmail'),
    phone: s('phone'),
    location: s('location'),
    socials,
    causes,
    onboardingTaskId,
    published,
  })

  back(
    formData,
    '/issuer/profile',
    result.ok ? { ok: published ? 'Profile published.' : 'Draft saved.' } : { error: result.error },
  )
}

export async function sendRosterMessageAction(formData: FormData) {
  const session = await requireActor('issuer', 'participants.manage')
  if (!session.orgId) redirect('/issuer')
  const audience = str(formData, 'audience')
  const groupId = audience.startsWith('group:') ? audience.slice('group:'.length) : ''
  const result = await sendRosterMessage({
    orgId: session.orgId,
    actorId: session.sub,
    audience: groupId ? 'group' : 'roster',
    groupId: groupId || undefined,
    allRecipients: str(formData, 'recipientMode') === 'all',
    memberIds: strList(formData, 'memberId'),
    subject: str(formData, 'subject'),
    body: str(formData, 'body'),
  })
  back(
    formData,
    '/issuer/volunteers',
    result.ok
      ? { ok: `Message sent to ${result.recipientCount} volunteer${result.recipientCount === 1 ? '' : 's'}.` }
      : { error: result.error },
  )
}

/** Send a private message to one volunteer, a saved group, or the full roster. */
export async function sendOrganizationMessageAction(formData: FormData) {
  const session = await requireActor('issuer', 'participants.manage')
  if (!session.orgId) redirect('/issuer')
  const recipientKind = str(formData, 'recipientKind')
  const memberIds = strList(formData, 'memberId')
  const groupId = str(formData, 'groupId')
  const result = await sendRosterMessage({
    orgId: session.orgId,
    actorId: session.sub,
    audience: recipientKind === 'group' ? 'group' : 'roster',
    groupId: recipientKind === 'group' ? groupId || undefined : undefined,
    allRecipients: recipientKind === 'roster' || recipientKind === 'group',
    memberIds: recipientKind === 'individual' ? memberIds : [],
    subject: str(formData, 'subject'),
    body: str(formData, 'body'),
  })
  back(
    formData,
    '/aesthetic-lab/issuer/notifications',
    result.ok
      ? { ok: `Message sent to ${result.recipientCount} volunteer${result.recipientCount === 1 ? '' : 's'}.`, pane: 'outbound', message: result.id }
      : { error: result.error },
  )
}

/** Start one temporary chat for a selected upcoming volunteer shift. */
export async function createEventChatAction(formData: FormData) {
  const session = await requireActor('issuer', 'participants.manage')
  if (!session.orgId) redirect('/issuer')
  const result = await createEventChat({
    orgId: session.orgId,
    actorId: session.sub,
    shiftId: str(formData, 'shiftId'),
  })
  back(
    formData,
    '/aesthetic-lab/issuer/notifications',
    result.ok
      ? { ok: 'Event chat created. It will close automatically when the shift ends.' }
      : { error: result.error },
  )
}

export async function postIssuerEventChatMessageAction(formData: FormData) {
  const session = await requireActor('issuer', 'participants.manage')
  if (!session.orgId) redirect('/issuer')
  const chatId = str(formData, 'chatId')
  const result = await postEventChatMessage({
    chatId,
    senderUserId: session.sub,
    issuerOrgId: session.orgId,
    body: str(formData, 'body'),
  })
  back(
    formData,
    `/aesthetic-lab/issuer/notifications/chats/${chatId}`,
    result.ok ? { ok: 'Message sent.' } : { error: result.error },
  )
}

export async function postParticipantEventChatMessageAction(formData: FormData) {
  const session = await requireActor('participant')
  const chatId = str(formData, 'chatId')
  const result = await postEventChatMessage({
    chatId,
    senderUserId: session.sub,
    body: str(formData, 'body'),
  })
  back(
    formData,
    `/aesthetic-lab/chats/${chatId}`,
    result.ok ? { ok: 'Message sent.' } : { error: result.error },
  )
}

/** Persist a participant's live event-chat read position without changing routes. */
export async function markParticipantEventChatReadAction(formData: FormData) {
  const session = await requireActor('participant')
  return markEventChatRead(str(formData, 'chatId'), session.sub)
}

/** Mark a participant inbox item as read without navigating away from Messages. */
export async function markParticipantInboxItemReadAction(formData: FormData) {
  const session = await requireActor('participant')
  const itemId = str(formData, 'itemId')
  if (!itemId) return

  if (str(formData, 'kind') === 'organization-message') {
    await markMessageRead(itemId, session.sub)
  } else {
    await markNotificationRead(itemId, session.sub)
  }
  revalidatePath('/aesthetic-lab/messages')
}

export async function createVolunteerGroupAction(formData: FormData) {
  const session = await requireActor('issuer', 'participants.manage')
  if (!session.orgId) redirect('/issuer')
  const result = await createVolunteerGroup({
    orgId: session.orgId,
    actorId: session.sub,
    name: str(formData, 'name'),
    memberIds: strList(formData, 'memberId'),
  })
  back(
    formData,
    str(formData, 'redirectTo') || '/issuer/volunteers',
    result.ok ? { ok: 'Volunteer grouping created.' } : { error: result.error },
  )
}

export async function updateVolunteerGroupMembersAction(formData: FormData) {
  const session = await requireActor('issuer', 'participants.manage')
  if (!session.orgId) redirect('/issuer')
  const result = await updateVolunteerGroupMembers({
    orgId: session.orgId,
    actorId: session.sub,
    groupId: str(formData, 'groupId'),
    memberIds: strList(formData, 'memberId'),
  })
  back(
    formData,
    '/issuer/volunteers',
    result.ok ? { ok: 'Volunteer grouping updated.' } : { error: result.error },
  )
}

/** Create a one-time public link that adds a Civic Participant to this roster. */
export async function createVolunteerRosterInviteAction(formData: FormData) {
  const session = await requireActor('issuer', 'participants.manage')
  if (!session.orgId) redirect('/aesthetic-lab/issuer/volunteers')
  const result = await createVolunteerRosterInvite({ orgId: session.orgId, actorId: session.sub })
  back(
    formData,
    '/aesthetic-lab/issuer/volunteers',
    result.ok
      ? { rosterInvite: result.code, ok: 'Volunteer invite link created. It expires after 30 days and can be used once.' }
      : { error: result.error },
  )
}

/** Accepting this link only adds a person to a volunteer roster; it grants no staff access. */
export async function acceptVolunteerRosterInviteAction(formData: FormData) {
  const session = await requireActor('participant')
  const code = str(formData, 'code')
  const result = await acceptVolunteerRosterInvite({ userId: session.sub, code })
  if (!result.ok) back(formData, '/volunteer-invite', { error: result.error })
  revalidatePath('/aesthetic-lab/issuer/volunteers')
  revalidatePath('/aesthetic-lab')
  redirect(`${aestheticHomeFor(session.role)}?ok=${encodeURIComponent(result.alreadyMember ? `You are already on ${result.organizationName}'s volunteer roster.` : `You joined ${result.organizationName}'s volunteer roster.`)}`)
}

/**
 * Store an organization-local eligibility outcome after an authorized staff
 * member has completed their own in-person review. We intentionally retain no
 * ID image, date of birth, or guardian document—only the minimum result,
 * verifier, and time required for the organization to operate safely.
 */
export async function setVolunteerEligibilityAction(formData: FormData) {
  const session = await requireActor('issuer', 'participants.manage')
  if (!session.orgId) redirect('/issuer')
  const destination = str(formData, 'redirectTo') || '/aesthetic-lab/issuer/catalog'
  const userId = str(formData, 'userId')
  const status = str(formData, 'eligibility')
  if (!userId || !['pending', 'adult_verified', 'minor_consent_verified'].includes(status)) {
    back(formData, destination, { error: 'Choose a valid participant eligibility status.' })
  }

  const rosterClaim = await db
    .select({ id: claims.id })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .where(and(eq(tasks.orgId, session.orgId), eq(claims.userId, userId)))
    .limit(1)
  if (!rosterClaim[0]) {
    back(formData, destination, { error: 'This participant is not in your organization roster.' })
  }

  const now = Date.now()
  const existing = await db
    .select({ id: volunteerEligibilityRecords.id })
    .from(volunteerEligibilityRecords)
    .where(and(eq(volunteerEligibilityRecords.orgId, session.orgId), eq(volunteerEligibilityRecords.userId, userId)))
    .limit(1)
  const verification = status === 'pending'
    ? { verifiedByUserId: null, verifiedAt: null }
    : { verifiedByUserId: session.sub, verifiedAt: now }

  if (existing[0]) {
    await db
      .update(volunteerEligibilityRecords)
      .set({ status: status as 'pending' | 'adult_verified' | 'minor_consent_verified', ...verification, updatedAt: now })
      .where(eq(volunteerEligibilityRecords.id, existing[0].id))
  } else {
    await db.insert(volunteerEligibilityRecords).values({
      id: randomUUID(),
      orgId: session.orgId,
      userId,
      status: status as 'pending' | 'adult_verified' | 'minor_consent_verified',
      ...verification,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    })
  }
  back(formData, destination, { ok: 'Participant eligibility status saved.' })
}

/**
 * A staff-attested in-person account match. The attestation is intentionally
 * minimal: City/Sync retains only its current/revoked state, staff actor, and
 * timestamp—not an ID image, ID number, birth date, or other source document.
 */
export async function setVolunteerIdentityVerificationAction(formData: FormData) {
  const session = await requireActor('issuer', 'participants.manage')
  if (!session.orgId) redirect('/issuer')
  const destination = str(formData, 'redirectTo') || '/aesthetic-lab/issuer/volunteers'
  const userId = str(formData, 'userId')
  const operation = str(formData, 'operation')
  if (!userId || !['verify', 'revoke'].includes(operation)) {
    back(formData, destination, { error: 'Choose a valid identity verification action.' })
  }
  if (operation === 'verify' && str(formData, 'identityConfirmed') !== 'on') {
    back(formData, destination, { error: 'Confirm the in-person account match before recording it.' })
  }

  const rosterClaim = await db
    .select({ id: claims.id })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .where(and(eq(tasks.orgId, session.orgId), eq(claims.userId, userId)))
    .limit(1)
  if (!rosterClaim[0]) {
    back(formData, destination, { error: 'This participant is not in your organization roster.' })
  }

  const existing = await db
    .select({ id: volunteerIdentityVerifications.id })
    .from(volunteerIdentityVerifications)
    .where(and(eq(volunteerIdentityVerifications.orgId, session.orgId), eq(volunteerIdentityVerifications.userId, userId)))
    .limit(1)
  const now = Date.now()
  if (operation === 'verify') {
    if (existing[0]) {
      await db
        .update(volunteerIdentityVerifications)
        .set({
          status: 'verified',
          verifiedByUserId: session.sub,
          verifiedAt: now,
          revokedByUserId: null,
          revokedAt: null,
          updatedAt: now,
        })
        .where(eq(volunteerIdentityVerifications.id, existing[0].id))
    } else {
      await db.insert(volunteerIdentityVerifications).values({
        id: randomUUID(),
        orgId: session.orgId,
        userId,
        status: 'verified',
        verifiedByUserId: session.sub,
        verifiedAt: now,
        revokedByUserId: null,
        revokedAt: null,
        createdAt: now,
        updatedAt: now,
      })
    }
    back(formData, destination, { ok: 'In-person identity match recorded.' })
  }

  if (!existing[0]) {
    back(formData, destination, { error: 'There is no identity match record to remove.' })
  }
  await db
    .update(volunteerIdentityVerifications)
    .set({ status: 'revoked', revokedByUserId: session.sub, revokedAt: now, updatedAt: now })
    .where(eq(volunteerIdentityVerifications.id, existing[0].id))
  back(formData, destination, { ok: 'In-person identity match removed.' })
}

/** Grant or revoke an organization-local authorization for a task template. */
export async function setVolunteerTaskEligibilityAction(formData: FormData) {
  const session = await requireActor('issuer', 'participants.manage')
  if (!session.orgId) redirect('/issuer')
  const destination = str(formData, 'redirectTo') || '/aesthetic-lab/issuer/volunteers'
  const userId = str(formData, 'userId')
  const operation = str(formData, 'operation')
  if (!userId || !['grant', 'revoke'].includes(operation)) {
    back(formData, destination, { error: 'Choose a valid task eligibility action.' })
  }

  const rosterClaim = await db
    .select({ id: claims.id })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .where(and(eq(tasks.orgId, session.orgId), eq(claims.userId, userId)))
    .limit(1)
  if (!rosterClaim[0]) {
    back(formData, destination, { error: 'This participant is not in your organization roster.' })
  }

  const now = Date.now()
  if (operation === 'grant') {
    const scope = str(formData, 'scope')
    const requestedTaskId = str(formData, 'taskId')
    if (scope !== 'all' && scope !== 'task') {
      back(formData, destination, { error: 'Choose all templates or a specific task template.' })
    }
    const taskId = scope === 'all' ? 'all' : requestedTaskId
    if (scope === 'task') {
      const task = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.orgId, session.orgId)))
        .limit(1)
      if (!task[0]) back(formData, destination, { error: 'That task template is no longer available to your organization.' })
    }
    const existing = await db
      .select({ id: volunteerTaskEligibilityGrants.id })
      .from(volunteerTaskEligibilityGrants)
      .where(and(eq(volunteerTaskEligibilityGrants.orgId, session.orgId), eq(volunteerTaskEligibilityGrants.userId, userId), eq(volunteerTaskEligibilityGrants.taskId, taskId)))
      .limit(1)
    if (existing[0]) {
      await db
        .update(volunteerTaskEligibilityGrants)
        .set({ scope: scope as 'all' | 'task', status: 'active', grantedByUserId: session.sub, grantedAt: now, revokedByUserId: null, revokedAt: null, updatedAt: now })
        .where(eq(volunteerTaskEligibilityGrants.id, existing[0].id))
    } else {
      await db.insert(volunteerTaskEligibilityGrants).values({
        id: randomUUID(),
        orgId: session.orgId,
        userId,
        scope: scope as 'all' | 'task',
        taskId,
        status: 'active',
        grantedByUserId: session.sub,
        grantedAt: now,
        revokedByUserId: null,
        revokedAt: null,
        createdAt: now,
        updatedAt: now,
      })
    }
    back(formData, destination, { ok: scope === 'all' ? 'Eligible for all task templates.' : 'Task template eligibility recorded.' })
  }

  const grantId = str(formData, 'grantId')
  if (!grantId) back(formData, destination, { error: 'Choose an active eligibility record to revoke.' })
  const grant = await db
    .select({ id: volunteerTaskEligibilityGrants.id })
    .from(volunteerTaskEligibilityGrants)
    .where(and(eq(volunteerTaskEligibilityGrants.id, grantId), eq(volunteerTaskEligibilityGrants.orgId, session.orgId), eq(volunteerTaskEligibilityGrants.userId, userId)))
    .limit(1)
  if (!grant[0]) back(formData, destination, { error: 'That eligibility record is no longer available.' })
  await db
    .update(volunteerTaskEligibilityGrants)
    .set({ status: 'revoked', revokedByUserId: session.sub, revokedAt: now, updatedAt: now })
    .where(eq(volunteerTaskEligibilityGrants.id, grant[0].id))
  back(formData, destination, { ok: 'Task template eligibility revoked.' })
}

// ---------------------------------------------------------------------------
// participant
// ---------------------------------------------------------------------------

/**
 * Records an explicit, private electronic waiver signature before a volunteer
 * can reserve a digitally-waivered onboarding session. The typed signing name
 * is intentionally kept out of participant profiles and public/city ledgers.
 */
export async function signWaiverAction(formData: FormData) {
  const session = await requireActor('participant')
  const taskId = str(formData, 'taskId')
  const waiverVersionId = str(formData, 'waiverVersionId')
  const requestedDestination = str(formData, 'redirectTo').trim()
  const destination = requestedDestination.startsWith('/') && !requestedDestination.startsWith('//')
    ? requestedDestination
    : `/participant/opportunities/${taskId}`

  if (!taskId || !waiverVersionId) {
    back(formData, destination, { error: 'The waiver signature request is incomplete.' })
  }

  // A participant may sign only a currently active waiver owned by the
  // organization that issued this opportunity.
  const task = (await db.select({ orgId: tasks.orgId }).from(tasks).where(eq(tasks.id, taskId)).limit(1))[0]
  const waiver = task
    ? (await db
      .select({ id: waiverVersions.id })
      .from(waiverVersions)
      .where(and(eq(waiverVersions.id, waiverVersionId), eq(waiverVersions.orgId, task.orgId), eq(waiverVersions.active, 1)))
      .limit(1))[0]
    : null
  if (!waiver) back(formData, destination, { error: 'That waiver is no longer available for this opportunity.' })

  const result = await signWaiver({
    waiverVersionId,
    userId: session.sub,
    signerName: str(formData, 'signerName'),
    electronicConsent: str(formData, 'electronicConsent') === 'yes',
  })
  back(formData, destination, result.ok
    ? { ok: 'Waiver signed. You can now reserve a session.' }
    : { error: result.error })
}

export async function claimShiftAction(formData: FormData) {
  const session = await requireActor('participant')
  const shiftId = str(formData, 'shiftId')
  const taskId = str(formData, 'taskId') // for redirect back to the opportunity
  const requestedDestination = str(formData, 'redirectTo').trim()
  const dest = requestedDestination.startsWith('/') && !requestedDestination.startsWith('//')
    ? requestedDestination
    : `/participant/opportunities/${taskId}`
  const requestedSuccessDestination = str(formData, 'successRedirectTo').trim()
  const successDestination = requestedSuccessDestination.startsWith('/') && !requestedSuccessDestination.startsWith('//')
    ? requestedSuccessDestination
    : null

  // A reservation is intentionally lightweight, but it must be deliberate.
  // This remains server-enforced so a client cannot reserve a capacity-limited
  // shift without affirming their intent to attend and cancel responsibly.
  if (str(formData, 'attendanceAcknowledgement') !== 'yes') {
    back(formData, dest, { error: 'Please acknowledge your attendance commitment before reserving a spot.' })
  }

  const requestedWaiverMethod = str(formData, 'waiverCollectionMethod') === 'in_person' ? 'in_person' : 'digital'
  const result = await claimShift(shiftId, session.sub, requestedWaiverMethod)
  const task = taskId
    ? (await db.select({ isOnboarding: tasks.isOnboarding }).from(tasks).where(eq(tasks.id, taskId)).limit(1))[0]
    : null
  if (result.ok && successDestination) {
    back(formData, successDestination, { ok: task?.isOnboarding === 1 ? 'Your spot is reserved. Here is everything you need for this session.' : 'You’re signed up for the shift.' }, false)
  }
  back(formData, dest, result.ok
    ? { ok: task?.isOnboarding === 1 ? 'Your spot is reserved.' : 'You’re signed up for the shift.' }
    : { error: result.error })
}

export async function selfCheckInAction(formData: FormData) {
  const session = await requireActor('participant')
  const taskId = str(formData, 'taskId')
  const result = await selfCheckIn(str(formData, 'shiftId'), session.sub, str(formData, 'code'))
  back(
    formData,
    `/participant/opportunities/${taskId}`,
    result.ok ? { ok: 'Checked in — submitted for verification.' } : { error: result.error },
  )
}

export async function markNotificationReadAction(formData: FormData) {
  const session = await requireActor('participant')
  await markNotificationRead(str(formData, 'notificationId'), session.sub)
  back(formData, '/participant/notifications', { ok: 'Notification marked as read.' })
}

/** Organization members can clear their own private insight notices. */
export async function markIssuerNotificationReadAction(formData: FormData) {
  const session = await requireActor('issuer')
  await markNotificationRead(str(formData, 'notificationId'), session.sub)
  back(formData, '/aesthetic-lab/issuer/notifications')
}

export async function markAllNotificationsReadAction(formData: FormData) {
  const session = await requireActor('participant')
  await Promise.all([markNotificationsRead(session.sub), markAllMessagesRead(session.sub)])
  back(formData, '/participant/notifications', { ok: 'All updates marked as read.' })
}

export async function markOrganizationMessageReadAction(formData: FormData) {
  const session = await requireActor('participant')
  await markMessageRead(str(formData, 'messageId'), session.sub)
  back(formData, '/participant/notifications', { ok: 'Message marked as read.' })
}

export async function issuerCheckInAction(formData: FormData) {
  const session = await requireActor('issuer', 'participants.manage')
  if (!session.orgId) redirect('/issuer')
  const result = await issuerCheckIn(str(formData, 'claimId'), session.orgId, session.sub)
  back(formData, '/issuer', result.ok ? { ok: 'Volunteer checked in.' } : { error: result.error })
}

export async function unclaimClaimAction(formData: FormData) {
  const session = await requireActor('participant')
  const result = await unclaimClaim(str(formData, 'claimId'), session.sub, str(formData, 'withdrawalNote'))
  back(formData, '/participant', result.ok ? { ok: 'Sign-up withdrawn.' } : { error: result.error })
}

export async function submitCompletionAction(formData: FormData) {
  const session = await requireActor('participant')
  const result = await submitCompletion(str(formData, 'claimId'), session.sub, str(formData, 'note'))
  back(
    formData,
    '/participant',
    result.ok ? { ok: 'Completion submitted for verification.' } : { error: result.error },
  )
}

/** A verified participant may optionally share one private reflection per shift. */
export async function submitVolunteerReflectionAction(formData: FormData) {
  const session = await requireActor('participant')
  const claimId = str(formData, 'claimId')
  const destination = str(formData, 'redirectTo') || `/aesthetic-lab/reflections/${claimId}`
  const result = await submitVolunteerReflection({
    claimId,
    userId: session.sub,
    shiftNote: str(formData, 'shiftNote'),
    organizationIdea: str(formData, 'organizationIdea'),
  })
  back(formData, destination, result.ok ? { shared: '1' } : { error: result.error })
}

export async function saveInterestsAction(formData: FormData) {
  const session = await requireActor('participant')
  const interests = strList(formData, 'interest')
    .flatMap((s) => s.split(','))
    .map((s) => s.trim())
    .filter(Boolean)
  await setInterests(session.sub, interests)
  await setNeighborhood(session.sub, str(formData, 'neighborhood'))
  back(formData, '/participant/opportunities', { ok: 'Saved.' })
}

export async function setResumePublicAction(formData: FormData) {
  const session = await requireActor('participant')
  const makePublic = str(formData, 'public') === 'true'
  await setResumePublic(session.sub, makePublic)
  back(formData, '/participant', {
    ok: makePublic ? 'Your résumé is now shareable.' : 'Your résumé is now private.',
  })
}

export async function requestRedemptionAction(formData: FormData) {
  const session = await requireActor('participant')
  if (!participantCreditsEnabled()) {
    back(formData, '/participant', { error: 'Civic credit redemptions are not available in this version.' })
  }
  const city = await getActiveCity(session)
  if (!city) back(formData, '/participant/redeem', { error: 'Choose a city before redeeming credits.' })
  const result = await requestRedemption(str(formData, 'offeringId'), session.sub, city.id)
  if (!result.ok) back(formData, '/participant/redeem', { error: result.error })
  back(formData, '/participant/redeem', { code: result.code })
}

export async function cancelRedemptionAction(formData: FormData) {
  const session = await requireActor('participant')
  if (!participantCreditsEnabled()) {
    back(formData, '/participant', { error: 'Civic credit redemptions are not available in this version.' })
  }
  const city = await getActiveCity(session)
  if (!city) back(formData, '/participant/redeem', { error: 'Choose a city before cancelling a redemption.' })
  const result = await cancelRedemption(str(formData, 'redemptionId'), session.sub, city.id)
  back(formData, '/participant/redeem', result.ok ? { ok: 'Redemption cancelled.' } : { error: result.error })
}

// ---------------------------------------------------------------------------
// redeemer
// ---------------------------------------------------------------------------

export async function createOfferingAction(formData: FormData) {
  const session = await requireActor('redeemer', 'offerings.manage')
  if (!session.orgId) redirect('/redeemer')
  const city = await getActiveCity(session)
  if (!city) back(formData, '/redeemer', { error: 'Your organization must be onboarded into a city before it can publish offerings.' })
  const result = await createOffering({
    orgId: session.orgId,
    cityId: city.id,
    actorId: session.sub,
    title: str(formData, 'title'),
    description: str(formData, 'description'),
    cost: int(formData, 'cost'),
  })
  back(formData, '/redeemer', result.ok ? { ok: 'Offering published.' } : { error: result.error })
}

export async function toggleOfferingAction(formData: FormData) {
  const session = await requireActor('redeemer', 'offerings.manage')
  if (!session.orgId) redirect('/redeemer')
  const city = await getActiveCity(session)
  if (!city) back(formData, '/redeemer', { error: 'Choose an organization city first.' })
  const result = await setOfferingActive(
    str(formData, 'offeringId'),
    session.orgId,
    city.id,
    str(formData, 'active') === 'true',
    session.sub,
  )
  back(formData, '/redeemer', result.ok ? { ok: 'Offering updated.' } : { error: result.error })
}

export async function finalizeRedemptionAction(formData: FormData) {
  const session = await requireActor('redeemer', 'offerings.manage')
  if (!session.orgId) redirect('/redeemer')
  const city = await getActiveCity(session)
  if (!city) back(formData, '/redeemer', { error: 'Choose an organization city first.' })
  const result = await finalizeRedemption(str(formData, 'code'), session.orgId, city.id, session.sub)
  back(
    formData,
    '/redeemer',
    result.ok ? { ok: 'Redemption finalized — credits burned.' } : { error: result.error },
  )
}

// ---------------------------------------------------------------------------
// MyCity Feed
// ---------------------------------------------------------------------------

export async function createPostAction(formData: FormData) {
  const session = await requireActor()
  if ((session.role !== 'issuer' && session.role !== 'redeemer') || !session.orgId) {
    back(formData, '/feed', { error: 'Only issuer and redeemer organizations can post.' })
  }
  if (!(await hasOrganizationPermission(session, 'feed.manage'))) {
    back(formData, '/feed', { error: 'Your organization role cannot publish to MyCity Feed.' })
  }
  const suppliedImageUrl = str(formData, 'imageUrl')
  const imageUrl = organizationPostImageUrl(suppliedImageUrl, session.orgId!)
  if (suppliedImageUrl && !imageUrl) {
    back(formData, '/feed', { error: 'That image could not be attached to this post.' })
  }
  const result = await createPost({
    orgId: session.orgId!,
    actorId: session.sub,
    body: str(formData, 'body'),
    imageUrl: imageUrl ?? undefined,
  })
  back(formData, '/feed', result.ok ? { ok: 'Posted to MyCity.' } : { error: result.error })
}

export async function toggleHeartAction(formData: FormData) {
  const session = await requireActor()
  const result = await toggleHeart(str(formData, 'postId'), session.sub)
  if (!result.ok) back(formData, '/feed', { error: result.error })
  back(formData, '/feed')
}

export async function toggleSavedItemAction(formData: FormData) {
  const session = await requireActor()
  const kind = str(formData, 'kind')
  if (kind !== 'post' && kind !== 'task') back(formData, '/aesthetic-lab', { error: 'That item cannot be saved.' })
  const itemId = str(formData, 'itemId')
  if (!itemId) back(formData, '/aesthetic-lab', { error: 'That item could not be saved.' })
  await toggleSavedItem(session.sub, kind as SavedItemKind, itemId)
  back(formData, '/aesthetic-lab')
}

// ---------------------------------------------------------------------------
// admin
// ---------------------------------------------------------------------------

export async function approveOrgAction(formData: FormData) {
  const session = await requireActor('admin')
  const result = await setOrgStatus(str(formData, 'orgId'), 'approved', session.sub, str(formData, 'cityId') || undefined)
  back(formData, '/admin', result.ok ? { ok: 'Organization approved.' } : { error: result.error })
}

export async function suspendOrgAction(formData: FormData) {
  const session = await requireActor('admin')
  const result = await setOrgStatus(str(formData, 'orgId'), 'suspended', session.sub)
  back(formData, '/admin', result.ok ? { ok: 'Organization suspended.' } : { error: result.error })
}

export async function setUserStatusAction(formData: FormData) {
  const session = await requireActor('admin')
  const status = str(formData, 'status') === 'disabled' ? 'disabled' : 'active'
  const result = await setUserStatus(str(formData, 'userId'), status, session.sub)
  back(
    formData,
    '/admin/users',
    result.ok ? { ok: status === 'disabled' ? 'Account disabled.' : 'Account re-enabled.' } : { error: result.error },
  )
}

export async function resetPasswordAction(formData: FormData) {
  const session = await requireActor('admin')
  const result = await resetUserPassword(str(formData, 'userId'), session.sub)
  back(
    formData,
    '/admin/users',
    result.ok
      ? { ok: `Temporary password (share securely, shown once): ${result.tempPassword}` }
      : { error: result.error },
  )
}

export async function adjustCreditsAction(formData: FormData) {
  const session = await requireActor('admin')
  const city = await getActiveCity(session)
  if (!city) back(formData, '/admin/users', { error: 'Choose a city before adjusting city credits.' })
  const result = await adjustCredits(
    str(formData, 'userId'),
    int(formData, 'amount'),
    str(formData, 'reason'),
    session.sub,
    city.id,
  )
  back(formData, '/admin/users', result.ok ? { ok: 'Credits adjusted (ledgered).' } : { error: result.error })
}

export async function removePostAction(formData: FormData) {
  const session = await requireActor('admin')
  const result = await removePost(str(formData, 'postId'), str(formData, 'reason'), session.sub)
  back(formData, '/admin/oversight', result.ok ? { ok: 'Post removed.' } : { error: result.error })
}

export async function adminCloseTaskAction(formData: FormData) {
  const session = await requireActor('admin')
  const result = await adminCloseTask(str(formData, 'taskId'), session.sub)
  back(formData, '/admin/oversight', result.ok ? { ok: 'Opportunity closed.' } : { error: result.error })
}

export async function adminCancelRedemptionAction(formData: FormData) {
  const session = await requireActor('admin')
  const result = await adminCancelRedemption(str(formData, 'redemptionId'), session.sub)
  back(formData, '/admin/oversight', result.ok ? { ok: 'Redemption cancelled.' } : { error: result.error })
}

export async function runRemindersAction(formData: FormData) {
  await requireActor('admin')
  const res = await processDueReminders()
  back(formData, '/admin/oversight', {
    ok: `Reminders processed — ${res.sent} delivered${res.failed ? `, ${res.failed} failed (will retry)` : ''}${res.noShows ? `; ${res.noShows} no-show${res.noShows === 1 ? '' : 's'} recorded` : ''}${res.barred ? `; ${res.barred} city restriction${res.barred === 1 ? '' : 's'} applied` : ''}.`,
  })
}

export async function createAnchorAction(formData: FormData) {
  const session = await requireActor('admin')
  const city = await getActiveCity(session)
  if (!city) back(formData, '/admin/ledger', { error: 'Choose a city before creating its anchor.' })
  const result = await createCityAnchor(city.id, session.sub)
  back(
    formData,
    '/admin/ledger',
    result.ok
      ? { ok: `Anchored ${result.count} events (seq ${result.fromSeq}–${result.toSeq}).` }
      : { error: result.error },
  )
}
