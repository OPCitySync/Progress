import { randomUUID } from 'crypto'
import { and, asc, desc, eq, inArray, isNull, or, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { claims, events, notifications, organizationDelegations, organizationRoles, organizationDocuments, programApplicants, programDocumentReceipts, programWorkspaceSettings, volunteerRosterMembers, tasks, users, waiverVersions } from '@/lib/db/schema'
import { getWaiverSignatures } from './waivers'
import { appendEvent, type DbOrTx } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'

export function stringIds(value: string): string[] {
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [] } catch { return [] }
}
export function scopeOf(programId: string | null) { return programId || 'organization' }
export async function programPolicy(orgId: string, scope: string) {
  const rows = await db.select().from(programWorkspaceSettings).where(and(eq(programWorkspaceSettings.orgId, orgId), inArray(programWorkspaceSettings.scope, [scope, 'organization'])))
  const local = rows.find(r => r.scope === scope)
  const shared = rows.find(r => r.scope === 'organization')
  if (scope !== 'organization' && (!local || local.onboardingMode === 'organization')) return shared ?? null
  return local ?? null
}
export async function programAccessError(orgId: string, scope: string, userId: string) {
  const admission = await (await import('./volunteer-intake')).volunteerAdmissionAccess(orgId, scope === 'organization' ? null : scope, userId)
  if (admission.applies) return admission.error
  const policy = await programPolicy(orgId, scope)
  if (!policy || policy.onboardingMode === 'none') return null
  const candidate=(await db.select().from(programApplicants).where(and(eq(programApplicants.orgId,orgId),eq(programApplicants.scope,policy.scope),eq(programApplicants.userId,userId))).limit(1))[0]
  if(candidate)return candidate.status==='approved'?null:'Complete this program’s onboarding and receive roster approval before joining its volunteer shifts.'
  // Preserve members present when onboarding was first configured. Editing the
  // welcome later must not let a newer member bypass another program's review.
  const firstConfiguration=(await db.select({at:events.ts}).from(events).where(and(
    eq(events.type,EventTypes.PROGRAM_ONBOARDING_CONFIGURED),
    sql`json_extract(${events.payload}, '$.orgId') = ${orgId}`,
    sql`json_extract(${events.payload}, '$.programId') = ${policy.scope}`,
  )).orderBy(asc(events.seq)).limit(1))[0]
  const configuredAt=firstConfiguration?.at??policy.updatedAt
  const existingMember=(await db.select().from(volunteerRosterMembers).where(and(eq(volunteerRosterMembers.orgId,orgId),eq(volunteerRosterMembers.userId,userId),lt(volunteerRosterMembers.joinedAt,configuredAt))).limit(1))[0]
  const existingParticipation=(await db.select({id:claims.id}).from(claims).innerJoin(tasks,eq(claims.taskId,tasks.id)).where(and(eq(tasks.orgId,orgId),eq(claims.userId,userId),scope==='organization'?isNull(tasks.programId):eq(tasks.programId,scope),lt(claims.createdAt,configuredAt),inArray(claims.status,['claimed','submitted','verified']))).limit(1))[0]
  if(existingMember || existingParticipation)return null
  return 'Complete this program’s onboarding and receive roster approval before joining its volunteer shifts.'
}
export async function registerProgramCandidate(tx: DbOrTx, orgId: string, scope: string, userId: string) {
  const now = Date.now()
  await tx.insert(programApplicants).values({ id: randomUUID(), orgId, scope, userId, status: 'preparing', createdAt: now, updatedAt: now })
    .onConflictDoNothing({ target: [programApplicants.orgId, programApplicants.scope, programApplicants.userId] })
}
export async function onboardingMaterials(orgId: string, scope: string) {
  const policy = await programPolicy(orgId, scope)
  if (!policy || policy.onboardingMode === 'none') return { policy, waivers: [], documents: [], sessions: [] }
  const [waivers, documents, sessions] = await Promise.all([
    db.select().from(waiverVersions).where(and(eq(waiverVersions.orgId, orgId), eq(waiverVersions.active, 1), policy.scope === 'organization' ? isNull(waiverVersions.programId) : or(isNull(waiverVersions.programId), eq(waiverVersions.programId, policy.scope)))),
    db.select().from(organizationDocuments).where(and(eq(organizationDocuments.orgId, orgId), eq(organizationDocuments.active, 1))),
    db.select().from(tasks).where(and(eq(tasks.orgId, orgId), eq(tasks.isOnboarding, 1), eq(tasks.status, 'open'), policy.scope === 'organization' ? isNull(tasks.programId) : eq(tasks.programId, policy.scope))).orderBy(asc(tasks.createdAt)),
  ])
  const requiredIds = new Set(stringIds(policy.documentIds))
  return { policy, waivers, documents: documents.filter(d => requiredIds.has(d.id)), sessions }
}
export async function candidateReadiness(orgId: string, scope: string, userId: string) {
  const materials = await onboardingMaterials(orgId, scope)
  const [application, signatures, receipts, attendance] = await Promise.all([
    db.select().from(programApplicants).where(and(eq(programApplicants.orgId, orgId), eq(programApplicants.scope, materials.policy?.scope ?? scope), eq(programApplicants.userId, userId))).limit(1).then(r => r[0] ?? null),
    getWaiverSignatures(userId, materials.waivers.map(w => w.id)),
    db.select().from(programDocumentReceipts).where(and(eq(programDocumentReceipts.orgId, orgId), eq(programDocumentReceipts.userId, userId))),
    materials.sessions.length ? db.select().from(claims).where(and(eq(claims.userId, userId), inArray(claims.taskId, materials.sessions.map(t => t.id)), eq(claims.status, 'verified'))) : Promise.resolve([]),
  ])
  const paperAllowed = materials.policy?.waiverMethod !== 'digital'
  const paperComplete = paperAllowed && Boolean(application?.paperWaiverConfirmedAt)
  const waiverItems = materials.waivers.map(w => ({ id: w.id, title: w.title, complete: (paperComplete && stringIds(application?.paperWaiverIds||'[]').includes(w.id)) || signatures.has(w.id), signer: signatures.get(w.id)?.signerName ?? null }))
  const documentItems = materials.documents.map(d => ({ id: d.id, title: d.title, complete: receipts.some(r => r.documentId === d.id && r.documentUpdatedAt === d.updatedAt) }))
  const sessionComplete = !materials.policy?.requireSession || attendance.length > 0
  const complete = waiverItems.every(w => w.complete) && documentItems.every(d => d.complete) && sessionComplete
  return { ...materials, application, waiverItems, documentItems, sessionComplete, complete }
}
export async function listProgramCandidates(orgId: string, scope: string) {
  const policy = await programPolicy(orgId, scope)
  const effectiveScope = policy?.scope ?? scope
  const [applications, staff] = await Promise.all([
    db.select({ application: programApplicants, user: users }).from(programApplicants).innerJoin(users, eq(programApplicants.userId, users.id))
      .where(and(eq(programApplicants.orgId, orgId), eq(programApplicants.scope, effectiveScope))).orderBy(desc(programApplicants.createdAt)),
    db.select({ userId: organizationDelegations.userId }).from(organizationDelegations).where(and(eq(organizationDelegations.orgId, orgId), eq(organizationDelegations.status, 'active'))),
  ])
  const staffIds = new Set(staff.map(s => s.userId))
  return Promise.all(applications.filter(a => !staffIds.has(a.user.id)).map(async row => ({ ...row, readiness: await candidateReadiness(orgId, scope, row.user.id) })))
}
export async function notifyCandidateReview(orgId: string, scope: string, userId: string) {
  const [staff, user] = await Promise.all([
    db.select({ delegation: organizationDelegations, role: organizationRoles }).from(organizationDelegations)
      .leftJoin(organizationRoles, eq(organizationDelegations.roleId, organizationRoles.id))
      .where(and(eq(organizationDelegations.orgId, orgId), eq(organizationDelegations.status, 'active'))),
    db.select().from(users).where(eq(users.id, userId)).limit(1).then(r => r[0]),
  ])
  const recipients = new Set(staff.filter(({delegation,role}) => {
    const permissions = stringIds(role?.permissions ?? delegation.capabilities)
    return delegation.role === 'owner' || permissions.includes('*') || permissions.includes('participants.manage')
  }).map(({delegation}) => delegation.userId))
  for (const recipient of Array.from(recipients)) await db.insert(notifications).values({
    id: randomUUID(), userId: recipient, kind: 'program_candidate_review', title: 'Volunteer ready for review',
    body: `${user?.name || 'A candidate'} has submitted their onboarding for review.`,
    link: `/aesthetic-lab/issuer/programs/${scope}?section=onboarding`, createdAt: Date.now(),
  })
}
export async function recordCandidateSubmission(orgId: string, scope: string, userId: string) {
  const readiness = await candidateReadiness(orgId, scope, userId)
  if (!readiness.policy || readiness.policy.onboardingMode === 'none') return { ok: false as const, error: 'This onboarding pathway is not active.' }
  if (!readiness.complete) return { ok: false as const, error: 'Complete the checklist before requesting review. Paper waivers must be confirmed by the organization.' }
  if (readiness.application?.status === 'approved' || readiness.application?.status === 'submitted') return { ok: true as const }
  await db.transaction(async tx => {
    await registerProgramCandidate(tx, orgId, readiness.policy!.scope, userId)
    await tx.update(programApplicants).set({ status: 'submitted', submittedAt: Date.now(), updatedAt: Date.now() }).where(and(eq(programApplicants.orgId, orgId), eq(programApplicants.scope, readiness.policy!.scope), eq(programApplicants.userId, userId)))
    await appendEvent(tx, EventTypes.PROGRAM_APPLICATION_SUBMITTED, { orgId, programId: readiness.policy!.scope, userId }, userId)
  })
  await notifyCandidateReview(orgId, readiness.policy.scope, userId)
  return { ok: true as const }
}
