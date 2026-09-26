import { PALETTES, safeProfileImage } from './profile-model.js';
export const ISSUER_SECTIONS = [
  {id:'home',label:'Home',icon:'home',page:'home',tabs:[['home','Overview'],['feed','MyCity Feed'],['discover','Discover organizations']]},
  {id:'workspace',label:'Workspace',icon:'work',page:'programs',tabs:[['programs','Programs'],['work','Activities'],['schedule','Schedule'],['planning','Planning']]},
  {id:'volunteers',label:'Volunteers',icon:'people',page:'people',tabs:[['people','Roster'],['recruitment','Recruitment & onboarding'],['passport','Passports']]},
  {id:'profile',label:'Public Profile',icon:'leaf',page:'profile',tabs:[]},
];
export function issuerSection(page) {
  if(page==='messages')return {id:'messages',label:'Conversations',icon:'message',tabs:[]};
  if(['programs','program','work','activity','schedule','planning'].includes(page))return ISSUER_SECTIONS[1];
  if(['people','recruitment','position','application','passport'].includes(page))return ISSUER_SECTIONS[2];
  if(page==='profile')return ISSUER_SECTIONS[3];
  return ISSUER_SECTIONS[0];
}
export function issuerNavigation(ctx) {
  const {state,ui,e,icon,button}=ctx,section=issuerSection(ui.page);
  const org=ctx.contextOrg||state.recruitment.organizations.find(o=>o.id==='berkeley-neighbors');
  const colors=PALETTES[org.profile.palette]||PALETTES.forest;
  const activeTab=({program:'programs',activity:'work',position:'recruitment',application:'recruitment','org-profile':'discover'})[ui.page]||ui.page;
  const pending=state.recruitment.applications.filter(a=>a.orgId===org.id&&a.submittedAt&&['submitted','reviewing','needs-info','offered','onboarding'].includes(a.status)).length;
  const tabLabel=section.tabs.find(([page])=>page===activeTab)?.[1]||(ui.page==='messages'?'Activity conversations':'Organization profile');
  return `<a href="#main-content" data-action="issuerSkip" class="issuer-skip">Skip to content</a><header class="issuer-header" style="--issuer-deep:${colors[0]};--issuer-mid:${colors[1]};--issuer-accent:${colors[2]}"><div class="issuer-studio"><span><i></i> COORDINATION STUDIO <span class="issuer-demo-label">Local prototype · sample data</span></span><div>${button('Try a journey','guide','','issuer-utility')}${button(icon('refresh')+'Reset demo','reset','','issuer-utility')}</div></div><div class="issuer-mainbar"><a href="#/coordinator/home" class="issuer-brand" aria-label="City/Sync home">city<span>/</span>sync<span class="issuer-brand-dot">®</span></a><nav aria-label="Issuer sections" class="issuer-section-nav">${ISSUER_SECTIONS.map(s=>`<a href="#/coordinator/${s.page}" class="issuer-section-link ${s.id===section.id?'is-active':''}" ${s.id===section.id?'aria-current="true"':''}>${icon(s.icon)}<span>${s.label}</span>${s.id===section.id?'<i aria-hidden="true"></i>':''}</a>`).join('')}</nav>${headerAccount(ctx)}</div></header><div class="issuer-context"><div class="issuer-organization"><span class="issuer-org-logo" style="background:${colors[2]};color:${colors[0]}">${safeProfileImage(org.profile.logo)?`<img src="${e(org.profile.logo)}" alt="">`:e(org.initial)}</span><div><strong>${e(org.name)}</strong><span>${e(org.location)} <i>·</i> Organization workspace</span></div></div><div class="issuer-section-context"><span>${e(section.label)}</span>${icon('chevron')}<strong>${e(tabLabel)}</strong></div><span class="issuer-context-note">${icon('people')} ${e(ctx.coordinatorName)}</span></div>${section.tabs.length?`<div class="issuer-subnav-wrap"><nav class="issuer-subnav" aria-label="${e(section.label)} navigation">${section.tabs.map(([page,label])=>`<a href="#/coordinator/${page}" class="${page===activeTab?'is-active':''}" ${page===activeTab?'aria-current="page"':''}>${e(label)}${page==='recruitment'&&pending?`<span class="issuer-count">${pending}</span>`:''}</a>`).join('')}</nav></div>`:''}`;
}

export const VOLUNTEER_SECTIONS = [
  {id:'home',label:'Home',icon:'home',page:'home',tabs:[]},
  {id:'opportunities',label:'Opportunities',icon:'work',page:'work',tabs:[['work','Explore activities'],['discover','Local organizations'],['applications','Applications'],['schedule','Commitments'],['programs','Programs'],['organization','My organization']]},
  {id:'passport',label:'Passport',icon:'book',page:'passport',tabs:[['passport','Profile'],['history','History'],['resume','Résumé']]},
];
export function volunteerNavigation(ctx) {
  const {state,ui,e,icon,button,currentPerson,avatar}=ctx,p=currentPerson();
  const section=ui.page==='messages'?{id:'messages',label:'Conversations',icon:'message',tabs:[]}:VOLUNTEER_SECTIONS[['home','feed'].includes(ui.page)?0:['passport','history','resume'].includes(ui.page)?2:1];
  const activeTab=({activity:'work',program:'programs',position:'discover','org-profile':'discover',application:'applications'})[ui.page]||ui.page;
  const tabLabel=section.tabs.find(([page])=>page===activeTab)?.[1]||(ui.page==='messages'?'Activity conversations':'MyCity Feed');
  const invitations=state.commitments.filter(c=>c.personId===p.id&&c.status==='proposed').length;
  return `<a href="#main-content" data-action="issuerSkip" class="issuer-skip">Skip to content</a>
    <header class="issuer-header" style="--issuer-deep:#234d40;--issuer-mid:#456750;--issuer-accent:#e2ecbd">
      <div class="issuer-studio"><span><i></i> COORDINATION STUDIO <span class="issuer-demo-label">Local prototype · sample data</span></span><div>${button('Try a journey','guide','','issuer-utility')}${button(icon('refresh')+'Reset demo','reset','','issuer-utility')}</div></div>
      <div class="issuer-mainbar"><a href="#/volunteer/home" class="issuer-brand" aria-label="City/Sync home">city<span>/</span>sync<span class="issuer-brand-dot">®</span></a>
      <nav aria-label="Volunteer sections" class="issuer-section-nav">${VOLUNTEER_SECTIONS.map(s=>`<a href="#/volunteer/${s.page}" class="issuer-section-link ${s.id===section.id?'is-active':''}" ${s.id===section.id?'aria-current="true"':''}>${icon(s.icon)}<span>${s.label}</span>${s.id===section.id?'<i aria-hidden="true"></i>':''}</a>`).join('')}</nav>
      ${headerAccount(ctx)}</div>
    </header>
    <div class="issuer-context"><div class="issuer-organization"><span class="volunteer-context-symbol">${icon(section.icon)}</span><div><strong>${section.id==='home'?`Hello, ${e(p.name.split(' ')[0])}.`:e(section.label)}</strong><span>${section.id==='home'?'Your city. Your community.':section.id==='opportunities'?'Find your people. Make a plan.':section.id==='messages'?'Keep the conversation with the work.':'Your experience goes with you.'}</span></div></div>
      <div class="issuer-section-context"><span>${e(section.label)}</span>${icon('chevron')}<strong>${e(tabLabel)}</strong></div>
      <label class="volunteer-persona"><span>Exploring as</span><select id="persona" aria-label="Explore as volunteer">${state.people.map(person=>`<option value="${e(person.id)}" ${person.id===p.id?'selected':''}>${e(person.name)}</option>`).join('')}</select></label>
    </div>
    ${section.tabs.length?`<div class="issuer-subnav-wrap"><nav class="issuer-subnav" aria-label="${e(section.label)} navigation">${section.tabs.map(([page,label])=>`<a href="#/volunteer/${page}" class="${page===activeTab?'is-active':''}" ${page===activeTab?'aria-current="page"':''}>${e(label)}${page==='schedule'&&invitations?`<span class="issuer-count" aria-label="${invitations} invitations">${invitations}</span>`:''}</a>`).join('')}</nav></div>`:''}`;
}


// Shared header utilities keep conversations one click away from every workspace.
function headerAccount(ctx) {
  const {ui,e,icon,button,avatar}=ctx,issuer=ui.mode==='coordinator';
  const person=issuer?{name:ctx.coordinatorName,color:'peach'}:ctx.currentPerson();
  return `<div class="issuer-account header-account">
    <a href="#/${ui.mode}/messages" class="header-conversations ${ui.page==='messages'?'is-active':''}" ${ui.page==='messages'?'aria-current="page"':''} aria-label="Conversations" title="Conversations">${icon('message')}<span>Conversations</span></a>
    <details class="header-profile"><summary aria-label="Profile menu for ${e(person.name)}" title="Profile menu">${avatar(person,'small')}${icon('down')}</summary>
      <div class="header-profile-dropdown"><div class="header-profile-identity">${avatar(person)}<div><strong>${e(person.name)}</strong><span>${issuer?'Volunteer coordinator':'Volunteer'}</span></div></div>
        <a href="#/${ui.mode}/${issuer?'profile':'passport'}" class="header-profile-item">${icon(issuer?'leaf':'book')}<span>${issuer?'Organization profile':'My passport & profile'}</span>${icon('chevron')}</a>
        ${!issuer?button(icon('calendar')+'<span>Availability & preferences</span>','preferences','','header-profile-item'):''}
        <div class="header-profile-divider"></div>
        ${button(icon(issuer?'leaf':'people')+`<span>${issuer?'Volunteer view':'Issuer view'}</span>`,'mode',`data-mode="${issuer?'volunteer':'coordinator'}"`,'header-profile-item')}
      </div>
    </details>
  </div>`;
}
