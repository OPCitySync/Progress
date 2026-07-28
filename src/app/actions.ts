'use server'

import { createHash, randomUUID } from 'crypto'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { verifyPassword } from '@/lib/auth/password'
import { createSession, clearSession, getSession, homeFor, type Session } from '@/lib/auth/session'
import { participantCreditsEnabled } from '@/lib/config'
import { registerParticipant, registerOrg, setOrgStatus, updateAccountIdentity } from '@/lib/services/identity'
import {
  createTask,
  createShift,
  closeTask,
  reopenTask,
  closeShift,
  claimShift,
  unclaimClaim,
  submitCompletion,
  verifyCompletion,
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
import { createWaiverVersion, acceptWaiver } from '@/lib/services/waivers'
import {
  ALLOWED_WAIVER_DOCUMENT_TYPES,
  getStorageAdapter,
  MAX_WAIVER_DOCUMENT_BYTES,
} from '@/lib/storage/storage'
import { saveProfile } from '@/lib/services/profile'
import { createRecurringOnboardingSession } from '@/lib/services/onboarding-session'
import { processDueReminders } from '@/lib/services/notifications'
import {
  createOffering,
  setOfferingActive,
  requestRedemption,
  finalizeRedemption,
  cancelRedemption,
} from '@/lib/services/redemption'
import { createCityAnchor } from '@/lib/protocol/city-anchor'
import { createPost, toggleHeart } from '@/lib/services/feed'
import { createVolunteerGroup, sendRosterMessage, updateVolunteerGroupMembers } from '@/lib/services/roster'
import { getActiveCity, joinCityNetwork, setActiveCity } from '@/lib/services/city-networks'
import { participantDisplayName } from '@/lib/participant-name'
import {
  acceptOrganizationInvite,
  createOrganizationRole,
  createOrganizationInvite,
  defaultSessionForUser,
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
  await createSession(session)
  redirect(safeNext(formData) ?? homeFor(session.role))
}

export async function signUpAction(formData: FormData) {
  const kind = str(formData, 'kind')
  const name = str(formData, 'name')
  const email = str(formData, 'email')
  const password = str(formData, 'password')

  if (kind === 'participant') {
    const result = await registerParticipant({ name, email, password, homeCityId: str(formData, 'cityId') })
    if (!result.ok) back(formData, '/signup', { error: result.error })
    const session = await defaultSessionForUser(result.userId)
    if (!session) back(formData, '/signup', { error: 'We could not provision your participant identity.' })
    await createSession(session)
    redirect(safeNext(formData) ?? '/participant')
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
    redirect(session.role === 'issuer' ? '/issuer' : '/redeemer')
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
  if (!next) back(formData, homeFor(current.role), { error: 'That identity is not available to this account.' })
  await createSession(next)
  const destination = str(formData, 'redirectTo')
  redirect(destination.startsWith('/') && !destination.startsWith('//') ? destination : homeFor(next.role))
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
  const result = await acceptOrganizationInvite({ userId: session.sub, code: str(formData, 'code') })
  if (!result.ok) back(formData, '/invite', { error: result.error })
  const next = await sessionForIdentity(session.sub, result.identityId)
  if (!next) back(formData, '/invite', { error: 'The authority was created, but could not be activated.' })
  await createSession(next)
  redirect(next.role === 'issuer' ? '/issuer' : '/redeemer')
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
      : `You added ${result.cityName}. Complete an onboarding task there to become an Active Participant.`,
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

export async function createTaskAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const city = await getActiveCity(session)
  if (!city) back(formData, '/issuer/tasks/new', { error: 'Your organization must be onboarded into a city before it can publish opportunities.' })
  const capacity = int(formData, 'capacity')
  const label = str(formData, 'shiftLabel')
  const task = await createTask({
    orgId: session.orgId,
    cityId: city.id,
    actorId: session.sub,
    title: str(formData, 'title'),
    description: str(formData, 'description'),
    location: str(formData, 'location'),
    credits: int(formData, 'credits'),
    slots: Number.isInteger(capacity) && capacity > 0 ? capacity : 1,
    startsAt: label,
    requiredCredentials: strList(formData, 'cred'),
  })
  if (!task.ok) back(formData, '/issuer/tasks/new', { error: task.error })
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
  // Alert participants whose interests match this org's causes (best-effort).
  await notifyMatchingParticipants(task.id)
  back(formData, `/issuer/tasks/${task.id}`, { ok: 'Opportunity published with its first shift.' })
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
  back(formData, '/issuer', result.ok ? { ok: 'Shift added.' } : { error: result.error })
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
    credits: int(formData, 'credits'),
    firstStartsAt: parseDateTime(formData, 'firstStartsAt'),
    durationMinutes: int(formData, 'durationMinutes'),
    weeklyCapacity: int(formData, 'weeklyCapacity'),
  })
  if (result.ok) await notifyMatchingParticipants(result.taskId)
  back(formData, '/issuer/catalog', result.ok ? { ok: 'Public recurring onboarding session created.' } : { error: result.error })
}

export async function closeShiftAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const result = await closeShift(str(formData, 'shiftId'), session.orgId, session.sub)
  back(formData, '/issuer', result.ok ? { ok: 'Shift closed.' } : { error: result.error })
}

export async function closeTaskAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const result = await closeTask(str(formData, 'taskId'), session.orgId, session.sub)
  back(formData, '/issuer', result.ok ? { ok: 'Opportunity closed.' } : { error: result.error })
}

export async function reopenTaskAction(formData: FormData) {
  const session = await requireActor('issuer', 'opportunities.manage')
  if (!session.orgId) redirect('/issuer')
  const result = await reopenTask(str(formData, 'taskId'), session.orgId, session.sub)
  back(formData, '/issuer', result.ok ? { ok: 'Opportunity reactivated.' } : { error: result.error })
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
  const result = await verifyCompletion(str(formData, 'claimId'), session.orgId, session.sub)
  back(formData, '/issuer', result.ok ? { ok: 'Completion verified — credits minted.' } : { error: result.error })
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
  const title = str(formData, 'title')
  const body = str(formData, 'body')
  if (!title.trim() || !body.trim()) {
    back(formData, '/issuer/waiver', { error: 'Waiver title and text are required.' })
  }

  let document:
    | { url: string; name: string; mimeType: string; sha256: string }
    | undefined
  const file = formData.get('document')
  if (file instanceof File && file.size > 0) {
    const ext = ALLOWED_WAIVER_DOCUMENT_TYPES[file.type]
    if (!ext) {
      back(formData, '/issuer/waiver', { error: 'Upload a PDF, DOC, or DOCX waiver document.' })
    }
    if (file.size > MAX_WAIVER_DOCUMENT_BYTES) {
      back(formData, '/issuer/waiver', { error: 'Waiver documents must be 10 MB or smaller.' })
    }
    try {
      const bytes = Buffer.from(await file.arrayBuffer())
      const stored = await getStorageAdapter().put({
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
      back(formData, '/issuer/waiver', { error: 'Could not upload the waiver document. Please try again.' })
    }
  }

  const result = await createWaiverVersion({
    orgId: session.orgId,
    actorId: session.sub,
    title,
    body,
    document,
  })
  if (!result.ok) back(formData, '/issuer/waiver', { error: result.error })
  back(formData, '/issuer/waiver', { ok: `Waiver v${result.version} is now active.` })
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
    '/issuer/volunteers',
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

// ---------------------------------------------------------------------------
// participant
// ---------------------------------------------------------------------------

export async function claimShiftAction(formData: FormData) {
  const session = await requireActor('participant')
  const shiftId = str(formData, 'shiftId')
  const taskId = str(formData, 'taskId') // for redirect back to the opportunity
  const dest = `/participant/opportunities/${taskId}`

  // If the claim form included a waiver acceptance, record it first.
  const waiverVersionId = str(formData, 'acceptWaiverVersionId')
  if (waiverVersionId) {
    if (str(formData, 'waiverAgree') !== 'on') {
      back(formData, dest, { error: 'You must check the box to accept the liability waiver.' })
    }
    const accepted = await acceptWaiver({ waiverVersionId, userId: session.sub })
    if (!accepted.ok) back(formData, dest, { error: accepted.error })
  }

  const result = await claimShift(shiftId, session.sub)
  back(formData, dest, result.ok ? { ok: 'You’re signed up for the shift.' } : { error: result.error })
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

export async function issuerCheckInAction(formData: FormData) {
  const session = await requireActor('issuer', 'participants.manage')
  if (!session.orgId) redirect('/issuer')
  const result = await issuerCheckIn(str(formData, 'claimId'), session.orgId, session.sub)
  back(formData, '/issuer', result.ok ? { ok: 'Volunteer checked in.' } : { error: result.error })
}

export async function unclaimClaimAction(formData: FormData) {
  const session = await requireActor('participant')
  const result = await unclaimClaim(str(formData, 'claimId'), session.sub)
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
  const result = await createPost({
    orgId: session.orgId!,
    actorId: session.sub,
    body: str(formData, 'body'),
  })
  back(formData, '/feed', result.ok ? { ok: 'Posted to MyCity.' } : { error: result.error })
}

export async function toggleHeartAction(formData: FormData) {
  const session = await requireActor('participant')
  const result = await toggleHeart(str(formData, 'postId'), session.sub)
  if (!result.ok) back(formData, '/feed', { error: result.error })
  back(formData, '/feed')
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
