import Link from 'next/link'
import { and, desc, eq } from 'drizzle-orm'
import { CheckCircle2, FileText } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs, tasks } from '@/lib/db/schema'
import { getShiftsWithCounts } from '@/lib/services/opportunities'
import { getVolunteerPrograms } from '@/lib/services/volunteer-programs'
import { getOnboardingWaiverSetup } from '@/lib/services/waivers'
import { getOrganizationDocuments, ORGANIZATION_DOCUMENT_CATEGORIES, ORGANIZATION_DOCUMENT_CATEGORY_DETAILS } from '@/lib/services/organization-documents'
import { getOrganizationResourcePublicationMap, getWaiverTaskIdsByWaiver, resourceKey } from '@/lib/services/organization-resources'
import { LabHeader } from '../../LabHeader'
import { getLabWorkspace } from '../../lab-workspace'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import { IssuerWorkspaceMenu } from '../IssuerWorkspaceMenu'
import { VolunteerProgramTabs } from '../VolunteerProgramTabs'
import { DocumentCreateButton } from '../DocumentCreateButton'
import { DocumentOverflowActions } from '../DocumentOverflowActions'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function IssuerCatalogLabPage({ searchParams }: { searchParams: { workspace?: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const [org, taskRows, volunteerPrograms, documents, waiverSetup, resourcePublicationMap, waiverTaskIds] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    city
      ? db.select().from(tasks).where(and(eq(tasks.orgId, orgId), eq(tasks.cityId, city.id))).orderBy(desc(tasks.createdAt))
      : Promise.resolve([]),
    getVolunteerPrograms(orgId),
    getOrganizationDocuments(orgId),
    getOnboardingWaiverSetup(orgId),
    getOrganizationResourcePublicationMap(orgId),
    getWaiverTaskIdsByWaiver(orgId),
  ])
  const referenceTime = Date.now()
  const sessionHasEnded = (endsAt: number | null, startsAt: number | null) => {
    const effectiveEnd = endsAt ?? startsAt
    return effectiveEnd !== null && effectiveEnd < referenceTime
  }
  const taskShifts = await Promise.all(taskRows.map(async (task) => ({ task, sessions: await getShiftsWithCounts(task.id) })))
  const programViews = [
    {
      id: null,
      name: 'Organization',
      description: 'Shared volunteer roles available across your organization.',
    },
    ...volunteerPrograms,
  ].map((program) => {
    const programTaskShifts = taskShifts.filter(({ task }) => program.id ? task.programId === program.id : !task.programId)
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
    const detailHref = program.id ? `/aesthetic-lab/issuer/programs/${program.id}` : '/aesthetic-lab/issuer/programs/organization'
    return {
      id: program.id ?? 'organization',
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
  const taskOptions=taskRows.map(({id,title})=>({id,title}))
  const hasWaiver=waiverSetup.waivers.length>0
  const documentationLibrary=[
    ...waiverSetup.waivers.map(waiver=>({
      id:waiver.id,
      area:'Liability waiver',
      title:waiver.title,
      timestamp:waiver.createdAt,
      href:'/aesthetic-lab/issuer/waiver',
      attached:Boolean(waiver.documentUrl),
      taskIds:waiverTaskIds.get(waiver.id)??[],
      kind:'waiver' as const,
      programId:waiver.programId,
      publications:resourcePublicationMap.get(resourceKey('waiver',waiver.id))??[],
    })),
    ...documents.map(document=>({
      id:document.id,
      area:ORGANIZATION_DOCUMENT_CATEGORY_DETAILS[document.category].label,
      title:document.title,
      timestamp:document.updatedAt,
      href:`/aesthetic-lab/issuer/documents/${document.id}`,
      attached:Boolean(document.documentUrl),
      taskIds:document.taskIds,
      kind:'document' as const,
      programId:document.programId,
      publications:resourcePublicationMap.get(resourceKey('document',document.id))??[],
    })),
  ]
  const documentProgramAreas=[
    {id:null,name:'Organization',description:'Documents available across your organization and not assigned to a specific volunteer program.',documents:documentationLibrary.filter(document=>!document.programId)},
    ...volunteerPrograms.map(program=>({id:program.id,name:program.name,description:program.description||'Documents connected to this area of volunteer work.',documents:documentationLibrary.filter(document=>document.programId===program.id)})),
  ]
  const documentation=<>
    <section className={`${styles.workspaceSetupCard} ${styles.documentationInfoCard}`}>
      <div className={styles.workspaceSetupHeading}><div><p className={styles.eyebrow}>Organization setup</p><h2>Keep participant documentation ready.</h2><p>Use liability waivers whenever they fit your program, alongside the guides and operational resources your team needs.</p></div></div>
    </section>
    <section className={`${styles.workspaceSetupCard} ${styles.uploadDocumentsCard}`}>
      <div className={styles.workspaceSetupHeading}><div><h2>Upload Documents</h2></div></div>
      <div className={styles.workspaceSetupSteps}>
        <article className={hasWaiver?styles.workspaceSetupStepComplete:undefined}><span>{hasWaiver?<CheckCircle2 size={18}/>:<FileText size={18}/>}</span><div><p>Liability waivers</p><h3>{hasWaiver?`${waiverSetup.waivers.length} active waiver${waiverSetup.waivers.length===1?'':'s'} ready`:'Add a liability waiver'}</h3><small>{hasWaiver?'Each active waiver is included automatically with future onboarding sessions.':'This is optional. Add one whenever your organization needs participant acknowledgement.'}</small></div><Link className={styles.catalogWorkspaceAction} href="/aesthetic-lab/issuer/waiver">{hasWaiver?'Manage waivers':'Add waiver'}</Link></article>
        {ORGANIZATION_DOCUMENT_CATEGORIES.map(category=>{
          const details=ORGANIZATION_DOCUMENT_CATEGORY_DETAILS[category]
          const count=documents.filter(document=>document.category===category).length
          const itemName=category==='guide'?'guide':category==='safety'?'safety plan':'additional document'
          return <article key={category} className={count>0?styles.workspaceSetupStepComplete:undefined}><span>{count>0?<CheckCircle2 size={18}/>:<FileText size={18}/>}</span><div><p>{details.label}</p><h3>{count>0?`${count} ${count===1?'document':'documents'} saved`:`Add a ${itemName}`}</h3><small>{details.description}</small></div><DocumentCreateButton category={category} tasks={taskOptions} programs={volunteerPrograms} redirectTo="/aesthetic-lab/issuer/catalog?workspace=documentation"/></article>
        })}
      </div>
    </section>
    <section className={styles.workspaceDocumentWorkspace} aria-label="Organization document library">
      {documentProgramAreas.map(program=><section key={program.id??'organization'} className={styles.opportunityProgramSection}>
        <div className={styles.opportunityProgramHeading}><div><p className={styles.eyebrow}>Program area</p><h2>{program.name}</h2><p>{program.description}</p></div></div>
        {program.documents.length?<div className={styles.workspaceDocumentProgramList}>{program.documents.map(document=><article key={`${document.kind}-${document.id}`}>
          <span><FileText size={17}/></span><div><p>{document.area}</p><h3>{document.title}</h3><small>{document.attached?'Source file attached · ':''}Updated {new Date(document.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</small></div>
          <div className={styles.workspaceDocumentActions}><Link className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} href={document.href}>Manage</Link><DocumentOverflowActions resource={{id:document.id,title:document.title,kind:document.kind,taskIds:document.taskIds,publications:document.publications,programId:document.programId}} tasks={taskOptions} programs={volunteerPrograms} redirectTo="/aesthetic-lab/issuer/catalog?workspace=documentation"/></div>
        </article>)}</div>:<div className={styles.workspaceDocumentProgramEmpty}><FileText size={18}/><div><b>No documents in this program yet.</b><p>Add a guide, safety document, waiver, or other resource whenever it supports this area of work.</p></div></div>}
      </section>)}
    </section>
  </>

  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
        <section className={styles.issuerMain} aria-label="Workspace">
          <IssuerWorkspaceMenu initialSection={searchParams.workspace==='documentation'?'documentation':'programs'} programs={<VolunteerProgramTabs tabs={programViews} />} documentation={documentation} />
        </section>
      </div>
    </main>
  )
}
