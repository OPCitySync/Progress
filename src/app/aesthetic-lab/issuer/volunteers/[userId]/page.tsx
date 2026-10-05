import Link from 'next/link'
import type { CSSProperties } from 'react'
import { BadgeCheck, CalendarDays, ShieldCheck, UserRound } from 'lucide-react'
import { and, desc, eq, ne } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { claims, tasks, users, volunteerEligibilityRecords, volunteerIdentityVerifications, waiverAcceptances, waiverVersions, programApplicants, volunteerRosterMembers, onboardingApplications, orgs } from '@/lib/db/schema'
import { organizationBannerPalette } from '@/lib/profile/organization-appearance'
import { participantDisplayName } from '@/lib/participant-name'
import { attendanceLabel, eligibilityLabel } from '@/lib/services/onboarding-attendance'
import { getProfile } from '@/lib/services/profile'
import { setVolunteerIdentityVerificationAction } from '@/app/actions'
import { getLabWorkspace } from '../../../lab-workspace'
import { LabHeader } from '../../../LabHeader'
import { HistoryBackButton } from '../../../HistoryBackButton'
import { LabNotice } from '../../../LabNotice'
import { IssuerLabSidebar } from '../../IssuerLabSidebar'
import styles from '../../../prototype.module.css'

export const dynamic = 'force-dynamic'

type VolunteerProfilePaletteVariables = CSSProperties & {
  '--volunteer-profile-deep': string
  '--volunteer-profile-mid': string
  '--volunteer-profile-accent': string
  '--volunteer-profile-accent-deep': string
}

export default async function IssuerVolunteerProfilePage({ params, searchParams }: { params: { userId: string }; searchParams: { ok?: string; error?: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const [org, profile, participant, history, eligibility, identityVerification, waiverProofs] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    getProfile(orgId),
    db.select().from(users).where(eq(users.id, params.userId)).limit(1).then((rows) => rows[0] ?? null),
    db
      .select({ claim: claims, task: tasks })
      .from(claims)
      .innerJoin(tasks, eq(claims.taskId, tasks.id))
      .where(and(eq(tasks.orgId, orgId), eq(claims.userId, params.userId), ne(claims.status, 'unclaimed')))
      .orderBy(desc(claims.updatedAt)),
    db
      .select()
      .from(volunteerEligibilityRecords)
      .where(and(eq(volunteerEligibilityRecords.orgId, orgId), eq(volunteerEligibilityRecords.userId, params.userId)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(volunteerIdentityVerifications)
      .where(and(eq(volunteerIdentityVerifications.orgId, orgId), eq(volunteerIdentityVerifications.userId, params.userId)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(waiverAcceptances)
      .innerJoin(waiverVersions, eq(waiverAcceptances.waiverVersionId, waiverVersions.id))
      .where(and(
        eq(waiverAcceptances.orgId, orgId),
        eq(waiverAcceptances.userId, params.userId),
        eq(waiverAcceptances.signatureMethod, 'typed_electronic'),
      ))
      .orderBy(desc(waiverAcceptances.signedAt)),
  ])
  const [candidate,explicitMember,intakeApplicant]=await Promise.all([
    db.select({id:programApplicants.id}).from(programApplicants).where(and(eq(programApplicants.orgId,orgId),eq(programApplicants.userId,params.userId))).limit(1),
    db.select({id:volunteerRosterMembers.id,joinedAt:volunteerRosterMembers.joinedAt,source:volunteerRosterMembers.source}).from(volunteerRosterMembers).where(and(eq(volunteerRosterMembers.orgId,orgId),eq(volunteerRosterMembers.userId,params.userId))).limit(1),
    db.select({id:onboardingApplications.id}).from(onboardingApplications).where(and(eq(onboardingApplications.orgId,orgId),eq(onboardingApplications.userId,params.userId))).limit(1),
  ])
  const isRosterMember = Boolean(participant && (history.length||candidate.length||explicitMember.length||intakeApplicant.length))
  const identityVerifier = identityVerification?.status === 'verified'
    ? (await db.select().from(users).where(eq(users.id, identityVerification.verifiedByUserId)).limit(1))[0] ?? null
    : null
  const identityVerified = identityVerification?.status === 'verified'
  const organizationPalette = organizationBannerPalette(profile?.bannerPalette)
  const volunteerProfilePalette: VolunteerProfilePaletteVariables = {
    '--volunteer-profile-deep': organizationPalette.colors[0],
    '--volunteer-profile-mid': organizationPalette.colors[1],
    '--volunteer-profile-accent': organizationPalette.colors[2],
    '--volunteer-profile-accent-deep': organizationPalette.colors[3],
  }
  const rosterMembership = explicitMember[0] ?? null
  // Older roster members may only have an opportunity claim because claims
  // historically established roster membership implicitly. Preserve a useful
  // milestone for them by using the date of their first organization claim.
  const rosterJoinedAt = rosterMembership?.joinedAt ?? (history.length
    ? Math.min(...history.map(({ claim }) => claim.createdAt))
    : null)
  const profileActivity = [
    ...history.map(({ claim, task }) => ({ kind: 'participation' as const, timestamp: claim.updatedAt, id: claim.id, claim, task })),
    ...(rosterJoinedAt === null ? [] : [{
      kind: 'roster' as const,
      timestamp: rosterJoinedAt,
      id: `roster-${participant!.id}`,
      source: rosterMembership?.source ?? 'opportunity',
    }]),
  ].sort((a, b) => b.timestamp - a.timestamp)

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-volunteers" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerLayout}>
      <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
      <section className={styles.issuerMain} aria-label="Volunteer profile">
        {!isRosterMember ? <section className={styles.labPanel}><p className={styles.emptyCopy}>This volunteer is not available in your organization roster.</p><HistoryBackButton fallback="/aesthetic-lab/issuer/volunteers" /></section> : <>
          <section className={styles.volunteerProfileHero} style={volunteerProfilePalette}>
            <span><UserRound size={22} /></span>
            <div><p className={styles.eyebrow}>Volunteer profile</p><h1>{participantDisplayName(participant!)}</h1><p>{participant!.email}</p></div>
            <HistoryBackButton fallback="/aesthetic-lab/issuer/volunteers" className={styles.volunteerProfileBack} variant="dark" />
          </section>
          <LabNotice hidden ok={searchParams.ok} error={searchParams.error} />
          <section className={styles.volunteerProfileGrid}>
            <div className={styles.volunteerProfileInfoStack}>
              <section className={styles.organizationVolunteerRecord}>
                <header>
                  <span><ShieldCheck size={19} /></span>
                  <div><p className={styles.eyebrow}>Organization record</p><h2>{org?.name ?? 'Organization record'}</h2><small>Private record for this volunteer</small></div>
                </header>
                <div className={styles.organizationVolunteerRecordList}>
                  <article>
                    <span><ShieldCheck size={18} /></span>
                    <div><p>Eligibility record</p><b>{eligibilityLabel(eligibility?.status ?? 'pending')}</b><small>{eligibility?.verifiedAt ? `Recorded ${new Date(eligibility.verifiedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.` : 'No age-eligibility outcome has been recorded.'}</small></div>
                  </article>
                  <article>
                    <span><BadgeCheck size={18} /></span>
                    <div><p>Identity confirmation</p><b>{identityVerified ? 'In-person identity match recorded' : 'No in-person identity match recorded'}</b><small>{identityVerified && identityVerification ? `Recorded ${new Date(identityVerification.verifiedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}${identityVerifier ? ` by ${participantDisplayName(identityVerifier)}` : ''}.` : 'Record this after an authorized staff member confirms the person matches their account.'}</small></div>
                    {identityVerified ? <form action={setVolunteerIdentityVerificationAction}><input type="hidden" name="userId" value={participant!.id} /><input type="hidden" name="operation" value="revoke" /><input type="hidden" name="redirectTo" value={`/aesthetic-lab/issuer/volunteers/${participant!.id}`} /><button type="submit">Remove record</button></form> : <form action={setVolunteerIdentityVerificationAction}><input type="hidden" name="userId" value={participant!.id} /><input type="hidden" name="operation" value="verify" /><input type="hidden" name="redirectTo" value={`/aesthetic-lab/issuer/volunteers/${participant!.id}`} /><label><input type="checkbox" name="identityConfirmed" required /> Confirmed in person</label><button type="submit">Confirm</button></form>}
                  </article>
                  {waiverProofs.length ? waiverProofs.map(({ waiver_acceptances: acceptance, waiver_versions: waiver }) => <article key={acceptance.id}>
                    <span><ShieldCheck size={18} /></span>
                    <div><p>Signed waiver</p><b>{waiver.title}</b><small>Electronically signed {new Date(acceptance.signedAt ?? acceptance.acceptedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</small></div>
                    <Link href={`/aesthetic-lab/issuer/volunteers/${participant!.id}/waivers/${waiver.id}`}>View proof</Link>
                  </article>) : <article>
                    <span><ShieldCheck size={18} /></span>
                    <div><p>Signed waiver</p><b>No digitally signed waiver on record</b><small>Electronically signed waivers will appear here with their proof of signature.</small></div>
                  </article>}
                </div>
                <footer>Only the recorded outcome, authorized attestation, and signed-waiver proof are shown here. IDs and birth dates are never stored.</footer>
              </section>
            </div>
            <section className={styles.volunteerHistoryCard}>
              <div><p className={styles.eyebrow}>Activity with your organization</p><h2>Participation history</h2></div>
              <div>{profileActivity.map((activity) => {
                if (activity.kind === 'roster') {
                  const source = activity.source === 'approval'
                    ? 'Approved and added by your organization'
                    : activity.source === 'invite'
                      ? 'Joined through an organization invitation'
                      : 'Joined through their first opportunity'
                  return <article key={activity.id}><UserRound size={16} /><div><b>Added to the volunteer roster</b><small>{source} · {new Date(activity.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</small></div></article>
                }
                const attendance = activity.claim.status === 'no_show' ? 'no_show' : activity.claim.status === 'verified' ? 'verified' : activity.claim.checkedInAt ? 'checked_in' : 'signed_up'
                return <article key={activity.id}><CalendarDays size={16} /><div><b>{activity.task.title}</b><small>{attendanceLabel(attendance)} · {new Date(activity.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</small></div><Link href={`/aesthetic-lab/issuer/opportunities/${activity.task.id}`}>Opportunity</Link></article>
              })}</div>
            </section>
          </section>
        </>}
      </section>
    </div>
  </main>
}
