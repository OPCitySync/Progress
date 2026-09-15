import Link from 'next/link'
import type { CSSProperties } from 'react'
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm'
import { CalendarDays, Eye, EyeOff, FileText, Settings2 } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { onboardingApplicationForms, onboardingIntakes, orgs, tasks } from '@/lib/db/schema'
import { setOpportunityPublicationStatusAction } from '@/app/actions'
import { getShiftsWithCounts } from '@/lib/services/opportunities'
import { getOrganizationDocuments, ORGANIZATION_DOCUMENT_CATEGORY_DETAILS } from '@/lib/services/organization-documents'
import {
  getOrganizationResourcePublicationMap,
  getWaiverTaskIdsByWaiver,
  resourceKey,
} from '@/lib/services/organization-resources'
import { getVolunteerPrograms } from '@/lib/services/volunteer-programs'
import { getOnboardingWaiverSetup } from '@/lib/services/waivers'
import { getProfile } from '@/lib/services/profile'
import { organizationBannerPalette } from '@/lib/profile/organization-appearance'
import { LabHeader } from '../../LabHeader'
import { getLabWorkspace } from '../../lab-workspace'
import { LabNotice } from '../../LabNotice'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import { DocumentUploadCard } from '../DocumentUploadCard'
import { DocumentOverflowActions } from '../DocumentOverflowActions'
import { IssuerWorkspaceMenu } from '../IssuerWorkspaceMenu'
import { VolunteerProgramTabs } from '../VolunteerProgramTabs'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

type WorkspacePaletteVariables = CSSProperties & {
  '--program-palette-deep': string
  '--program-palette-mid': string
  '--program-palette-accent': string
  '--program-palette-accent-deep': string
}

function when(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(timestamp)
}

function eventWhen(timestamp: number | null) {
  return timestamp
    ? new Date(timestamp).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Date and time to be confirmed'
}

export default async function IssuerCatalogLabPage({
  searchParams,
}: {
  searchParams: { workspace?: string; ok?: string; error?: string }
}) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const [org, taskRows, volunteerPrograms, documents, waiverSetup, profile, publicationMap, waiverTaskIds, publishedApplicationForms, publicProfileIntakes] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    city
      ? db.select().from(tasks).where(and(eq(tasks.orgId, orgId), eq(tasks.cityId, city.id))).orderBy(desc(tasks.createdAt))
      : Promise.resolve([]),
    getVolunteerPrograms(orgId),
    getOrganizationDocuments(orgId),
    getOnboardingWaiverSetup(orgId),
    getProfile(orgId),
    getOrganizationResourcePublicationMap(orgId),
    getWaiverTaskIdsByWaiver(orgId),
    db.select({ taskId: onboardingApplicationForms.taskId }).from(onboardingApplicationForms).where(and(
      eq(onboardingApplicationForms.orgId, orgId),
      isNotNull(onboardingApplicationForms.publishedAt),
      isNull(onboardingApplicationForms.archivedAt),
    )),
    db.select({ taskId: onboardingIntakes.taskId }).from(onboardingIntakes).where(and(
      eq(onboardingIntakes.orgId, orgId),
      eq(onboardingIntakes.applicationPublic, 1),
    )),
  ])
  const referenceTime = Date.now()
  const sessionHasEnded = (endsAt: number | null, startsAt: number | null) => {
    const effectiveEnd = endsAt ?? startsAt
    return effectiveEnd !== null && effectiveEnd < referenceTime
  }
  const taskShifts = await Promise.all(taskRows.map(async (task) => ({ task, sessions: await getShiftsWithCounts(task.id) })))
  const publishedApplicationTaskIds = new Set([
    ...publishedApplicationForms.map((row) => row.taskId),
    ...publicProfileIntakes.map((row) => row.taskId),
  ])
  const programById = new Map(volunteerPrograms.map((program) => [program.id, program]))
  const publishedOpportunities = taskShifts.flatMap(({ task, sessions }) => {
    if (task.isOnboarding === 1) return []
    const publicSessions = sessions.filter(({ shift }) => shift.visibility === 'public')
    const applicationPublished = publishedApplicationTaskIds.has(task.id)
    if (!publicSessions.length && !applicationPublished) return []
    const liveSessions = publicSessions
      .filter(({ shift }) => shift.status === 'open' && !sessionHasEnded(shift.endsAt, shift.startsAt))
      .sort((a, b) => (a.shift.startsAt ?? Number.MAX_SAFE_INTEGER) - (b.shift.startsAt ?? Number.MAX_SAFE_INTEGER))
    return [{
      task,
      programName: task.programId ? programById.get(task.programId)?.name ?? 'Volunteer program' : 'Organization-wide',
      applicationPublished,
      publicSessionCount: publicSessions.length,
      liveSessionCount: liveSessions.length,
      nextSessionAt: liveSessions[0]?.shift.startsAt ?? null,
    }]
  }).sort((left, right) => {
    if (left.task.status !== right.task.status) return left.task.status === 'open' ? -1 : 1
    return (left.nextSessionAt ?? Number.MAX_SAFE_INTEGER) - (right.nextSessionAt ?? Number.MAX_SAFE_INTEGER)
  })
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
  const resources = [
    ...waiverSetup.waivers.map((waiver) => ({
      id: waiver.id,
      kind: 'waiver' as const,
      title: waiver.title,
      area: 'Liability Waiver',
      timestamp: waiver.createdAt,
      href: '/aesthetic-lab/issuer/waiver',
      attached: Boolean(waiver.documentUrl),
      taskIds: waiverTaskIds.get(waiver.id) ?? [],
      publications: publicationMap.get(resourceKey('waiver', waiver.id)) ?? [],
      programId: waiver.programId,
    })),
    ...documents.map((document) => ({
      id: document.id,
      kind: 'document' as const,
      title: document.title,
      area: ORGANIZATION_DOCUMENT_CATEGORY_DETAILS[document.category].label,
      timestamp: document.updatedAt,
      href: `/aesthetic-lab/issuer/documents/${document.id}`,
      attached: Boolean(document.documentUrl),
      taskIds: document.taskIds,
      publications: publicationMap.get(resourceKey('document', document.id)) ?? [],
      programId: document.programId,
    })),
  ].sort((a, b) => b.timestamp - a.timestamp)
  const palette = organizationBannerPalette(profile?.bannerPalette)
  const workspacePalette: WorkspacePaletteVariables = {
    '--program-palette-deep': palette.colors[0],
    '--program-palette-mid': palette.colors[1],
    '--program-palette-accent': palette.colors[2],
    '--program-palette-accent-deep': palette.colors[3],
  }
  const documentLibrary = <>
    <LabNotice hidden ok={searchParams.ok} error={searchParams.error} />
    <DocumentUploadCard
      waiverCount={waiverSetup.waivers.length}
      documentCount={documents.length}
      tasks={taskRows}
      programs={volunteerPrograms}
      redirectTo="/aesthetic-lab/issuer/catalog?workspace=documents"
      attached
    />
    {resources.length ? <section className={`${styles.workspaceSetupCard} ${styles.workspaceDocumentWorkspace} ${styles.paletteTreatmentCard}`} aria-label="Resource Library">
      <div className={`${styles.workspaceSetupHeading} ${styles.paletteTreatmentHeader}`}><div><p className={styles.eyebrow}>Resource Library</p></div></div>
      <div className={`${styles.workspaceDocumentProgramList} ${styles.paletteTreatmentBody}`}>{resources.map((resource) => <article key={`${resource.kind}-${resource.id}`}>
        <span><FileText size={17} /></span>
        <div><p>{resource.area}</p><h3>{resource.title}</h3><small>{resource.attached ? 'Source file attached · ' : ''}Updated {when(resource.timestamp)}</small></div>
        <div className={styles.workspaceDocumentActions}>
          <Link className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} href={resource.href}>Manage</Link>
          <DocumentOverflowActions resource={resource} tasks={taskRows} programs={volunteerPrograms} redirectTo="/aesthetic-lab/issuer/catalog?workspace=documents" />
        </div>
      </article>)}</div>
    </section> : null}
  </>
  const programs = <VolunteerProgramTabs tabs={programViews} />
  const opportunities = <>
    <LabNotice ok={searchParams.ok} error={searchParams.error} />
    <section className={`${styles.paletteTreatmentCard} ${styles.publishedOpportunitiesCard}`} aria-label="Published Opportunities">
      <div className={`${styles.paletteTreatmentHeader} ${styles.publishedOpportunitiesHeader}`}>
        <div><p className={styles.eyebrow}>Published Opportunities</p></div>
        <span>{publishedOpportunities.filter(({ task }) => task.status === 'open').length} open · {publishedOpportunities.length} total</span>
      </div>
      <div className={`${styles.paletteTreatmentBody} ${styles.publishedOpportunityList}`}>
        {publishedOpportunities.length ? publishedOpportunities.map((opportunity) => {
          const isOpen = opportunity.task.status === 'open'
          const publicationSummary = [
            opportunity.publicSessionCount
              ? `${opportunity.liveSessionCount} upcoming public session${opportunity.liveSessionCount === 1 ? '' : 's'}`
              : null,
            opportunity.applicationPublished ? (isOpen ? 'Application open' : 'Application ready to reopen') : null,
            opportunity.nextSessionAt ? `Next: ${eventWhen(opportunity.nextSessionAt)}` : null,
          ].filter((item): item is string => Boolean(item)).join(' · ')
          return <article key={opportunity.task.id} data-open={isOpen ? 'true' : 'false'}>
            <span><CalendarDays size={18} /></span>
            <div className={styles.publishedOpportunityDetails}>
              <p>{opportunity.programName}</p>
              <h3>{opportunity.task.title}</h3>
              <small>{publicationSummary || 'Public publication is configured and ready.'}</small>
            </div>
            <em>{isOpen ? 'Open to public' : 'Closed'}</em>
            <div className={styles.publishedOpportunityActions}>
              <form action={setOpportunityPublicationStatusAction}>
                <input type="hidden" name="taskId" value={opportunity.task.id} />
                <input type="hidden" name="status" value={isOpen ? 'closed' : 'open'} />
                <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/catalog?workspace=opportunities" />
                <button type="submit" className={styles.publishedOpportunityToggle} data-action={isOpen ? 'close' : 'open'}>{isOpen ? <EyeOff size={14} /> : <Eye size={14} />}{isOpen ? 'Close public' : 'Open public'}</button>
              </form>
              <Link className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} href={`/aesthetic-lab/issuer/opportunities/${opportunity.task.id}`}><Settings2 size={14} /> Manage</Link>
            </div>
          </article>
        }) : <div className={styles.publishedOpportunityEmpty}><CalendarDays size={20} /><div><b>No published opportunities yet.</b><p>Public shifts and application opportunities will appear here after they are published from a volunteer program.</p></div></div>}
      </div>
    </section>
  </>

  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
        <section className={styles.issuerMain} aria-label="Workspace">
          <div className={styles.programControlCenterShell} style={workspacePalette}>
            <section className={styles.programControlCenterCard}>
              <div className={styles.programControlCenterHeading}>
                <div>
                  <p className={styles.eyebrow}>Organization Workspace</p>
                  <h1>{org?.name ?? 'Organization'}&apos;s Workspace</h1>
                  <p>Manage the documents, volunteer programs, and published opportunities that keep your organization ready for its community.</p>
                </div>
              </div>
            </section>
            <IssuerWorkspaceMenu
              initialSection={searchParams.workspace}
              documents={documentLibrary}
              programs={programs}
              opportunities={opportunities}
            />
          </div>
        </section>
      </div>
    </main>
  )
}
