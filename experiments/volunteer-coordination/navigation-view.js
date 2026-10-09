import { safeProfileImage } from './profile-model.js';

const ISSUER_HEADER_PALETTE = ['#15151e', '#34343f', '#fbf0dc'];
export const ISSUER_SECTIONS = [
  {id:'home',label:'Home',icon:'home',page:'home',tabs:[]},
  {id:'volunteers',label:'Volunteers',icon:'people',page:'people',tabs:[['people','Roster'],['recruitment','Recruitment & onboarding'],['passport','Passports']]},
  {id:'mycity',label:'MyCity Feed',icon:'feed',page:'feed',tabs:[]},
];
const ISSUER_WORKSPACE = {id:'workspace',label:'Workspace',tabs:[['programs','Programs'],['documents','Documents'],['planning','Planning']]};
export function issuerSection(page) {
  if(page==='messages')return {id:'messages',label:'Messages',icon:'message',tabs:[]};
  if(page==='settings')return {id:'settings',label:'Organization Settings',icon:'settings',tabs:[]};
  if(page==='reports')return {id:'reports',label:'Reports',icon:'reports',tabs:[]};
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
  const section=ui.page==='messages'?{id:'messages',label:'Messages',icon:'message',tabs:[]}:ui.page==='settings'?{id:'settings',label:'Account Settings',icon:'settings',tabs:[]}:VOLUNTEER_SECTIONS[['home','feed'].includes(ui.page)?0:['passport','resume'].includes(ui.page)?2:1];
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
function headerNotifications(ctx) {
  const {state,ui,e,icon}=ctx,issuer=ui.mode==='coordinator',person=ctx.currentPerson();
  const items=issuer
    ? (state.activityLog||[]).slice(0,8).map((item,index)=>({id:`activity-${index}`,text:item.text,time:item.time||'Recent'}))
    : (state.notifications||[]).filter(item=>item.personId===person.id).slice(0,8);
  const list=items.length
    ? items.map(item=>{
      const content=`<span class="header-notification-symbol">${icon('bell')}</span><span><strong>${e(item.text)}</strong><small>${e(item.time||'New')}</small></span>${item.activityId?icon('chevron'):''}`;
      return item.activityId
        ? `<button type="button" class="header-notification-item" data-action="activity" data-id="${e(item.activityId)}">${content}</button>`
        : `<article class="header-notification-item">${content}</article>`;
    }).join('')
    : `<div class="header-notification-empty">${icon('bell')}<strong>You’re all caught up.</strong><span>New updates will appear here.</span></div>`;
  return `<details class="header-notifications"><summary aria-label="Notifications${items.length?` · ${items.length}`:''}" title="Notifications">${icon('bell')}${items.length?`<span class="header-notification-count" aria-hidden="true">${items.length>9?'9+':items.length}</span>`:''}</summary><section class="header-notification-dropdown" aria-label="Notifications"><header><strong>Notifications</strong><span>Recent updates</span></header><div class="header-notification-list">${list}</div></section></details>`;
}

function headerAccount(ctx) {
  const {state,ui,e,icon,button,avatar}=ctx,issuer=ui.mode==='coordinator';
  const org=ctx.contextOrg||state.recruitment.organizations.find(o=>o.id==='berkeley-neighbors')||{id:'',name:'Organization',location:'',profile:{}};
  const person=issuer?{name:ctx.coordinatorName,color:'peach'}:ctx.currentPerson();
  const connectedOrg=issuer&&ctx.integratedPlatform?ctx.platformContext?.organization:null;
  const identity=issuer?{name:connectedOrg?.name||org.name||'Organization',color:'sage'}:ctx.integratedPlatform?{name:ctx.platformContext?.accountName||person.name,color:'peach'}:person;
  const logo=connectedOrg?.logoUrl||org.profile?.logo;
  const otherIdentities=ctx.platformContext?.identities?.filter(target=>!target.active)||[];
  const workspaceSwitch=ctx.integratedPlatform
    ? otherIdentities.map(target=>button(icon('switch')+`<span><small>Switch to</small>${e(target.label)}<small>${target.role==='issuer'?'Issuer Organization':'Civic-Participant role'}</small></span>`,'connectedIdentity',`data-identity-id="${e(target.id)}"`,'header-profile-item')).join('') || '<span class="header-profile-empty">No other roles available</span>'
    : button(icon('switch')+`<span><small>Switch to</small>${e(issuer?ctx.currentPerson().name:org.name)}<small>${issuer?'Civic-Participant role':'Issuer Organization'}</small></span>`,'mode',`data-mode="${issuer?'volunteer':'coordinator'}"`,'header-profile-item');
  const accountAvatar=()=>issuer&&safeProfileImage(logo)?`<span class="avatar small sage"><img src="${e(logo)}" alt=""></span>`:avatar(identity,'small');
  return `<div class="issuer-account header-account">
    ${headerNotifications(ctx)}
    <a href="#/${ui.mode}/messages" class="header-conversations ${ui.page==='messages'?'is-active':''}" ${ui.page==='messages'?'aria-current="page"':''} aria-label="Messages" title="Messages">${icon('message')}<span>Messages</span></a>
    <details class="header-profile"><summary aria-label="Profile menu for ${e(identity.name)}" title="Profile menu">${accountAvatar()}${icon('down')}</summary>
      <section class="header-profile-dropdown" aria-label="Account menu"><div class="header-profile-identity">${accountAvatar()}<div><strong>${e(identity.name)}</strong><span>${issuer?'Issuer Organization':'Civic-Participant'} · ${e(ctx.platformContext?.cityName||'Berkeley')}</span></div></div>
        <div class="header-profile-section"><p class="header-profile-label">Workspace</p>
          ${workspaceSwitch}
          ${!issuer&&!ctx.integratedPlatform?`<label class="header-profile-persona">Exploring as<select id="persona" aria-label="Explore as volunteer">${state.people.map(person=>`<option value="${e(person.id)}" ${person.id===ctx.currentPerson().id?'selected':''}>${e(person.name)}</option>`).join('')}</select></label>`:''}
        </div>
        <div class="header-profile-section"><p class="header-profile-label">${issuer?'Organization':'Account'}</p>
          ${issuer?`<a href="#/coordinator/feed/profile" class="header-profile-item">${icon('leaf')}<span>Organization Profile</span>${icon('chevron')}</a>
          <a href="#/coordinator/reports" class="header-profile-item">${icon('reports')}<span>Reports<small>Participation, service, and exports</small></span>${icon('chevron')}</a>
          <a href="#/coordinator/settings" class="header-profile-item">${icon('settings')}<span>Organization Settings<small>Identity, access, and workspace controls</small></span>${icon('chevron')}</a>`:
          `<a href="#/volunteer/settings" class="header-profile-item">${icon('settings')}<span>Account Settings<small>Identity and account access</small></span>${icon('chevron')}</a>`}
        </div>
        <div class="header-profile-section"><p class="header-profile-label">Support</p>
          <a href="mailto:support@city-sync.org?subject=City%2FSync%20help" class="header-profile-item">${icon('help')}<span>Help &amp; Support</span>${icon('chevron')}</a>
        </div>
        <div class="header-profile-section"><p class="header-profile-label">${issuer?'Switch City':'City Network'}</p>
          <button class="header-profile-item" disabled>${icon('pin')}<span>${e(ctx.platformContext?.cityName||'Berkeley')}<small>Selected city${ctx.integratedPlatform?'':' · Local demo'}</small></span>${icon('check')}</button>
        </div>
        <div class="header-profile-section">${ctx.integratedPlatform?`<a href="/logout" class="header-profile-item">${icon('logout')}<span>Sign Out</span>${icon('chevron')}</a>`:`<button class="header-profile-item" disabled>${icon('logout')}<span>Sign Out<small>Unavailable · No signed-in account in this demo</small></span></button>`}</div>
      </section>
    </details>
  </div>`;
}
