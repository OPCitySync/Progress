import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { ArrowUpRight, Bookmark, Building2, CalendarDays, CheckCircle2, ChevronDown, ClipboardCheck, Download, FileText, Heart, Mail, MapPin, Phone, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { claims, orgs, shifts, tasks, volunteerIdentityVerifications } from '@/lib/db/schema'
import { getOnboardingWaiverSetup, getWaiverSignatures } from '@/lib/services/waivers'
import { getOrganizationDocuments, ORGANIZATION_DOCUMENT_CATEGORY_DETAILS } from '@/lib/services/organization-documents'
import { getWaiversAttachedToTask } from '@/lib/services/organization-resources'
import { getShiftsWithCounts } from '@/lib/services/opportunities'
import { getCityImpact } from '@/lib/services/leaderboard'
import { getParticipantOrganizations } from '@/lib/services/participant-workspace'
import { getMyResume } from '@/lib/services/resume'
import { getProfile } from '@/lib/services/profile'
import { organizationFileDownloadUrl } from '@/lib/storage/organization-file-url'
import { getLabWorkspace } from '../../../../lab-workspace'
import { LabHeader } from '../../../../LabHeader'
import { LabNotice } from '../../../../LabNotice'
import { DigitalWaiverSignature } from '../../../../DigitalWaiverSignature'
import styles from '../../../../prototype.module.css'

export const dynamic = 'force-dynamic'

function sessionTime(startsAt: number | null, endsAt: number | null) {
  if (!startsAt) return 'Time to be confirmed'
  const start = new Date(startsAt).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const end = endsAt ? new Date(endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
  return end ? `${start}–${end}` : start
}

function signatureDate(signedAt: number | null) {
  return signedAt ? new Date(signedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
}

function shortTime(timestamp: number | null) {
  if (!timestamp) return 'Time TBD'
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function cancellationCopy(startsAt: number | null) {
  if (!startsAt) return 'Return to the opportunity page to withdraw your reservation if your plans change.'
  const cutoff = new Date(startsAt - 24 * 60 * 60 * 1000)
  return `Return to the opportunity page to withdraw your reservation by ${cutoff.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. After that, contact the organization directly.`
}

export default async function ReservedSessionPage({
  params,
  searchParams,
}: {
  params: { id: string; shiftId: string }
  searchParams: { ok?: string; error?: string }
}) {
  const session = await requireRole('participant')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const record = (await db
    .select({ task: tasks, organization: orgs, shift: shifts })
    .from(shifts)
    .innerJoin(tasks, eq(shifts.taskId, tasks.id))
    .innerJoin(orgs, eq(tasks.orgId, orgs.id))
    .where(and(eq(shifts.id, params.shiftId), eq(tasks.id, params.id)))
    .limit(1))[0]

  if (!record || (city && record.task.cityId !== city.id)) redirect('/aesthetic-lab/opportunities')

  const claim = (await db
    .select()
    .from(claims)
    .where(and(eq(claims.shiftId, record.shift.id), eq(claims.userId, session.sub)))
    .limit(1))[0]
  if (!claim || claim.status === 'unclaimed') {
    redirect(`/aesthetic-lab/opportunities/${record.task.id}?error=${encodeURIComponent('Reserve this session before opening its preparation page.')}`)
  }

  const isOnboarding = record.task.isOnboarding === 1
  const [waiverSetup, attachedWaivers, organizationDocuments, shiftRows, profile, resume, joinedOrganizations, impact, identityVerification, activeClaimRows, cityEvents] = await Promise.all([
    getOnboardingWaiverSetup(record.organization.id, record.task),
    getWaiversAttachedToTask(record.task.id),
    getOrganizationDocuments(record.organization.id),
    getShiftsWithCounts(record.task.id),
    getProfile(record.organization.id),
    getMyResume(session.sub),
    getParticipantOrganizations(session.sub),
    getCityImpact(city?.id),
    db
      .select({ status: volunteerIdentityVerifications.status })
      .from(volunteerIdentityVerifications)
      .where(and(
        eq(volunteerIdentityVerifications.orgId, record.organization.id),
        eq(volunteerIdentityVerifications.userId, session.sub),
      ))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    city
      ? db
          .select({ claim: claims })
          .from(claims)
          .innerJoin(tasks, eq(claims.taskId, tasks.id))
          .where(and(eq(claims.userId, session.sub), eq(tasks.cityId, city.id), inArray(claims.status, ['claimed', 'submitted'])))
      : Promise.resolve([]),
    city
      ? db
          .select({ task: tasks, organization: orgs, shift: shifts })
          .from(shifts)
          .innerJoin(tasks, eq(shifts.taskId, tasks.id))
          .innerJoin(orgs, eq(tasks.orgId, orgs.id))
          .where(and(eq(tasks.cityId, city.id), eq(tasks.status, 'open'), eq(shifts.status, 'open'), eq(shifts.visibility, 'public')))
          .orderBy(asc(shifts.startsAt), asc(shifts.createdAt))
          .limit(3)
      : Promise.resolve([]),
  ])
  const waivers = isOnboarding ? waiverSetup.waivers : attachedWaivers
  const waiverCollectionMethod = isOnboarding ? (claim.waiverCollectionMethod ?? waiverSetup.method ?? 'digital') : 'digital'
  const usesPaperWaiver = isOnboarding && waiverCollectionMethod === 'in_person'
  const signatures = await getWaiverSignatures(session.sub, waivers.map((waiver) => waiver.id))
  const documents = organizationDocuments.filter((document) => document.taskIds.includes(record.task.id))
  const currentShift = shiftRows.find(({ shift }) => shift.id === record.shift.id)
  const slotsLeft = currentShift?.slotsLeft ?? Math.max(0, record.shift.capacity - 1)
  const unsignedWaivers = usesPaperWaiver ? [] : waivers.filter((waiver) => !signatures.has(waiver.id))
  const identityMatchPending = claim.identityMatchRequired === 1 && identityVerification?.status !== 'verified'
  const sessionUrl = `/aesthetic-lab/opportunities/${record.task.id}/sessions/${record.shift.id}`
  const opportunityUrl = `/aesthetic-lab/opportunities/${record.task.id}`
  const welcomePolicy=await (await import('@/lib/services/program-workspace')).programPolicy(record.task.orgId,record.task.programId||'organization')
  const sessionLocation = record.task.location || profile?.location || 'Location to be confirmed by the organization'
  const participation = city?.participation?.status
  const cityLabel = city ? (city.id === 'mexico-city' ? 'Mexico City, Mexico' : `${city.name}, California`) : 'Choose a city'

  return <main className={styles.app}>
    <LabHeader activeSection="opportunities" session={session} city={city} cities={cities} contexts={contexts} />
    <section className={`${styles.detailLayout} ${styles.sessionPrepLayout}`}>
      <aside className={styles.leftRail}>
        <section className={styles.profileCard}>
          <div className={styles.profileCover}><i /><i /><i /></div>
          <div className={styles.profileBody}>
            <div className={styles.avatarLarge}>{session.name.slice(0, 1).toUpperCase() || 'U'}</div>
            <div className={styles.profileTitle}><p className={styles.eyebrow}>Civic participant</p><h2>{session.name}</h2><p>{cityLabel}</p></div>
            <div className={styles.membershipStatus}>
              <span><Sparkles size={15} /> {participation === 'active' ? 'City Member' : participation === 'barred' ? 'Participation restricted' : 'New participant'}</span>
              <p>{participation === 'active' ? 'Your local participation is verified.' : participation === 'barred' ? 'Your participation is temporarily paused.' : 'Complete one local onboarding session to become a City Member.'}</p>
              <div><i /><i /><i /></div>
              <Link href="/aesthetic-lab/opportunities">Find onboarding <ArrowUpRight size={14} /></Link>
            </div>
          </div>
        </section>

        <section className={styles.quickLinks}>
          <p className={styles.eyebrow}>Quick Actions</p>
          <Link href="/aesthetic-lab/commitments"><CalendarDays size={17} /> My Commitments</Link>
          <Link href="/aesthetic-lab/organizations"><Building2 size={17} /> Discover organizations</Link>
          <Link href="/aesthetic-lab/opportunities?saved=1"><Heart size={17} /> Saved opportunities</Link>
        </section>

        <section className={styles.impactCard}>
          <p className={styles.eyebrow}>My impact</p>
          <div className={styles.impactGrid}>
            <div><strong>{String(activeClaimRows.length).padStart(2, '0')}</strong><span>Active shifts</span></div>
            <div><strong>{resume?.totals.hours ?? 0}h</strong><span>Service record</span></div>
            <div><strong>{String(joinedOrganizations.length).padStart(2, '0')}</strong><span>Organizations</span></div>
          </div>
          <Link href="/aesthetic-lab/history"><Bookmark size={15} /> View service history</Link>
        </section>
      </aside>

      <section className={styles.primaryColumn} aria-label="Session preparation">
        <Link href={opportunityUrl} className={styles.onboardingBackLink}>← Opportunity</Link>
        {isOnboarding&&welcomePolicy&&welcomePolicy.onboardingMode!=='none'?<section className={styles.onboardingProcessCard}><b>Finish your volunteer welcome</b><p>Your session is part of the organization’s onboarding. Review your checklist and request profile approval when everything is ready.</p><Link className={styles.catalogWorkspaceAction} href={'/aesthetic-lab/onboarding/'+record.task.orgId+'/'+(record.task.programId||'organization')}>Open my onboarding checklist</Link></section>:null}
        <LabNotice ok={searchParams.ok} error={searchParams.error} />

        <section className={styles.sessionPrepReservationGroup}>
          <section className={styles.sessionPrepHero}>
            <div>
              <p className={styles.eyebrow}>{isOnboarding ? 'Onboarding session reserved' : 'Volunteer shift reserved'}</p>
              <h1>{record.task.title}</h1>
              <p>{record.task.description || 'Your organization has reserved a place for you in this session.'}</p>
            </div>
            <span><CheckCircle2 size={24} /></span>
            <div className={styles.sessionPrepFacts}>
              <div><CalendarDays size={17} /><span><b>When</b><small>{sessionTime(record.shift.startsAt, record.shift.endsAt)}</small></span></div>
              <div><MapPin size={17} /><span><b>Where</b><small>{sessionLocation}</small></span></div>
              <div><UsersRound size={17} /><span><b>Your place</b><small>Reserved · {slotsLeft} other spot{slotsLeft === 1 ? '' : 's'} open</small></span></div>
            </div>
          </section>

          <section className={styles.sessionPrepChecklistCard}>
            <div className={styles.onboardingCardHeading}>
              <div><p className={styles.eyebrow}>Your session checklist</p><h2>Only the next steps that need you.</h2><p>Complete the actions below before the session. This page stays updated if the organization changes its instructions or materials.</p></div>
              <ClipboardCheck size={20} />
            </div>
            <div className={styles.sessionPrepChecklist}>
              {unsignedWaivers.map((waiver) => <article data-state="action" key={waiver.id}><span><ShieldCheck size={17} /></span><div><b>Sign {waiver.title}</b><p>Review the current waiver version and add your electronic signature before attending.</p></div><DigitalWaiverSignature taskId={record.task.id} waiver={{ id: waiver.id, title: waiver.title, version: waiver.version, body: waiver.body, hasDocument: Boolean(waiver.documentUrl), documentName: waiver.documentName }} redirectTo={sessionUrl} defaultSigningName={session.name} organizationName={record.organization.name} /></article>)}
              {usesPaperWaiver && waivers.length && !claim.paperWaiverConfirmedAt ? <article data-state="action"><span><ShieldCheck size={17} /></span><div><b>Bring your signed waiver</b><p>Review the document below and bring any required signed copy. The organization will record its receipt at check-in.</p></div><em>At session</em></article> : null}
              {identityMatchPending ? <article data-state="action"><span><UsersRound size={17} /></span><div><b>Complete identity confirmation at check-in</b><p>The organization will confirm that the person who arrives matches the City/Sync account used for this reservation. City/Sync does not keep identity documents.</p></div><em>At session</em></article> : null}
              {record.task.beforeSession.trim() ? <article data-state="action"><span><ClipboardCheck size={17} /></span><div><b>Review the session notes</b><p>The organization has shared preparation instructions for this session.</p></div><a href="#session-details">Review</a></article> : null}
              {record.task.bringItems.trim() ? <article data-state="action"><span><UsersRound size={17} /></span><div><b>Bring the listed items</b><p>{record.task.bringItems.trim()}</p></div><a href="#session-details">View list</a></article> : null}
              {documents.length ? <article data-state="action"><span><FileText size={17} /></span><div><b>Review related documents</b><p>{documents.length} document{documents.length === 1 ? '' : 's'} is attached to this session.</p></div><a href="#related-documents">Open</a></article> : null}
              {!unsignedWaivers.length && !(usesPaperWaiver && waivers.length && !claim.paperWaiverConfirmedAt) && !identityMatchPending && !record.task.beforeSession.trim() && !record.task.bringItems.trim() && !documents.length ? <p className={styles.sessionPrepChecklistEmpty}><CheckCircle2 size={17} /> You’re all set. The organization has not added any required preparation steps for this session.</p> : null}
            </div>
          </section>
        </section>

        <section className={styles.sessionPrepDetailsCard} id="session-details">
          <div className={styles.onboardingCardHeading}>
            <div><p className={styles.eyebrow}>Session details</p><h2>Important information from {record.organization.name}</h2><p>Keep this page handy on the day of the session. It includes the details you need if anything changes.</p></div>
            <CalendarDays size={20} />
          </div>
          <div className={styles.sessionPrepNotes}>
            <article><MapPin size={17} /><div><b>Location of session</b><p>{sessionLocation}</p></div></article>
            <article><ClipboardCheck size={17} /><div><b>Session notes</b><p>{record.task.beforeSession.trim() || 'No additional session notes have been posted.'}</p></div></article>
            {record.task.bringItems.trim() ? <article><UsersRound size={17} /><div><b>What to bring</b><p>{record.task.bringItems.trim()}</p></div></article> : null}
            <article><Mail size={17} /><div><b>Organizational contact</b>{profile?.contactEmail ? <p><a href={`mailto:${profile.contactEmail}`}>{profile.contactEmail}</a>{profile.phone ? <> · <a href={`tel:${profile.phone}`}>{profile.phone}</a></> : null}</p> : profile?.phone ? <p><a href={`tel:${profile.phone}`}><Phone size={13} /> {profile.phone}</a></p> : <p>Use the organization&apos;s public profile if you need to reach its team.</p>}</div></article>
            <article><CheckCircle2 size={17} /><div><b>What to do if you can’t come</b><p>{cancellationCopy(record.shift.startsAt)}</p><Link href={opportunityUrl}>Manage reservation <ArrowUpRight size={13} /></Link></div></article>
          </div>
        </section>

        <section className={styles.sessionPrepResourcesCard} id="related-documents">
          <div className={styles.onboardingCardHeading}>
            <div><p className={styles.eyebrow}>Related documents</p><h2>Documents for this session</h2><p>Review or download the materials shared by {record.organization.name}.</p></div>
            <FileText size={20} />
          </div>
          <div className={styles.onboardingResourceList}>
            {waivers.map((waiver) => <details className={styles.onboardingResourceItem} key={waiver.id}>
              <summary><span className={styles.onboardingResourceIcon}><ShieldCheck size={16} /></span><div><b>{waiver.title}</b><small>{usesPaperWaiver ? claim.paperWaiverConfirmedAt ? 'Paper-waiver receipt recorded.' : 'Bring a signed copy for receipt at check-in.' : signatures.has(waiver.id) ? `Signed electronically ${signatureDate(signatures.get(waiver.id)?.signedAt ?? null)}.` : 'Digital signature still needed.'}</small></div><ChevronDown size={16} /></summary>
              <div className={styles.onboardingResourcePreview}>{waiver.body ? <p>{waiver.body}</p> : <p>This waiver is provided as a source document.</p>}{waiver.documentUrl ? <a href={organizationFileDownloadUrl('waiver', waiver.id, record.task.id)} target="_blank" rel="noreferrer"><Download size={14} /> Download source file</a> : null}{!usesPaperWaiver && !signatures.has(waiver.id) ? <DigitalWaiverSignature taskId={record.task.id} waiver={{ id: waiver.id, title: waiver.title, version: waiver.version, body: waiver.body, hasDocument: Boolean(waiver.documentUrl), documentName: waiver.documentName }} redirectTo={sessionUrl} defaultSigningName={session.name} organizationName={record.organization.name} /> : null}</div>
            </details>)}
            {documents.map((document) => <details className={styles.onboardingResourceItem} key={document.id}>
              <summary><span className={styles.onboardingResourceIcon}><FileText size={16} /></span><div><b>{document.title}</b><small>{ORGANIZATION_DOCUMENT_CATEGORY_DETAILS[document.category].label}</small></div><ChevronDown size={16} /></summary>
              <div className={styles.onboardingResourcePreview}>{document.body ? <p>{document.body}</p> : <p>This document is available through its source file.</p>}{document.documentUrl ? <a href={organizationFileDownloadUrl('document', document.id, record.task.id)} target="_blank" rel="noreferrer"><Download size={14} /> Download source file</a> : null}</div>
            </details>)}
            {!waivers.length && !documents.length ? <p className={styles.sessionPrepDocumentsEmpty}>No related documents have been added to this session.</p> : null}
          </div>
        </section>
      </section>

      <aside className={styles.rightRail}>
        <section className={styles.todayEventsCard}>
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>My Calendar</p><CalendarDays size={17} /></div>
          <div className={styles.todayEventList}>
            {cityEvents.length === 0 ? <p className={styles.emptyCopy}>No upcoming public shifts are scheduled yet.</p> : cityEvents.map(({ task, organization, shift }) => <Link href={`/aesthetic-lab/opportunities/${task.id}`} key={shift.id}><span>{shortTime(shift.startsAt)}</span><div><b>{task.title}</b><p>{task.location || organization.name}</p></div><ArrowUpRight size={14} /></Link>)}
          </div>
          <Link className={styles.viewEventsLink} href="/aesthetic-lab/opportunities">View city calendar <ArrowUpRight size={14} /></Link>
        </section>

        <section className={styles.cityPulse}>
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>{city?.name ?? 'City'} Pulse</p><span>Live</span></div>
          {[
            { label: 'Active volunteers', detail: `${impact.volunteers} people participating`, color: 'sun' },
            { label: 'Contributions', detail: `${impact.contributions} verified locally`, color: 'blue' },
            { label: 'Organizations', detail: `${impact.organizations} local partners`, color: 'coral' },
          ].map((note) => <div key={note.label} className={styles.pulseItem}><i className={styles[note.color]} /><span><b>{note.label}</b><small>{note.detail}</small></span></div>)}
        </section>
      </aside>
    </section>
  </main>
}
