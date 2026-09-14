import Link from 'next/link'
import type { CSSProperties } from 'react'
import { and, desc, eq, inArray } from 'drizzle-orm'
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  FileCheck2,
  FileText,
  Settings2,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import {
  claims,
  onboardingApplications,
  organizationDocuments,
  orgs,
  programApplicants,
  programDocumentReceipts,
  shifts,
  tasks,
  users,
  volunteerAdmissionDecisions,
  volunteerEligibilityRecords,
  volunteerIdentityVerifications,
  volunteerRosterMembers,
  waiverAcceptances,
  waiverVersions,
} from '@/lib/db/schema'
import { participantDisplayName } from '@/lib/participant-name'
import { organizationBannerPalette } from '@/lib/profile/organization-appearance'
import { eligibilityLabel } from '@/lib/services/onboarding-attendance'
import { organizationFileUrl } from '@/lib/storage/organization-file-url'
import { getLabWorkspace } from '../lab-workspace'
import { HistoryBackButton } from '../HistoryBackButton'
import { LabHeader } from '../LabHeader'
import { ParticipantIdentityCard } from '../ParticipantIdentityCard'
import styles from '../prototype.module.css'

export const dynamic = 'force-dynamic'

type VolunteerProfilePaletteVariables = CSSProperties & {
  '--volunteer-profile-deep': string
  '--volunteer-profile-mid': string
  '--volunteer-profile-accent': string
  '--volunteer-profile-accent-deep': string
}

function ids(value: string | null | undefined) {
  try {
    const parsed: unknown = JSON.parse(value ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function date(timestamp: number | null | undefined) {
  return timestamp
    ? new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Date unavailable'
}

function activityLabel(status: typeof claims.$inferSelect.status, checkedInAt: number | null) {
  if (status === 'verified') return 'Participation verified'
  if (status === 'rejected') return 'Completion not verified'
  if (status === 'no_show') return 'No-show recorded'
  if (status === 'submitted') return 'Completion submitted'
  if (status === 'unclaimed') return 'Commitment withdrawn'
  if (checkedInAt) return 'Checked in'
  return 'Commitment reserved'
}

export default async function VolunteerProfilePage() {
  const session = await requireRole('participant')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [participant, rosterRows, activityRows, approvedRoleRows] = await Promise.all([
    db.select().from(users).where(eq(users.id, session.sub)).limit(1).then((rows) => rows[0] ?? null),
    db
      .select({ membership: volunteerRosterMembers, organization: orgs })
      .from(volunteerRosterMembers)
      .innerJoin(orgs, eq(volunteerRosterMembers.orgId, orgs.id))
      .where(eq(volunteerRosterMembers.userId, session.sub))
      .orderBy(desc(volunteerRosterMembers.joinedAt)),
    db
      .select({ claim: claims, task: tasks, shift: shifts, organization: orgs })
      .from(claims)
      .innerJoin(tasks, eq(claims.taskId, tasks.id))
      .innerJoin(orgs, eq(tasks.orgId, orgs.id))
      .leftJoin(shifts, eq(claims.shiftId, shifts.id))
      .where(eq(claims.userId, session.sub))
      .orderBy(desc(claims.updatedAt)),
    db
      .select({ organizationId: tasks.orgId, roleTitle: tasks.title, reviewedAt: onboardingApplications.reviewedAt })
      .from(onboardingApplications)
      .innerJoin(tasks, eq(onboardingApplications.taskId, tasks.id))
      .where(and(eq(onboardingApplications.userId, session.sub), eq(onboardingApplications.status, 'approved'), eq(tasks.isOnboarding, 0))),
  ])

  if (!participant) return null

  const organizationMap = new Map<string, typeof orgs.$inferSelect>()
  for (const row of rosterRows) organizationMap.set(row.organization.id, row.organization)
  for (const row of activityRows) {
    if (row.claim.status !== 'unclaimed') organizationMap.set(row.organization.id, row.organization)
  }
  const approvedOrganizationIds = new Set(approvedRoleRows.map((row) => row.organizationId))
  if (approvedOrganizationIds.size) {
    const approvedOrganizations = await db.select().from(orgs).where(inArray(orgs.id, Array.from(approvedOrganizationIds)))
    for (const organization of approvedOrganizations) organizationMap.set(organization.id, organization)
  }
  const organizationIds = Array.from(organizationMap.keys())

  const [eligibilityRows, identityRows, digitalWaiverRows, admissionRows, applicantRows, documentRows] = organizationIds.length
    ? await Promise.all([
        db.select().from(volunteerEligibilityRecords).where(and(eq(volunteerEligibilityRecords.userId, session.sub), inArray(volunteerEligibilityRecords.orgId, organizationIds))),
        db.select().from(volunteerIdentityVerifications).where(and(eq(volunteerIdentityVerifications.userId, session.sub), inArray(volunteerIdentityVerifications.orgId, organizationIds))),
        db
          .select({ acceptance: waiverAcceptances, waiver: waiverVersions })
          .from(waiverAcceptances)
          .innerJoin(waiverVersions, eq(waiverAcceptances.waiverVersionId, waiverVersions.id))
          .where(and(
            eq(waiverAcceptances.userId, session.sub),
            inArray(waiverAcceptances.orgId, organizationIds),
            eq(waiverAcceptances.signatureMethod, 'typed_electronic'),
          ))
          .orderBy(desc(waiverAcceptances.signedAt)),
        db.select().from(volunteerAdmissionDecisions).where(and(eq(volunteerAdmissionDecisions.userId, session.sub), inArray(volunteerAdmissionDecisions.orgId, organizationIds))),
        db.select().from(programApplicants).where(and(eq(programApplicants.userId, session.sub), inArray(programApplicants.orgId, organizationIds))),
        db
          .select({ receipt: programDocumentReceipts, document: organizationDocuments })
          .from(programDocumentReceipts)
          .innerJoin(organizationDocuments, eq(programDocumentReceipts.documentId, organizationDocuments.id))
          .where(and(eq(programDocumentReceipts.userId, session.sub), inArray(programDocumentReceipts.orgId, organizationIds))),
      ])
    : [[], [], [], [], [], []]

  const paperWaiverEvidence = new Map<string, { orgId: string; recordedAt: number }>()
  for (const row of admissionRows) {
    for (const waiverId of ids(row.paperWaiverIds)) paperWaiverEvidence.set(waiverId, { orgId: row.orgId, recordedAt: row.updatedAt })
  }
  for (const row of applicantRows) {
    if (!row.paperWaiverConfirmedAt) continue
    for (const waiverId of ids(row.paperWaiverIds)) paperWaiverEvidence.set(waiverId, { orgId: row.orgId, recordedAt: row.paperWaiverConfirmedAt })
  }
  const paperWaiverIds = Array.from(paperWaiverEvidence.keys())
  const paperWaivers = paperWaiverIds.length ? await db.select().from(waiverVersions).where(inArray(waiverVersions.id, paperWaiverIds)) : []
  const digitalWaiverIds = new Set(digitalWaiverRows.map((row) => row.waiver.id))
  const rolesByOrganization = new Map<string, string[]>()
  for (const role of approvedRoleRows) {
    const titles = rolesByOrganization.get(role.organizationId) ?? []
    if (!titles.includes(role.roleTitle)) titles.push(role.roleTitle)
    rolesByOrganization.set(role.organizationId, titles)
  }
  const eligibilityByOrganization = new Map(eligibilityRows.map((row) => [row.orgId, row]))
  const identityByOrganization = new Map(identityRows.map((row) => [row.orgId, row]))
  const membershipByOrganization = new Map(rosterRows.map((row) => [row.organization.id, row.membership]))
  const organizations = Array.from(organizationMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  const firstClaimByOrganization = new Map<string, number>()
  for (const row of activityRows) {
    if (row.claim.status === 'unclaimed') continue
    const current = firstClaimByOrganization.get(row.organization.id)
    if (current === undefined || row.claim.createdAt < current) firstClaimByOrganization.set(row.organization.id, row.claim.createdAt)
  }
  const profileActivity = [
    ...activityRows.map((row) => ({ kind: 'participation' as const, timestamp: row.claim.updatedAt, id: row.claim.id, ...row })),
    ...organizations.flatMap((organization) => {
      const membership = membershipByOrganization.get(organization.id)
      const timestamp = membership?.joinedAt ?? firstClaimByOrganization.get(organization.id)
      return timestamp ? [{ kind: 'roster' as const, timestamp, id: `roster-${organization.id}`, organization, source: membership?.source ?? 'opportunity' }] : []
    }),
  ].sort((a, b) => b.timestamp - a.timestamp)

  const participantPalette = organizationBannerPalette(participant.bannerPalette)
  const volunteerProfilePalette: VolunteerProfilePaletteVariables = {
    '--volunteer-profile-deep': participantPalette.colors[0],
    '--volunteer-profile-mid': participantPalette.colors[1],
    '--volunteer-profile-accent': participantPalette.colors[2],
    '--volunteer-profile-accent-deep': participantPalette.colors[3],
  }

  return <main className={styles.app}>
    <LabHeader activeSection="opportunities" workspace="participant" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={`${styles.detailLayout} ${styles.opportunitiesLayout}`}>
      <aside className={styles.leftRail}>
        <ParticipantIdentityCard session={session} city={city} redirectTo="/aesthetic-lab/profile" />
        <section className={styles.quickLinks}>
          <p className={styles.eyebrow}>Volunteer Profile</p>
          <Link href="/aesthetic-lab/settings"><Settings2 size={17} /> Edit account details</Link>
          <Link href="/aesthetic-lab/commitments"><CalendarDays size={17} /> My Commitments</Link>
          <Link href="/aesthetic-lab/history"><FileCheck2 size={17} /> Service History</Link>
        </section>
      </aside>

      <section className={styles.primaryColumn} aria-label="Volunteer profile">
        <section className={styles.volunteerProfileHero} style={volunteerProfilePalette}>
          <span><UserRound size={22} /></span>
          <div><p className={styles.eyebrow}>Volunteer Profile</p><h1>{participantDisplayName(participant)}</h1><p>{organizations.length} organization{organizations.length === 1 ? '' : 's'} · {activityRows.filter((row) => row.claim.status === 'verified').length} verified contribution{activityRows.filter((row) => row.claim.status === 'verified').length === 1 ? '' : 's'}</p></div>
          <HistoryBackButton fallback="/aesthetic-lab/opportunities" className={styles.volunteerProfileBack} variant="dark" />
        </section>

        <section className={`${styles.volunteerProfileGrid} ${styles.participantVolunteerProfileGrid}`}>
          <div className={styles.volunteerProfileInfoStack}>
            {organizations.length ? organizations.map((organization) => {
              const eligibility = eligibilityByOrganization.get(organization.id)
              const identity = identityByOrganization.get(organization.id)
              const membership = membershipByOrganization.get(organization.id)
              const joinedAt = membership?.joinedAt ?? firstClaimByOrganization.get(organization.id)
              const roles = rolesByOrganization.get(organization.id) ?? []
              const digitalWaivers = digitalWaiverRows.filter((row) => row.acceptance.orgId === organization.id)
              const recordedPaperWaivers = paperWaivers.filter((waiver) => paperWaiverEvidence.get(waiver.id)?.orgId === organization.id && !digitalWaiverIds.has(waiver.id))
              const receivedDocuments = documentRows.filter((row) => row.receipt.orgId === organization.id)
              const hasDocumentation = digitalWaivers.length || recordedPaperWaivers.length || receivedDocuments.length
              return <section className={styles.organizationVolunteerRecord} key={organization.id}>
                <header>
                  <span><Building2 size={19} /></span>
                  <div><p className={styles.eyebrow}>Organization record</p><h2>{organization.slug ? <Link href={`/aesthetic-lab/organizations/${organization.slug}`}>{organization.name}</Link> : organization.name}</h2><small>{joinedAt ? `Volunteer since ${date(joinedAt)}` : 'Approved volunteer relationship'}</small></div>
                </header>
                <div className={styles.organizationVolunteerRecordList}>
                  <article>
                    <span><UsersRound size={18} /></span>
                    <div><p>Volunteer roles</p><b>{roles.length ? roles.join(' · ') : 'General volunteer'}</b><small>{roles.length ? 'Roles approved by this organization.' : 'No role-specific approval is required.'}</small></div>
                  </article>
                  <article>
                    <span><ShieldCheck size={18} /></span>
                    <div><p>Eligibility record</p><b>{eligibilityLabel(eligibility?.status ?? 'pending')}</b><small>{eligibility?.verifiedAt ? `Recorded ${date(eligibility.verifiedAt)}.` : 'No age-eligibility outcome has been recorded.'}</small></div>
                  </article>
                  <article>
                    <span><BadgeCheck size={18} /></span>
                    <div><p>Identity confirmation</p><b>{identity?.status === 'verified' ? 'In-person identity match recorded' : 'No active identity match recorded'}</b><small>{identity?.status === 'verified' ? `Recorded ${date(identity.verifiedAt)}.` : 'This organization has not recorded an in-person identity match.'}</small></div>
                  </article>
                  {digitalWaivers.map(({ acceptance, waiver }) => <article key={acceptance.id}>
                    <span><ShieldCheck size={18} /></span>
                    <div><p>Signed waiver</p><b>{waiver.title}</b><small>Electronically signed {date(acceptance.signedAt ?? acceptance.acceptedAt)}.</small></div>
                    <Link href={`/aesthetic-lab/profile/waivers/${waiver.id}`}>View proof</Link>
                  </article>)}
                  {recordedPaperWaivers.map((waiver) => <article key={`paper-${waiver.id}`}>
                    <span><FileCheck2 size={18} /></span>
                    <div><p>Paper waiver received</p><b>{waiver.title}</b><small>Receipt recorded {date(paperWaiverEvidence.get(waiver.id)?.recordedAt)}.</small></div>
                    {waiver.documentUrl ? <a href={organizationFileUrl('waiver', waiver.id)} target="_blank" rel="noreferrer">View document</a> : null}
                  </article>)}
                  {receivedDocuments.map(({ receipt, document }) => <article key={receipt.id}>
                    <span><FileText size={18} /></span>
                    <div><p>Organization document</p><b>{document.title}</b><small>Received {date(receipt.receivedAt)}.</small></div>
                    {document.documentUrl ? <a href={organizationFileUrl('document', document.id)} target="_blank" rel="noreferrer">View document</a> : null}
                  </article>)}
                  {!hasDocumentation ? <article>
                    <span><FileText size={18} /></span>
                    <div><p>Documentation</p><b>No participant documents on record</b><small>Signed waivers and received materials will appear here.</small></div>
                  </article> : null}
                </div>
                <footer>This shows the records connected to your relationship with {organization.name}. Internal organization notes are not included.</footer>
              </section>
            }) : <section className={styles.organizationVolunteerRecord}>
              <header><span><Building2 size={19} /></span><div><p className={styles.eyebrow}>Organization records</p><h2>Your organization relationships</h2><small>Volunteer records will appear after you join an organization.</small></div></header>
              <footer>Explore a local organization and apply when you find work that fits.</footer>
            </section>}
          </div>

          <section className={styles.volunteerHistoryCard}>
            <div><p className={styles.eyebrow}>Volunteer Activity Log</p><h2>Your participation history</h2></div>
            <div>{profileActivity.length ? profileActivity.map((activity) => {
              if (activity.kind === 'roster') {
                const source = activity.source === 'approval' ? 'Approved by the organization' : activity.source === 'invite' ? 'Joined through an invitation' : 'Joined through an opportunity'
                return <article key={activity.id}><UserRound size={16} /><div><b>Added to {activity.organization.name}&apos;s volunteer roster</b><small>{source} · {date(activity.timestamp)}</small></div>{activity.organization.slug ? <Link href={`/aesthetic-lab/organizations/${activity.organization.slug}`}>Organization</Link> : null}</article>
              }
              const href = activity.claim.shiftId
                ? `/aesthetic-lab/opportunities/${activity.task.id}/sessions/${activity.claim.shiftId}`
                : `/aesthetic-lab/opportunities/${activity.task.id}`
              return <article key={activity.id}><CalendarDays size={16} /><div><b>{activity.task.title}</b><small>{activity.organization.name} · {activityLabel(activity.claim.status, activity.claim.checkedInAt)} · {date(activity.shift?.startsAt ?? activity.timestamp)}</small></div><Link href={href}>Opportunity</Link></article>
            }) : <p className={styles.emptyCopy}>Your activity log will begin when you apply, reserve a shift, or join an organization.</p>}</div>
          </section>
        </section>
      </section>
    </div>
  </main>
}
