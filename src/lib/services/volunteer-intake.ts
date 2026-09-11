import { randomUUID } from 'crypto'
import { and, asc, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  claims, messageRecipients, notifications, onboardingApplicationForms, onboardingApplications, onboardingIntakes,
  organizationDelegations, organizationRoles, organizationDocumentAssignments, organizationDocuments,
  orgMessages, orgProfiles, orgs, programApplicants, programDocumentReceipts, shifts, tasks, users,
  volunteerAdmissionDecisions, volunteerPrograms, volunteerRosterMembers, waiverVersions,
} from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import { isActiveOrganizationStaff } from './identity-access'
import { normalizeOrganizationLocation, rememberOrganizationLocation } from './organization-locations'

export type IntakeQuestion = { id: string; label: string; type: 'short' | 'long' | 'choice' | 'yes_no'; required: boolean; options: string[] }
export type RoleJoinMode = 'open' | 'profile' | 'form'
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }
const fail = (error: string) => ({ ok: false as const, error })
export function intakeIds(value: string | null | undefined): string[] {
  try { const v: unknown = JSON.parse(value || '[]'); return Array.isArray(v) ? v.filter((id): id is string => typeof id === 'string') : [] } catch { return [] }
}
export function intakeQuestions(value: string): IntakeQuestion[] {
  try { const v: unknown = JSON.parse(value); return Array.isArray(v) ? v as IntakeQuestion[] : [] } catch { return [] }
}
function checkedQuestions(value: unknown): IntakeQuestion[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) return null
  const ids = new Set<string>(), result: IntakeQuestion[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null
    const q = raw as Record<string, unknown>
    if (typeof q.id !== 'string' || !q.id || q.id.length > 80 || ids.has(q.id) ||
      typeof q.label !== 'string' || !q.label.trim() || q.label.length > 240 ||
      !['short', 'long', 'choice', 'yes_no'].includes(String(q.type)) || typeof q.required !== 'boolean') return null
    const options = q.type === 'choice' && Array.isArray(q.options) ? Array.from(new Set(q.options.filter((o): o is string => typeof o === 'string').map(o => o.trim()).filter(Boolean))) : []
    if (q.type === 'choice' && (options.length < 2 || options.length > 10 || options.some(o => o.length > 120))) return null
    ids.add(q.id)
    result.push({ id: q.id, label: q.label.trim(), type: q.type as IntakeQuestion['type'], required: q.required, options })
  }
  return result
}
async function validPrograms(orgId: string, mode: string, ids: string[]) {
  if (!['all', 'specific'].includes(mode)) return false
  if (mode === 'all') return true
  if (!ids.length) return false
  const programs = await db.select({ id: volunteerPrograms.id }).from(volunteerPrograms).where(eq(volunteerPrograms.orgId, orgId))
  return ids.every(id => programs.some(p => p.id === id))
}
export async function getIntake(taskId: string) {
  return (await db.select().from(onboardingIntakes).where(eq(onboardingIntakes.taskId, taskId)).limit(1))[0] ?? null
}
export async function getIntakeForm(taskId: string) {
  const intake = await getIntake(taskId)
  const form = intake?.activeFormId ? (await db.select().from(onboardingApplicationForms).where(and(eq(onboardingApplicationForms.id, intake.activeFormId),isNull(onboardingApplicationForms.archivedAt))).limit(1))[0] ?? null : null
  return { intake, form, questions: form ? intakeQuestions(form.questions) : [] }
}
export function getRoleJoinMode(intake: typeof onboardingIntakes.$inferSelect | null, hasForm = false): RoleJoinMode {
  if (intake?.roleJoinMode === 'profile' || intake?.roleJoinMode === 'form') return intake.roleJoinMode
  // Preserve the behavior of roles created before role_join_mode existed.
  if (intake?.applicationRequired && hasForm) return 'form'
  return 'open'
}
export async function getIntakeWaivers(taskId: string) {
  const intake = await getIntake(taskId)
  if (!intake) return null
  const programIds = intakeIds(intake.programIds)
  return db.select().from(waiverVersions).where(and(eq(waiverVersions.orgId, intake.orgId), eq(waiverVersions.active, 1),
    intake.assignmentMode === 'all' ? undefined : or(isNull(waiverVersions.programId), programIds.length ? inArray(waiverVersions.programId, programIds) : undefined)))
}
export async function createVolunteerIntake(input: {
  orgId: string; cityId: string; actorId: string; title: string; location: string; description: string; notes: string;
  capacity: string; duration: number; assignmentMode: string; programIds: string[];
}): Promise<Result<{ taskId: string }>> {
  const title = input.title.trim(), location = normalizeOrganizationLocation(input.location)
  if (!title || title.length > 120 || !location || location.length > 240) return fail('Add a session title and location.')
  if (!input.description.trim() || input.description.length > 3000 || input.notes.length > 3000) return fail('Add a description; keep each text field under 3,000 characters.')
  if (!['2', '3', '4', '5', 'flexible'].includes(input.capacity) || ![30, 60, 90, 120].includes(input.duration)) return fail('Choose a capacity and duration.')
  if (!(await validPrograms(input.orgId, input.assignmentMode, input.programIds))) return fail('Select at least one of your programs.')
  const org = (await db.select().from(orgs).where(eq(orgs.id, input.orgId)).limit(1))[0]
  if (!org || org.status !== 'approved') return fail('Your organization must be approved to create onboarding.')
  const now = Date.now(), taskId = randomUUID()
  const programIds = input.assignmentMode === 'all' ? [] : Array.from(new Set(input.programIds))
  await db.transaction(async tx => {
    await tx.insert(tasks).values({
      id: taskId, orgId: input.orgId, cityId: input.cityId, title, description: input.description.trim(),
      location, beforeSession: input.notes.trim(), bringItems: '', credits: 5,
      slots: input.capacity === 'flexible' ? 10 : Number(input.capacity), defaultDurationMinutes: input.duration,
      startsAt: '', status: 'open', isOnboarding: 1, programId: programIds[0] ?? null,
      onboardingWaiverMethod: 'either', onboardingIdentityCheck: 'staff_attested',
      requiredCredentials: '[]', createdBy: input.actorId, createdAt: now,
    })
    await tx.insert(onboardingIntakes).values({ taskId, orgId: input.orgId, assignmentMode: input.assignmentMode as 'all' | 'specific', programIds: JSON.stringify(programIds), flexibleCapacity: input.capacity === 'flexible' ? 1 : 0, createdAt: now, updatedAt: now })
    const profile = (await tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, input.orgId)).limit(1))[0]
    if (!profile) await tx.insert(orgProfiles).values({ orgId: input.orgId, onboardingTaskId: taskId, updatedAt: now })
    else if (!profile.onboardingTaskId) await tx.update(orgProfiles).set({ onboardingTaskId: taskId, updatedAt: now }).where(eq(orgProfiles.orgId, input.orgId))
    await rememberOrganizationLocation(tx, { orgId: input.orgId, address: location })
    await appendEvent(tx, EventTypes.ONBOARDING_SESSION_CREATED, { orgId: input.orgId, cityId: input.cityId, taskId, title, capacity: input.capacity === 'flexible' ? 10 : Number(input.capacity), flexibleCapacity: input.capacity === 'flexible', durationMinutes: input.duration, assignmentMode: input.assignmentMode, programIds, occurrencesCreated: 0 }, input.actorId)
  })
  return { ok: true, taskId }
}
export async function saveIntakeApplicationForm(input: { orgId: string; actorId: string; taskId: string; introduction: string; questions: unknown; required: boolean; public?: boolean; sourceFormId?: string }): Promise<Result> {
  const task = (await db.select().from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.orgId, input.orgId), eq(tasks.status, 'open'))).limit(1))[0]
  const questions = checkedQuestions(input.questions)
  if (!task) return fail('This volunteer role is no longer available.')
  if (!questions || input.introduction.length > 1500) return fail('Add 1–12 valid questions. Choice questions need 2–10 distinct options.')
  const currentIntake = await getIntake(task.id)
  const sourceForm=input.sourceFormId?(await db.select().from(onboardingApplicationForms).where(and(eq(onboardingApplicationForms.id,input.sourceFormId),eq(onboardingApplicationForms.taskId,task.id),eq(onboardingApplicationForms.orgId,input.orgId),isNull(onboardingApplicationForms.archivedAt))).limit(1))[0]:null
  if(input.sourceFormId&&!sourceForm)return fail('This application template changed. Reopen it before saving.')
  const isRole = task.isOnboarding !== 1
  const applicationRequired = isRole ? true : input.required
  const applicationPublic = isRole ? Boolean(currentIntake?.applicationPublic) : Boolean(input.public)
  if (applicationPublic && !applicationRequired) return fail('A public application must require organization approval.')
  await db.transaction(async tx => {
    const previous = (await tx.select().from(onboardingApplicationForms).where(eq(onboardingApplicationForms.taskId, task.id)).orderBy(desc(onboardingApplicationForms.version)).limit(1))[0]
    const now = Date.now(), formId = randomUUID(), version = (previous?.version ?? 0) + 1
    await tx.insert(onboardingApplicationForms).values({ id: formId, orgId: input.orgId, taskId: task.id, version, introduction: input.introduction.trim(), questions: JSON.stringify(questions), createdBy: input.actorId, createdAt: now })
    if(sourceForm)await tx.update(onboardingApplicationForms).set({archivedAt:now}).where(eq(onboardingApplicationForms.id,sourceForm.id))
    await tx.insert(onboardingIntakes).values({ taskId: task.id, orgId: input.orgId, assignmentMode: task.programId ? 'specific' : 'all', programIds: JSON.stringify(task.programId ? [task.programId] : []), applicationRequired: applicationRequired ? 1 : 0, roleJoinMode: isRole ? 'form' : getRoleJoinMode(currentIntake), applicationPublic: applicationPublic ? 1 : 0, activeFormId: formId, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: onboardingIntakes.taskId, set: { applicationRequired: applicationRequired ? 1 : 0, roleJoinMode: isRole ? 'form' : getRoleJoinMode(currentIntake), applicationPublic: applicationPublic ? 1 : 0, activeFormId: formId, updatedAt: now } })
    await appendEvent(tx, EventTypes.ONBOARDING_APPLICATION_FORM_SAVED, { orgId: input.orgId, taskId: task.id, formId, version, replacesFormId:sourceForm?.id, required: applicationRequired, public: applicationPublic, roleJoinMode: isRole ? 'form' : undefined, questionCount: questions.length }, input.actorId)
  })
  return { ok: true }
}
export async function archiveIntakeApplicationForm(input:{orgId:string;actorId:string;formId:string}):Promise<Result>{
  const form=(await db.select().from(onboardingApplicationForms).where(and(eq(onboardingApplicationForms.id,input.formId),eq(onboardingApplicationForms.orgId,input.orgId),isNull(onboardingApplicationForms.archivedAt))).limit(1))[0]
  if(!form)return fail('This application template is no longer available.')
  const task=(await db.select().from(tasks).where(and(eq(tasks.id,form.taskId),eq(tasks.orgId,input.orgId),eq(tasks.isOnboarding,0))).limit(1))[0]
  if(!task)return fail('Only volunteer role applications can be deleted here.')
  const intake=await getIntake(form.taskId)
  const now=Date.now()
  await db.transaction(async tx=>{
    await tx.update(onboardingApplicationForms).set({archivedAt:now}).where(eq(onboardingApplicationForms.id,form.id))
    let replacementFormId:string|null=intake?.activeFormId??null
    if(intake?.activeFormId===form.id){
      const replacement=(await tx.select({id:onboardingApplicationForms.id}).from(onboardingApplicationForms).where(and(eq(onboardingApplicationForms.taskId,form.taskId),isNull(onboardingApplicationForms.archivedAt))).orderBy(desc(onboardingApplicationForms.version)).limit(1))[0]
      replacementFormId=replacement?.id??null
      await tx.update(onboardingIntakes).set({activeFormId:replacementFormId,roleJoinMode:replacementFormId?'form':'profile',updatedAt:now}).where(eq(onboardingIntakes.taskId,form.taskId))
    }
    await appendEvent(tx,EventTypes.ONBOARDING_APPLICATION_FORM_ARCHIVED,{orgId:input.orgId,taskId:form.taskId,formId:form.id,version:form.version,replacementFormId},input.actorId)
  })
  return{ok:true}
}
export async function publishIntakeApplicationForm(input:{orgId:string;actorId:string;formId:string}):Promise<Result>{
  const form=(await db.select().from(onboardingApplicationForms).where(and(eq(onboardingApplicationForms.id,input.formId),eq(onboardingApplicationForms.orgId,input.orgId),isNull(onboardingApplicationForms.archivedAt))).limit(1))[0]
  if(!form)return fail('This application template is no longer available.')
  const task=(await db.select().from(tasks).where(and(eq(tasks.id,form.taskId),eq(tasks.orgId,input.orgId),eq(tasks.status,'open'),eq(tasks.isOnboarding,0))).limit(1))[0]
  if(!task)return fail('This volunteer role is no longer available.')
  const now=Date.now()
  await db.transaction(async tx=>{
    await tx.insert(onboardingIntakes).values({taskId:task.id,orgId:input.orgId,assignmentMode:task.programId?'specific':'all',programIds:JSON.stringify(task.programId?[task.programId]:[]),applicationRequired:1,roleJoinMode:'form',applicationPublic:1,activeFormId:form.id,createdAt:now,updatedAt:now})
      .onConflictDoUpdate({target:onboardingIntakes.taskId,set:{applicationRequired:1,roleJoinMode:'form',applicationPublic:1,activeFormId:form.id,updatedAt:now}})
    await appendEvent(tx,EventTypes.ONBOARDING_APPLICATION_FORM_PUBLISHED,{orgId:input.orgId,taskId:task.id,formId:form.id,version:form.version},input.actorId)
  })
  return{ok:true}
}
export async function unpublishIntakeApplicationForm(input:{orgId:string;actorId:string;formId:string}):Promise<Result>{
  const form=(await db.select().from(onboardingApplicationForms).where(and(eq(onboardingApplicationForms.id,input.formId),eq(onboardingApplicationForms.orgId,input.orgId),isNull(onboardingApplicationForms.archivedAt))).limit(1))[0]
  if(!form)return fail('This application template is no longer available.')
  const intake=await getIntake(form.taskId)
  if(!intake||intake.activeFormId!==form.id||!intake.applicationPublic)return fail('This application is not currently published.')
  const now=Date.now()
  await db.transaction(async tx=>{
    await tx.update(onboardingIntakes).set({applicationPublic:0,updatedAt:now}).where(and(eq(onboardingIntakes.taskId,form.taskId),eq(onboardingIntakes.orgId,input.orgId)))
    await appendEvent(tx,EventTypes.ONBOARDING_APPLICATION_FORM_UNPUBLISHED,{orgId:input.orgId,taskId:form.taskId,formId:form.id,version:form.version},input.actorId)
  })
  return{ok:true}
}
export async function inviteApprovedVolunteersToOnboardingSession(input:{orgId:string;actorId:string;shiftId:string;userIds:string[]}):Promise<Result<{invited:number}>>{
  const requested=Array.from(new Set(input.userIds.filter(Boolean)))
  if(!requested.length)return fail('Choose at least one approved volunteer to invite.')
  if(requested.length>250)return fail('Invite up to 250 volunteers at a time.')
  const row=(await db.select({shift:shifts,task:tasks,organizationName:orgs.name}).from(shifts).innerJoin(tasks,eq(shifts.taskId,tasks.id)).innerJoin(orgs,eq(tasks.orgId,orgs.id)).where(and(eq(shifts.id,input.shiftId),eq(shifts.orgId,input.orgId))).limit(1))[0]
  if(!row||row.task.isOnboarding!==1||row.task.status!=='open'||row.shift.status!=='open')return fail('This onboarding session is no longer available.')
  if(!row.shift.startsAt||row.shift.startsAt<=Date.now())return fail('Invitations can only be sent for an upcoming onboarding session.')
  const roleScope=row.task.programId?eq(tasks.programId,row.task.programId):undefined
  const onboardingScope=row.task.programId?eq(tasks.programId,row.task.programId):undefined
  const [approvedRows,staffRows,completedRows,reservedRows]=await Promise.all([
    db.select({userId:onboardingApplications.userId}).from(onboardingApplications).innerJoin(tasks,eq(onboardingApplications.taskId,tasks.id)).where(and(eq(onboardingApplications.orgId,input.orgId),eq(onboardingApplications.status,'approved'),eq(tasks.isOnboarding,0),roleScope,inArray(onboardingApplications.userId,requested))),
    db.select({userId:organizationDelegations.userId}).from(organizationDelegations).where(and(eq(organizationDelegations.orgId,input.orgId),eq(organizationDelegations.status,'active'),inArray(organizationDelegations.userId,requested))),
    db.select({claim:claims,shift:shifts}).from(claims).innerJoin(tasks,eq(claims.taskId,tasks.id)).innerJoin(shifts,eq(claims.shiftId,shifts.id)).where(and(eq(tasks.orgId,input.orgId),eq(tasks.isOnboarding,1),onboardingScope,inArray(claims.status,['claimed','submitted','verified']),inArray(claims.userId,requested))),
    db.select({userId:claims.userId}).from(claims).where(and(eq(claims.shiftId,input.shiftId),inArray(claims.status,['claimed','submitted','verified']),inArray(claims.userId,requested))),
  ])
  const approved=new Set(approvedRows.map(person=>person.userId)),staff=new Set(staffRows.map(person=>person.userId)),completed=new Set(completedRows.filter(row=>attendedOnboarding(row.claim,row.shift)).map(row=>row.claim.userId)),reserved=new Set(reservedRows.map(person=>person.userId))
  const eligible=requested.filter(userId=>approved.has(userId)&&!staff.has(userId)&&!completed.has(userId)&&!reserved.has(userId))
  if(eligible.length!==requested.length)return fail('One or more selected people are no longer awaiting this orientation. Refresh the page and try again.')
  const link=`/aesthetic-lab/opportunities/${row.task.id}?invitedSession=${row.shift.id}#available-sessions`
  const existing=await db.select({userId:notifications.userId}).from(notifications).where(and(eq(notifications.kind,'onboarding_session_invitation'),eq(notifications.link,link),inArray(notifications.userId,eligible)))
  const alreadyInvited=new Set(existing.map(person=>person.userId)),recipients=eligible.filter(userId=>!alreadyInvited.has(userId))
  if(!recipients.length)return fail('Everyone selected has already received this invitation.')
  const startsAt=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(row.shift.startsAt))
  const now=Date.now()
  await db.transaction(async tx=>{
    for(const userId of recipients)await tx.insert(notifications).values({id:randomUUID(),userId,kind:'onboarding_session_invitation',title:`Invitation: ${row.task.title}`,body:`${row.organizationName} invited you to an onboarding session on ${startsAt}. Review the details and reserve your spot.`,link,createdAt:now})
    await appendEvent(tx,EventTypes.ONBOARDING_SESSION_INVITATIONS_SENT,{orgId:input.orgId,taskId:row.task.id,shiftId:row.shift.id,participantIds:recipients,invitationCount:recipients.length},input.actorId)
  })
  return{ok:true,invited:recipients.length}
}
export async function setRolePublication(input: { orgId: string; actorId: string; taskId: string; published: boolean }): Promise<Result> {
  const task = (await db.select().from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.orgId, input.orgId), eq(tasks.status, 'open'), eq(tasks.isOnboarding, 0))).limit(1))[0]
  if (!task) return fail('This volunteer role is no longer available.')
  const current = await getIntake(task.id)
  const mode: RoleJoinMode = current?.activeFormId ? 'form' : 'profile'
  const now = Date.now()
  await db.transaction(async tx => {
    await tx.insert(onboardingIntakes).values({ taskId: task.id, orgId: input.orgId, assignmentMode: task.programId ? 'specific' : 'all', programIds: JSON.stringify(task.programId ? [task.programId] : []), applicationRequired: 1, roleJoinMode: mode, applicationPublic: input.published ? 1 : 0, activeFormId: current?.activeFormId ?? null, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: onboardingIntakes.taskId, set: { applicationRequired: 1, roleJoinMode: mode, applicationPublic: input.published ? 1 : 0, updatedAt: now } })
    await appendEvent(tx, EventTypes.TASK_UPDATED, { orgId: input.orgId, taskId: task.id, change: 'role_publication', published: input.published, roleJoinMode: mode }, input.actorId)
  })
  return { ok: true }
}
export async function getAdmissionDecision(orgId: string, userId: string) {
  return (await db.select().from(volunteerAdmissionDecisions).where(and(eq(volunteerAdmissionDecisions.orgId, orgId), eq(volunteerAdmissionDecisions.userId, userId))).limit(1))[0] ?? null
}
export async function intakeReservationGate(taskId: string, userId: string): Promise<Result> {
  const task = (await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1))[0]
  if (!task) return fail('This volunteer role is no longer available.')
  const decision = await getAdmissionDecision(task.orgId, userId)
  if (decision?.status === 'not_approved') return fail('This organization has not approved you for its volunteer activities. Contact the organization if you would like it to review that decision.')
  const { intake } = await getIntakeForm(taskId)
  const requiresApplication = task.isOnboarding === 1 ? Boolean(intake?.applicationRequired) : Boolean(intake?.applicationPublic)
  if (!requiresApplication) return { ok: true }
  const application = (await db.select().from(onboardingApplications).where(and(eq(onboardingApplications.taskId, taskId), eq(onboardingApplications.userId, userId))).limit(1))[0]
  if (application?.status === 'approved') return { ok: true }
  const item = task.isOnboarding === 1 ? 'onboarding session' : 'volunteer shift'
  return fail(application?.status === 'submitted' ? `Your application is awaiting organization approval. You can reserve a ${item} after it is approved.` : application?.status === 'not_approved' ? 'Your application was not approved. Contact the organization if you have questions.' : `Apply and receive organization approval before reserving a ${item}.`)
}
// An explicit local decision takes priority over the experimental program-page
// welcome. Otherwise both interfaces can coexist without silently resetting it.
export async function volunteerAdmissionAccess(orgId: string, programId: string | null, userId: string) {
  const decision = await getAdmissionDecision(orgId, userId)
  if (decision) {
    if (decision.status === 'not_approved') return { applies: true, error: 'This organization has not approved you for its volunteer activities. Contact it to request a review.' }
    if (decision.status === 'needs_paperwork') return { applies: true, error: 'Complete the outstanding onboarding paperwork and receive organization approval before joining volunteer shifts.' }
    return { applies: true, error: decision.assignmentMode === 'all' || (programId && intakeIds(decision.programIds).includes(programId)) ? null : 'You are approved for specific programs, but not for this program. Contact the organization to update your access.' }
  }
  // Role applications use this same form store, but they must never turn on
  // organization-wide onboarding requirements by themselves.
  const intake = (await db.select({ intake: onboardingIntakes }).from(onboardingIntakes)
    .innerJoin(tasks, eq(onboardingIntakes.taskId, tasks.id))
    .where(and(eq(onboardingIntakes.orgId, orgId), eq(tasks.isOnboarding, 1)))
    .orderBy(asc(onboardingIntakes.createdAt)).limit(1))[0]?.intake
  if (!intake) return { applies: false, error: null }
  const [member, prior, programApproval] = await Promise.all([
    db.select().from(volunteerRosterMembers).where(and(eq(volunteerRosterMembers.orgId, orgId), eq(volunteerRosterMembers.userId, userId))).limit(1),
    db.select({ id: claims.id }).from(claims).innerJoin(tasks, eq(claims.taskId, tasks.id)).where(and(eq(tasks.orgId, orgId), eq(claims.userId, userId), lt(claims.createdAt, intake.createdAt), inArray(claims.status, ['claimed', 'submitted', 'verified']))).limit(1),
    db.select().from(programApplicants).where(and(eq(programApplicants.orgId, orgId), eq(programApplicants.userId, userId), eq(programApplicants.status, 'approved'), inArray(programApplicants.scope, [programId || 'organization', 'organization']))).limit(1),
  ])
  if (member.length || prior.length || programApproval.length) return { applies: false, error: null }
  return { applies: true, error: 'Complete onboarding and receive the organization’s roster approval before joining its volunteer shifts.' }
}
async function reviewerIds(orgId: string) {
  const staff = await db.select({ delegation: organizationDelegations, role: organizationRoles }).from(organizationDelegations).leftJoin(organizationRoles, eq(organizationDelegations.roleId, organizationRoles.id)).where(and(eq(organizationDelegations.orgId, orgId), eq(organizationDelegations.status, 'active')))
  return Array.from(new Set(staff.filter(({ delegation, role }) => delegation.role === 'owner' || intakeIds(role?.permissions ?? delegation.capabilities).some(p => p === '*' || p === 'participants.manage')).map(({ delegation }) => delegation.userId)))
}
export async function submitIntakeApplication(input: { taskId: string; userId: string; formId: string; answers: Record<string, unknown> }): Promise<Result> {
  const { intake, form, questions } = await getIntakeForm(input.taskId)
  const task = (await db.select({ id: tasks.id, isOnboarding: tasks.isOnboarding }).from(tasks).where(eq(tasks.id, input.taskId)).limit(1))[0]
  if (!task) return fail('This volunteer role is no longer available.')
  if (!intake || (task.isOnboarding === 1 ? !intake.applicationRequired : !intake.applicationPublic)) return fail('This application is not currently required.')
  if (task.isOnboarding !== 1 && !intake.applicationPublic) return fail('This role is not currently accepting public applications.')
  const joinMode = task.isOnboarding === 1 ? 'form' : form ? 'form' : 'profile'
  const profileOnly = task.isOnboarding !== 1 && joinMode === 'profile'
  if (!profileOnly && !form) return fail('This application form is not currently available.')
  if (!profileOnly && form!.id !== input.formId) return fail('The organization updated this application. Reopen it to see the current questions.')
  if (await isActiveOrganizationStaff(intake.orgId, input.userId)) return fail('Staff cannot apply as volunteers within the same organization.')
  if ((await getAdmissionDecision(intake.orgId, input.userId))?.status === 'not_approved') return fail('Please contact the organization to review your participation status.')
  const org = (await db.select().from(orgs).where(eq(orgs.id, intake.orgId)).limit(1))[0]
  if (org?.status !== 'approved') return fail('This organization is not accepting applications.')
  const existing = (await db.select().from(onboardingApplications).where(and(eq(onboardingApplications.taskId, input.taskId), eq(onboardingApplications.userId, input.userId))).limit(1))[0]
  if (existing) return existing.status === 'not_approved' ? fail('Your application was not approved. Contact the organization to request a review.') : { ok: true }
  const answers: Record<string, string> = {}
  for (const q of profileOnly ? [] : questions) {
    const answer = typeof input.answers[q.id] === 'string' ? String(input.answers[q.id]).trim() : ''
    if ((q.required && !answer) || answer.length > (q.type === 'long' ? 3000 : 500)) return fail('Complete the required questions and keep answers within their length limits.')
    if (answer && q.type === 'choice' && !q.options.includes(answer)) return fail('Choose one of the listed answers.')
    if (answer && q.type === 'yes_no' && !['Yes', 'No'].includes(answer)) return fail('Choose Yes or No.')
    answers[q.id] = answer
  }
  const recipients = await reviewerIds(intake.orgId)
  await db.transaction(async tx => {
    const id = randomUUID(), now = Date.now()
    const formId = profileOnly ? `profile-review:${input.taskId}` : form!.id
    if (profileOnly) await tx.insert(onboardingApplicationForms).values({ id: formId, orgId: intake.orgId, taskId: input.taskId, version: 0, introduction: '', questions: '[]', createdBy: input.userId, createdAt: now }).onConflictDoNothing()
    await tx.insert(onboardingApplications).values({ id, orgId: intake.orgId, taskId: input.taskId, userId: input.userId, formId, answers: JSON.stringify(answers), createdAt: now, updatedAt: now })
    const subject = task.isOnboarding === 1 ? 'onboarding date' : 'volunteer shift'
    for (const userId of recipients) await tx.insert(notifications).values({ id: randomUUID(), userId, kind: 'onboarding_application', title: 'Volunteer application ready for review', body: `Review the application before the volunteer reserves a ${subject}.`, link: '/aesthetic-lab/issuer/volunteers#onboarding-approval', createdAt: now })
    await appendEvent(tx, EventTypes.ONBOARDING_APPLICATION_SUBMITTED, { orgId: intake.orgId, taskId: input.taskId, applicationId: id, formId, participantId: input.userId, profileOnly }, input.userId)
  })
  return { ok: true }
}
export async function reviewIntakeApplication(input: { orgId: string; actorId: string; applicationId: string; decision: string; internalNote: string; acceptanceSubject?: string; acceptanceMessage?: string; rejectionSubject?: string; rejectionMessage?: string; confirmed: boolean }): Promise<Result> {
  const application = (await db.select().from(onboardingApplications).where(and(eq(onboardingApplications.id, input.applicationId), eq(onboardingApplications.orgId, input.orgId))).limit(1))[0]
  if (!application || !['approved', 'not_approved'].includes(input.decision) || !input.confirmed) return fail('Review the application and confirm your decision.')
  const acceptanceSubject=input.acceptanceSubject?.trim()??'',acceptanceMessage=input.acceptanceMessage?.trim()??''
  const rejectionSubject=input.rejectionSubject?.trim()??'',rejectionMessage=input.rejectionMessage?.trim()??''
  if(input.decision==='approved'&&(!acceptanceSubject||!acceptanceMessage))return fail('Add a subject and message for the acceptance letter.')
  if(input.decision==='not_approved'&&(!rejectionSubject||!rejectionMessage))return fail('Add a subject and message for the rejection letter.')
  const letterSubject=input.decision==='approved'?acceptanceSubject:rejectionSubject
  const letterMessage=input.decision==='approved'?acceptanceMessage:rejectionMessage
  if(letterSubject.length>180||letterMessage.length>5000)return fail('Keep the letter subject under 180 characters and the message under 5,000 characters.')
  if (await isActiveOrganizationStaff(input.orgId, application.userId)) return fail('Staff cannot join their organization as volunteers.')
  if (application.status === input.decision && application.internalNote === input.internalNote.trim()) return { ok: true }
  const decision = input.decision as 'approved' | 'not_approved'
  const task = (await db.select({ isOnboarding: tasks.isOnboarding }).from(tasks).where(eq(tasks.id, application.taskId)).limit(1))[0]
  const isOnboarding = task?.isOnboarding === 1
  await db.transaction(async tx => {
    const now = Date.now()
    await tx.update(onboardingApplications).set({ status: decision, internalNote: input.internalNote.trim().slice(0,1500), reviewedBy: input.actorId, reviewedAt: now, updatedAt: now }).where(eq(onboardingApplications.id, application.id))
    const decisionMessageId=randomUUID()
    await tx.insert(orgMessages).values({id:decisionMessageId,orgId:input.orgId,senderUserId:input.actorId,scope:'members',taskId:application.taskId,groupId:null,subject:letterSubject,body:letterMessage,recipientCount:1,createdAt:now})
    await tx.insert(messageRecipients).values({id:randomUUID(),messageId:decisionMessageId,userId:application.userId,readAt:null,createdAt:now})
    await appendEvent(tx,EventTypes.MESSAGE_SENT,{messageId:decisionMessageId,orgId:input.orgId,scope:'members',selectedMemberIds:[application.userId],subject:letterSubject,recipientCount:1},input.actorId)
    if(decision==='approved')await tx.insert(notifications).values({ id: randomUUID(), userId: application.userId, kind: 'onboarding_application_review', title: isOnboarding ? 'Application approved — choose your onboarding date' : 'Role application approved', body: isOnboarding ? 'You can now reserve an onboarding session. Joining the volunteer roster is a separate decision after onboarding.' : 'You can now review this role’s public shifts. Complete any organization onboarding requirements before signing up.', link: '/aesthetic-lab/opportunities/' + application.taskId, createdAt: now })
    await appendEvent(tx, EventTypes.ONBOARDING_APPLICATION_REVIEWED, { orgId: input.orgId, taskId: application.taskId, applicationId: application.id, participantId: application.userId, decision, previousStatus: application.status, decisionMessageId, acceptanceMessageId: decision==='approved'?decisionMessageId:undefined, rejectionMessageId: decision==='not_approved'?decisionMessageId:undefined }, input.actorId)
  })
  return { ok: true }
}
export function attendedOnboarding(claim: typeof claims.$inferSelect, shift: typeof shifts.$inferSelect | null) {
  return claim.status === 'verified' || Boolean(claim.checkedInAt && ['claimed', 'submitted'].includes(claim.status) && shift && (shift.status === 'closed' || (shift.endsAt !== null && shift.endsAt <= Date.now())))
}
export async function intakePaperwork(orgId: string, taskId: string, userId: string) {
  const { getOnboardingWaiverSetup, getWaiverSignatures } = await import('./waivers')
  const task = (await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.orgId, orgId), eq(tasks.isOnboarding,1))).limit(1))[0]
  if (!task) return null
  const [setup, decision, documents, receipts, personClaims] = await Promise.all([
    getOnboardingWaiverSetup(orgId, task), getAdmissionDecision(orgId, userId),
    db.select({ document: organizationDocuments }).from(organizationDocumentAssignments).innerJoin(organizationDocuments, eq(organizationDocumentAssignments.documentId, organizationDocuments.id)).where(and(eq(organizationDocumentAssignments.taskId,taskId),eq(organizationDocuments.orgId,orgId),eq(organizationDocuments.active,1))),
    db.select().from(programDocumentReceipts).where(and(eq(programDocumentReceipts.orgId,orgId),eq(programDocumentReceipts.userId,userId))),
    db.select().from(claims).where(and(eq(claims.taskId,taskId),eq(claims.userId,userId))),
  ])
  const signatures = await getWaiverSignatures(userId,setup.waivers.map(w=>w.id))
  const paperIds = new Set(intakeIds(decision?.paperWaiverIds))
  for (const claim of personClaims) if (claim.paperWaiverConfirmedAt && claim.waiverVersionId) paperIds.add(claim.waiverVersionId)
  const waiverItems = setup.waivers.map(w=>({id:w.id,title:w.title,complete:signatures.has(w.id)||paperIds.has(w.id),signerName:signatures.get(w.id)?.signerName??null}))
  const documentItems = documents.map(({document})=>({id:document.id,title:document.title,updatedAt:document.updatedAt,complete:receipts.some(r=>r.documentId===document.id&&r.documentUpdatedAt===document.updatedAt)}))
  return { task, decision, waiverItems, documentItems, complete:waiverItems.every(w=>w.complete)&&documentItems.every(d=>d.complete) }
}
export async function saveVolunteerAdmission(input: {
  orgId:string;actorId:string;claimId:string;decision:string;assignmentMode:string;programIds:string[];
  paperWaiverIds:string[];documentIds:string[];internalNote:string;confirmed:boolean;confirmRestriction:boolean;
}): Promise<Result> {
  const row=(await db.select({claim:claims,task:tasks,shift:shifts}).from(claims).innerJoin(tasks,eq(claims.taskId,tasks.id)).leftJoin(shifts,eq(claims.shiftId,shifts.id)).where(and(eq(claims.id,input.claimId),eq(tasks.orgId,input.orgId),eq(tasks.isOnboarding,1))).limit(1))[0]
  if(!row||!attendedOnboarding(row.claim,row.shift))return fail('This person must attend onboarding before their roster decision is saved.')
  if(!input.confirmed||!['approved','needs_paperwork','not_approved'].includes(input.decision))return fail('Review the person’s profile and choose a decision.')
  if(input.decision==='not_approved'&&!input.confirmRestriction)return fail('Confirm that this decision prevents new sign-ups and assignments for this organization.')
  if(await isActiveOrganizationStaff(input.orgId,row.claim.userId))return fail('Staff cannot also be volunteers within this organization.')
  if(!(await validPrograms(input.orgId,input.assignmentMode,input.programIds)))return fail('Choose All Programs or select the programs this person can join.')
  const paperwork=await intakePaperwork(input.orgId,row.task.id,row.claim.userId)
  if(!paperwork)return fail('Onboarding record not found.')
  if(input.paperWaiverIds.some(id=>!paperwork.waiverItems.some(w=>w.id===id))||input.documentIds.some(id=>!paperwork.documentItems.some(d=>d.id===id)))return fail('The required paperwork changed. Reopen this review.')
  const complete=paperwork.waiverItems.every(w=>w.complete||input.paperWaiverIds.includes(w.id))&&paperwork.documentItems.every(d=>d.complete||input.documentIds.includes(d.id))
  if(input.decision==='approved'&&!complete)return fail('Resolve the missing paperwork, or choose Paperwork needed for now.')
  const now=Date.now(),status=input.decision as 'approved'|'needs_paperwork'|'not_approved'
  const programIds=input.assignmentMode==='all'?[]:Array.from(new Set(input.programIds))
  const value={taskId:row.task.id,claimId:row.claim.id,status,assignmentMode:input.assignmentMode as 'all'|'specific',programIds:JSON.stringify(programIds),paperWaiverIds:JSON.stringify(Array.from(new Set([...intakeIds(paperwork.decision?.paperWaiverIds),...input.paperWaiverIds]))),internalNote:input.internalNote.trim().slice(0,1500),reviewedBy:input.actorId,updatedAt:now}
  await db.transaction(async tx=>{
    await tx.insert(volunteerAdmissionDecisions).values({id:randomUUID(),orgId:input.orgId,userId:row.claim.userId,...value,createdAt:now}).onConflictDoUpdate({target:[volunteerAdmissionDecisions.orgId,volunteerAdmissionDecisions.userId],set:value})
    for(const doc of paperwork.documentItems.filter(d=>input.documentIds.includes(d.id)))await tx.insert(programDocumentReceipts).values({id:randomUUID(),orgId:input.orgId,userId:row.claim.userId,documentId:doc.id,documentUpdatedAt:doc.updatedAt,receivedAt:now}).onConflictDoNothing()
    if(input.paperWaiverIds.length)await appendEvent(tx,EventTypes.WAIVER_RECEIPT_ATTESTED,{orgId:input.orgId,taskId:row.task.id,claimId:row.claim.id,participantId:row.claim.userId,waiverVersionIds:input.paperWaiverIds},input.actorId)
    if(status==='approved')await tx.insert(volunteerRosterMembers).values({id:randomUUID(),orgId:input.orgId,userId:row.claim.userId,source:'approval',invitedByUserId:input.actorId,joinedAt:now}).onConflictDoNothing({target:[volunteerRosterMembers.orgId,volunteerRosterMembers.userId]})
    const missing=[...paperwork.waiverItems.filter(w=>!w.complete&&!input.paperWaiverIds.includes(w.id)).map(w=>w.title),...paperwork.documentItems.filter(d=>!d.complete&&!input.documentIds.includes(d.id)).map(d=>d.title)]
    await tx.insert(notifications).values({id:randomUUID(),userId:row.claim.userId,kind:'volunteer_admission',title:status==='approved'?'You’re approved to volunteer':status==='needs_paperwork'?'Your onboarding needs paperwork':'Your volunteer participation was not approved',body:status==='approved'?(input.assignmentMode==='all'?'You can join this organization’s volunteer shifts across all programs.':'You can join volunteer shifts in the programs selected by the organization.'):status==='needs_paperwork'?(missing.length?'Please complete: '+missing.join(', '):'Contact the organization about your remaining onboarding paperwork.'):'The organization has not approved you for its volunteer activities. Contact it if you would like to request a review. Existing commitments have not been cancelled.',link:'/aesthetic-lab/opportunities/'+row.task.id,createdAt:now})
    await appendEvent(tx,EventTypes.VOLUNTEER_ADMISSION_REVIEWED,{orgId:input.orgId,taskId:row.task.id,claimId:row.claim.id,participantId:row.claim.userId,status,previousStatus:paperwork.decision?.status??'pending',assignmentMode:input.assignmentMode,programIds,receivedDocumentIds:input.documentIds,paperWaiverIds:input.paperWaiverIds},input.actorId)
  })
  return {ok:true}
}
export async function listIntakeReviews(orgId:string,cityId:string|null){
  const [applications,attendance,decisions,staff]=await Promise.all([
    db.select({application:onboardingApplications,form:onboardingApplicationForms,user:users,task:tasks}).from(onboardingApplications).innerJoin(onboardingApplicationForms,eq(onboardingApplications.formId,onboardingApplicationForms.id)).innerJoin(users,eq(onboardingApplications.userId,users.id)).innerJoin(tasks,eq(onboardingApplications.taskId,tasks.id)).where(and(eq(onboardingApplications.orgId,orgId),cityId?eq(tasks.cityId,cityId):undefined)).orderBy(desc(onboardingApplications.createdAt)),
    db.select({claim:claims,user:users,task:tasks,shift:shifts}).from(claims).innerJoin(tasks,eq(claims.taskId,tasks.id)).innerJoin(users,eq(claims.userId,users.id)).leftJoin(shifts,eq(claims.shiftId,shifts.id)).where(and(eq(tasks.orgId,orgId),eq(tasks.isOnboarding,1),cityId?eq(tasks.cityId,cityId):undefined,inArray(claims.status,['claimed','submitted','verified']))).orderBy(desc(claims.updatedAt)),
    db.select().from(volunteerAdmissionDecisions).where(eq(volunteerAdmissionDecisions.orgId,orgId)),
    db.select({userId:organizationDelegations.userId}).from(organizationDelegations).where(and(eq(organizationDelegations.orgId,orgId),eq(organizationDelegations.status,'active'))),
  ])
  const staffIds=new Set(staff.map(s=>s.userId)),byUser=new Map<string,typeof attendance[number]>()
  for(const row of attendance)if(!staffIds.has(row.user.id)&&attendedOnboarding(row.claim,row.shift)&&!byUser.has(row.user.id))byUser.set(row.user.id,row)
  const candidates=await Promise.all(Array.from(byUser.values()).map(async row=>({...row,decision:decisions.find(d=>d.userId===row.user.id)??null,intake:await getIntake(row.task.id),paperwork:await intakePaperwork(orgId,row.task.id,row.user.id)})))
  candidates.sort((a,b)=>Number(Boolean(a.decision&&a.decision.status!=='needs_paperwork'))-Number(Boolean(b.decision&&b.decision.status!=='needs_paperwork')))
  return {applications:applications.filter(a=>!staffIds.has(a.user.id)),candidates}
}
