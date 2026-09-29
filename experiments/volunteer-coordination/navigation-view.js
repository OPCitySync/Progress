import { PALETTES, safeProfileImage } from './profile-model.js';
export const ISSUER_SECTIONS = [
  {id:'home',label:'Home',icon:'home',page:'home',tabs:[['home','Overview'],['feed','MyCity Feed'],['discover','Discover organizations']]},
  {id:'workspace',label:'Workspace',icon:'work',page:'programs',tabs:[['programs','Programs'],['documents','Documents'],['planning','Planning']]},
  {id:'volunteers',label:'Volunteers',icon:'people',page:'people',tabs:[['people','Roster'],['recruitment','Recruitment & onboarding'],['passport','Passports']]},
  {id:'profile',label:'Public Profile',icon:'leaf',page:'profile',tabs:[]},
];
export function issuerSection(page) {
  if(page==='messages')return {id:'messages',label:'Conversations',icon:'message',tabs:[]};
  if(['programs','program','documents','work','activity','schedule','planning'].includes(page))return ISSUER_SECTIONS[1];
  if(['people','recruitment','position','application','passport'].includes(page))return ISSUER_SECTIONS[2];
  if(page==='profile')return ISSUER_SECTIONS[3];
  return ISSUER_SECTIONS[0];
}
export function issuerNavigation(ctx) {
  const {state,ui,e,icon,button}=ctx,section=issuerSection(ui.page);
  const org=ctx.contextOrg||state.recruitment.organizations.find(o=>o.id==='berkeley-neighbors');
  const colors=PALETTES[org.profile.palette]||PALETTES.forest;
  const activeTab=({program:'programs',work:'planning',activity:'planning',schedule:'planning',position:'recruitment',application:'recruitment','org-profile':'discover'})[ui.page]||ui.page;
  const pending=state.recruitment.applications.filter(a=>a.orgId===org.id&&a.submittedAt&&['submitted','reviewing','needs-info','offered','onboarding'].includes(a.status)).length;
  const brandWordmark=`${ctx.assetBase}/assets/mycity-wordmark-light.svg`;
  return `<a href="#main-content" data-action="issuerSkip" class="issuer-skip">Skip to content</a><header class="issuer-header" style="--issuer-deep:${colors[0]};--issuer-mid:${colors[1]};--issuer-accent:${colors[2]}"><div class="issuer-studio"><span><i></i> MYCITY STUDIO <span class="issuer-demo-label">${ctx.integratedPlatform?'Branch preview · sample data':'Local prototype · sample data'}</span></span><div>${button('Try a journey','guide','','issuer-utility')}${button(icon('refresh')+'Reset demo','reset','','issuer-utility')}</div></div><div class="issuer-mainbar"><a href="#/coordinator/home" class="issuer-brand" aria-label="MyCity home"><img src="${brandWordmark}" alt="mycity"></a><nav aria-label="Issuer sections" class="issuer-section-nav">${ISSUER_SECTIONS.map(s=>`<a href="#/coordinator/${s.page}" class="issuer-section-link ${s.id===section.id?'is-active':''}" ${s.id===section.id?'aria-current="true"':''}>${icon(s.icon)}<span>${s.label}</span>${s.id===section.id?'<i aria-hidden="true"></i>':''}</a>`).join('')}</nav>${headerAccount(ctx)}</div></header>${section.tabs.length?`<div class="issuer-subnav-wrap"><nav class="issuer-subnav" aria-label="${e(section.label)} navigation">${section.tabs.map(([page,label])=>`<a href="#/coordinator/${page}" class="${page===activeTab?'is-active':''}" ${page===activeTab?'aria-current="page"':''}>${e(label)}${page==='recruitment'&&pending?`<span class="issuer-count">${pending}</span>`:''}</a>`).join('')}</nav></div>`:''}`;
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
  const invitations=state.commitments.filter(c=>c.personId===p.id&&c.status==='proposed').length;
  const brandWordmark=`${ctx.assetBase}/assets/mycity-wordmark-light.svg`;
  return `<a href="#main-content" data-action="issuerSkip" class="issuer-skip">Skip to content</a>
    <header class="issuer-header" style="--issuer-deep:#234d40;--issuer-mid:#456750;--issuer-accent:#e2ecbd">
      <div class="issuer-studio"><span><i></i> MYCITY STUDIO <span class="issuer-demo-label">${ctx.integratedPlatform?'Branch preview · sample data':'Local prototype · sample data'}</span></span><div>${button('Try a journey','guide','','issuer-utility')}${button(icon('refresh')+'Reset demo','reset','','issuer-utility')}</div></div>
      <div class="issuer-mainbar"><a href="#/volunteer/home" class="issuer-brand" aria-label="MyCity home"><img src="${brandWordmark}" alt="mycity"></a>
      <nav aria-label="Volunteer sections" class="issuer-section-nav">${VOLUNTEER_SECTIONS.map(s=>`<a href="#/volunteer/${s.page}" class="issuer-section-link ${s.id===section.id?'is-active':''}" ${s.id===section.id?'aria-current="true"':''}>${icon(s.icon)}<span>${s.label}</span>${s.id===section.id?'<i aria-hidden="true"></i>':''}</a>`).join('')}</nav>
      ${headerAccount(ctx)}</div>
    </header>
    ${section.tabs.length?`<div class="issuer-subnav-wrap"><nav class="issuer-subnav" aria-label="${e(section.label)} navigation">${section.tabs.map(([page,label])=>`<a href="#/volunteer/${page}" class="${page===activeTab?'is-active':''}" ${page===activeTab?'aria-current="page"':''}>${e(label)}${page==='schedule'&&invitations?`<span class="issuer-count" aria-label="${invitations} invitations">${invitations}</span>`:''}</a>`).join('')}</nav></div>`:''}`;
}


// Shared header utilities keep conversations one click away from every workspace.
function headerAccount(ctx) {
  const {state,ui,e,icon,button,avatar}=ctx,issuer=ui.mode==='coordinator';
  const org=ctx.contextOrg||state.recruitment.organizations.find(o=>o.id==='berkeley-neighbors');
  const person=issuer?{name:ctx.coordinatorName,color:'peach'}:ctx.currentPerson();
  const identity=issuer?{name:org.name,color:'sage'}:person;
  const accountAvatar=()=>issuer&&safeProfileImage(org.profile.logo)?`<span class="avatar small sage"><img src="${e(org.profile.logo)}" alt=""></span>`:avatar(identity,'small');
  const platformItem=(label,glyph,path,description)=>ctx.connectedPlatform
    ? `<a href="${path}" target="_blank" rel="noopener noreferrer" class="header-profile-item">${icon(glyph)}<span>${label}<small>${description} · Connected platform ↗</small></span>${icon('external')}</a>`
    : `<button class="header-profile-item" disabled>${icon(glyph)}<span>${label}<small>Available in the connected platform</small></span></button>`;
  return `<div class="issuer-account header-account">
    <a href="#/${ui.mode}/messages" class="header-conversations ${ui.page==='messages'?'is-active':''}" ${ui.page==='messages'?'aria-current="page"':''} aria-label="Conversations" title="Conversations">${icon('message')}<span>Conversations</span></a>
    <details class="header-profile"><summary aria-label="Profile menu for ${e(identity.name)}" title="Profile menu">${accountAvatar()}${icon('down')}</summary>
      <section class="header-profile-dropdown" aria-label="Account menu"><div class="header-profile-identity">${accountAvatar()}<div><strong>${e(identity.name)}</strong><span>${issuer?'Issuer Organization':'Volunteer'} · Berkeley</span></div></div>
        <div class="header-profile-section"><p class="header-profile-label">Workspace</p>
          ${button(icon('switch')+`<span><small>Switch to</small>${e(issuer?ctx.currentPerson().name:org.name)}<small>${issuer?'Volunteer workspace':'Issuer workspace'}</small></span>`,'mode',`data-mode="${issuer?'volunteer':'coordinator'}"`,'header-profile-item')}
          ${!issuer?`<label class="header-profile-persona">Exploring as<select id="persona" aria-label="Explore as volunteer">${state.people.map(person=>`<option value="${e(person.id)}" ${person.id===ctx.currentPerson().id?'selected':''}>${e(person.name)}</option>`).join('')}</select></label>`:''}
        </div>
        <div class="header-profile-section"><p class="header-profile-label">${issuer?'Organization':'Account'}</p>
          <a href="#/${ui.mode}/${issuer?'profile':'passport'}" class="header-profile-item">${icon(issuer?'leaf':'book')}<span>${issuer?'Organization profile':'Volunteer Passport'}</span>${icon('chevron')}</a>
          ${ctx.integratedPlatform?`<a href="${issuer?'/aesthetic-lab/issuer?view=connected':'/aesthetic-lab?view=connected'}" class="header-profile-item">${icon('external')}<span>Connected workspace<small>Use live records and existing tools</small></span>${icon('chevron')}</a>`:''}
          ${issuer?platformItem('Reports','reports','/aesthetic-lab/issuer/reports','Impact, exports, and activity'):''}
          ${platformItem(issuer?'Settings':'Account Settings','settings','/aesthetic-lab/settings',issuer?'Organization and account controls':'Account controls')}
          ${!issuer?`<a href="#/volunteer/messages" class="header-profile-item">${icon('message')}<span>Messages</span>${icon('chevron')}</a>`:''}
        </div>
        <div class="header-profile-section"><p class="header-profile-label">Preferences</p>
          ${!issuer?button(icon('calendar')+'<span>Availability & preferences</span>','preferences','','header-profile-item'):''}
          <a href="mailto:support@city-sync.org?subject=City%2FSync%20help" class="header-profile-item">${icon('help')}<span>Help &amp; support</span>${icon('chevron')}</a>
        </div>
        <div class="header-profile-section"><p class="header-profile-label">Switch city</p>
          <button class="header-profile-item" disabled>${icon('pin')}<span>Berkeley<small>Selected city · Local demo</small></span>${icon('check')}</button>
        </div>
        <div class="header-profile-section">${ctx.integratedPlatform?`<a href="/logout" class="header-profile-item">${icon('logout')}<span>Sign out</span>${icon('chevron')}</a>`:`<button class="header-profile-item" disabled>${icon('logout')}<span>Sign out<small>Unavailable · No signed-in account in this demo</small></span></button>`}</div>
      </section>
    </details>
  </div>`;
}
