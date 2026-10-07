import { safeProfileImage } from './profile-model.js';

const ISSUER_HEADER_PALETTE = ['#15151e', '#34343f', '#fbf0dc'];
export const ISSUER_SECTIONS = [
  {id:'home',label:'Home',icon:'home',page:'home',tabs:[]},
  {id:'volunteers',label:'Volunteers',icon:'people',page:'people',tabs:[['people','Roster'],['recruitment','Recruitment & onboarding'],['passport','Passports']]},
  {id:'mycity',label:'MyCity',icon:'feed',page:'feed',tabs:[]},
];
const ISSUER_WORKSPACE = {id:'workspace',label:'Workspace',tabs:[['programs','Programs'],['documents','Documents'],['planning','Planning']]};
export function issuerSection(page) {
  if(page==='messages')return {id:'messages',label:'Messages',icon:'message',tabs:[]};
  if(page==='settings')return {id:'settings',label:'Organization Settings',icon:'settings',tabs:[]};
  if(page==='feed')return ISSUER_SECTIONS[2];
  if(['people','recruitment','position','application','passport'].includes(page))return ISSUER_SECTIONS[1];
  return ISSUER_SECTIONS[0];
}
export function issuerNavigation(ctx) {
  const {state,ui,e,icon}=ctx,section=issuerSection(ui.page);
  const org=ctx.contextOrg||state.recruitment.organizations.find(o=>o.id==='berkeley-neighbors')||{id:'',name:'Organization',profile:{}};
  const colors=ISSUER_HEADER_PALETTE;
  const activeTab=({program:'programs',work:'planning',activity:'planning',schedule:'planning',position:'recruitment',application:'recruitment','org-profile':'discover'})[ui.page]||ui.page;
  const pending=state.recruitment.applications.filter(a=>a.orgId===org.id&&a.submittedAt&&['submitted','reviewing','needs-info','offered','onboarding'].includes(a.status)).length;
  const brandWordmark=`${ctx.assetBase}/assets/mycity-logo-gold-blue-on-white.svg`;
  const localSection=['programs','program','documents','work','activity','schedule','planning'].includes(ui.page)?ISSUER_WORKSPACE:section;
  const pageNavigation=localSection.tabs.length?`<div class="issuer-subnav-wrap"><nav class="issuer-subnav" aria-label="${e(localSection.label)} navigation">${localSection.tabs.map(([page,label])=>`<a href="#/coordinator/${page}" class="${page===activeTab?'is-active':''}" ${page===activeTab?'aria-current="page"':''}>${e(label)}${page==='recruitment'&&pending?`<span class="issuer-count">${pending}</span>`:''}</a>`).join('')}</nav></div>`:'';
  return `<a href="#main-content" data-action="issuerSkip" class="issuer-skip">Skip to content</a><header class="issuer-header" style="--issuer-deep:${colors[0]};--issuer-mid:${colors[1]};--issuer-accent:${colors[2]}"><div class="issuer-studio"><span><i></i> COORDINATION STUDIO <span class="issuer-demo-label">${ctx.previewSampleData?'Local Main · sample data':ctx.integratedPlatform?'Connected workspace':'Local prototype · sample data'}</span></span></div><div class="issuer-mainbar"><a href="#/coordinator/home" class="issuer-brand" aria-label="MyCity home"><img src="${brandWordmark}" alt="mycity"></a><nav aria-label="Issuer sections" class="issuer-section-nav">${ISSUER_SECTIONS.map(s=>`<a href="#/coordinator/${s.page}" class="issuer-section-link ${s.id===section.id?'is-active':''}" ${s.id===section.id?'aria-current="true"':''}>${icon(s.icon)}<span>${s.label}</span></a>`).join('')}</nav>${headerAccount(ctx)}</div></header>${pageNavigation}`;
}

export const VOLUNTEER_SECTIONS = [
  {id:'home',label:'Home',icon:'home',page:'home',tabs:[]},
  {id:'opportunities',label:'Opportunities',icon:'work',page:'work',tabs:[['work','Opportunities'],['discover','Discover Organizations'],['applications','My Volunteering']]},
  {id:'passport',label:'Passport',icon:'book',page:'passport',tabs:[['passport','MyPassport'],['resume','Résumé']]},
];
export function volunteerNavigation(ctx) {
  const {state,ui,e,icon,currentPerson}=ctx,p=currentPerson();
  const section=ui.page==='messages'?{id:'messages',label:'Messages',icon:'message',tabs:[]}:VOLUNTEER_SECTIONS[['home','feed'].includes(ui.page)?0:['passport','resume'].includes(ui.page)?2:1];
  const activeTab=({activity:'work',position:'discover','org-profile':'discover',application:'applications',schedule:'applications'})[ui.page]||ui.page;
  const invitations=state.commitments.filter(c=>c.personId===p.id&&c.status==='proposed').length+(state.recruitment.invitations||[]).filter(invitation=>invitation.personId===p.id&&invitation.status==='pending').length;
  const brandWordmark=`${ctx.assetBase}/assets/mycity-logo-gold-blue-on-white.svg`;
  return `<a href="#main-content" data-action="issuerSkip" class="issuer-skip">Skip to content</a>
    <header class="issuer-header" style="--issuer-deep:#15151e;--issuer-mid:#34343f;--issuer-accent:#fbf0dc">
      <div class="issuer-studio"><span><i></i> COORDINATION STUDIO <span class="issuer-demo-label">${ctx.integratedPlatform?'Connected workspace':'Local prototype · sample data'}</span></span></div>
      <div class="issuer-mainbar"><a href="#/volunteer/home" class="issuer-brand" aria-label="MyCity home"><img src="${brandWordmark}" alt="mycity"></a>
      <nav aria-label="Volunteer sections" class="issuer-section-nav">${VOLUNTEER_SECTIONS.map(s=>`<a href="#/volunteer/${s.page}" class="issuer-section-link ${s.id===section.id?'is-active':''}" ${s.id===section.id?'aria-current="true"':''}>${icon(s.icon)}<span>${s.label}</span></a>`).join('')}</nav>
      ${headerAccount(ctx)}</div>
    </header>
    ${section.tabs.length?`<div class="issuer-subnav-wrap"><nav class="issuer-subnav" aria-label="${e(section.label)} navigation">${section.tabs.map(([page,label])=>`<a href="#/volunteer/${page}" class="${page===activeTab?'is-active':''}" ${page===activeTab?'aria-current="page"':''}>${e(label)}${page==='applications'&&invitations?`<span class="issuer-count" aria-label="${invitations} invitations">${invitations}</span>`:''}</a>`).join('')}</nav></div>`:''}`;
}


// Shared header utilities keep messages one click away from every workspace.
function headerAccount(ctx) {
  const {state,ui,e,icon,button,avatar}=ctx,issuer=ui.mode==='coordinator';
  const org=ctx.contextOrg||state.recruitment.organizations.find(o=>o.id==='berkeley-neighbors')||{id:'',name:'Organization',location:'',profile:{}};
  const person=issuer?{name:ctx.coordinatorName,color:'peach'}:ctx.currentPerson();
  const connectedOrg=issuer&&ctx.integratedPlatform?ctx.platformContext?.organization:null;
  const identity=issuer?{name:connectedOrg?.name||org.name||'Organization',color:'sage'}:ctx.integratedPlatform?{name:ctx.platformContext?.accountName||person.name,color:'peach'}:person;
  const logo=connectedOrg?.logoUrl||org.profile?.logo;
  const otherIdentities=ctx.platformContext?.identities?.filter(target=>!target.active)||[];
  const workspaceSwitch=ctx.integratedPlatform
    ? otherIdentities.map(target=>button(icon('switch')+`<span><small>Switch to</small>${e(target.label)}<small>${target.role==='issuer'?'Issuer workspace':'Volunteer workspace'}</small></span>`,'connectedIdentity',`data-identity-id="${e(target.id)}"`,'header-profile-item')).join('') || '<span class="header-profile-empty">No other workspaces available</span>'
    : button(icon('switch')+`<span><small>Switch to</small>${e(issuer?ctx.currentPerson().name:org.name)}<small>${issuer?'Volunteer workspace':'Issuer workspace'}</small></span>`,'mode',`data-mode="${issuer?'volunteer':'coordinator'}"`,'header-profile-item');
  const accountAvatar=()=>issuer&&safeProfileImage(logo)?`<span class="avatar small sage"><img src="${e(logo)}" alt=""></span>`:avatar(identity,'small');
  const platformItem=(label,glyph,path,description)=>ctx.connectedPlatform
    ? `<a href="${path}" target="_blank" rel="noopener noreferrer" class="header-profile-item">${icon(glyph)}<span>${label}<small>${description} · Connected platform ↗</small></span>${icon('external')}</a>`
    : `<button class="header-profile-item" disabled>${icon(glyph)}<span>${label}<small>Available in the connected platform</small></span></button>`;
  return `<div class="issuer-account header-account">
    <a href="#/${ui.mode}/messages" class="header-conversations ${ui.page==='messages'?'is-active':''}" ${ui.page==='messages'?'aria-current="page"':''} aria-label="Messages" title="Messages">${icon('message')}<span>Messages</span></a>
    <details class="header-profile"><summary aria-label="Profile menu for ${e(identity.name)}" title="Profile menu">${accountAvatar()}${icon('down')}</summary>
      <section class="header-profile-dropdown" aria-label="Account menu"><div class="header-profile-identity">${accountAvatar()}<div><strong>${e(identity.name)}</strong><span>${issuer?'Issuer Organization':'Volunteer'} · ${e(ctx.platformContext?.cityName||'Berkeley')}</span></div></div>
        <div class="header-profile-section"><p class="header-profile-label">Workspace</p>
          ${workspaceSwitch}
          ${!issuer&&!ctx.integratedPlatform?`<label class="header-profile-persona">Exploring as<select id="persona" aria-label="Explore as volunteer">${state.people.map(person=>`<option value="${e(person.id)}" ${person.id===ctx.currentPerson().id?'selected':''}>${e(person.name)}</option>`).join('')}</select></label>`:''}
        </div>
        <div class="header-profile-section"><p class="header-profile-label">${issuer?'Organization':'Account'}</p>
          <a href="#/${ui.mode}/${issuer?'profile':'passport'}" class="header-profile-item">${icon(issuer?'leaf':'book')}<span>${issuer?'Organization profile':'Volunteer Passport'}</span>${icon('chevron')}</a>
          ${ctx.integratedPlatform?`<a href="${issuer?'/aesthetic-lab/issuer?view=connected':'/aesthetic-lab?view=connected'}" class="header-profile-item">${icon('external')}<span>Connected workspace<small>Use live records and existing tools</small></span>${icon('chevron')}</a>`:''}
          ${issuer?platformItem('Reports','reports','/aesthetic-lab/issuer/reports','Impact, exports, and activity'):''}
          ${issuer&&ctx.integratedPlatform?`<a href="#/coordinator/settings" class="header-profile-item">${icon('settings')}<span>Organization Settings<small>Connected organization controls</small></span>${icon('chevron')}</a>`:platformItem(issuer?'Settings':'Account Settings','settings','/aesthetic-lab/settings',issuer?'Organization and account controls':'Account controls')}
          ${!issuer?`<a href="#/volunteer/messages" class="header-profile-item">${icon('message')}<span>Messages</span>${icon('chevron')}</a>`:''}
        </div>
        <div class="header-profile-section"><p class="header-profile-label">Preferences</p>
          ${!issuer?button(icon('calendar')+'<span>Availability & preferences</span>','preferences','','header-profile-item'):''}
          <a href="mailto:support@city-sync.org?subject=City%2FSync%20help" class="header-profile-item">${icon('help')}<span>Help &amp; support</span>${icon('chevron')}</a>
        </div>
        <div class="header-profile-section"><p class="header-profile-label">Switch city</p>
          <button class="header-profile-item" disabled>${icon('pin')}<span>${e(ctx.platformContext?.cityName||'Berkeley')}<small>Selected city${ctx.integratedPlatform?'':' · Local demo'}</small></span>${icon('check')}</button>
        </div>
        <div class="header-profile-section">${ctx.integratedPlatform?`<a href="/logout" class="header-profile-item">${icon('logout')}<span>Sign out</span>${icon('chevron')}</a>`:`<button class="header-profile-item" disabled>${icon('logout')}<span>Sign out<small>Unavailable · No signed-in account in this demo</small></span></button>`}</div>
      </section>
    </details>
  </div>`;
}
