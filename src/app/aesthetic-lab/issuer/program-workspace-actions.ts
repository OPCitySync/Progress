'use server'

import { randomUUID } from 'crypto'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { claims, messageRecipients, notifications, organizationDocuments, orgMessages, orgs, programApplicants, programDocumentReceipts, programMetricEntries, programMetrics, programRecognitions, programWorkAreas, programWorkspaceSettings, shifts, tasks, users, volunteerRosterMembers } from '@/lib/db/schema'
import { hasOrganizationPermission, isActiveOrganizationStaff, type OrganizationPermission } from '@/lib/services/identity-access'
import { programBelongsToOrganization } from '@/lib/services/volunteer-programs'
import { candidateReadiness, onboardingMaterials, programPolicy, recordCandidateSubmission, registerProgramCandidate, stringIds } from '@/lib/services/program-workspace'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import { signWaiver } from '@/lib/services/waivers'
import { createTask } from '@/lib/services/opportunities'
import { getActiveCity } from '@/lib/services/city-networks'

const field = (form: FormData, name: string) => String(form.get(name) ?? '').trim()
const ids = (form: FormData, name: string) => Array.from(new Set(form.getAll(name).map(String)))
const fail = (error: string) => ({ ok: false as const, error })
function dateValid(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value }

type RoleShiftInput = {
  startsAt: number
  durationMinutes: number
  recurring: boolean
}

function roleShiftInputs(value: string): RoleShiftInput[] | null {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed) || parsed.length > 21) return null
    const shifts = parsed.map((item): RoleShiftInput | null => {
      if (!item || typeof item !== 'object') return null
      const candidate = item as Record<string, unknown>
      const startsAt = Number(candidate.startsAt)
      const durationMinutes = Number(candidate.durationMinutes)
      if (!Number.isFinite(startsAt) || !Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 24 * 60 || typeof candidate.recurring !== 'boolean') return null
      return { startsAt, durationMinutes, recurring: candidate.recurring }
    })
    if (shifts.some((shift) => !shift)) return null
    const valid = shifts as RoleShiftInput[]
    return new Set(valid.map((shift) => shift.startsAt)).size === valid.length ? valid : null
  } catch {
    return null
  }
}

export async function programWorkspaceAction(form: FormData) {
  const session = await requireRole('issuer')
  const orgId = session.orgId
  if (!orgId) return fail('Choose an organization first.')
  const scope = field(form, 'scope')
  if (!scope || !(await programBelongsToOrganization(orgId, scope === 'organization' ? null : scope))) return fail('Program not found.')
  const operation = field(form, 'operation')
  const permission: OrganizationPermission = ['review', 'paper', 'recognize'].includes(operation) ? 'participants.manage' : 'opportunities.manage'
  if (!(await hasOrganizationPermission(session, permission))) return fail('Your organization role does not include this action.')
  const now = Date.now()
  const href = `/aesthetic-lab/issuer/programs/${scope}`
  try {
    if (operation === 'onboarding') {
      const mode = field(form, 'mode')
      const method = field(form, 'waiverMethod')
      if (!['organization', 'program', 'none'].includes(mode) || !['digital', 'paper', 'either'].includes(method)) return fail('Choose an onboarding approach and waiver method.')
      if (scope === 'organization' && mode === 'organization') return fail('Configure shared onboarding here, or choose no onboarding.')
      const documents = await db.select().from(organizationDocuments).where(and(eq(organizationDocuments.orgId, orgId), eq(organizationDocuments.active, 1)))
      const selected = ids(form, 'documentId')
      if (selected.some(id => !documents.some(d => d.id === id))) return fail('Choose an active document from your organization library.')
      const value = { onboardingMode: mode as 'organization' | 'program' | 'none', headline: field(form, 'headline').slice(0,180), welcome: field(form, 'welcome').slice(0,2000), requireSession: form.has('requireSession') ? 1 : 0, waiverMethod: method as 'digital' | 'paper' | 'either', documentIds: JSON.stringify(selected), updatedAt: now }
      if(mode!=='program'){
        const previous=(await db.select().from(programWorkspaceSettings).where(and(eq(programWorkspaceSettings.orgId,orgId),eq(programWorkspaceSettings.scope,scope))).limit(1))[0]
        if(previous)Object.assign(value,{headline:previous.headline,welcome:previous.welcome,requireSession:previous.requireSession,waiverMethod:previous.waiverMethod,documentIds:previous.documentIds})
      }
      await db.transaction(async tx => {
        await tx.insert(programWorkspaceSettings).values({ id: randomUUID(), orgId, scope, ...value }).onConflictDoUpdate({ target: [programWorkspaceSettings.orgId, programWorkspaceSettings.scope], set: value })
        await appendEvent(tx, EventTypes.PROGRAM_ONBOARDING_CONFIGURED, { orgId, programId: scope, mode, requireSession: Boolean(value.requireSession), waiverMethod: method, documentIds: selected }, session.sub)
      })
    } else if (operation === 'area') {
      const existingId = field(form, 'id')
      const id = existingId || randomUUID()
      const title = field(form, 'title')
      const status = field(form, 'status')
      if (!title || title.length > 100 || !['exploring','active','complete'].includes(status)) return fail('Give this area a title and status.')
      if (existingId && !(await db.select().from(programWorkAreas).where(and(eq(programWorkAreas.id,id), eq(programWorkAreas.orgId,orgId), eq(programWorkAreas.scope,scope))).limit(1))[0]) return fail('Area not found.')
      const taskIds = ids(form, 'taskId')
      const ownedTasks = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.orgId, orgId), scope === 'organization' ? isNull(tasks.programId) : eq(tasks.programId, scope), eq(tasks.isOnboarding, 0)))
      if (taskIds.some(id => !ownedTasks.some(t => t.id === id))) return fail('Choose volunteer positions from this program.')
      const value = { title, purpose: field(form,'purpose').slice(0,1000), nextStep: field(form,'nextStep').slice(0,1000), status: status as 'exploring'|'active'|'complete', taskIds: JSON.stringify(taskIds), updatedAt: now }
      await db.transaction(async tx => {
        if (existingId) await tx.update(programWorkAreas).set(value).where(eq(programWorkAreas.id,id))
        else await tx.insert(programWorkAreas).values({ id, orgId, scope, ...value })
        await appendEvent(tx, EventTypes.PROGRAM_WORK_AREA_UPDATED, { orgId, programId: scope, areaId: id, title, status, positionIds:taskIds, hasPurpose:Boolean(value.purpose),hasNextStep:Boolean(value.nextStep) }, session.sub)
      })
    } else if (operation === 'metric') {
      const title = field(form,'title'), unit = field(form,'unit'), start = field(form,'periodStart'), end = field(form,'periodEnd')
      const target = field(form,'target') ? Number(field(form,'target')) : null
      if (!title || title.length > 100 || !unit || unit.length > 50 || !dateValid(start) || !dateValid(end) || start > end || (target !== null && (!Number.isFinite(target) || target <= 0))) return fail('Enter a metric, unit, valid reporting period, and a positive target if needed.')
      const id = randomUUID()
      await db.transaction(async tx => {
        await tx.insert(programMetrics).values({ id, orgId, scope, title, unit, target, periodStart: start, periodEnd: end, createdAt: now })
        await appendEvent(tx, EventTypes.PROGRAM_METRIC_CREATED, { orgId, programId:scope, metricId:id, title, unit, target, periodStart:start, periodEnd:end }, session.sub)
      })
    } else if (operation === 'measurement') {
      const metric = (await db.select().from(programMetrics).where(and(eq(programMetrics.id,field(form,'metricId')),eq(programMetrics.orgId,orgId),eq(programMetrics.scope,scope),isNull(programMetrics.archivedAt))).limit(1))[0]
      const amount = Number(field(form,'amount')), date = field(form,'date')
      if (!metric || !field(form,'amount') || !Number.isFinite(amount) || !dateValid(date) || date < metric.periodStart || date > metric.periodEnd) return fail('Enter a valid amount and date inside this metric’s reporting period.')
      const note = field(form,'note').slice(0,500)
      if (amount < 0 && !note) return fail('Add a note explaining this correction.')
      await db.transaction(async tx => {
        await tx.insert(programMetricEntries).values({ id:randomUUID(), metricId:metric.id, orgId, amount, date, note, actorId:session.sub, createdAt:now })
        await appendEvent(tx, EventTypes.PROGRAM_METRIC_RECORDED, { orgId, programId:scope, metricId:metric.id, title:metric.title, amount, unit:metric.unit, date, hasNote:Boolean(note) }, session.sub)
      })
    } else if (operation === 'paper' || operation === 'review') {
      const candidate = (await db.select().from(programApplicants).where(and(eq(programApplicants.id,field(form,'candidateId')),eq(programApplicants.orgId,orgId))).limit(1))[0]
      const policy = await programPolicy(orgId,scope)
      if (!candidate || candidate.scope !== (policy?.scope ?? scope)) return fail('Candidate not found in this onboarding pathway.')
      if (await isActiveOrganizationStaff(orgId,candidate.userId)) return fail('Staff members cannot join their organization as volunteers.')
      if (operation === 'paper') {
        if (!policy || policy.waiverMethod === 'digital' || !form.has('confirmed')) return fail('Confirm receipt of the signed paper waivers.')
        const required=await onboardingMaterials(orgId,scope)
        await db.transaction(async tx => {
          await tx.update(programApplicants).set({paperWaiverConfirmedAt:now,paperWaiverIds:JSON.stringify(required.waivers.map(w=>w.id)),updatedAt:now}).where(eq(programApplicants.id,candidate.id))
          // A receipt recorded during profile review also satisfies the paper
          // receipt step on the person's existing orientation reservations.
          if(required.sessions.length)await tx.update(claims).set({paperWaiverConfirmedAt:now,paperWaiverConfirmedBy:session.sub,updatedAt:now}).where(and(eq(claims.userId,candidate.userId),inArray(claims.taskId,required.sessions.map(t=>t.id)),eq(claims.waiverCollectionMethod,'in_person'),inArray(claims.status,['claimed','submitted'])))
          await appendEvent(tx, EventTypes.WAIVER_RECEIPT_ATTESTED, {orgId,programId:candidate.scope,participantId:candidate.userId,applicationId:candidate.id,waiverVersionIds:required.waivers.map(w=>w.id)},session.sub)
        })
      } else {
        const decision = field(form,'decision')
        if (!form.has('reviewed') || !['approved','declined'].includes(decision)) return fail('Review the profile and confirm your decision.')
        const readiness = await candidateReadiness(orgId,scope,candidate.userId)
        if (decision === 'approved' && !readiness.complete) return fail('This candidate still has incomplete onboarding requirements.')
        if (candidate.status === 'approved') return fail('This candidate is already approved.')
        await db.transaction(async tx => {
          await tx.update(programApplicants).set({status:decision as 'approved'|'declined',reviewedAt:now,reviewedBy:session.sub,updatedAt:now}).where(eq(programApplicants.id,candidate.id))
          if (decision === 'approved') await tx.insert(volunteerRosterMembers).values({id:randomUUID(),orgId,userId:candidate.userId,source:'approval',invitedByUserId:session.sub,joinedAt:now}).onConflictDoNothing({target:[volunteerRosterMembers.orgId,volunteerRosterMembers.userId]})
          await tx.insert(notifications).values({id:randomUUID(),userId:candidate.userId,kind:'program_application_review',title:decision === 'approved' ? 'Welcome to the volunteer roster' : 'Your onboarding has been reviewed',body:decision === 'approved' ? 'The organization reviewed your profile and approved your participation.' : 'The organization is not adding you to this roster at this time.',link:`/aesthetic-lab/onboarding/${orgId}/${candidate.scope}`,createdAt:now})
          await appendEvent(tx,EventTypes.PROGRAM_CANDIDATE_REVIEWED,{orgId,programId:candidate.scope,participantId:candidate.userId,applicationId:candidate.id,decision},session.sub)
        })
      }
    } else if (operation === 'recognize') {
      const shift = (await db.select({shift:shifts,task:tasks}).from(shifts).innerJoin(tasks,eq(shifts.taskId,tasks.id)).where(and(eq(shifts.id,field(form,'shiftId')),eq(tasks.orgId,orgId),scope==='organization'?isNull(tasks.programId):eq(tasks.programId,scope))).limit(1))[0]
      if (!shift) return fail('Choose a completed shift from this program.')
      const kind = field(form,'kind'), message = field(form,'message'), userId=field(form,'userId')
      if (!['personal','team','letter'].includes(kind) || !message || message.length>3000) return fail('Write an appreciation message of up to 3,000 characters.')
      const recipients = await db.select({user:users}).from(claims).innerJoin(users,eq(claims.userId,users.id)).where(and(eq(claims.shiftId,shift.shift.id),eq(claims.status,'verified')))
      const selected = kind==='personal' ? recipients.filter(r=>r.user.id===userId) : recipients
      if (!selected.length) return fail('Choose someone with verified participation in this shift.')
      const id=randomUUID(), messageId=randomUUID()
      await db.transaction(async tx=>{
        await tx.insert(programRecognitions).values({id,orgId,scope,shiftId:shift.shift.id,userId:kind==='personal'?userId:null,kind:kind as 'personal'|'team'|'letter',message,recipientNames:selected.map(r=>r.user.name).join(', '),actorId:session.sub,createdAt:now})
        await tx.insert(orgMessages).values({id:messageId,orgId,senderUserId:session.sub,scope:'members',taskId:shift.task.id,subject:`Thank you — ${shift.task.title}`,body:message,recipientCount:selected.length,createdAt:now})
        for(const {user} of selected) await tx.insert(messageRecipients).values({id:randomUUID(),messageId,userId:user.id,createdAt:now})
        await appendEvent(tx,EventTypes.PROGRAM_RECOGNITION_CREATED,{orgId,programId:scope,recognitionId:id,shiftId:shift.shift.id,taskId:shift.task.id,kind,recipientIds:selected.map(r=>r.user.id),messageId},session.sub)
      })
    } else if(operation==='position'){
      const city=await getActiveCity(session)
      if(!city) return fail('Choose a city first.')
      const fallbackDuration=Number(field(form,'defaultDurationMinutes'))
      const roleShifts=roleShiftInputs(field(form,'roleShifts'))
      if(!roleShifts)return fail('Review the saved shifts and try again.')
      const durationMinutes=roleShifts[0]?.durationMinutes??fallbackDuration
      const visibility=field(form,'visibility')==='private'?'private':'public'
      if(!Number.isInteger(durationMinutes)||durationMinutes<15||durationMinutes>24*60)return fail('The shift must last between 15 minutes and 24 hours.')
      const capacity=Number(field(form,'capacity'))
      const result=await createTask({
        orgId,cityId:city.id,actorId:session.sub,
        title:field(form,'title'),description:field(form,'description'),location:field(form,'location'),
        credits:10,slots:capacity,defaultDurationMinutes:durationMinutes,startsAt:'',programId:scope==='organization'?null:scope,
        initialShifts:roleShifts.map((shift)=>({...shift,capacity,visibility})),
      })
      if(!result.ok)return result
    } else return fail('Unknown workspace action.')
    revalidatePath(href)
    revalidatePath('/aesthetic-lab/issuer/volunteers')
    revalidatePath('/aesthetic-lab/opportunities')
    revalidatePath('/aesthetic-lab')
    return {ok:true as const}
  } catch(error) {
    console.error('Program workspace action failed',error)
    return fail('The change could not be saved. Please try again.')
  }
}

export async function participantOnboardingAction(form: FormData) {
  const session=await requireRole('participant')
  const orgId=field(form,'orgId'),scope=field(form,'scope')
  const org=(await db.select().from(orgs).where(and(eq(orgs.id,orgId),eq(orgs.status,'approved'))).limit(1))[0]
  if(!org || !(await programBelongsToOrganization(orgId,scope==='organization'?null:scope))) return fail('Onboarding not found.')
  if(await isActiveOrganizationStaff(orgId,session.sub)) return fail('Your staff role takes priority within this organization.')
  const materials=await onboardingMaterials(orgId,scope)
  if(!materials.policy || materials.policy.onboardingMode==='none') return fail('This onboarding pathway is not active.')
  const operation=field(form,'operation')
  try {
    if(operation==='start'){
      await db.transaction(tx=>registerProgramCandidate(tx,orgId,materials.policy!.scope,session.sub))
    } else if(operation==='sign'){
      const waiver=materials.waivers.find(w=>w.id===field(form,'waiverId'))
      if(!waiver || materials.policy.waiverMethod==='paper')return fail('This waiver is not available for digital signing.')
      const result=await signWaiver({waiverVersionId:waiver.id,userId:session.sub,signerName:field(form,'signerName'),electronicConsent:form.has('consent')})
      if(!result.ok)return result
    } else if(operation==='receipt'){
      const document=materials.documents.find(d=>d.id===field(form,'documentId'))
      if(!document || !form.has('received'))return fail('Confirm you received and reviewed this document.')
      await db.transaction(async tx=>{
        await tx.insert(programDocumentReceipts).values({id:randomUUID(),orgId,userId:session.sub,documentId:document.id,documentUpdatedAt:document.updatedAt,receivedAt:Date.now()}).onConflictDoNothing()
        await appendEvent(tx,EventTypes.PROGRAM_DOCUMENT_RECEIVED,{orgId,programId:materials.policy!.scope,userId:session.sub,documentId:document.id,documentUpdatedAt:document.updatedAt},session.sub)
      })
    } else if(operation==='submit'){
      const result=await recordCandidateSubmission(orgId,scope,session.sub)
      if(!result.ok)return result
    } else return fail('Unknown onboarding action.')
    revalidatePath(`/aesthetic-lab/onboarding/${orgId}/${scope}`)
    revalidatePath('/aesthetic-lab/issuer/programs/[id]','page')
    return {ok:true as const}
  }catch(error){console.error('Onboarding action failed',error);return fail('Your progress could not be saved. Please try again.')}
}
