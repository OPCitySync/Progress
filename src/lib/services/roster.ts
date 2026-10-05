import { createHash, randomBytes, randomUUID } from 'crypto'
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  claims,
  tasks,
  users,
  orgs,
  waiverAcceptances,
  orgMessages,
  messageRecipients,
  organizationDelegations,
  volunteerGroups,
  volunteerGroupMembers,
  volunteerRosterInvites,
  volunteerRosterMembers,
  programApplicants,
  programWorkspaceSettings,
  onboardingIntakes,
  volunteerAdmissionDecisions,
} from '@/lib/db/schema'
import { getActiveWaivers } from './waivers'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import type { Result } from './identity'
import { participantDisplayName } from '@/lib/participant-name'

/**
 * Volunteer roster + communication for issuer organizations.
 * Ported from the CS1 issuer workspace concept, rebuilt on real data:
 * the roster is everyone who has ever claimed one of the org's opportunities,
 * with status derived from live claim/waiver state instead of mock labels.
 */

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

export type RosterStatus = 'active' | 'committed' | 'needs-waiver' | 'inactive'

export type RosterVolunteer = {
  userId: string
  name: string
  email: string
  status: RosterStatus
  completedCount: number
  creditsEarned: number
  lastActivity: number
  activeClaims: number
  completedTaskIds: string[]
  waiverCurrent: boolean
}

export type Roster = {
  volunteers: RosterVolunteer[]
  taskGroups: { taskId: string; title: string; volunteers: RosterVolunteer[] }[]
  counts: { total: number; active: number; needsWaiver: number }
}

export type VolunteerGroup = {
  id: string
  name: string
  memberIds: string[]
  createdAt: number
  updatedAt: number
}

export type VolunteerRosterInvite = {
  organizationName: string
  expiresAt: number
}

function hashVolunteerRosterInviteCode(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

export async function getRoster(orgId: string, query?: string): Promise<Roster> {
  const [rows, explicitMembers, activeStaff, applicants, intakes, admissions] = await Promise.all([
    db
      .select({ claim: claims, task: tasks, volunteer: users })
      .from(claims)
      .innerJoin(tasks, eq(claims.taskId, tasks.id))
      .innerJoin(users, eq(claims.userId, users.id))
      .where(eq(tasks.orgId, orgId))
      .orderBy(desc(claims.updatedAt)),
    db
      .select({ member: volunteerRosterMembers, volunteer: users })
      .from(volunteerRosterMembers)
      .innerJoin(users, eq(volunteerRosterMembers.userId, users.id))
      .where(eq(volunteerRosterMembers.orgId, orgId)),
    db
      .select({ userId: organizationDelegations.userId })
      .from(organizationDelegations)
      .where(and(
        eq(organizationDelegations.orgId, orgId),
        eq(organizationDelegations.status, 'active'),
      )),
    db.select().from(programApplicants).where(eq(programApplicants.orgId,orgId)),
    db.select({ createdAt: onboardingIntakes.createdAt }).from(onboardingIntakes)
      .innerJoin(tasks, eq(onboardingIntakes.taskId, tasks.id))
      .where(and(eq(onboardingIntakes.orgId,orgId), eq(tasks.isOnboarding,1)))
      .orderBy(asc(onboardingIntakes.createdAt)),
    db.select().from(volunteerAdmissionDecisions).where(eq(volunteerAdmissionDecisions.orgId,orgId)),
  ])
  const staffUserIds = new Set(activeStaff.map(({ userId }) => userId))
  const pendingUserIds=new Set(applicants.filter(a=>a.status!=='approved').map(a=>a.userId))
  const approvedUserIds=new Set(applicants.filter(a=>a.status==='approved').map(a=>a.userId))
  for(const admission of admissions) if(admission.status==='approved') approvedUserIds.add(admission.userId)
  const restrictedUserIds=new Set(admissions.filter(a=>a.status!=='approved').map(a=>a.userId))
  const intakeBeganAt=intakes[0]?.createdAt
  const establishedUsers=new Set(rows.filter(r=>intakeBeganAt && r.claim.createdAt<intakeBeganAt && ['claimed','submitted','verified'].includes(r.claim.status)).map(r=>r.volunteer.id))

  const waivers = await getActiveWaivers(orgId)
  const acceptedSet = new Set<string>()
  if (waivers.length > 0) {
    const acceptances = await db
      .select({ userId: waiverAcceptances.userId, waiverVersionId: waiverAcceptances.waiverVersionId })
      .from(waiverAcceptances)
      .where(and(
        inArray(waiverAcceptances.waiverVersionId, waivers.map((waiver) => waiver.id)),
        eq(waiverAcceptances.signatureMethod, 'typed_electronic'),
      ))
    const acceptedByUser = new Map<string, Set<string>>()
    for (const admission of admissions) {
      try { acceptedByUser.set(admission.userId, new Set<string>(JSON.parse(admission.paperWaiverIds))) } catch {}
    }
    for (const acceptance of acceptances) {
      const set = acceptedByUser.get(acceptance.userId) ?? new Set<string>()
      set.add(acceptance.waiverVersionId)
      acceptedByUser.set(acceptance.userId, set)
    }
    // Program welcome receipts are version-specific staff attestations too.
    for (const application of applicants) {
      if (!application.paperWaiverConfirmedAt) continue
      let ids: unknown
      try { ids = JSON.parse(application.paperWaiverIds) } catch { continue }
      if (!Array.isArray(ids)) continue
      const accepted = acceptedByUser.get(application.userId) ?? new Set<string>()
      for (const id of ids) if (typeof id === 'string') accepted.add(id)
      acceptedByUser.set(application.userId, accepted)
    }

    // Paper waivers are not a participant click-through. A participant is
    // current only after an authorized organization representative records
    // receipt on the related onboarding claim.
    const paperWaiverConfirmations = await db
      .select({ userId: claims.userId })
      .from(claims)
      .innerJoin(tasks, eq(claims.taskId, tasks.id))
      .where(and(
        eq(tasks.orgId, orgId),
        eq(claims.waiverCollectionMethod, 'in_person'),
        isNotNull(claims.paperWaiverConfirmedAt),
      ))
    for (const confirmation of paperWaiverConfirmations) acceptedSet.add(confirmation.userId)
    for (const [userId, acceptedWaiverIds] of Array.from(acceptedByUser.entries())) {
      if (waivers.every((waiver) => acceptedWaiverIds.has(waiver.id))) acceptedSet.add(userId)
    }
  }

  const byUser = new Map<string, RosterVolunteer>()
  for (const { member, volunteer } of explicitMembers) {
    if (staffUserIds.has(volunteer.id) || restrictedUserIds.has(volunteer.id)) continue
    byUser.set(volunteer.id, {
      userId: volunteer.id,
      name: participantDisplayName(volunteer),
      email: volunteer.email,
      status: 'inactive',
      completedCount: 0,
      creditsEarned: 0,
      lastActivity: member.joinedAt,
      activeClaims: 0,
      completedTaskIds: [],
      waiverCurrent: waivers.length === 0 || acceptedSet.has(volunteer.id),
    })
  }
  for (const { claim, task, volunteer } of rows) {
    if (claim.status === 'unclaimed' || staffUserIds.has(volunteer.id) || restrictedUserIds.has(volunteer.id)) continue
    if (intakeBeganAt && !establishedUsers.has(volunteer.id) && !approvedUserIds.has(volunteer.id) && !byUser.has(volunteer.id)) continue
    if(task.isOnboarding===1&&pendingUserIds.has(volunteer.id)&&!approvedUserIds.has(volunteer.id)&&!byUser.has(volunteer.id))continue
    let v = byUser.get(volunteer.id)
    if (!v) {
      v = {
        userId: volunteer.id,
        name: participantDisplayName(volunteer),
        email: volunteer.email,
        status: 'inactive',
        completedCount: 0,
        creditsEarned: 0,
        lastActivity: 0,
        activeClaims: 0,
        completedTaskIds: [],
        waiverCurrent: waivers.length === 0 || acceptedSet.has(volunteer.id),
      }
      byUser.set(volunteer.id, v)
    }
    v.lastActivity = Math.max(v.lastActivity, claim.updatedAt)
    if (claim.status === 'verified') {
      v.completedCount += 1
      v.creditsEarned += task.credits
      if (!v.completedTaskIds.includes(task.id)) v.completedTaskIds.push(task.id)
    }
    if (claim.status === 'claimed' || claim.status === 'submitted') v.activeClaims += 1
  }

  const all = Array.from(byUser.values())
  const now = Date.now()
  for (const v of all) {
    if (!v.waiverCurrent) v.status = 'needs-waiver'
    else if (v.activeClaims > 0) v.status = 'committed'
    else if (v.completedCount > 0 && now - v.lastActivity < THIRTY_DAYS) v.status = 'active'
    else v.status = 'inactive'
  }

  let volunteers = all.slice().sort((a, b) => b.lastActivity - a.lastActivity)
  if (query?.trim()) {
    const q = query.trim().toLowerCase()
    volunteers = volunteers.filter((v) =>
      [v.name, v.email, v.status].join(' ').toLowerCase().includes(q),
    )
  }

  const orgTasks = await db
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(eq(tasks.orgId, orgId))
    .orderBy(desc(tasks.createdAt))

  const taskGroups = orgTasks
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      volunteers: volunteers.filter((v) => v.completedTaskIds.includes(t.id)),
    }))
    .filter((g) => g.volunteers.length > 0)

  return {
    volunteers,
    taskGroups,
    counts: {
      total: all.length,
      active: all.filter((v) => v.status === 'active' || v.status === 'committed').length,
      needsWaiver: all.filter((v) => v.status === 'needs-waiver').length,
    },
  }
}

/** Create a single-use link that adds a Civic Participant to this roster. */
export async function createVolunteerRosterInvite(input: {
  orgId: string
  actorId: string
}): Promise<Result<{ code: string; expiresAt: number }>> {
  const organization = (await db.select({ id: orgs.id }).from(orgs).where(eq(orgs.id, input.orgId)).limit(1))[0]
  if (!organization) return { ok: false, error: 'This organization is no longer available.' }

  const now = Date.now()
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000
  const code = `CS-VOL-${randomBytes(18).toString('base64url')}`

  await db.transaction(async (tx) => {
    await tx.insert(volunteerRosterInvites).values({
      id: randomUUID(),
      orgId: input.orgId,
      codeHash: hashVolunteerRosterInviteCode(code),
      issuedByUserId: input.actorId,
      expiresAt,
      acceptedByUserId: null,
      acceptedAt: null,
      revokedAt: null,
      createdAt: now,
    })
    await appendEvent(
      tx,
      EventTypes.VOLUNTEER_ROSTER_INVITE_CREATED,
      { orgId: input.orgId, expiresAt },
      input.actorId,
    )
  })

  return { ok: true, code, expiresAt }
}

/** Read the safe, public metadata needed to explain a roster invite. */
export async function getVolunteerRosterInvite(code: string): Promise<VolunteerRosterInvite | null> {
  const cleanCode = code.trim()
  if (!cleanCode) return null
  const row = (
    await db
      .select({ invite: volunteerRosterInvites, organizationName: orgs.name })
      .from(volunteerRosterInvites)
      .innerJoin(orgs, eq(volunteerRosterInvites.orgId, orgs.id))
      .where(eq(volunteerRosterInvites.codeHash, hashVolunteerRosterInviteCode(cleanCode)))
      .limit(1)
  )[0]
  if (!row || row.invite.revokedAt || row.invite.acceptedAt || row.invite.expiresAt <= Date.now()) return null
  return { organizationName: row.organizationName, expiresAt: row.invite.expiresAt }
}

/** Redeem a roster invite. It never grants organization authority or access. */
export async function acceptVolunteerRosterInvite(input: {
  userId: string
  code: string
}): Promise<Result<{ organizationName: string; alreadyMember: boolean; next?:string }>> {
  const cleanCode = input.code.trim()
  if (!cleanCode) return { ok: false, error: 'That volunteer invitation is missing its code.' }

  const recipient = (await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1))[0]
  if (!recipient) return { ok: false, error: 'Your Civic Participant account is no longer available.' }

  const result = await db.transaction(async (tx) => {
    const fresh = (
      await tx
        .select({ invite: volunteerRosterInvites, organizationName: orgs.name })
        .from(volunteerRosterInvites)
        .innerJoin(orgs, eq(volunteerRosterInvites.orgId, orgs.id))
        .where(eq(volunteerRosterInvites.codeHash, hashVolunteerRosterInviteCode(cleanCode)))
        .limit(1)
    )[0]
    if (!fresh || fresh.invite.revokedAt || fresh.invite.expiresAt <= Date.now()) return { state: 'invalid' as const }
    if (fresh.invite.acceptedAt) {
      return fresh.invite.acceptedByUserId === input.userId
        ? { state: 'already-accepted' as const, organizationName: fresh.organizationName }
        : { state: 'unavailable' as const }
    }

    const staffAccess = (
      await tx
        .select({ id: organizationDelegations.id })
        .from(organizationDelegations)
        .where(and(
          eq(organizationDelegations.orgId, fresh.invite.orgId),
          eq(organizationDelegations.userId, input.userId),
          eq(organizationDelegations.status, 'active'),
        ))
        .limit(1)
    )[0]
    if (staffAccess) return { state: 'staff' as const }

    const existing = (
      await tx
        .select({ id: volunteerRosterMembers.id })
        .from(volunteerRosterMembers)
        .where(and(eq(volunteerRosterMembers.orgId, fresh.invite.orgId), eq(volunteerRosterMembers.userId, input.userId)))
        .limit(1)
    )[0]
    const now = Date.now()
    const welcome=(await tx.select().from(programWorkspaceSettings).where(and(eq(programWorkspaceSettings.orgId,fresh.invite.orgId),eq(programWorkspaceSettings.scope,'organization'),eq(programWorkspaceSettings.onboardingMode,'program'))).limit(1))[0]
    if(welcome&&!existing){
      await (await import('./program-workspace')).registerProgramCandidate(tx,fresh.invite.orgId,'organization',input.userId)
    } else if (!existing) {
      await tx.insert(volunteerRosterMembers).values({
        id: randomUUID(),
        orgId: fresh.invite.orgId,
        userId: input.userId,
        source: 'invite',
        invitedByUserId: fresh.invite.issuedByUserId,
        joinedAt: now,
      })
    }
    await tx
      .update(volunteerRosterInvites)
      .set({ acceptedByUserId: input.userId, acceptedAt: now })
      .where(eq(volunteerRosterInvites.id, fresh.invite.id))
    await appendEvent(
      tx,
      EventTypes.VOLUNTEER_ROSTER_INVITE_ACCEPTED,
      { orgId: fresh.invite.orgId, userId: input.userId, alreadyMember: Boolean(existing) },
      input.userId,
    )
    return { state: existing ? 'already-member' as const : 'joined' as const, organizationName: fresh.organizationName, next:welcome&&!existing?'/aesthetic-lab/onboarding/'+fresh.invite.orgId+'/organization':undefined }
  })

  if (result.state === 'invalid') return { ok: false, error: 'That volunteer invitation is invalid, expired, or has been revoked.' }
  if (result.state === 'unavailable') return { ok: false, error: 'That volunteer invitation has already been used.' }
  if (result.state === 'staff') return { ok: false, error: 'Staff members cannot join the volunteer roster for the same organization. Organization access takes priority.' }
  return { ok: true, organizationName: result.organizationName, alreadyMember: result.state !== 'joined', next:'next' in result?result.next:undefined }
}

/** Organization-defined volunteer groupings and their current membership. */
export async function getVolunteerGroups(orgId: string): Promise<VolunteerGroup[]> {
  const [groups, activeStaff] = await Promise.all([
    db
      .select()
      .from(volunteerGroups)
      .where(eq(volunteerGroups.orgId, orgId))
      .orderBy(asc(volunteerGroups.name)),
    db
      .select({ userId: organizationDelegations.userId })
      .from(organizationDelegations)
      .where(and(
        eq(organizationDelegations.orgId, orgId),
        eq(organizationDelegations.status, 'active'),
      )),
  ])

  if (groups.length === 0) return []

  const members = await db
    .select({ groupId: volunteerGroupMembers.groupId, userId: volunteerGroupMembers.userId })
    .from(volunteerGroupMembers)
  const membersByGroup = new Map<string, string[]>()
  const staffUserIds = new Set(activeStaff.map(({ userId }) => userId))
  for (const member of members) {
    if (staffUserIds.has(member.userId)) continue
    const list = membersByGroup.get(member.groupId) ?? []
    list.push(member.userId)
    membersByGroup.set(member.groupId, list)
  }

  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    memberIds: membersByGroup.get(group.id) ?? [],
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  }))
}

function normalizeGroupName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

async function eligibleRosterMemberIds(orgId: string, memberIds: string[]) {
  const roster = await getRoster(orgId)
  const eligible = new Set(roster.volunteers.map((volunteer) => volunteer.userId))
  return Array.from(new Set(memberIds)).filter((id) => eligible.has(id))
}

/** Create an issuer-owned grouping. Members are restricted to that issuer's roster. */
export async function createVolunteerGroup(input: {
  orgId: string
  actorId: string
  name: string
  memberIds: string[]
}): Promise<Result<{ id: string }>> {
  const name = normalizeGroupName(input.name)
  if (!name) return { ok: false, error: 'Give the grouping a name.' }
  if (name.length > 80) return { ok: false, error: 'Grouping names are limited to 80 characters.' }

  const duplicate = (
    await db
      .select({ id: volunteerGroups.id })
      .from(volunteerGroups)
      .where(and(eq(volunteerGroups.orgId, input.orgId), sql`lower(${volunteerGroups.name}) = lower(${name})`))
      .limit(1)
  )[0]
  if (duplicate) return { ok: false, error: 'A grouping with that name already exists.' }

  const memberIds = await eligibleRosterMemberIds(input.orgId, input.memberIds)
  const id = randomUUID()
  const now = Date.now()

  await db.transaction(async (tx) => {
    await tx.insert(volunteerGroups).values({
      id,
      orgId: input.orgId,
      name,
      createdByUserId: input.actorId,
      createdAt: now,
      updatedAt: now,
    })
    if (memberIds.length > 0) {
      await tx.insert(volunteerGroupMembers).values(
        memberIds.map((userId) => ({ id: randomUUID(), groupId: id, userId, createdAt: now })),
      )
    }
    await appendEvent(
      tx,
      EventTypes.VOLUNTEER_GROUP_CREATED,
      { groupId: id, orgId: input.orgId, name, memberCount: memberIds.length },
      input.actorId,
    )
  })

  return { ok: true, id }
}

/** Replace a grouping's member list with the issuer-selected roster members. */
export async function updateVolunteerGroupMembers(input: {
  orgId: string
  actorId: string
  groupId: string
  memberIds: string[]
}): Promise<Result> {
  const group = (
    await db
      .select({ id: volunteerGroups.id, name: volunteerGroups.name })
      .from(volunteerGroups)
      .where(and(eq(volunteerGroups.id, input.groupId), eq(volunteerGroups.orgId, input.orgId)))
      .limit(1)
  )[0]
  if (!group) return { ok: false, error: 'That grouping could not be found.' }

  const memberIds = await eligibleRosterMemberIds(input.orgId, input.memberIds)
  const now = Date.now()
  await db.transaction(async (tx) => {
    await tx.delete(volunteerGroupMembers).where(eq(volunteerGroupMembers.groupId, group.id))
    if (memberIds.length > 0) {
      await tx.insert(volunteerGroupMembers).values(
        memberIds.map((userId) => ({ id: randomUUID(), groupId: group.id, userId, createdAt: now })),
      )
    }
    await tx.update(volunteerGroups).set({ updatedAt: now }).where(eq(volunteerGroups.id, group.id))
    await appendEvent(
      tx,
      EventTypes.VOLUNTEER_GROUP_MEMBERS_UPDATED,
      { groupId: group.id, orgId: input.orgId, name: group.name, memberCount: memberIds.length },
      input.actorId,
    )
  })

  return { ok: true }
}

/**
 * Send an in-app message to the full roster or one saved grouping. The issuer
 * can include every person in that audience or choose a smaller subset.
 * Recipients are resolved and frozen at send time.
 */
export async function sendRosterMessage(input: {
  orgId: string
  actorId: string
  audience: 'roster' | 'group'
  groupId?: string
  allRecipients: boolean
  memberIds?: string[]
  subject: string
  body: string
}): Promise<Result<{ id: string; recipientCount: number }>> {
  const subject = input.subject.trim()
  const body = input.body.trim()
  if (!subject || !body) return { ok: false, error: 'Subject and message are required.' }
  if (body.length > 5000) return { ok: false, error: 'Messages are limited to 5,000 characters.' }

  const org = (await db.select().from(orgs).where(eq(orgs.id, input.orgId)).limit(1))[0]
  if (!org || org.status !== 'approved') {
    return { ok: false, error: 'Your organization must be active to send messages.' }
  }

  const roster = await getRoster(input.orgId)
  let audienceVolunteers = roster.volunteers
  if (input.audience === 'group') {
    if (!input.groupId) return { ok: false, error: 'Choose a volunteer grouping.' }
    const group = (
      await db
        .select({ id: volunteerGroups.id })
        .from(volunteerGroups)
        .where(and(eq(volunteerGroups.id, input.groupId), eq(volunteerGroups.orgId, input.orgId)))
        .limit(1)
    )[0]
    if (!group) return { ok: false, error: 'That volunteer grouping could not be found.' }
    const members = await db
      .select({ userId: volunteerGroupMembers.userId })
      .from(volunteerGroupMembers)
      .where(eq(volunteerGroupMembers.groupId, group.id))
    const memberIds = new Set(members.map((member) => member.userId))
    audienceVolunteers = roster.volunteers.filter((volunteer) => memberIds.has(volunteer.userId))
  }
  const selectedIds = new Set(input.memberIds ?? [])
  const recipients = input.allRecipients
    ? audienceVolunteers
    : audienceVolunteers.filter((volunteer) => selectedIds.has(volunteer.userId))

  if (recipients.length === 0) {
    return { ok: false, error: 'Choose at least one volunteer to message.' }
  }

  const id = randomUUID()
  const now = Date.now()
  const scope = input.allRecipients ? input.audience : 'members'

  await db.transaction(async (tx) => {
    await tx.insert(orgMessages).values({
      id,
      orgId: input.orgId,
      senderUserId: input.actorId,
      scope,
      taskId: null,
      groupId: input.audience === 'group' ? input.groupId! : null,
      subject,
      body,
      recipientCount: recipients.length,
      createdAt: now,
    })
    await tx.insert(messageRecipients).values(
      recipients.map((r) => ({
        id: randomUUID(),
        messageId: id,
        userId: r.userId,
        readAt: null,
        createdAt: now,
      })),
    )
    await appendEvent(
      tx,
      EventTypes.MESSAGE_SENT,
      {
        messageId: id,
        orgId: input.orgId,
        scope,
        groupId: input.audience === 'group' ? input.groupId : undefined,
        selectedMemberIds: scope === 'members' ? recipients.map((recipient) => recipient.userId) : undefined,
        subject,
        recipientCount: recipients.length,
      },
      input.actorId,
    )
  })

  return { ok: true, id, recipientCount: recipients.length }
}

export async function getMessagesForUser(userId: string, limit = 20) {
  const rows = await db
    .select({ recipient: messageRecipients, message: orgMessages, org: orgs })
    .from(messageRecipients)
    .innerJoin(orgMessages, eq(messageRecipients.messageId, orgMessages.id))
    .innerJoin(orgs, eq(orgMessages.orgId, orgs.id))
    .where(eq(messageRecipients.userId, userId))
    .orderBy(desc(orgMessages.createdAt))
    .limit(limit)

  return rows.map((r) => ({
    id: r.message.id,
    orgName: r.org.name,
    subject: r.message.subject,
    body: r.message.body,
    createdAt: r.message.createdAt,
    unread: r.recipient.readAt === null,
  }))
}

export async function getUnreadMessageCount(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(messageRecipients)
    .where(and(eq(messageRecipients.userId, userId), isNull(messageRecipients.readAt)))
  return Number(rows[0]?.count ?? 0)
}

export async function markMessageRead(messageId: string, userId: string) {
  await db
    .update(messageRecipients)
    .set({ readAt: Date.now() })
    .where(and(eq(messageRecipients.messageId, messageId), eq(messageRecipients.userId, userId), isNull(messageRecipients.readAt)))
}

export async function markAllMessagesRead(userId: string) {
  await db
    .update(messageRecipients)
    .set({ readAt: Date.now() })
    .where(and(eq(messageRecipients.userId, userId), isNull(messageRecipients.readAt)))
}

export async function getSentMessages(orgId: string, limit = 10) {
  const rows = await db
    .select({ message: orgMessages, groupName: volunteerGroups.name })
    .from(orgMessages)
    .leftJoin(volunteerGroups, eq(orgMessages.groupId, volunteerGroups.id))
    .where(eq(orgMessages.orgId, orgId))
    .orderBy(desc(orgMessages.createdAt))
    .limit(limit)
  return rows.map(({ message, groupName }) => ({ ...message, groupName }))
}
