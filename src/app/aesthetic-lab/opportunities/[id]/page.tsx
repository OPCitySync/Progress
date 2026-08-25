import Link from 'next/link'
import {
  ArrowLeft,
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
import { and, eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { claims, orgs, tasks } from '@/lib/db/schema'
import { claimShiftAction, unclaimClaimAction } from '@/app/actions'
import { getOnboardingWaiverSetup, getWaiverSignatures } from '@/lib/services/waivers'
import { getOrganizationDocuments, ORGANIZATION_DOCUMENT_CATEGORY_DETAILS } from '@/lib/services/organization-documents'
import { getWaiversAttachedToTask } from '@/lib/services/organization-resources'
import { getShiftsWithCounts } from '@/lib/services/opportunities'
import { savedItemIds } from '@/lib/services/saved-items'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { LabNotice } from '../../LabNotice'
import { SaveTaskButton } from '../../SaveTaskButton'
import { DigitalWaiverSignature } from '../../DigitalWaiverSignature'
import styles from '../../prototype.module.css'

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
      <section className={styles.primaryColumn}><p className={styles.emptyCopy}>This opportunity is no longer available in your active city.</p><Link href="/aesthetic-lab/opportunities">Back to opportunities</Link></section>
    </main>
  }

  const [sessions, waiverSetup, myClaims, savedTaskIds, organizationDocuments, attachedWaivers] = await Promise.all([
    getShiftsWithCounts(task.id),
    getOnboardingWaiverSetup(org.id),
    db.select().from(claims).where(and(eq(claims.taskId, task.id), eq(claims.userId, session.sub))),
    savedItemIds(session.sub, 'task', [task.id]),
    getOrganizationDocuments(org.id),
    getWaiversAttachedToTask(task.id),
  ])

  const claimByShift = new Map(myClaims.map((claim) => [claim.shiftId, claim]))
  const visibleSessions = sessions.filter(({ shift }) => shift.visibility === 'public' || Boolean(claimByShift.get(shift.id) && claimByShift.get(shift.id)?.status !== 'unclaimed'))
  const isOnboarding = task.isOnboarding === 1
  const waivers = isOnboarding ? waiverSetup.waivers : attachedWaivers
  const usesPaperWaiver = isOnboarding && waiverSetup.method === 'in_person'
  const waiverSignatures = await getWaiverSignatures(session.sub, waivers.map((waiver) => waiver.id))
  const unsignedWaivers = isOnboarding && !usesPaperWaiver
    ? waivers.filter((waiver) => !waiverSignatures.has(waiver.id))
    : []
  const includedDocuments = organizationDocuments.filter((document) => document.taskIds.includes(task.id))
  const sessionCount = visibleSessions.length
  const backLabel = isOnboarding ? 'Back to onboarding' : 'Back to opportunities'

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
              <li><span>1</span><div><b>Review the details</b><small>Read the materials and waiver requirements.</small></div></li>
              <li><span>2</span><div><b>Choose a session</b><small>Reserve one date that works for you.</small></div></li>
              <li><span>3</span><div><b>Show up and check in</b><small>The organization confirms your attendance.</small></div></li>
            </ol>
          </section>
        </aside>

        <section className={styles.primaryColumn} aria-label={isOnboarding ? 'Onboarding reservation' : 'Opportunity reservation'}>
          <Link href="/aesthetic-lab/opportunities" className={styles.onboardingBackLink}><ArrowLeft size={15} /> {backLabel}</Link>
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

          <section className={styles.onboardingResourceCard}>
            <div className={styles.onboardingCardHeading}>
              <div><p className={styles.eyebrow}>Before you reserve</p><h2>Resources and requirements</h2><p>Read or download the materials from {org.name}. Any required digital waiver is accepted when you reserve a session below.</p></div>
              <FileText size={20} />
            </div>
            <div className={styles.onboardingResourceList}>
              {waivers.length ? waivers.map((waiver) => {
                const signature = waiverSignatures.get(waiver.id)
                return <details className={styles.onboardingResourceItem} id={`waiver-${waiver.id}`} key={waiver.id}>
                <summary>
                  <span className={styles.onboardingResourceIcon}><ShieldCheck size={16} /></span>
                  <div><b>{waiver.title}</b><small>{usesPaperWaiver ? 'Signature is collected in person at check-in.' : signature ? `Digitally signed ${signatureDate(signature.signedAt)}.` : 'Required · review and sign before reserving a session.'}</small></div>
                  <ChevronDown size={16} />
                </summary>
                <div className={styles.onboardingResourcePreview}>
                  {waiver.body ? <p>{waiver.body}</p> : <p>This waiver is provided as a source document.</p>}
                  {waiver.documentUrl ? <a href={waiver.documentUrl} target="_blank" rel="noreferrer"><Download size={14} /> Download source file</a> : null}
                  {!usesPaperWaiver ? signature ? <p className={styles.onboardingSignatureReceipt}><CheckCircle2 size={15} /> Signed electronically on {signatureDate(signature.signedAt)}. This receipt is private to you and {org.name}.</p> : <DigitalWaiverSignature taskId={task.id} waiver={waiver} redirectTo={`/aesthetic-lab/opportunities/${task.id}`} defaultSigningName={session.name} organizationName={org.name} /> : null}
                </div>
              </details>
              }) : isOnboarding ? <div className={styles.onboardingResourceEmpty}><ShieldCheck size={17} /><p><b>No waiver has been added.</b><br />This organization has not attached a liability waiver to this onboarding opportunity.</p></div> : null}
              {includedDocuments.map((document) => <details className={styles.onboardingResourceItem} key={document.id}>
                <summary>
                  <span className={styles.onboardingResourceIcon}><FileText size={16} /></span>
                  <div><b>{document.title}</b><small>{ORGANIZATION_DOCUMENT_CATEGORY_DETAILS[document.category].label}{document.body ? ' · written guidance available' : ' · source file available'}</small></div>
                  <ChevronDown size={16} />
                </summary>
                <div className={styles.onboardingResourcePreview}>
                  {document.body ? <p>{document.body}</p> : <p>A preview is available for written guidance created in City/Sync. Attached source files can be downloaded below.</p>}
                  {document.documentUrl ? <a href={document.documentUrl} target="_blank" rel="noreferrer"><Download size={14} /> Download source file</a> : null}
                </div>
              </details>)}
              {!waivers.length && !includedDocuments.length ? <div className={styles.onboardingResourceEmpty}><FileText size={17} /><p><b>No materials have been added yet.</b><br />The organization will provide any relevant materials before the session.</p></div> : null}
            </div>
          </section>

          <section className={styles.onboardingSessionsCard}>
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
                      {existing?.status === 'claimed' ? <form action={unclaimClaimAction}><input type="hidden" name="claimId" value={existing.id} /><input type="hidden" name="redirectTo" value={`/aesthetic-lab/opportunities/${task.id}`} /><button type="submit">Cancel reservation</button></form> : null}
                    </div> : shift.enrollmentMode === 'organization_managed' ? <p className={styles.onboardingReservationUnavailable}>This session’s roster is managed directly by the organization.</p>
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
                          {usesPaperWaiver ? <p className={styles.onboardingPaperWaiver}><ShieldCheck size={15} /> Your reservation is provisional until the organization records your in-person waiver at check-in.</p> : null}
                          <label className={styles.reservationAcknowledgement}><input type="checkbox" name="attendanceAcknowledgement" value="yes" required /><span><b>I intend to attend this session.</b><small>If my plans change, I will cancel before the 24-hour cancellation cutoff.</small></span></label>
                          <div className={styles.onboardingReservationActions}><span>A reservation is for this date only.</span><button type="submit">{isOnboarding ? 'Reserve a spot' : 'Sign up'}</button></div>
                        </form>}
                  </div>
                </details>
              }) : <div className={styles.onboardingResourceEmpty}><CalendarDays size={17} /><p><b>No dates have been published yet.</b><br />Check the organization profile again soon for a new session.</p></div>}
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
