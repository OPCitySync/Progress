import Link from 'next/link'
import type { ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { claims, notifications, onboardingApplications, organizationDelegations, programMetricEntries, programMetrics, programRecognitions, programWorkAreas, programWorkspaceSettings, shifts, tasks, users } from '@/lib/db/schema'
import { onboardingMaterials, stringIds } from '@/lib/services/program-workspace'
import { attendedOnboarding } from '@/lib/services/volunteer-intake'
import { getOrganizationDocuments } from '@/lib/services/organization-documents'
import { DialogForm, WorkspaceDialog, ThankYouLetterComposer, OnboardingSetupEditor } from './ProgramWorkspace'
import { AddOnboardingSessionButton } from './AddOnboardingSessionButton'
import { ManageOnboardingSessionButton } from './ManageOnboardingSessionButton'
import { PublishOnboardingSessionButton } from './PublishOnboardingSessionButton'
import { InviteOnboardingVolunteersButton } from './InviteOnboardingVolunteersButton'
import { getShiftsWithCounts } from '@/lib/services/opportunities'
import styles from './ProgramWorkspace.module.css'

type Position={id:string;title:string}
const date=(n:number)=>new Date(n).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
const dateTime=(n:number)=>new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(n))
const today=()=>new Date().toISOString().slice(0,10)
function WorkAreaForm({scope,positions,area}:{scope:string;positions:Position[];area?:typeof programWorkAreas.$inferSelect}){
  return <DialogForm scope={scope} operation="area" submitLabel={area?'Save area':'Create area'}>
    {area?<input type="hidden" name="id" value={area.id}/>:null}
    <label>Area of work<input name="title" required maxLength={100} defaultValue={area?.title} placeholder="e.g. Food preparation"/></label>
    <label>What does this area make possible?<textarea name="purpose" maxLength={1000} defaultValue={area?.purpose} placeholder="The result your team is working toward."/></label>
    <label>What comes next?<textarea name="nextStep" maxLength={1000} defaultValue={area?.nextStep} placeholder="An improvement to try, a need to meet, or an idea to explore."/></label>
    <label>Status<select name="status" defaultValue={area?.status||'active'}><option value="exploring">Exploring</option><option value="active">In progress</option><option value="complete">Complete</option></select></label>
    {positions.length?<fieldset><legend>Connected volunteer positions</legend>{positions.map(p=><label className={styles.check} key={p.id}><input type="checkbox" name="taskId" value={p.id} defaultChecked={stringIds(area?.taskIds||'[]').includes(p.id)}/>{p.title}</label>)}</fieldset>:null}
  </DialogForm>
}
export async function ProgramOverviewPanel({orgId,scope,positions,history,impact}:{orgId:string;scope:string;positions:Position[];history:ReactNode;impact:ReactNode}){
  const [areas,metrics]=await Promise.all([
    db.select().from(programWorkAreas).where(and(eq(programWorkAreas.orgId,orgId),eq(programWorkAreas.scope,scope))).orderBy(desc(programWorkAreas.updatedAt)),
    db.select().from(programMetrics).where(and(eq(programMetrics.orgId,orgId),eq(programMetrics.scope,scope),isNull(programMetrics.archivedAt))).orderBy(desc(programMetrics.createdAt)),
  ])
  const measurements=metrics.length?await db.select({entry:programMetricEntries,author:users.name}).from(programMetricEntries).leftJoin(users,eq(programMetricEntries.actorId,users.id)).where(inArray(programMetricEntries.metricId,metrics.map(m=>m.id))).orderBy(desc(programMetricEntries.date),desc(programMetricEntries.createdAt)):[]
  return <>
    <section className={styles.card}>
      <header className={styles.heading}><div><p className={styles.eyebrow}>Program map</p><h2>The work, and where it can go.</h2></div><WorkspaceDialog label="Add work area" title="Build an area of work"><WorkAreaForm scope={scope} positions={positions}/></WorkspaceDialog></header>
      {areas.length?<div className={styles.grid}>{areas.map(area=><article key={area.id} className={styles.area} data-status={area.status}>
        <small>{area.status==='active'?'In progress':area.status==='exploring'?'Exploring':'Complete'}</small><h3>{area.title}</h3>
        {area.purpose?<p>{area.purpose}</p>:null}{area.nextStep?<div className={styles.nextStep}><b>Next step</b><p>{area.nextStep}</p></div>:null}
        {stringIds(area.taskIds).length?<p className={styles.hint}>{positions.filter(p=>stringIds(area.taskIds).includes(p.id)).map(p=>p.title).join(' · ')}</p>:null}
        <WorkspaceDialog label="Manage area" title={area.title} icon={false}><WorkAreaForm scope={scope} positions={positions} area={area}/></WorkspaceDialog>
      </article>)}</div>:<p className={styles.empty}>Give your program a starting point. Add an area of work, connect its volunteer positions, and capture what you want to improve next.</p>}
    </section>
    <section className={styles.card}>
      <header className={styles.heading}><div><p className={styles.eyebrow}>Your measures</p><h2>Track what matters to your mission.</h2></div><WorkspaceDialog label="Add a measure" title="What would you like to track?"><DialogForm scope={scope} operation="metric" submitLabel="Create measure">
        <label>Measure<input name="title" required maxLength={100} placeholder="e.g. Meals delivered"/></label>
        <div className={styles.twoColumns}><label>Unit<input name="unit" required maxLength={50} placeholder="e.g. meals"/></label><label>Target <small>(optional)</small><input name="target" type="number" min="0.01" step="any"/></label></div>
        <div className={styles.twoColumns}><label>Reporting starts<input type="date" name="periodStart" required defaultValue={today()}/></label><label>Reporting ends<input type="date" name="periodEnd" required defaultValue={new Date(new Date().getFullYear(),11,31,12).toISOString().slice(0,10)}/></label></div>
        <p className={styles.hint}>Your team adds measured results. These are separate from automatically recorded participation.</p>
      </DialogForm></WorkspaceDialog></header>
      {metrics.length?<div className={styles.grid}>{metrics.map(metric=>{
        const entries=measurements.filter(m=>m.entry.metricId===metric.id),total=entries.reduce((s,m)=>s+m.entry.amount,0)
        return <article className={styles.metric} key={metric.id}><p className={styles.eyebrow}>{metric.title}</p><strong>{total.toLocaleString()} <small>{metric.unit}</small></strong>
          {metric.target?<><progress max={metric.target} value={Math.max(0,Math.min(total,metric.target))} aria-label={metric.title+' progress'}/><small>Target: {metric.target.toLocaleString()} {metric.unit}</small></>:null}
          <p className={styles.hint}>{metric.periodStart} — {metric.periodEnd} · Team-reported</p>
          <WorkspaceDialog label="Record progress" title={metric.title} icon={false}><DialogForm scope={scope} operation="measurement" submitLabel="Save progress">
            <input type="hidden" name="metricId" value={metric.id}/><label>Amount to add ({metric.unit})<input name="amount" type="number" step="any" required/></label>
            <label>Date<input name="date" type="date" min={metric.periodStart} max={metric.periodEnd} required defaultValue={today()<metric.periodStart?metric.periodStart:today()>metric.periodEnd?metric.periodEnd:today()}/></label>
            <label>Note <small>(optional)</small><textarea name="note" maxLength={500} placeholder="Where this result came from. Use a negative amount and explain the reason to correct an earlier entry."/></label>
          </DialogForm></WorkspaceDialog>
          {entries.length?<details className={styles.measurements}><summary>Recorded progress</summary>{entries.map(({entry,author})=><p key={entry.id}><b>{entry.amount>0?'+':''}{entry.amount} {metric.unit}</b><br/>{entry.date} · {author||'Organization member'}{entry.note?<><br/>{entry.note}</>:null}</p>)}</details>:null}
        </article>
      })}</div>:<p className={styles.empty}>Meals shared, trees planted, neighbors reached—choose a measure and a reporting period when you are ready.</p>}
    </section>
    {history}{impact}
  </>
}

export async function ProgramOnboardingPanel({orgId,scope,programName,programs,location}:{orgId:string;scope:string;programName:string;programs:Array<{id:string;name:string}>;location:string}){
  const now=Date.now()
  const [own,materials,allDocuments]=await Promise.all([
    db.select().from(programWorkspaceSettings).where(and(eq(programWorkspaceSettings.orgId,orgId),eq(programWorkspaceSettings.scope,scope))).limit(1).then(r=>r[0]),
    onboardingMaterials(orgId,scope),
    getOrganizationDocuments(orgId),
  ])
  const documents=allDocuments.filter(document=>scope==='organization'?document.programId===null:document.programId===null||document.programId===scope)
  const effectiveScope=materials.policy?.scope||scope
  const active=Boolean(materials.policy&&materials.policy.onboardingMode!=='none')
  const shared=effectiveScope!==scope
  const redirectTo='/aesthetic-lab/issuer/programs/'+scope+'?section=onboarding'
  const welcomeTasks=await db.select().from(tasks).where(and(eq(tasks.orgId,orgId),eq(tasks.isOnboarding,1),eq(tasks.status,'open'),effectiveScope==='organization'?isNull(tasks.programId):eq(tasks.programId,effectiveScope)))
  const [approvedApplicationRows,activeStaffRows,orientationRows]=await Promise.all([
    db.select({applicationId:onboardingApplications.id,userId:users.id,name:users.name,email:users.email,roleTitle:tasks.title,approvedAt:onboardingApplications.reviewedAt}).from(onboardingApplications).innerJoin(users,eq(onboardingApplications.userId,users.id)).innerJoin(tasks,eq(onboardingApplications.taskId,tasks.id)).where(and(eq(onboardingApplications.orgId,orgId),eq(onboardingApplications.status,'approved'),eq(tasks.isOnboarding,0),scope==='organization'?isNull(tasks.programId):eq(tasks.programId,scope))).orderBy(desc(onboardingApplications.reviewedAt)),
    db.select({userId:organizationDelegations.userId}).from(organizationDelegations).where(and(eq(organizationDelegations.orgId,orgId),eq(organizationDelegations.status,'active'))),
    welcomeTasks.length?db.select({claim:claims,shift:shifts}).from(claims).innerJoin(shifts,eq(claims.shiftId,shifts.id)).where(and(inArray(claims.taskId,welcomeTasks.map(task=>task.id)),inArray(claims.status,['claimed','submitted','verified']))):Promise.resolve([]),
  ])
  const activeStaffIds=new Set(activeStaffRows.map(row=>row.userId))
  const completedOrientationIds=new Set(orientationRows.filter(row=>attendedOnboarding(row.claim,row.shift)).map(row=>row.claim.userId))
  const passedOrientationIds=new Set(orientationRows.filter(row=>{
    const sessionEndedAt=row.shift.endsAt??row.shift.startsAt
    return sessionEndedAt!==null&&sessionEndedAt<=now
  }).map(row=>row.claim.userId))
  const approvedVolunteerMap=new Map<string,{id:string;name:string;email:string;roleTitles:string[];approvedAt:number|null}>()
  for(const row of approvedApplicationRows){
    if(activeStaffIds.has(row.userId)||completedOrientationIds.has(row.userId)||passedOrientationIds.has(row.userId))continue
    const existing=approvedVolunteerMap.get(row.userId)
    if(existing){if(!existing.roleTitles.includes(row.roleTitle))existing.roleTitles.push(row.roleTitle);if((row.approvedAt??0)>(existing.approvedAt??0))existing.approvedAt=row.approvedAt}
    else approvedVolunteerMap.set(row.userId,{id:row.userId,name:row.name,email:row.email,roleTitles:[row.roleTitle],approvedAt:row.approvedAt})
  }
  const approvedVolunteers=Array.from(approvedVolunteerMap.values())
  const sessions=await Promise.all(welcomeTasks.map(async task=>({task,dates:await getShiftsWithCounts(task.id)})))
  const futureShifts=sessions.flatMap(({task,dates})=>dates.filter(({shift})=>shift.status==='open'&&Boolean(shift.startsAt&&shift.startsAt>now)).map(({shift,taken})=>({task,shift,taken})))
  const candidateIds=approvedVolunteers.map(volunteer=>volunteer.id)
  const invitationLinks=futureShifts.map(({task,shift})=>`/aesthetic-lab/opportunities/${task.id}?invitedSession=${shift.id}#available-sessions`)
  const [reservedRows,invitationRows]=await Promise.all([
    candidateIds.length&&futureShifts.length?db.select({shiftId:claims.shiftId,userId:claims.userId}).from(claims).where(and(inArray(claims.shiftId,futureShifts.map(({shift})=>shift.id)),inArray(claims.userId,candidateIds),inArray(claims.status,['claimed','submitted','verified']))):Promise.resolve([]),
    candidateIds.length&&invitationLinks.length?db.select({userId:notifications.userId,link:notifications.link}).from(notifications).where(and(eq(notifications.kind,'onboarding_session_invitation'),inArray(notifications.userId,candidateIds),inArray(notifications.link,invitationLinks))):Promise.resolve([]),
  ])
  const reservedKeys=new Set(reservedRows.map(row=>`${row.shiftId}:${row.userId}`))
  const invitationKeys=new Set(invitationRows.map(row=>`${row.link}:${row.userId}`))
  const volunteersWithReservation=new Set(reservedRows.map(row=>row.userId))
  const invitedVolunteerIds=new Set(invitationRows.map(row=>row.userId))
  return <>
    <section className={styles.info}>
      <header className={styles.heading}><div><p className={styles.eyebrow}>A clear welcome</p><h2>{active?(shared?'Shared organization onboarding':'Your volunteer welcome'):materials.policy?.onboardingMode==='none'?'No onboarding required':'Choose how people get started.'}</h2><p className={styles.hint}>Help people understand the program, get ready, and meet your team. You make the final decision about joining the roster.</p></div>
        {own?<WorkspaceDialog label="Manage onboarding" title="How should volunteers get started?" icon={false}><OnboardingSetupEditor scope={scope} initial={own} documents={documents.map(d=>({id:d.id,title:d.title}))}/></WorkspaceDialog>:null}
      </header>
      {!active?<p className={styles.hint}>Onboarding is optional. No requirements are applied until you save an active pathway.</p>:null}
      <div className={styles.approvedVolunteerSection}>
        <div className={styles.approvedVolunteerHeading}><div><p className={styles.eyebrow}>Awaiting orientation</p><h3>Approved volunteers ready for onboarding</h3></div></div>
        {approvedVolunteers.length?<div className={styles.approvedVolunteerList}>{approvedVolunteers.map(volunteer=><article className={styles.approvedVolunteerRow} key={volunteer.id}><span aria-hidden="true">{volunteer.name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'V'}</span><div><b>{volunteer.name}</b><small>Approved for {volunteer.roleTitles.join(' · ')}</small>{volunteersWithReservation.has(volunteer.id)?<small>Onboarding session reserved</small>:invitedVolunteerIds.has(volunteer.id)?<small className={styles.invitationSent}><CheckCircle2 size={12}/>Invitation sent</small>:<small>{volunteer.approvedAt?`Approved ${date(volunteer.approvedAt)} · Ready to invite`:'Ready to invite'}</small>}</div><Link className={styles.button} href={'/aesthetic-lab/issuer/volunteers/'+volunteer.id}>View Profile</Link></article>)}</div>:<p className={styles.approvedVolunteerEmpty}>No approved volunteers are currently awaiting orientation.</p>}
      </div>
    </section>
    <section className={styles.card}>
      <header className={styles.heading}><div><p className={styles.eyebrow}>Meet your volunteers</p><h2>Onboarding sessions</h2></div><AddOnboardingSessionButton programs={programs} defaultProgramId={effectiveScope==='organization'?null:effectiveScope} lockProgramContext activeProgramName={shared?'Organization':programName} defaultLocation={location} redirectTo={redirectTo}/></header>
      {sessions.length?<div className={styles.onboardingSessionDefinitions}>{sessions.map(({task,dates})=>{
        const upcoming=dates.filter(({shift})=>shift.status==='open'&&Boolean(shift.startsAt&&shift.startsAt>now))
        const inviteSessions=upcoming.map(({shift})=>{
          const link=`/aesthetic-lab/opportunities/${task.id}?invitedSession=${shift.id}#available-sessions`
          return {shiftId:shift.id,label:dateTime(shift.startsAt!),candidates:approvedVolunteers.map(volunteer=>({...volunteer,state:reservedKeys.has(`${shift.id}:${volunteer.id}`)?'reserved' as const:invitationKeys.has(`${link}:${volunteer.id}`)?'invited' as const:'available' as const}))}
        })
        return <article key={task.id} className={styles.onboardingSessionDefinition}>
          <div className={styles.onboardingSessionDefinitionHeading}>
            <div><b>{task.title}</b><small>Reusable onboarding session · {task.location||'Location to be confirmed'} · {materials.policy?.requireSession?'Attendance required':'Optional welcome session'}</small></div>
            <div className={styles.actions}>
              <ManageOnboardingSessionButton task={task} nextStartsAt={upcoming[0]?.shift.startsAt||null} durationMinutes={task.defaultDurationMinutes} weeklyCapacity={task.slots} programs={programs} redirectTo={redirectTo}/>
              <PublishOnboardingSessionButton taskId={task.id} redirectTo={redirectTo} suggestedStartsAt={upcoming.length?Math.max(...upcoming.map(({shift})=>shift.startsAt??now))+7*24*60*60*1000:now+24*60*60*1000} existingFutureSessions={upcoming.length}/>
              {approvedVolunteers.length&&inviteSessions.length?<InviteOnboardingVolunteersButton sessions={inviteSessions}/>:null}
            </div>
          </div>
          {upcoming.length?<div className={styles.onboardingSessionDateList}>{upcoming.map(({shift,taken})=><div className={styles.onboardingSessionDateRow} key={shift.id}><div><b>{dateTime(shift.startsAt!)}</b><small>{taken} reserved · {Math.max(0,shift.capacity-taken)} open</small></div></div>)}</div>:<p className={styles.onboardingSessionEmpty}>No upcoming dates.</p>}
        </article>
      })}</div>:<p className={styles.empty}>Create a reusable onboarding session and invite approved volunteers when you are ready.</p>}
    </section>
  </>
}
export async function ProgramRecognitionPanel({orgId,scope,taskIds}:{orgId:string;scope:string;taskIds:string[]}){
  const [verified,records,openShiftRows]=await Promise.all([
    taskIds.length?db.select({shift:shifts,task:tasks,user:users}).from(claims).innerJoin(shifts,eq(claims.shiftId,shifts.id)).innerJoin(tasks,eq(claims.taskId,tasks.id)).innerJoin(users,eq(claims.userId,users.id)).where(and(inArray(claims.taskId,taskIds),eq(claims.status,'verified'))).orderBy(desc(shifts.startsAt)):Promise.resolve([]),
    db.select().from(programRecognitions).where(and(eq(programRecognitions.orgId,orgId),eq(programRecognitions.scope,scope))).orderBy(desc(programRecognitions.createdAt)),
    taskIds.length?db.select({shift:shifts}).from(shifts).where(and(eq(shifts.orgId,orgId),eq(shifts.status,'open'),inArray(shifts.taskId,taskIds))).orderBy(desc(shifts.startsAt)):Promise.resolve([]),
  ])
  const now=Date.now()
  const shiftsToVerify=openShiftRows.filter(({shift})=>(shift.endsAt??shift.startsAt??Number.MAX_SAFE_INTEGER)<=now)
  const events=Array.from(new Map(verified.map(r=>[r.shift.id,{id:r.shift.id,title:r.task.title,date:date(r.shift.startsAt||r.shift.createdAt),people:verified.filter(p=>p.shift.id===r.shift.id).map(p=>({id:p.user.id,name:p.user.name}))}])).values())
  return <>
    <section className={styles.info}><header className={styles.heading}><h2>Recognition</h2><WorkspaceDialog label="Create Thank You Letter" title="Create Thank You Letter"><ThankYouLetterComposer scope={scope} events={events}/></WorkspaceDialog></header></section>
    <section className={styles.card}><header className={styles.heading}><div><p className={styles.eyebrow}>Verification</p><h2>Shifts ready for review.</h2></div></header>
      {shiftsToVerify.length?<div className={styles.rows}>{shiftsToVerify.map(({shift})=>{
        const shiftName=shift.label.trim()||(shift.startsAt?`${new Date(shift.startsAt).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})} shift`:'Scheduled shift')
        return <article className={styles.row} key={shift.id}><div><b>{shiftName}</b><small>{dateTime(shift.startsAt??shift.createdAt)} · Attendance awaiting verification</small></div><Link className={styles.button} href={`/aesthetic-lab/issuer/shifts/${shift.id}/verify`}><CheckCircle2 size={14}/> Verify &amp; Close</Link></article>
      })}</div>:<p className={styles.empty}>No completed shifts are waiting for verification.</p>}
    </section>
    <section className={styles.card}><header className={styles.heading}><div><p className={styles.eyebrow}>Appreciation shared</p><h2>Small moments worth keeping.</h2></div></header>
      {records.length?records.map(r=><article className={styles.row} key={r.id}><div><b>{r.recipientNames}</b><small>{date(r.createdAt)} · {r.kind==='letter'?'Printable letter':r.kind==='team'?'Private team message':'Private thank-you'}</small><p>{r.message}</p></div>{r.kind==='letter'?<Link className={styles.button} href={'/aesthetic-lab/issuer/programs/'+scope+'/recognition/'+r.id}>Open letter</Link>:<Link className={styles.button} href="/aesthetic-lab/issuer/notifications?pane=outbound">Messages</Link>}</article>):<p className={styles.empty}>Your personal notes and appreciation letters will collect here.</p>}
    </section>
  </>
}
