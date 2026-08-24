import Link from 'next/link'
import { and, desc, eq, inArray, ne } from 'drizzle-orm'
import { ArrowLeft, CalendarDays, CheckCircle2, FileText, FolderKanban, Repeat2, UsersRound } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { claims, orgs, tasks } from '@/lib/db/schema'
import { getShiftsWithCounts } from '@/lib/services/opportunities'
import { getOrganizationDocuments } from '@/lib/services/organization-documents'
import { getOnboardingWaiverSetup } from '@/lib/services/waivers'
import { getVolunteerPrograms } from '@/lib/services/volunteer-programs'
import { LabHeader } from '../../../LabHeader'
import { getLabWorkspace } from '../../../lab-workspace'
import { IssuerLabSidebar } from '../../IssuerLabSidebar'
import styles from '../../../prototype.module.css'

export const dynamic = 'force-dynamic'

function formatDate(timestamp: number | null) {
  return timestamp
    ? new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Date to be confirmed'
}

export default async function IssuerVolunteerProgramDetailsPage({ params }: { params: { id: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const [org, programs, taskRows, documents, waiverSetup] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    getVolunteerPrograms(orgId),
    city
      ? db.select().from(tasks).where(and(eq(tasks.orgId, orgId), eq(tasks.cityId, city.id), eq(tasks.programId, params.id))).orderBy(desc(tasks.createdAt))
      : Promise.resolve([]),
    getOrganizationDocuments(orgId),
    getOnboardingWaiverSetup(orgId),
  ])
  const program = programs.find((item) => item.id === params.id)
  const workspaceHref = '/aesthetic-lab/issuer/catalog?workspace=programs'

  if (!program) {
    return (
      <main className={styles.app}>
        <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
        <div className={styles.issuerLayout}>
          <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
          <section className={styles.issuerMain} aria-label="Volunteer program">
            <section className={styles.issuerPageHero}>
              <div><p className={styles.eyebrow}>Volunteer programs</p><h1>Program unavailable.</h1><p>This volunteer program may have been removed or belongs to another organization.</p></div>
              <Link href={workspaceHref} className={styles.catalogWorkspaceAction}><ArrowLeft size={15} /> Workspace</Link>
            </section>
          </section>
        </div>
      </main>
    )
  }

  const taskShifts = await Promise.all(taskRows.map(async (task) => ({ task, sessions: await getShiftsWithCounts(task.id) })))
  const now = Date.now()
  const hasEnded = (endsAt: number | null, startsAt: number | null) => (endsAt ?? startsAt ?? Number.MAX_SAFE_INTEGER) < now
  const standardTemplates = taskShifts.filter(({ task }) => task.isOnboarding !== 1)
  const onboardingTemplates = taskShifts.filter(({ task }) => task.isOnboarding === 1)
  const publishedEvents = taskShifts.flatMap(({ task, sessions }) => sessions
    .filter(({ shift }) => shift.status === 'open' && !hasEnded(shift.endsAt, shift.startsAt))
    .map(({ shift, taken, slotsLeft }) => ({ task, shift, taken, slotsLeft })))
    .sort((a, b) => (a.shift.startsAt ?? Number.MAX_SAFE_INTEGER) - (b.shift.startsAt ?? Number.MAX_SAFE_INTEGER))
  const pastEvents = taskShifts.flatMap(({ task, sessions }) => sessions
    .filter(({ shift }) => hasEnded(shift.endsAt, shift.startsAt))
    .map(({ shift, taken }) => ({ task, shift, taken })))
    .sort((a, b) => (b.shift.startsAt ?? 0) - (a.shift.startsAt ?? 0))
  const shiftIds = [...publishedEvents, ...pastEvents].map(({ shift }) => shift.id)
  const programClaims = shiftIds.length
    ? await db.select({ userId: claims.userId, status: claims.status }).from(claims)
      .where(and(inArray(claims.shiftId, shiftIds), ne(claims.status, 'unclaimed')))
    : []
  const verifiedContributions = programClaims.filter((claim) => claim.status === 'verified').length
  const participatingVolunteers = new Set(programClaims.filter((claim) => claim.status !== 'no_show').map((claim) => claim.userId)).size
  const programDocuments = documents.filter((document) => document.programId === program.id)
  const programWaivers = waiverSetup.waivers.filter((waiver) => waiver.programId === program.id)
  const impactMetrics = [
    { label: 'Verified contributions', value: verifiedContributions, detail: 'Completed participation recorded' },
    { label: 'Volunteers involved', value: participatingVolunteers, detail: 'People who signed up or participated' },
    { label: 'Events completed', value: pastEvents.length, detail: 'Past sessions retained' },
    { label: 'Upcoming events', value: publishedEvents.length, detail: 'Currently visible to volunteers' },
  ]

  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
        <section className={styles.issuerMain} aria-label={`${program.name} details`}>
          <section className={styles.issuerPageHero}>
            <div><p className={styles.eyebrow}>Workspace · Volunteer Programs</p><h1>{program.name}</h1><p>{program.description || 'This program brings its volunteer work, resources, and participation history together in one place.'}</p></div>
            <Link href={workspaceHref} className={styles.catalogWorkspaceAction}><ArrowLeft size={15} /> Workspace</Link>
          </section>

          <nav className={styles.workspaceSectionNav} aria-label="Workspace navigation">
            <Link href={workspaceHref} data-active="true" aria-current="page"><FolderKanban size={15} /> Volunteer Programs</Link>
            <Link href="/aesthetic-lab/issuer/catalog?workspace=documentation"><FileText size={15} /> Documentation</Link>
            <Link href="/aesthetic-lab/issuer/catalog?workspace=onboarding"><Repeat2 size={15} /> Onboarding</Link>
            <Link href="/aesthetic-lab/issuer/catalog?workspace=opportunities"><UsersRound size={15} /> Opportunities</Link>
          </nav>

          <section className={styles.programDetailImpactCard}>
            <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Program impact</p><h2>Progress at a glance</h2><p>This summary is specific to {program.name} in {city?.name ?? 'your active city'}.</p></div><CheckCircle2 size={19} /></div>
            <div className={styles.programDetailMetricGrid}>{impactMetrics.map((metric) => <article key={metric.label}><strong>{metric.value.toLocaleString()}</strong><b>{metric.label}</b><span>{metric.detail}</span></article>)}</div>
          </section>

          <div className={styles.programDetailGrid}>
            <section className={styles.programDetailSection}>
              <div className={styles.programDetailHeading}><div><p className={styles.eyebrow}>Opportunity templates</p><h2>Work this program makes possible</h2></div><span>{standardTemplates.length}</span></div>
              {standardTemplates.length ? <div className={styles.programDetailList}>{standardTemplates.map(({ task, sessions }) => { const upcoming = sessions.filter(({ shift }) => shift.status === 'open' && !hasEnded(shift.endsAt, shift.startsAt)).length; return <article key={task.id}><CalendarDays size={17} /><div><b>{task.title}</b><p>{task.description || 'Volunteer opportunity template'}</p><small>{upcoming} upcoming session{upcoming === 1 ? '' : 's'}</small></div><Link href={`/aesthetic-lab/issuer/opportunities/${task.id}`}>Manage</Link></article> })}</div> : <p className={styles.programDetailEmpty}>No opportunity templates are assigned to this program yet.</p>}
            </section>

            <section className={styles.programDetailSection}>
              <div className={styles.programDetailHeading}><div><p className={styles.eyebrow}>Onboarding</p><h2>Welcome pathways</h2></div><span>{onboardingTemplates.length}</span></div>
              {onboardingTemplates.length ? <div className={styles.programDetailList}>{onboardingTemplates.map(({ task, sessions }) => { const active = sessions.filter(({ shift }) => shift.status === 'open' && !hasEnded(shift.endsAt, shift.startsAt)).length; return <article key={task.id}><Repeat2 size={17} /><div><b>{task.title}</b><p>{active ? 'An active onboarding session is available.' : 'No active onboarding date is published.'}</p><small>{sessions.length} total session{sessions.length === 1 ? '' : 's'} retained</small></div><Link href="/aesthetic-lab/issuer/catalog?workspace=onboarding">View</Link></article> })}</div> : <p className={styles.programDetailEmpty}>No onboarding session is assigned to this program.</p>}
            </section>
          </div>

          <div className={styles.programDetailGrid}>
            <section className={styles.programDetailSection}>
              <div className={styles.programDetailHeading}><div><p className={styles.eyebrow}>Program resources</p><h2>Documents and waivers</h2></div><span>{programDocuments.length + programWaivers.length}</span></div>
              {programDocuments.length || programWaivers.length ? <div className={styles.programDetailList}>{programDocuments.map((document) => <article key={document.id}><FileText size={17} /><div><b>{document.title}</b><p>{document.category === 'guide' ? 'Volunteer guide' : document.category === 'safety' ? 'Safety & operations document' : 'Additional document'}</p><small>Updated {formatDate(document.updatedAt)}</small></div><Link href={`/aesthetic-lab/issuer/documents/${document.id}`}>View</Link></article>)}{programWaivers.map((waiver) => <article key={waiver.id}><FileText size={17} /><div><b>{waiver.title}</b><p>Liability waiver</p><small>Added {formatDate(waiver.createdAt)}</small></div><Link href="/aesthetic-lab/issuer/waiver">View</Link></article>)}</div> : <p className={styles.programDetailEmpty}>No documents or waivers are assigned to this program.</p>}
            </section>

            <section className={styles.programDetailSection}>
              <div className={styles.programDetailHeading}><div><p className={styles.eyebrow}>Program history</p><h2>Completed events</h2></div><span>{pastEvents.length}</span></div>
              {pastEvents.length ? <div className={styles.programDetailList}>{pastEvents.slice(0, 8).map(({ task, shift, taken }) => <article key={shift.id}><CheckCircle2 size={17} /><div><b>{task.title}</b><p>{formatDate(shift.startsAt)} · {taken} participant{taken === 1 ? '' : 's'} recorded</p><small>{shift.label || 'Completed volunteer event'}</small></div><Link href={`/aesthetic-lab/issuer/opportunities/${task.id}`}>View</Link></article>)}</div> : <p className={styles.programDetailEmpty}>Completed events will collect here as this program grows.</p>}
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}
