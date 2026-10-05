import { ACTIVITY_TYPES, programActivities, programHealth, blockersFor, workspaceProgramLeads } from './program-model.js';
import { HOME_ORG, positionOpen } from './recruitment-model.js';
import { today } from './passport-model.js';
const isCoordinator = ctx => ctx.ui.mode === 'coordinator';
const canView = (ctx,p) => isCoordinator(ctx) || (p.status !== 'draft' && ctx.currentPerson().relationship === 'member');
const when = value => value ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value+'T12:00:00' : value).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : 'Not set';
export function programActivityContext(ctx,a) {
  const {state,e,button,badge} = ctx;
  const p = state.programWorkspace.programs.find(p=>p.id===a.programId);
  if (!p || !canView(ctx,p)) return '';
  const blocked = blockersFor(state,a);
  return `<section class="panel detail-section"><div class="section-heading"><div><span class="eyebrow">PART OF A SHARED INITIATIVE</span><h2>${e(p.name)}</h2></div>${badge(a.workStatus,blocked.length?'sand':'sage')}</div><p>${e(p.purpose)}</p><p><strong>Done means:</strong> ${e(a.acceptance)}</p>${blocked.length?`<div class="callout sand"><strong>Waiting before work can proceed</strong>${blocked.map(b=>`<p>${e(b)}</p>`).join('')}</div>`:''}${a.seriesId?'<p class="microcopy">This is one occurrence. Accepting it does not book the rest of the series.</p>':''}${button('Open program →','pgOpen',`data-id="${e(p.id)}"`,'text-button')}</section>`;
}
function programActivityStatus(activity) {
  if(activity.workStatus==='Complete')return ['Completed','sage'];
  if(activity.workStatus==='Ready for review'||activity.date<today())return ['Waiting for Verification','sand'];
  return ['Upcoming','neutral'];
}
function programRoleMenu(ctx,program,role) {
  const {e,button}=ctx;
  return `<details class="program-row-menu"><summary aria-label="Manage ${e(role.title)}">…</summary><div class="program-row-menu-panel" role="menu">${button('Edit Role','rcEditRole',`data-id="${e(role.id)}" data-program="${e(program.id)}" role="menuitem"`,'program-row-menu-item')}${button('Delete Role','rcDeleteRole',`data-id="${e(role.id)}" data-program="${e(program.id)}" role="menuitem"`,'program-row-menu-item danger')}</div></details>`;
}
export function renderPrograms(ctx) {
  const {state,ui,e,button,badge} = ctx;
  const manage = isCoordinator(ctx);
  const allPrograms = state.programWorkspace.programs.filter(p=>canView(ctx,p));
  const programs = allPrograms.filter(p=>p.status!=='archived');
  const archivedPrograms = manage ? allPrograms.filter(p=>p.status==='archived') : [];
  const header = (title,sub,controls='',eyebrow='BERKELEY NEIGHBORS · VOLUNTEER PROGRAMS') => `<div class="page-heading"><div>${eyebrow ? `<span class="eyebrow">${e(eyebrow)}</span>` : ''}<h1>${e(title)}</h1><p>${e(sub)}</p></div><div class="page-actions">${controls}</div></div>`;
  if(ui.page==='programs') {
    const showingArchived=manage&&ui.item==='archived';
    const visiblePrograms=showingArchived?archivedPrograms:programs;
    const controls=manage?(showingArchived
      ? `<a class="text-button program-archive-back" href="#/${e(ui.mode)}/programs">← Back to Volunteer Programs</a>`
      : `<div class="program-list-actions">${button('+ Create program','pgNew','','btn primary')}${archivedPrograms.length?`<a class="text-button program-archive-link" href="#/${e(ui.mode)}/programs/archived">Archived Programs</a>`:''}</div>`):'';
    return header(showingArchived?'Archived Programs':manage?'Volunteer Programs':'A purpose. A plan. A team.',showingArchived?'Review programs retained as read-only organizational records.':'Keep the scope, people, decisions, and work of each initiative together.',controls,manage?'':undefined)+`<div class="program-cards">${visiblePrograms.map(p=>{
    const h=programHealth(state,p);return `<article class="panel program-card"><header class="program-card-header"><h2>${button(e(p.name),'pgOpen',`data-id="${e(p.id)}"`,'title-button')}</h2></header><div class="program-card-body"><p>${e(p.purpose||'Finish the program brief to define this initiative.')}</p><div class="program-owner"><strong>${e(p.lead||'Lead needed')}</strong><small>Program Lead</small></div><div class="progress-track" aria-label="${h.complete} of ${h.total} program activities complete"><span style="width:${h.total?100*h.complete/h.total:0}%"></span></div>${button('Open program →','pgOpen',`data-id="${e(p.id)}"`,'btn secondary')}</div></article>`;
    }).join('')||(showingArchived?'<section class="panel empty-state">No programs have been archived.</section>':'<section class="panel empty-state">Programs are available to organization members. Explore an open activity or apply to join the team.</section>')}</div>`;
  }
  const p=allPrograms.find(p=>p.id===ui.item);
  if(!p)return header('Program unavailable','This program is available to organization members.');
  const work=programActivities(state,p.id);
  const tab=ui.programTab==='resources'?'resources':'overview';
  const roles=state.recruitment.positions.filter(position=>position.orgId===HOME_ORG&&position.programId===p.id&&(manage||positionOpen(position)));
  const history=state.programWorkspace.history.filter(entry=>entry.programId===p.id);
  const programResources=(state.documentLibrary?.items||[]).filter(document=>document.programId===p.id||(document.programIds||[]).includes(p.id)||document.allVolunteerActivities);
  const editable=manage&&!['complete','archived'].includes(p.status);
  const tabs=[['overview','Overview'],['resources','Program Resources & Notes']];
  let content='';
  if(tab==='overview') {
    const sortedWork=work.slice().sort((a,b)=>(a.date||'').localeCompare(b.date||'')||a.title.localeCompare(b.title));
    content=`<div class="program-layout program-overview"><div class="program-overview-main">
      <section class="panel detail-section program-overview-card program-surface-card"><div class="section-heading"><div><span class="eyebrow">BUILD THE TEAM</span><h2>Program Roles</h2></div>${editable?button('+ Create role','pgCreateRole',`data-id="${e(p.id)}"`,'btn primary small'):''}</div><p class="program-section-intro">Define volunteer roles for this program. Roles also appear under Volunteers → Recruitment & onboarding.</p>${roles.length?`<div class="program-overview-list program-role-list">${roles.map(role=>`<div class="program-overview-row"><strong>${e(role.title)}</strong>${editable?programRoleMenu(ctx,p,role):''}</div>`).join('')}</div>`:'<div class="empty-state compact">No roles in this program yet. Create one to give volunteers a clear way to join.</div>'}</section>
      <section class="panel detail-section program-overview-card program-surface-card"><div class="section-heading"><div><span class="eyebrow">PLAN THE WORK</span><h2>Program Activities</h2></div>${editable?button('+ Program Activity','pgAddActivity',`data-id="${e(p.id)}"`,'btn primary small'):''}</div><p class="program-section-intro">New one-time and recurring activities stay in this program; existing work remains here too.</p>${sortedWork.length?`<div class="program-overview-list">${sortedWork.map(activity=>{const [status,statusKind]=programActivityStatus(activity);return `<div class="program-overview-row"><div><span class="eyebrow">${e(activity.type==='event'?'One-Time Program Activity':activity.type==='shift'?'Recurring Program Activity':ACTIVITY_TYPES[activity.type]||'Activity')} · ${e(activity.date||'Date to be set')}</span><strong>${e(activity.title)}</strong><small>${e(activity.time||'Time to be agreed')} · ${ctx.confirmedCount(state,activity.id)} confirmed</small>${editable&&['event','shift'].includes(activity.type)?`<div class="program-overview-actions">${button('Edit Activity','pgEditActivity',`data-id="${e(activity.id)}" data-program="${e(p.id)}"`,'text-button')}</div>`:''}</div>${badge(status,statusKind)}</div>`;}).join('')}</div>`:'<div class="empty-state compact">No activities in this program yet. Add the first piece of work when it is ready.</div>'}</section>
    </div><aside class="program-overview-aside"><section class="panel detail-section program-overview-card program-surface-card"><div class="section-heading"><div><span class="eyebrow">AT A GLANCE</span><h2>Program Details</h2></div>${editable?button('Program Settings','pgEdit',`data-id="${e(p.id)}"`,'btn secondary small'):''}</div><dl class="program-details"><div><dt>Program name</dt><dd>${e(p.name)}</dd></div><div><dt>Purpose and goals</dt><dd>${e(p.purpose)}</dd></div><div><dt>Program lead</dt><dd>${e(p.lead||'Not assigned')}</dd></div></dl>${manage&&p.status==='draft'?button('Activate program','pgStatus',`data-id="${e(p.id)}" data-status="active"`,'btn primary small'):''}</section>
    <section class="panel detail-section program-overview-card program-surface-card"><div class="section-heading"><div><h2>Activity Log</h2></div><span class="program-log-count">${history.length}</span></div>${history.length?`<ol class="program-log">${history.map(entry=>`<li><span class="program-log-dot" aria-hidden="true"></span><div><strong>${e(entry.text)}</strong>${entry.detail?`<p>${e(entry.detail)}</p>`:''}<small>${e(entry.actor)} · ${when(entry.date)}</small></div></li>`).join('')}</ol>`:'<p class="muted">Program changes and work updates will appear here.</p>'}</section></aside></div>`;
  }
  if(tab==='resources') content=`<div class="program-layout"><section class="panel detail-section program-surface-card"><div class="section-heading"><h2>Program Resources</h2>${editable?button('+ Add resource','pgResource',`data-id="${e(p.id)}"`,'btn secondary small'):''}</div><p>Keep useful instructions and documents with the initiative. Everything added here also appears in Documents &amp; Resources.</p>${programResources.map(resource=>`<article class="program-resource program-document-resource"><div><span class="eyebrow">${e(resource.category||'DOCUMENT')}</span><h3>${e(resource.title)}</h3><p>${e(resource.summary)}</p><small>Updated ${when(resource.updatedAt)}${resource.fileName?` · ${e(resource.fileName)}`:''}</small></div>${button('View Document','docOpen',`data-id="${e(resource.id)}"`,'btn secondary small')}</article>`).join('')||'<div class="empty-state compact">Add a brief, instructions, or a document for this program.</div>'}</section><section class="panel detail-section program-surface-card"><div class="section-heading"><h2>Decisions & progress</h2>${editable?button('+ Add Note','pgUpdate',`data-id="${e(p.id)}"`,'btn secondary small'):''}</div>${p.updates.map(u=>`<article class="program-resource">${badge(u.kind,u.kind==='Risk'?'sand':'sage')}<p>${e(u.text)}</p><small>${e(u.author)} · ${when(u.date)}</small></article>`).join('')||'<p>Record decisions, observed outcomes, or risks so the next person has the context.</p>'}</section></div>`;
  const programHeader=`<section class="panel program-detail-header"><div class="program-detail-heading"><div><span class="eyebrow">VOLUNTEER PROGRAM</span><h1>${e(p.name)}</h1></div>${button('← Back to Volunteer Programs','nav','data-page="programs"','btn secondary program-back')}</div><nav class="tabs program-tabs" aria-label="Program sections">${tabs.map(([key,label])=>button(label,'pgTab',`data-tab="${key}" aria-pressed="${tab===key}"`,`tab ${tab===key?'active':''}`)).join('')}</nav></section>`;
  return programHeader+content;
}
export function programDialog(ctx,type,data={}) {
  const {state,e,button,errorOutput}=ctx;
  if(!isCoordinator(ctx))return null;
  const p=state.programWorkspace.programs.find(p=>p.id===(data.program||data.id));
  const field=(label,name,value='',tag='input',extra='')=>`<label>${label}${tag==='textarea'?`<textarea name="${name}" rows="3" ${extra}>${e(value)}</textarea>`:`<input name="${name}" value="${e(value)}" ${extra}>`}</label>`;
  let title='',body='',form='',attrs='',submit='Save';
  if(type==='New') {
    title='Create Volunteer Program';form='pgProgram';attrs='data-id=""';submit='Create Program';
    const leads=workspaceProgramLeads(state);
    body=field('Program name','name','','input','required maxlength="100"')+field('Purpose and Goals of the Program','purpose','','textarea','required maxlength="1500"')+`<label>Assign a Program Lead<select name="leadMemberId" required><option value="" selected disabled>Choose an organization member</option>${leads.map(member=>`<option value="${e(member.id)}">${e(member.name)} · ${e(member.role)}</option>`).join('')}</select></label>`;
  } else if(type==='Edit') {
    const v=p;if(!v)return null;
    title='Edit Program Details';form='pgProgram';attrs=`data-id="${e(v.id)}"`;
    const leads=workspaceProgramLeads(state);
    const selectedId=v.leadMemberId||leads.find(member=>member.name===v.lead)?.id||'';
    body=field('Program name','name',v.name,'input','required maxlength="100"')+field('Purpose and Goals of the Program','purpose',v.purpose,'textarea','required maxlength="1500"')+`<label>Assign a Program Lead<select name="leadMemberId" required><option value="" ${selectedId?'':'selected'} disabled>Choose an organization member</option>${leads.map(member=>`<option value="${e(member.id)}" ${selectedId===member.id?'selected':''}>${e(member.name)} · ${e(member.role)}</option>`).join('')}</select></label>`;
  } else if(type==='Update'||type==='Close') {
    if(!p)return null;attrs=`data-id="${e(p.id)}"`;form='pg'+type;title=type==='Update'?'Record a program update':'Review the program outcome';
    body=type==='Update'?field('What should the team know?','text','','textarea','required maxlength="4000"'):`${p.success?`<p><strong>Success criteria:</strong> ${e(p.success)}</p>`:`<p><strong>Purpose and goals:</strong> ${e(p.purpose)}</p>`}<p>All work must be accepted before closing. Record what changed for the people this program serves, including any unmet goals.</p>`+field('Outcome review','note','','textarea','required maxlength="4000"');
  } else return null;
  const archiveAction=form==='pgProgram'&&p&&p.status!=='archived'?'<div class="dialog-footer-start">'+button('Archive Program','pgArchive',`data-id="${e(p.id)}"`,'text-button danger')+'</div>':'';
  return {title,content:`<form data-form="${form}" ${attrs}><div class="dialog-body">${body}${errorOutput()}</div><div class="dialog-footer">${archiveAction}${button('Cancel','close','','btn secondary')}<button type="submit" class="btn primary">${e(submit)}</button></div></form>`};
}
