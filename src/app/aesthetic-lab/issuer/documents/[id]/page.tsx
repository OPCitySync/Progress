import Link from 'next/link'
import { ArrowLeft, FileText, FolderOpen, ShieldCheck, Trash2 } from 'lucide-react'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { archiveOrganizationDocumentAction, setOrganizationDocumentProgramAction } from '@/app/actions'
import { getOrganizationDocuments, ORGANIZATION_DOCUMENT_CATEGORY_DETAILS } from '@/lib/services/organization-documents'
import { getVolunteerPrograms } from '@/lib/services/volunteer-programs'
import { getLabWorkspace } from '../../../lab-workspace'
import { LabHeader } from '../../../LabHeader'
import { IssuerLabSidebar } from '../../IssuerLabSidebar'
import styles from '../../../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function IssuerDocumentDetailLabPage({ params }: { params: { id: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [documents, volunteerPrograms] = await Promise.all([
    getOrganizationDocuments(session.orgId!),
    getVolunteerPrograms(session.orgId!),
  ])
  const document = documents.find((item) => item.id === params.id)
  if (!document) notFound()
  const category = ORGANIZATION_DOCUMENT_CATEGORY_DETAILS[document.category]
  const canPreviewPdf = document.documentMimeType === 'application/pdf' && Boolean(document.documentUrl)
  const sourceFileLabel = canPreviewPdf ? 'Open Source File' : 'Download Source File'

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerLayout}>
      <IssuerLabSidebar organizationId={session.orgId ?? undefined} cityName={city?.name} />
      <section className={styles.issuerMain} aria-label={`${document.title} document`}>
        <section className={styles.issuerPageHero}>
          <div><p className={styles.eyebrow}>Workspace · Documentation · {category.label}</p><h1>{document.title}</h1><p>Review the current resource and download its source file when needed.</p></div>
          <Link href="/aesthetic-lab/issuer/catalog" className={styles.catalogWorkspaceAction}><ArrowLeft size={15} /> Workspace</Link>
        </section>
        <section className={`${styles.labPanel} ${styles.documentPreviewCard}`}>
          <div className={styles.documentPreviewHeading}><span>{document.category === 'safety' ? <ShieldCheck size={20} /> : document.category === 'guide' ? <FolderOpen size={20} /> : <FileText size={20} />}</span><div><p className={styles.eyebrow}>Document preview</p><h2>{document.title}</h2><p>{category.description}</p></div><div className={styles.documentPreviewActions}>{document.documentUrl ? <a className={styles.catalogWorkspaceAction} href={document.documentUrl} target="_blank" rel="noreferrer" download={canPreviewPdf ? undefined : document.documentName ?? true}><FileText size={15} /> {sourceFileLabel}</a> : null}<form action={archiveOrganizationDocumentAction}><input type="hidden" name="documentId" value={document.id} /><input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/catalog?workspace=documentation" /><button className={styles.catalogWorkspaceAction} type="submit"><Trash2 size={15} /> Delete Document</button></form></div></div>
          <form action={setOrganizationDocumentProgramAction} className={styles.documentProgramAssignment}>
            <input type="hidden" name="documentId" value={document.id} />
            <input type="hidden" name="redirectTo" value={`/aesthetic-lab/issuer/documents/${document.id}`} />
            <label>Volunteer program<select name="programId" defaultValue={document.programId ?? ''}><option value="">Organization-wide / not assigned</option>{volunteerPrograms.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>
            <button className={styles.catalogWorkspaceAction} type="submit">Save program</button>
          </form>
          {canPreviewPdf ? <iframe className={styles.documentPdfPreview} src={document.documentUrl!} title={`Preview of ${document.title}`} /> : document.documentUrl ? <div className={styles.documentPreviewEmpty}><strong>Attached file: {document.documentName || 'Source document'}</strong><p>City/Sync can preview PDF files and written guidance created directly in the app. This file is available through Download Source File.</p></div> : document.body ? <div className={styles.documentPreviewBody}>{document.body.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div> : <p className={styles.documentPreviewEmpty}>Add written guidance to create an in-app preview for this resource.</p>}
        </section>
      </section>
    </div>
  </main>
}
