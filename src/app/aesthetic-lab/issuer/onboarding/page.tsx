import Link from 'next/link'
import { and, asc, eq, gte } from 'drizzle-orm'
import { FileText, ShieldCheck } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { attachOrganizationDocumentAction, createOnboardingSessionAction, updateOnboardingSessionAction } from '@/app/actions'
import { db } from '@/lib/db/client'
import { orgs, shifts, tasks } from '@/lib/db/schema'
import { getOnboardingWaiverSetup } from '@/lib/services/waivers'
import { getOrganizationDocuments, ORGANIZATION_DOCUMENT_CATEGORY_DETAILS } from '@/lib/services/organization-documents'
import { getVolunteerPrograms } from '@/lib/services/volunteer-programs'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { LabNotice } from '../../LabNotice'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import { OnboardingDocumentPicker } from '../OnboardingDocumentPicker'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

function localDateTimeValue(timestamp: number | null | undefined) {
  if (!timestamp) return ''
  const value = new Date(timestamp)
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset())
  return value.toISOString().slice(0, 16)
}

function onboardingDocumentAttachFormId(documentId: string) {
  return `onboarding-document-attach-${documentId}`
}

export default async function NewLabOnboardingPage({ searchParams }: { searchParams: { taskId?: string; ok?: string; error?: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const [waiverSetup, org, organizationDocuments, volunteerPrograms] = await Promise.all([
    getOnboardingWaiverSetup(orgId),
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    getOrganizationDocuments(orgId),
    getVolunteerPrograms(orgId),
  ])
  const editingTaskId = searchParams.taskId ?? null
  const candidateEditingTask = editingTaskId
    ? (await db.select().from(tasks).where(and(eq(tasks.id, editingTaskId), eq(tasks.orgId, orgId))).limit(1))[0] ?? null
    : null
  const editingTask = candidateEditingTask?.isOnboarding === 1 ? candidateEditingTask : null
  const sessionWaiverSetup = editingTask
    ? await getOnboardingWaiverSetup(orgId, editingTask)
    : waiverSetup
  const nextSession = editingTask
    ? (await db.select().from(shifts).where(and(eq(shifts.taskId, editingTask.id), gte(shifts.startsAt, Date.now()))).orderBy(asc(shifts.startsAt), asc(shifts.createdAt)).limit(1))[0] ?? null
    : null
  const isEditing = Boolean(editingTask)
  const durationMinutes = nextSession?.startsAt && nextSession.endsAt
    ? Math.max(30, Math.round((nextSession.endsAt - nextSession.startsAt) / 60_000))
    : 45
  const usesPaperWaivers = sessionWaiverSetup.method === 'in_person'
  const returnToWorkspace = '/aesthetic-lab/issuer/volunteers'
  const includedDocuments = editingTask ? organizationDocuments.filter((document) => document.taskIds.includes(editingTask.id)) : []
  const availableDocuments = editingTask ? organizationDocuments.filter((document) => !document.taskIds.includes(editingTask.id)) : []
  const manageUrl = editingTask ? `/aesthetic-lab/issuer/onboarding?taskId=${editingTask.id}` : '/aesthetic-lab/issuer/onboarding'
  const addDocumentUrl = editingTask
    ? `/aesthetic-lab/issuer/documents?category=guide&taskId=${editingTask.id}&returnTo=${encodeURIComponent(manageUrl)}`
    : '/aesthetic-lab/issuer/documents?category=guide'

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-volunteers" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerLayout}>
      <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
      <section className={styles.issuerMain} aria-label="Workspace">
        <section className={styles.issuerPageHero}>
          <div><p className={styles.eyebrow}>Volunteers · Onboarding</p><h1>{isEditing ? 'Manage your onboarding session.' : 'Create a first step.'}</h1><p>{isEditing ? 'Update the recurring session while keeping completed session history in place.' : 'Participants complete this local session to become City Members.'}</p></div>
          <Link href={returnToWorkspace} className={styles.catalogWorkspaceAction}>Back to Volunteers</Link>
        </section>
        <LabNotice hidden ok={searchParams.ok} error={searchParams.error} />
        <section className={styles.labPanel}>
              <form action={isEditing ? updateOnboardingSessionAction : createOnboardingSessionAction} className={styles.labForm}>
                {isEditing ? <input type="hidden" name="taskId" value={editingTask!.id} /> : <input type="hidden" name="redirectTo" value={returnToWorkspace} />}
                <div className={styles.labFormGrid}><label>Session title<input name="title" defaultValue={editingTask?.title ?? 'New volunteer orientation'} required /></label><label>Location<input name="location" defaultValue={editingTask?.location ?? ''} required placeholder="Address or meeting point" /></label></div>
                <label>Volunteer program <span>(optional)</span><select name="programId" defaultValue={editingTask?.programId ?? ''}><option value="">Not assigned to a program</option>{volunteerPrograms.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select><small>Connect this onboarding session to the program it prepares volunteers for.</small></label>
                <label>Description<textarea name="description" required defaultValue={editingTask?.description ?? 'A welcoming local orientation for people beginning with our organization.'} /></label>
                <label>Before the session <span>(optional)</span><textarea name="beforeSession" defaultValue={editingTask?.beforeSession ?? ''} placeholder="List anything participants should complete or review before they arrive." /></label>
                <label>What to bring <span>(optional)</span><textarea name="bringItems" defaultValue={editingTask?.bringItems ?? ''} placeholder="e.g. Photo ID, comfortable shoes, water bottle" /></label>
                <input type="hidden" name="credits" value={editingTask?.credits ?? 5} />
                {isEditing ? <input type="hidden" name="firstStartsAt" value={localDateTimeValue(nextSession?.startsAt)} /> : <label>First session<input type="datetime-local" name="firstStartsAt" defaultValue={localDateTimeValue(nextSession?.startsAt)} required /></label>}
                <div className={styles.labFormGrid}><label>Weekly capacity<input type="number" name="weeklyCapacity" min="1" defaultValue={nextSession?.capacity ?? editingTask?.slots ?? 20} required /></label><label>Duration (minutes)<input type="number" name="durationMinutes" min="30" defaultValue={durationMinutes} required /></label></div>
                <section className={styles.onboardingDocumentsCard}>
                  <div className={styles.onboardingDocumentsHeading}><div><p className={styles.eyebrow}>Session requirements</p><h2>Choose how this session handles waivers.</h2><p>These settings apply only to this onboarding series. Leave either setting at the organization default unless this program needs a different process.</p></div></div>
                  <div className={styles.labFormGrid}>
                    <label>Waiver collection<select name="onboardingWaiverMethod" defaultValue={editingTask?.onboardingWaiverMethod ?? ''}>
                      <option value="">Organization default ({waiverSetup.method === 'in_person' ? 'Paper waiver at check-in' : waiverSetup.method === 'either' ? 'Digital or paper waiver' : 'Digital signature'})</option>
                      <option value="digital">Digital signature before reserving</option>
                      <option value="in_person">Paper waiver attested at check-in</option>
                      <option value="either">Let participants choose digital or paper</option>
                    </select></label>
                    <label>Identity confirmation<select name="onboardingIdentityCheck" defaultValue={editingTask?.onboardingIdentityCheck ?? ''}>
                      <option value="">Organization default ({waiverSetup.identityCheck === 'staff_attested' ? 'Staff confirmation at check-in' : 'Not required'})</option>
                      <option value="not_required">Not required</option>
                      <option value="staff_attested">Staff confirmation at check-in</option>
                    </select></label>
                  </div>
                </section>
                <section className={styles.onboardingDocumentsCard}>
                  <div className={styles.onboardingDocumentsHeading}>
                    <div><p className={styles.eyebrow}>Included documents</p><h2>Materials participants receive for onboarding.</h2><p>Attach guides, forms, safety information, or other resources that participants should review before their session.</p></div>
                  </div>
                  {isEditing ? <>
                    {sessionWaiverSetup.waivers.length > 0 || includedDocuments.length > 0 ? <div className={styles.onboardingDocumentList}>
                      {sessionWaiverSetup.waivers.map((waiver) => <article key={waiver.id}>
                        <span><ShieldCheck size={17} /></span><div><p>Liability waiver</p><h3>{waiver.title}</h3><small>{usesPaperWaivers ? 'Paper receipt attested at check-in' : sessionWaiverSetup.method === 'either' ? 'Digital signature or paper receipt selected at reservation' : 'Digital signature required before reservation'} · Included with this onboarding session</small></div><Link href="/aesthetic-lab/issuer/waiver" className={styles.catalogWorkspaceAction}>Manage</Link>
                      </article>)}
                      {includedDocuments.map((document) => <article key={document.id}>
                      <span><FileText size={17} /></span><div><p>{ORGANIZATION_DOCUMENT_CATEGORY_DETAILS[document.category].label}</p><h3>{document.title}</h3><small>{document.documentUrl ? 'Source file attached' : 'Written guidance'} · Included with this onboarding session</small></div><Link href={`/aesthetic-lab/issuer/documents/${document.id}`} className={styles.catalogWorkspaceAction}>Manage</Link>
                      </article>)}</div> : <p className={styles.onboardingDocumentsEmpty}>No supplemental documents or waiver are included yet.</p>}
                    <OnboardingDocumentPicker
                      createDocumentHref={addDocumentUrl}
                      documents={organizationDocuments.map((document) => ({
                        id: document.id,
                        title: document.title,
                        categoryLabel: ORGANIZATION_DOCUMENT_CATEGORY_DETAILS[document.category].label,
                        attached: document.taskIds.includes(editingTask!.id),
                      }))}
                    />
                  </> : <p className={styles.onboardingDocumentsEmpty}>Save the session first, then add documents or forms that should be included for every participant.</p>}
                </section>
                <div className={styles.labFormActions}><Link className={`${styles.labLinkButton} ${styles.labLinkButtonSecondary}`} href={returnToWorkspace}>Cancel</Link><button className={styles.labButton} type="submit">{isEditing ? 'Save session' : 'Create recurring session'}</button></div>
              </form>
              {isEditing ? availableDocuments.map((document) => <form key={document.id} id={onboardingDocumentAttachFormId(document.id)} action={attachOrganizationDocumentAction}><input type="hidden" name="documentId" value={document.id} /><input type="hidden" name="taskId" value={editingTask!.id} /><input type="hidden" name="redirectTo" value={manageUrl} /></form>) : null}
        </section>
      </section>
    </div>
  </main>
}
