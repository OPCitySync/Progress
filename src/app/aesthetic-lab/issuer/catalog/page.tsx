import { and, desc, eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs, tasks } from '@/lib/db/schema'
import { getShiftsWithCounts } from '@/lib/services/opportunities'
import { getOrganizationDocuments } from '@/lib/services/organization-documents'
import { getVolunteerPrograms } from '@/lib/services/volunteer-programs'
import { getOnboardingWaiverSetup } from '@/lib/services/waivers'
import { getProfile } from '@/lib/services/profile'
import { LabHeader } from '../../LabHeader'
import { getLabWorkspace } from '../../lab-workspace'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import { DocumentUploadCard } from '../DocumentUploadCard'
import { IssuerWorkspaceMenu } from '../IssuerWorkspaceMenu'
import { VolunteerProgramTabs } from '../VolunteerProgramTabs'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function IssuerCatalogLabPage() {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const [org, taskRows, volunteerPrograms, documents, waiverSetup, profile] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    city
      ? db.select().from(tasks).where(and(eq(tasks.orgId, orgId), eq(tasks.cityId, city.id))).orderBy(desc(tasks.createdAt))
      : Promise.resolve([]),
    getVolunteerPrograms(orgId),
    getOrganizationDocuments(orgId),
    getOnboardingWaiverSetup(orgId),
    getProfile(orgId),
  ])
  const referenceTime = Date.now()
  const sessionHasEnded = (endsAt: number | null, startsAt: number | null) => {
    const effectiveEnd = endsAt ?? startsAt
    return effectiveEnd !== null && effectiveEnd < referenceTime
  }
  const taskShifts = await Promise.all(taskRows.map(async (task) => ({ task, sessions: await getShiftsWithCounts(task.id) })))
  const programViews = volunteerPrograms.map((program) => {
    const programTaskShifts = taskShifts.filter(({ task }) => task.programId === program.id)
    const opportunityTemplates = programTaskShifts.filter(({ task }) => task.isOnboarding !== 1 && task.status === 'open')
    const programOpportunityShifts = programTaskShifts.filter(({ task }) => task.isOnboarding !== 1)
    const pastEvents = programOpportunityShifts
      .flatMap(({ task, sessions }) => sessions
        .filter(({ shift }) => sessionHasEnded(shift.endsAt, shift.startsAt))
        .map(({ shift }) => ({ task, shift })))
      .sort((a, b) => (b.shift.startsAt ?? 0) - (a.shift.startsAt ?? 0))
    const upcomingEvents = programOpportunityShifts
      .flatMap(({ task, sessions }) => sessions
        .filter(({ shift }) => shift.status === 'open' && !sessionHasEnded(shift.endsAt, shift.startsAt))
        .map(({ shift }) => ({ task, shift })))
      .sort((a, b) => (a.shift.startsAt ?? Number.MAX_SAFE_INTEGER) - (b.shift.startsAt ?? Number.MAX_SAFE_INTEGER))
    const detailHref = `/aesthetic-lab/issuer/programs/${program.id}`
    return {
      id: program.id,
      name: program.name,
      description: program.description || 'Shared work available across your organization.',
      detailHref,
      opportunityTemplates: opportunityTemplates.map(({ task }) => ({ id: task.id, title: task.title, href: `${detailHref}#program-opportunities` })),
      history: pastEvents.slice(0, 3).map(({ task, shift }) => ({
        id: shift.id,
        title: task.title,
        dateLabel: shift.startsAt ? new Date(shift.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Completed session',
      })),
      upcomingEvents: upcomingEvents.length,
      completedEvents: pastEvents.length,
      nextEvent: upcomingEvents[0] ? {
        id: upcomingEvents[0].shift.id,
        title: upcomingEvents[0].task.title,
        dateLabel: upcomingEvents[0].shift.startsAt
          ? new Date(upcomingEvents[0].shift.startsAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
          : 'Date and time to be confirmed',
        href: `${detailHref}#program-schedule`,
      } : null,
    }
  })
  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
        <section className={styles.issuerMain} aria-label="Workspace">
          <IssuerWorkspaceMenu programs={<VolunteerProgramTabs
            tabs={programViews}
            bannerPalette={profile?.bannerPalette}
            uploadDocuments={<DocumentUploadCard
              waiverCount={waiverSetup.waivers.length}
              documentCount={documents.length}
              tasks={taskRows}
              programs={volunteerPrograms}
              redirectTo="/aesthetic-lab/issuer/catalog"
              attached
            />}
          />} />
        </section>
      </div>
    </main>
  )
}
