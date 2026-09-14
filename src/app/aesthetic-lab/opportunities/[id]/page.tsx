import Link from 'next/link'
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  MapPin,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { claims, orgs, tasks, onboardingApplications, volunteerPrograms } from '@/lib/db/schema'
import { claimShiftAction } from '@/app/actions'
import { getOnboardingWaiverSetup, getWaiverSignatures } from '@/lib/services/waivers'
import { getOrganizationDocuments, ORGANIZATION_DOCUMENT_CATEGORY_DETAILS } from '@/lib/services/organization-documents'
import { getWaiversAttachedToTask } from '@/lib/services/organization-resources'
import { getShiftsWithCounts } from '@/lib/services/opportunities'
import { savedItemIds } from '@/lib/services/saved-items'
import { organizationFileDownloadUrl } from '@/lib/storage/organization-file-url'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { HistoryBackButton } from '../../HistoryBackButton'
import { LabNotice } from '../../LabNotice'
import { SaveTaskButton } from '../../SaveTaskButton'
import { DigitalWaiverSignature } from '../../DigitalWaiverSignature'
import { WithdrawCommitmentButton } from '../../WithdrawCommitmentButton'
import styles from '../../prototype.module.css'
import {programPolicy,scopeOf} from '@/lib/services/program-workspace'
import { getIntakeForm, getPublishedApplicationForTask, intakeApplicationForTaskScope, intakeReservationGate, getAdmissionDecision } from '@/lib/services/volunteer-intake'
import { ParticipantIntakeApplication, ParticipantProfileApplication } from '../../issuer/VolunteerIntakeControls'

export const dynamic = 'force-dynamic'

function shiftTime(startsAt: number | null, endsAt: number | null) {
  if (!startsAt) return 'Time to be confirmed'
  const start = new Date(startsAt).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const end = endsAt ? new Date(endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
  return end ? `${start}–${end}` : start
}

function sessionDate(startsAt: number | null) {
  if (!startsAt) return { day: 'TBD', date: '—' }
  const date = new Date(startsAt)
  return { day: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(), date: String(date.getDate()) }
}

function signatureDate(signedAt: number | null) {
  return signedAt ? new Date(signedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
}

export default async function LabOpportunityDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; error?: string } }) {
  const session = await requireRole('participant')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const task = (await db.select().from(tasks).where(eq(tasks.id, params.id)).limit(1))[0]
  const org = task ? (await db.select().from(orgs).where(eq(orgs.id, task.orgId)).limit(1))[0] : null

  if (!task || !org || task.status !== 'open' || (city && task.cityId !== city.id)) {
    return <main className={styles.app}>
      <LabHeader activeSection="opportunities" session={session} city={city} cities={cities} contexts={contexts} />
      <section className={styles.primaryColumn}><p className={styles.emptyCopy}>This opportunity is no longer available in your active city.</p><HistoryBackButton fallback="/aesthetic-lab/opportunities" /></section>
    </main>
  }

  const isOnboarding = task.isOnboarding === 1
  const [sessions, waiverSetup, myClaims, savedTaskIds, organizationDocuments, attachedWaivers, roleInterestRows, programRow] = await Promise.all([
    getShiftsWithCounts(task.id),
    getOnboardingWaiverSetup(org.id, task),
    db.select().from(claims).where(and(eq(claims.taskId, task.id), eq(claims.userId, session.sub))),
    savedItemIds(session.sub, 'task', [task.id]),
    getOrganizationDocuments(org.id),
    getWaiversAttachedToTask(task.id),
    !isOnboarding ? db.select({id:tasks.id,title:tasks.title}).from(tasks).where(and(
      eq(tasks.orgId,task.orgId),
      eq(tasks.cityId,task.cityId),
      eq(tasks.status,'open'),
      eq(tasks.isOnboarding,0),
      task.programId?eq(tasks.programId,task.programId):isNull(tasks.programId),
    )) : Promise.resolve([]),
    task.programId ? db.select({name:volunteerPrograms.name}).from(volunteerPrograms).where(eq(volunteerPrograms.id,task.programId)).limit(1).then(rows=>rows[0]??null) : Promise.resolve(null),
  ])

  const claimByShift = new Map(myClaims.map((claim) => [claim.shiftId, claim]))
  const visibleSessions = sessions.filter(({ shift }) => shift.visibility === 'public' || Boolean(claimByShift.get(shift.id) && claimByShift.get(shift.id)?.status !== 'unclaimed'))
  const intakeSetup = await getIntakeForm(task.id)
  const publishedApplication = isOnboarding ? null : await getPublishedApplicationForTask(task.id)
  const roleJoinMode = publishedApplication?.form ? 'form' : 'profile'
  const publicRoleApplication = !isOnboarding && Boolean(publishedApplication||intakeSetup.intake?.applicationPublic)
  const applicationRequired = Boolean(intakeSetup.intake?.applicationRequired && (isOnboarding || publicRoleApplication))
  const intakeGate = applicationRequired ? await intakeReservationGate(task.id, session.sub) : null
  const application = applicationRequired ? await intakeApplicationForTaskScope(task,session.sub) : null
  const admission = isOnboarding ? await getAdmissionDecision(org.id,session.sub) : null
  const welcomePolicy=intakeSetup?.intake ? null : await programPolicy(org.id,scopeOf(task.programId))
  const waivers = isOnboarding ? waiverSetup.waivers : attachedWaivers
  const waiverCollectionMethod = isOnboarding ? (waiverSetup.method ?? 'digital') : 'digital'
  const usesPaperWaiver = isOnboarding && waiverCollectionMethod === 'in_person'
  const allowsDigitalWaiver = !isOnboarding || waiverCollectionMethod !== 'in_person'
  const allowsPaperWaiver = isOnboarding && (waiverCollectionMethod === 'in_person' || waiverCollectionMethod === 'either')
  const waiverSignatures = await getWaiverSignatures(session.sub, waivers.map((waiver) => waiver.id))
  const unsignedWaivers = isOnboarding && waiverCollectionMethod === 'digital'
    ? waivers.filter((waiver) => !waiverSignatures.has(waiver.id))
    : []
  const includedDocuments = organizationDocuments.filter((document) => document.taskIds.includes(task.id))
  const sessionCount = visibleSessions.length
  const volunteerIntakeTitle = programRow?.name ?? `Volunteer with ${org.name}`

  return (
    <main className={styles.app}>
      <LabHeader activeSection="opportunities" session={session} city={city} cities={cities} contexts={contexts} />
      <section className={`${styles.detailLayout} ${styles.onboardingDetailLayout}`}>
        <aside className={styles.leftRail}>
          <section className={styles.cityCard}>
            <p className={styles.eyebrow}>{isOnboarding ? 'Onboarding with' : 'Volunteer with'}</p>
            <h2>{org.name}</h2>
            <p>Provided by an approved organization in {city?.name ?? 'your active city'}.</p>
            <Link href={`/aesthetic-lab/organizations/${org.slug}`}>View organization <ArrowUpRight size={14} /></Link>
          </section>
          <section className={styles.onboardingProcessCard}>
            <p className={styles.eyebrow}>How it works</p>
            <ol>
              <li><span>1</span><div><b>{applicationRequired ? 'Apply to volunteer' : 'Review the details'}</b><small>{applicationRequired ? `Receive application approval before choosing a ${isOnboarding ? 'date' : 'shift'}.` : 'Read the materials and waiver requirements.'}</small></div></li>
              <li><span>2</span><div><b>{isOnboarding ? 'Choose a session' : 'Choose a shift'}</b><small>{isOnboarding ? 'Reserve one date that works for you.' : 'Sign up for a shift that fits your schedule.'}</small></div></li>
              <li><span>3</span><div><b>Show up and check in</b><small>The organization confirms your attendance.</small></div></li>
              {isOnboarding && intakeSetup.intake?<li><span>4</span><div><b>Join the volunteer roster</b><small>The organization reviews your paperwork and approves your program access.</small></div></li>:null}
            </ol>
          </section>
        </aside>

        <section className={styles.primaryColumn} aria-label={isOnboarding ? 'Onboarding reservation' : 'Opportunity reservation'}>
          <HistoryBackButton fallback="/aesthetic-lab/opportunities" className={styles.onboardingBackLink} />
          {welcomePolicy&&welcomePolicy.onboardingMode!=='none'?<section className={styles.onboardingProcessCard}><b>Your volunteer welcome</b><p>Complete the organization’s checklist and request a personal profile review before joining its volunteer roster.</p><Link className={styles.catalogWorkspaceAction} href={'/aesthetic-lab/onboarding/'+org.id+'/'+scopeOf(task.programId)}>Open my checklist</Link></section>:null}
          <LabNotice ok={searchParams.ok} error={searchParams.error} />

          <section className={styles.onboardingHeroCard}>
            <div className={styles.onboardingHeroCopy}>
              <p className={styles.eyebrow}>{isOnboarding ? 'Start with this organization' : 'Volunteer opportunity'}</p>
              <h1>{task.title}</h1>
              <p>{task.description || 'Meet the organization, learn how its program works, and choose a time to take part.'}</p>
            </div>
            <div className={styles.onboardingHeroActions}>
              <SaveTaskButton taskId={task.id} saved={savedTaskIds.has(task.id)} redirectTo={`/aesthetic-lab/opportunities/${task.id}`} />
              <Link href={`/aesthetic-lab/organizations/${org.slug}`}>Organization profile <ArrowUpRight size={14} /></Link>
            </div>
            <div className={styles.onboardingFactGrid}>
              <div><MapPin size={18} /><span><b>Location</b><small>{task.location || 'Location to be confirmed'}</small></span></div>
              <div><UsersRound size={18} /><span><b>Capacity</b><small>{task.slots} spot{task.slots === 1 ? '' : 's'} per session</small></span></div>
              <div><CalendarDays size={18} /><span><b>Scheduled sessions</b><small>{sessionCount} available now</small></span></div>
            </div>
          </section>

          {applicationRequired && (isOnboarding || roleJoinMode==='form') && (isOnboarding?intakeSetup.form:publishedApplication?.form) ? <ParticipantIntakeApplication taskId={task.id} title={isOnboarding?task.title:volunteerIntakeTitle} form={isOnboarding?{id:intakeSetup.form!.id,introduction:intakeSetup.form!.introduction,questions:intakeSetup.questions}:{id:publishedApplication!.form.id,introduction:publishedApplication!.form.introduction,questions:publishedApplication!.questions,scope:publishedApplication!.form.scope,resumePolicy:publishedApplication!.form.resumePolicy,coverLetterPolicy:publishedApplication!.form.coverLetterPolicy}} status={application?.status??null} kind={isOnboarding ? 'onboarding' : 'role'} roles={roleInterestRows} blocked={admission?.status==='not_approved'?'Your participation at this organization was not approved. Contact the organization to request a review.':null}/> : null}
          {applicationRequired && !isOnboarding && roleJoinMode==='profile' ? <ParticipantProfileApplication taskId={task.id} title={volunteerIntakeTitle} status={application?.status??null} roles={roleInterestRows}/> : null}

          <section className={styles.onboardingResourceCard}>
            <div className={styles.onboardingCardHeading}>
              <div><p className={styles.eyebrow}>Before you reserve</p><h2>Resources and requirements</h2><p>Read or download the materials from {org.name}. The organization&apos;s waiver and check-in requirements are shown below.</p></div>
              <FileText size={20} />
            </div>
            <div className={styles.onboardingResourceList}>
              {waivers.length ? waivers.map((waiver) => {
                const signature = waiverSignatures.get(waiver.id)
                return <details className={styles.onboardingResourceItem} id={`waiver-${waiver.id}`} key={waiver.id}>
                <summary>
                  <span className={styles.onboardingResourceIcon}><ShieldCheck size={16} /></span>
                  <div><b>{waiver.title}</b><small>{usesPaperWaiver ? 'Bring a signed copy; the organization records receipt at check-in.' : signature ? `Digitally signed ${signatureDate(signature.signedAt)}.` : waiverCollectionMethod === 'either' ? 'Choose digital signing or a paper copy when you reserve.' : 'Required · review and sign before reserving a session.'}</small></div>
                  <ChevronDown size={16} />
                </summary>
                <div className={styles.onboardingResourcePreview}>
                  {waiver.body ? <p>{waiver.body}</p> : <p>This waiver is provided as a source document.</p>}
                  {waiver.documentUrl ? <a href={organizationFileDownloadUrl('waiver', waiver.id, task.id)} target="_blank" rel="noreferrer"><Download size={14} /> Download source file</a> : null}
                  {allowsDigitalWaiver ? signature ? <p className={styles.onboardingSignatureReceipt}><CheckCircle2 size={15} /> Signed electronically on {signatureDate(signature.signedAt)}. This receipt is private to you and {org.name}.</p> : <DigitalWaiverSignature taskId={task.id} waiver={{ id: waiver.id, title: waiver.title, version: waiver.version, body: waiver.body, hasDocument: Boolean(waiver.documentUrl), documentName: waiver.documentName }} redirectTo={`/aesthetic-lab/opportunities/${task.id}`} defaultSigningName={session.name} organizationName={org.name} /> : null}
                </div>
              </details>
              }) : isOnboarding ? <div className={styles.onboardingResourceEmpty}><ShieldCheck size={17} /><p><b>No waiver has been added.</b><br />This organization has not attached a liability waiver to this onboarding opportunity.</p></div> : null}
              {isOnboarding && waiverSetup.identityCheck === 'staff_attested' ? <div className={styles.onboardingResourceEmpty}><UsersRound size={17} /><p><b>Identity confirmation at check-in.</b><br />Organization staff will confirm that the person who arrives matches the City/Sync account used for this reservation. City/Sync does not retain identity documents.</p></div> : null}
              {includedDocuments.map((document) => <details className={styles.onboardingResourceItem} key={document.id}>
                <summary>
                  <span className={styles.onboardingResourceIcon}><FileText size={16} /></span>
                  <div><b>{document.title}</b><small>{ORGANIZATION_DOCUMENT_CATEGORY_DETAILS[document.category].label}{document.body ? ' · written guidance available' : ' · source file available'}</small></div>
                  <ChevronDown size={16} />
                </summary>
                <div className={styles.onboardingResourcePreview}>
                  {document.body ? <p>{document.body}</p> : <p>A preview is available for written guidance created in City/Sync. Attached source files can be downloaded below.</p>}
                  {document.documentUrl ? <a href={organizationFileDownloadUrl('document', document.id, task.id)} target="_blank" rel="noreferrer"><Download size={14} /> Download source file</a> : null}
                </div>
              </details>)}
              {!waivers.length && !includedDocuments.length ? <div className={styles.onboardingResourceEmpty}><FileText size={17} /><p><b>No materials have been added yet.</b><br />The organization will provide any relevant materials before the session.</p></div> : null}
            </div>
          </section>

          {admission?<section className={styles.onboardingProcessCard}><b>{admission.status==='approved'?'Your roster access is approved':admission.status==='needs_paperwork'?'Paperwork is still needed':'Your volunteer participation was not approved'}</b><p>{admission.status==='approved'?(admission.assignmentMode==='all'?'You can join this organization’s volunteer shifts across all programs.':'Your approval applies to the programs selected by the organization. Contact it before joining another program.'):admission.status==='needs_paperwork'?'Complete the unsigned waivers above, or give the organization your signed paper copies. Contact the organization to confirm any other required materials.':'Contact the organization if you would like it to review this decision. Existing commitments have not been cancelled.'}</p></section>:null}
          <section className={styles.onboardingSessionsCard} id="available-sessions">
            <div className={styles.onboardingCardHeading}>
              <div><p className={styles.eyebrow}>{isOnboarding ? 'Choose your onboarding date' : 'Choose a shift'}</p><h2>{sessionCount ? `${sessionCount} session${sessionCount === 1 ? '' : 's'} currently available` : 'No sessions currently available'}</h2><p>{isOnboarding ? 'A reservation holds one place for one session. It does not create a recurring commitment.' : 'Choose one shift that fits your schedule.'}</p></div>
              <CalendarDays size={20} />
            </div>
            <div className={styles.onboardingReservationList}>
              {visibleSessions.length ? visibleSessions.map(({ shift, slotsLeft }) => {
                const existing = claimByShift.get(shift.id)
                const date = sessionDate(shift.startsAt)
                const alreadyReserved = Boolean(existing && existing.status !== 'unclaimed')
                return <details className={styles.onboardingReservationSession} key={shift.id} open={visibleSessions.length === 1}>
                  <summary>
                    <time><span>{date.day}</span><b>{date.date}</b></time>
                    <div><b>{shiftTime(shift.startsAt, shift.endsAt)}</b><small>{shift.label || (isOnboarding ? 'Organization onboarding session' : 'Volunteer shift')} <i /> {task.location || 'Location to be confirmed'}</small></div>
                    <em>{alreadyReserved ? (existing?.status === 'claimed' ? 'Reserved' : existing?.status) : `${slotsLeft} of ${shift.capacity} open`}<ChevronDown size={16} /></em>
                  </summary>
                  <div className={styles.onboardingReservationBody}>
                    {alreadyReserved ? <div className={styles.onboardingReservationState}>
                      <span><CheckCircle2 size={17} /></span>
                      <div><b>{existing?.status === 'claimed' ? (isOnboarding ? 'Your spot is reserved.' : 'You’re signed up.') : existing?.status}</b><p>{isOnboarding ? 'Arrive ready to check in with the organization. Completed onboarding is then verified by their team.' : 'Your attendance will be confirmed by the organization after the shift.'}</p><Link className={styles.onboardingSessionDetailsLink} href={`/aesthetic-lab/opportunities/${task.id}/sessions/${shift.id}`}>View session details</Link></div>
                      {existing?.status === 'claimed' ? <WithdrawCommitmentButton claimId={existing.id} redirectTo={`/aesthetic-lab/opportunities/${task.id}`} organizationName={org.name} label={isOnboarding ? 'Cancel reservation' : 'Withdraw sign-up'} /> : null}
                    </div> : intakeGate && !intakeGate.ok ? <div className={styles.onboardingReservationUnavailable}><p>{intakeGate.error}</p>{applicationRequired && !application?<Link href="#application">Open application</Link>:null}</div> : shift.enrollmentMode === 'organization_managed' ? <p className={styles.onboardingReservationUnavailable}>This session’s roster is managed directly by the organization.</p>
                      : slotsLeft <= 0 ? <p className={styles.onboardingReservationUnavailable}>This session is currently full. Check back if another place opens.</p>
                        : unsignedWaivers.length > 0 ? <div className={styles.onboardingSignatureRequired}>
                          <ShieldCheck size={17} />
                          <div><b>Sign {unsignedWaivers.length === 1 ? 'the required waiver' : 'the required waivers'} first.</b><p>Review each waiver above and select <em>Review &amp; sign</em>. Your reservation will unlock as soon as they are signed.</p></div>
                        </div>
                        : <form action={claimShiftAction} className={styles.onboardingReservationForm}>
                          <input type="hidden" name="taskId" value={task.id} />
                          <input type="hidden" name="shiftId" value={shift.id} />
                          <input type="hidden" name="redirectTo" value={`/aesthetic-lab/opportunities/${task.id}`} />
                          <input type="hidden" name="successRedirectTo" value={`/aesthetic-lab/opportunities/${task.id}/sessions/${shift.id}`} />
                          {allowsPaperWaiver && waiverCollectionMethod === 'either' ? <fieldset className={styles.onboardingWaiverChoice}><legend>How will you complete the waiver?</legend><label><input type="radio" name="waiverCollectionMethod" value="digital" defaultChecked={waiverSignatures.size === waivers.length} /> Sign digitally now</label><label><input type="radio" name="waiverCollectionMethod" value="in_person" defaultChecked={waiverSignatures.size !== waivers.length} /> Bring a signed paper copy</label></fieldset> : <input type="hidden" name="waiverCollectionMethod" value={usesPaperWaiver ? 'in_person' : 'digital'} />}
                          {usesPaperWaiver || waiverCollectionMethod === 'either' ? <p className={styles.onboardingPaperWaiver}><ShieldCheck size={15} /> A paper-waiver reservation is provisional until the organization records receipt of your signed copy at check-in.</p> : null}
                          {waiverSetup.identityCheck === 'staff_attested' ? <p className={styles.onboardingPaperWaiver}><UsersRound size={15} /> The organization will confirm that you match your City/Sync account at check-in.</p> : null}
                          <label className={styles.reservationAcknowledgement}><input type="checkbox" name="attendanceAcknowledgement" value="yes" required /><span><b>I intend to attend this session.</b><small>If my plans change, I will cancel before the 24-hour cancellation cutoff.</small></span></label>
                          <div className={styles.onboardingReservationActions}><span>A reservation is for this date only.</span><button type="submit">{isOnboarding ? 'Reserve a spot' : 'Sign up'}</button></div>
                        </form>}
                  </div>
                </details>
              }) : <div className={styles.onboardingResourceEmpty}><CalendarDays size={17} /><p><b>{isOnboarding ? 'No dates have been published yet.' : 'No shifts have been published yet.'}</b><br />{isOnboarding ? 'Check the organization profile again soon for a new session.' : applicationRequired ? 'You can apply now; the organization will publish shifts for approved applicants.' : 'Check the organization profile again soon for a new opportunity.'}</p></div>}
            </div>
          </section>
        </section>

        <aside className={styles.rightRail}>
          <section className={styles.onboardingReservationGuide}>
            <span><ShieldCheck size={20} /></span>
            <p className={styles.eyebrow}>Your commitment</p>
            <h2>{isOnboarding ? 'One date. One place. A clear next step.' : 'Choose one way to help.'}</h2>
            <p>{isOnboarding ? 'Reserving a spot is not a recurring commitment. It simply lets the organization prepare for your arrival.' : 'Your sign-up reserves one place for one specific shift.'}</p>
          </section>
          <section className={styles.onboardingTrustCard}>
            <CheckCircle2 size={18} />
            <div><p className={styles.eyebrow}>City/Sync verified</p><b>Approved local organization</b><span>Session capacity and attendance are managed by {org.name}.</span></div>
          </section>
        </aside>
      </section>
    </main>
  )
}
