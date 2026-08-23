import Link from 'next/link'
import { Archive, ArrowLeft, FileText, FileUp, FolderOpen, ShieldCheck } from 'lucide-react'
import { and, desc, eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { archiveOrganizationDocumentAction, createOrganizationDocumentAction } from '@/app/actions'
import { db } from '@/lib/db/client'
import { tasks } from '@/lib/db/schema'
import {
  getOrganizationDocuments,
  ORGANIZATION_DOCUMENT_CATEGORIES,
  ORGANIZATION_DOCUMENT_CATEGORY_DETAILS,
  type OrganizationDocumentCategory,
} from '@/lib/services/organization-documents'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { LabNotice } from '../../LabNotice'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

function categoryFrom(value: string | undefined): OrganizationDocumentCategory {
  return ORGANIZATION_DOCUMENT_CATEGORIES.includes(value as OrganizationDocumentCategory)
    ? (value as OrganizationDocumentCategory)
    : 'guide'
}

function when(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(timestamp)
}

function onboardingReturnPath(value: string | undefined) {
  return value?.startsWith('/aesthetic-lab/issuer/onboarding') ? value : null
}

export default async function IssuerDocumentsLabPage({
  searchParams,
}: {
  searchParams: { category?: string; taskId?: string; returnTo?: string; ok?: string; error?: string }
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
  const defaultCategory = categoryFrom(searchParams.category)
  const formCopy: Record<OrganizationDocumentCategory, { eyebrow: string; title: string; helper: string; placeholder: string }> = {
    guide: {
      eyebrow: 'New guide document',
      title: 'Add a volunteer guide.',
      helper: 'Create a handbook, role guide, training note, or event-day briefing for your team.',
      placeholder: 'Add the instructions, key contacts, or context a volunteer needs.',
    },
    safety: {
      eyebrow: 'New safety & operations document',
      title: 'Add a safety plan or operating guide.',
      helper: 'Keep emergency instructions, site procedures, equipment lists, and operational plans in one clear place.',
      placeholder: 'Add safety instructions, site procedures, key contacts, or equipment details.',
    },
    template: {
      eyebrow: 'New template',
      title: 'Add a reusable template.',
      helper: 'Save a checklist, project plan, after-action report, or team-ready starting point for future work.',
      placeholder: 'Add the reusable structure, prompts, or steps for your team to follow.',
    },
  }
  const selectedForm = formCopy[defaultCategory]
  const taskTitles = new Map(taskRows.map((task) => [task.id, task.title]))
  const selectedTask = searchParams.taskId ? taskRows.find((task) => task.id === searchParams.taskId) ?? null : null
  const returnTo = selectedTask ? onboardingReturnPath(searchParams.returnTo) : null
  const formDestination = selectedTask
    ? `/aesthetic-lab/issuer/documents?category=${defaultCategory}&taskId=${selectedTask.id}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`
    : `/aesthetic-lab/issuer/documents?category=${defaultCategory}`
  const successDestination = returnTo ?? '/aesthetic-lab/issuer/catalog?workspace=documentation'

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerLayout}>
      <IssuerLabSidebar organizationId={session.orgId ?? undefined} cityName={city?.name} />
      <section className={styles.issuerMain} aria-label="Volunteer documents">
        <section className={styles.issuerPageHero}>
          <div><p className={styles.eyebrow}>Workspace · Documentation</p><h1>Keep the work clear and ready.</h1><p>Create guidance your volunteers and team can rely on, then attach it to the opportunities where it belongs.</p></div>
          <Link href="/aesthetic-lab/issuer/catalog" className={styles.catalogWorkspaceAction}><ArrowLeft size={15} /> Workspace</Link>
        </section>
        <LabNotice hidden ok={searchParams.ok} error={searchParams.error} />

        <section className={`${styles.labPanel} ${styles.documentCreateCard}`}>
          <div><p className={styles.eyebrow}>{selectedTask ? 'Onboarding material' : selectedForm.eyebrow}</p><h2>{selectedTask ? `Add a document for ${selectedTask.title}.` : selectedForm.title}</h2><p className={styles.waiverHelper}>{selectedTask ? 'This material will be attached to the onboarding session by default, so participants can review it before they attend.' : selectedForm.helper} Write the content directly, attach a source file, or use both.</p></div>
          <form action={createOrganizationDocumentAction} className={styles.labForm}>
            <input type="hidden" name="redirectTo" value={formDestination} />
            <input type="hidden" name="successRedirectTo" value={successDestination} />
            <input type="hidden" name="category" value={defaultCategory} />
            <label>Document title<input name="title" required placeholder="e.g. Community garden volunteer guide" /></label>
            <label>Written guidance <span>(optional if you attach a file)</span><textarea name="body" placeholder={selectedForm.placeholder} /></label>
            <label>Attach a source file <span>(optional)</span><input name="document" type="file" accept="application/pdf,.doc,.docx" /><small>PDF, DOC, or DOCX; up to 10 MB.</small></label>
            <fieldset className={styles.documentAssignmentFieldset}><legend>{selectedTask ? 'Include with onboarding' : <>Attach to opportunities <span>(optional)</span></>}</legend>
              {taskRows.length > 0 ? <div>{taskRows.map((task) => <label key={task.id}><input type="checkbox" name="taskIds" value={task.id} defaultChecked={task.id === selectedTask?.id} /><span>{task.title}</span></label>)}</div> : <p>No current opportunities in this city yet. You can attach this document later when you publish one.</p>}
            </fieldset>
            <div className={styles.labFormActions}><button className={styles.labButton} type="submit"><FileUp size={15} /> Save document</button></div>
          </form>
        </section>

        <section className={styles.documentLibrarySection} aria-label="Organization document library">
          <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Your library</p><h2>Volunteer resources by purpose.</h2></div><span className={styles.documentCount}>{documents.length} saved</span></div>
          <div className={styles.documentCategoryGrid}>
            {ORGANIZATION_DOCUMENT_CATEGORIES.map((category) => {
              const details = ORGANIZATION_DOCUMENT_CATEGORY_DETAILS[category]
              const categoryDocuments = documents.filter((document) => document.category === category)
              return <article key={category} className={styles.documentCategoryCard}>
                <div className={styles.documentCategoryHeading}><span>{category === 'guide' ? <FolderOpen size={18} /> : category === 'safety' ? <ShieldCheck size={18} /> : <FileText size={18} />}</span><div><p>{details.label}</p><small>{details.description}</small></div></div>
                {categoryDocuments.length > 0 ? <div className={styles.documentEntries}>{categoryDocuments.map((document) => <article key={document.id}>
                  <div><b>{document.title}</b><small>Updated {when(document.updatedAt)}</small>{document.taskIds.length > 0 ? <em>Attached to {document.taskIds.map((taskId) => taskTitles.get(taskId) ?? 'an opportunity').join(', ')}</em> : <em>Organization library only</em>}</div>
                  <div className={styles.documentEntryActions}>{document.documentUrl ? <a href={document.documentUrl} target="_blank" rel="noreferrer" aria-label={`Open ${document.title}`}><FileText size={15} /></a> : null}<form action={archiveOrganizationDocumentAction}><input type="hidden" name="documentId" value={document.id} /><input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/documents" /><button type="submit" aria-label={`Archive ${document.title}`}><Archive size={15} /></button></form></div>
                </article>)}</div> : <p className={styles.documentEmpty}>No {details.label.toLowerCase()} yet.</p>}
                <Link className={styles.catalogWorkspaceAction} href={`/aesthetic-lab/issuer/documents?category=${category}`}>Add {details.label.slice(0, -1)}</Link>
              </article>
            })}
          </div>
        </section>
      </section>
    </div>
  </main>
}
