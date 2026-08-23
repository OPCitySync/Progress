import Link from 'next/link'
import { ArrowLeft, FileText, FolderOpen, ShieldCheck } from 'lucide-react'
import { and, desc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { updateOrganizationDocumentAction } from '@/app/actions'
import { db } from '@/lib/db/client'
import { tasks } from '@/lib/db/schema'
import { getOrganizationDocuments, ORGANIZATION_DOCUMENT_CATEGORY_DETAILS } from '@/lib/services/organization-documents'
import { getLabWorkspace } from '../../../lab-workspace'
import { LabHeader } from '../../../LabHeader'
import { LabNotice } from '../../../LabNotice'
import { IssuerLabSidebar } from '../../IssuerLabSidebar'
import styles from '../../../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function IssuerDocumentDetailLabPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { ok?: string; error?: string }
}) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [documents, taskRows] = await Promise.all([
    getOrganizationDocuments(session.orgId!),
    city
      ? db
          .select({ id: tasks.id, title: tasks.title })
          .from(tasks)
          .where(and(eq(tasks.orgId, session.orgId!), eq(tasks.cityId, city.id)))
          .orderBy(desc(tasks.createdAt))
      : Promise.resolve([]),
  ])
  const document = documents.find((item) => item.id === params.id)
  if (!document) notFound()
  const category = ORGANIZATION_DOCUMENT_CATEGORY_DETAILS[document.category]
  const canPreviewPdf = document.documentMimeType === 'application/pdf' && Boolean(document.documentUrl)

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerLayout}>
      <IssuerLabSidebar organizationId={session.orgId ?? undefined} cityName={city?.name} />
      <section className={styles.issuerMain} aria-label={`${document.title} document`}>
        <section className={styles.issuerPageHero}>
          <div><p className={styles.eyebrow}>Workspace · Documentation · {category.label}</p><h1>{document.title}</h1><p>Review the current resource and adjust its title, written guidance, or opportunity assignments.</p></div>
          <Link href="/aesthetic-lab/issuer/catalog" className={styles.catalogWorkspaceAction}><ArrowLeft size={15} /> Workspace</Link>
        </section>
        <LabNotice hidden ok={searchParams.ok} error={searchParams.error} />

        <section className={`${styles.labPanel} ${styles.documentPreviewCard}`}>
          <div className={styles.documentPreviewHeading}><span>{document.category === 'safety' ? <ShieldCheck size={20} /> : document.category === 'guide' ? <FolderOpen size={20} /> : <FileText size={20} />}</span><div><p className={styles.eyebrow}>Document preview</p><h2>{document.title}</h2><p>{category.description}</p></div>{document.documentUrl ? <a className={styles.catalogWorkspaceAction} href={document.documentUrl} target="_blank" rel="noreferrer"><FileText size={15} /> Open source file</a> : null}</div>
          {canPreviewPdf ? <iframe className={styles.documentPdfPreview} src={document.documentUrl!} title={`Preview of ${document.title}`} /> : document.documentUrl ? <p className={styles.documentPreviewEmpty}>City/Sync can preview PDF files and written guidance created directly in the app. DOC and DOCX files are available through the source-file link.</p> : document.body ? <div className={styles.documentPreviewBody}>{document.body.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div> : <p className={styles.documentPreviewEmpty}>Add written guidance to create an in-app preview for this resource.</p>}
        </section>

        <section className={`${styles.labPanel} ${styles.documentSettingsCard}`}>
          <div><p className={styles.eyebrow}>Current settings</p><h2>Where and how this resource is used.</h2><p className={styles.waiverHelper}>Changes take effect immediately for your organization’s Workspace.</p></div>
          <form action={updateOrganizationDocumentAction} className={styles.labForm}>
            <input type="hidden" name="documentId" value={document.id} />
            <input type="hidden" name="redirectTo" value={`/aesthetic-lab/issuer/documents/${document.id}`} />
            <label>Document title<input name="title" required defaultValue={document.title} /></label>
            <label>Written guidance <span>(optional if a source file is attached)</span><textarea name="body" defaultValue={document.body} placeholder="Add written guidance for your team." /></label>
            <fieldset className={styles.documentAssignmentFieldset}><legend>Applies to opportunities</legend>
              {taskRows.length > 0 ? <div>{taskRows.map((task) => <label key={task.id}><input type="checkbox" name="taskIds" value={task.id} defaultChecked={document.taskIds.includes(task.id)} /><span>{task.title}</span></label>)}</div> : <p>No current opportunities in this city yet.</p>}
            </fieldset>
            <div className={styles.labFormActions}><button className={styles.labButton} type="submit">Save settings</button></div>
          </form>
        </section>
      </section>
    </div>
  </main>
}
