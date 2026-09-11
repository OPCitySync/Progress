'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/session'
import { getActiveCity } from '@/lib/services/city-networks'
import { hasOrganizationPermission } from '@/lib/services/identity-access'
import { archiveIntakeApplicationForm, createVolunteerIntake, inviteApprovedVolunteersToOnboardingSession, publishIntakeApplicationForm, saveIntakeApplicationForm, reviewIntakeApplication, saveVolunteerAdmission, setRolePublication, submitIntakeApplication, unpublishIntakeApplicationForm } from '@/lib/services/volunteer-intake'
import { publishOnboardingSession } from '@/lib/services/onboarding-session'

const field = (data: FormData, key: string) => String(data.get(key) ?? '')
const ids = (data: FormData, key: string) => Array.from(new Set(data.getAll(key).map(String)))
const fail = (error: string) => ({ ok: false as const, error })
function refresh() {
  revalidatePath('/aesthetic-lab/issuer/volunteers')
  revalidatePath('/aesthetic-lab/issuer')
  revalidatePath('/aesthetic-lab/issuer/programs/[id]', 'page')
  revalidatePath('/aesthetic-lab/opportunities', 'layout')
  revalidatePath('/aesthetic-lab/organizations/[slug]', 'page')
  revalidatePath('/aesthetic-lab/messages')
}
export async function volunteerIntakeAction(data: FormData) {
  const session = await requireRole('issuer'), orgId = session.orgId
  if (!orgId) return fail('Choose an organization first.')
  const operation = field(data, 'operation')
  if (!(await hasOrganizationPermission(session, ['application-review','admission-review','session-invite'].includes(operation) ? 'participants.manage' : 'opportunities.manage'))) return fail('Your role does not include this action.')
  try {
    let result: { ok: true } | { ok: false; error: string }
    if (operation === 'session') {
      const city = await getActiveCity(session)
      if (!city) return fail('Choose a city first.')
      result = await createVolunteerIntake({ orgId, actorId: session.sub, cityId: city.id, title: field(data,'title'), location: field(data,'location'), description: field(data,'description'), notes: field(data,'notes'), capacity: field(data,'capacity'), duration: Number(field(data,'duration')), assignmentMode: field(data,'assignmentMode'), programIds: ids(data,'programId') })
    } else if (operation === 'application-form') {
      result = await saveIntakeApplicationForm({ orgId, actorId:session.sub, taskId:field(data,'taskId'), introduction:field(data,'introduction'), questions:JSON.parse(field(data,'questions') || '[]'), required:data.has('required'), public:data.has('public'), sourceFormId:field(data,'sourceFormId')||undefined })
    } else if (operation === 'application-form-archive') {
      result = await archiveIntakeApplicationForm({orgId,actorId:session.sub,formId:field(data,'formId')})
    } else if (operation === 'application-form-publish') {
      result = await publishIntakeApplicationForm({orgId,actorId:session.sub,formId:field(data,'formId')})
    } else if (operation === 'application-form-unpublish') {
      result = await unpublishIntakeApplicationForm({orgId,actorId:session.sub,formId:field(data,'formId')})
    } else if (operation === 'session-invite') {
      result = await inviteApprovedVolunteersToOnboardingSession({orgId,actorId:session.sub,shiftId:field(data,'shiftId'),userIds:ids(data,'userId')})
    } else if (operation === 'role-publication') {
      result = await setRolePublication({ orgId, actorId:session.sub, taskId:field(data,'taskId'), published:field(data,'published') === 'true' })
    } else if (operation === 'publish') {
      result = await publishOnboardingSession({ orgId, actorId:session.sub, taskId:field(data,'taskId'), startsAt:Number(field(data,'startsAt')), recurring:data.has('recurring') })
    } else if (operation === 'application-review') {
      result = await reviewIntakeApplication({ orgId, actorId:session.sub, applicationId:field(data,'applicationId'), decision:field(data,'decision'), internalNote:field(data,'internalNote'), acceptanceSubject:field(data,'acceptanceSubject'), acceptanceMessage:field(data,'acceptanceMessage'), rejectionSubject:field(data,'rejectionSubject'), rejectionMessage:field(data,'rejectionMessage'), confirmed:data.has('confirmed') })
    } else if (operation === 'admission-review') {
      result = await saveVolunteerAdmission({ orgId, actorId:session.sub, claimId:field(data,'claimId'), decision:field(data,'decision'), assignmentMode:field(data,'assignmentMode'), programIds:ids(data,'programId'), paperWaiverIds:ids(data,'paperWaiverId'), documentIds:ids(data,'documentId'), internalNote:field(data,'internalNote'), confirmed:data.has('confirmed'), confirmRestriction:data.has('confirmRestriction') })
    } else return fail('Unknown onboarding action.')
    if (result.ok) refresh()
    return result
  } catch (error) {
    console.error('Volunteer intake action failed', error)
    return fail('Your change could not be saved. Please try again.')
  }
}
export async function participantIntakeAction(data: FormData) {
  const session = await requireRole('participant')
  try {
    const result = await submitIntakeApplication({ taskId:field(data,'taskId'), userId:session.sub, formId:field(data,'formId'), answers:JSON.parse(field(data,'answers') || '{}') })
    if(result.ok) refresh()
    return result
  } catch(error) {
    console.error('Volunteer application failed',error)
    return fail('Your application could not be sent. Your answers are still here; please try again.')
  }
}
