import Link from 'next/link'
import { and, desc, eq } from 'drizzle-orm'
import { FileText } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs, tasks } from '@/lib/db/schema'
import { getOrganizationDocuments, ORGANIZATION_DOCUMENT_CATEGORY_DETAILS } from '@/lib/services/organization-documents'
import {
  getOrganizationResourcePublicationMap,
  getWaiverTaskIdsByWaiver,
  resourceKey,
} from '@/lib/services/organization-resources'
import { getVolunteerPrograms } from '@/lib/services/volunteer-programs'
import { getProfile } from '@/lib/services/profile'
import { getOnboardingWaiverSetup } from '@/lib/services/waivers'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { HistoryBackButton } from '../../HistoryBackButton'
import { LabNotice } from '../../LabNotice'
import { DocumentUploadCard } from '../DocumentUploadCard'
import { DocumentOverflowActions } from '../DocumentOverflowActions'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

function when(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(timestamp)
}

export default async function IssuerDocumentsLabPage({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string }
}) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const [org, documents, taskRows, programs, waiverSetup, publicationMap, waiverTaskIds, profile] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    getOrganizationDocuments(orgId),
    city
      ? db.select({ id: tasks.id, title: tasks.title }).from(tasks).where(and(eq(tasks.orgId, orgId), eq(tasks.cityId, city.id))).orderBy(desc(tasks.createdAt))
      : Promise.resolve([]),
    getVolunteerPrograms(orgId),
    getOnboardingWaiverSetup(orgId),
    getOrganizationResourcePublicationMap(orgId),
    getWaiverTaskIdsByWaiver(orgId),
    getProfile(orgId),
  ])

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

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerLayout}>
      <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
      <section className={styles.issuerMain} aria-label="Document Library">
        <LabNotice hidden ok={searchParams.ok} error={searchParams.error} />

        <DocumentUploadCard
          waiverCount={waiverSetup.waivers.length}
          documentCount={documents.length}
          tasks={taskRows}
          programs={programs}
          redirectTo="/aesthetic-lab/issuer/documents"
          bannerPalette={profile?.bannerPalette}
          headerAction={<HistoryBackButton fallback="/aesthetic-lab/issuer/catalog" variant="dark" />}
        />

        <section className={`${styles.workspaceSetupCard} ${styles.workspaceDocumentWorkspace}`} aria-label="Resource Library">
          <div className={styles.workspaceSetupHeading}><div><p className={styles.eyebrow}>Resource Library</p></div></div>
          {resources.length ? <div className={styles.workspaceDocumentProgramList}>{resources.map((resource) => <article key={`${resource.kind}-${resource.id}`}>
            <span><FileText size={17} /></span>
            <div><p>{resource.area}</p><h3>{resource.title}</h3><small>{resource.attached ? 'Source file attached · ' : ''}Updated {when(resource.timestamp)}</small></div>
            <div className={styles.workspaceDocumentActions}>
              <Link className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} href={resource.href}>Manage</Link>
              <DocumentOverflowActions resource={resource} tasks={taskRows} programs={programs} redirectTo="/aesthetic-lab/issuer/documents" />
            </div>
          </article>)}</div> : <div className={styles.workspaceDocumentProgramEmpty}><FileText size={18} /><div><b>No documents yet.</b><p>Upload a waiver or document when your organization is ready.</p></div></div>}
        </section>
      </section>
    </div>
  </main>
}
