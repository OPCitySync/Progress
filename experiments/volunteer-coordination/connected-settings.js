/** Load the signed-in identity used to hydrate the connected MyCity workspace. */
export async function loadMyCityContext() {
  const response = await fetch('/api/mycity/context', { credentials: 'same-origin', cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Could not load your organization.');
  return result;
}

export async function saveOrganizationSettings(values) {
  const response = await fetch('/api/mycity/organization-settings', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Could not save organization settings.');
  return result.organization;
}

export async function saveAccountSettings(values) {
  const response = await fetch('/api/mycity/account-settings', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Could not save account settings.');
  return result.account;
}

export async function loadMyCityReports() {
  const response = await fetch('/api/mycity/reports', { credentials: 'same-origin', cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Could not load organization reports.');
  return result;
}

export async function switchMyCityIdentity(identityId) {
  const response = await fetch('/api/mycity/identity', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identityId }),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Could not switch workspaces.');
  return result.role;
}

function initials(value) {
  return String(value || 'Account').split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();
}

function settingLink(ctx, href, glyph, title, copy, action) {
  const content=`<span class="workspace-setting-link-icon">${ctx.icon(glyph)}</span><span><strong>${ctx.e(title)}</strong><small>${ctx.e(copy)}</small></span>${ctx.icon('chevron')}`;
  return action ? ctx.button(content,action,href,'workspace-setting-link') : `<a class="workspace-setting-link" href="${href}">${content}</a>`;
}

export function renderConnectedSettings(ctx, context, error) {
  const {state,e,icon,previewSampleData}=ctx;
  const localOrg=state.recruitment.organizations.find(item=>item.id==='berkeley-neighbors');
  if (error&&!previewSampleData&&!localOrg) return `<section class="connected-settings-state panel"><h1>Organization Settings</h1><p role="alert">${e(error)}</p><a class="btn secondary" href="/login">Sign in again</a></section>`;
  const org = context?.organization || (localOrg ? {name:localOrg.name,email:localOrg.email,location:localOrg.location,phone:localOrg.profile?.phone,canEdit:true} : null);
  if (!org) {
    const issuer = context?.identities?.find(identity => identity.role === 'issuer');
    return `<section class="connected-settings-state panel"><h1>Organization Settings</h1><p>Switch to an Issuer Organization to manage its settings.</p>${issuer ? `<button class="btn primary" data-action="connectedIdentity" data-identity-id="${e(issuer.id)}">Open ${e(issuer.label)}</button>` : ''}</section>`;
  }
  const fields = [
    ['name', 'Organization name', org.name, 'text', 120],
    ['email', 'Organization email', org.email, 'email', 150],
    ['location', 'Location', org.location, 'text', 240],
    ['phone', 'Phone number', org.phone, 'tel', 50],
  ];
  const connected=Boolean(context?.organization&&!previewSampleData);
  return `<div class="workspace-settings-page">
    <header class="workspace-page-hero"><div><span class="eyebrow">ORGANIZATION ADMINISTRATION · ${e(context?.cityName||localOrg?.location||'CITY NETWORK')}</span><h1>Organization Settings</h1><p>Manage the identity, access, and operating controls behind your organization’s MyCity workspace.</p></div><span class="workspace-page-hero-mark">${icon('settings')}</span></header>
    <div class="workspace-settings-layout">
      <section class="workspace-settings-primary panel"><header class="workspace-card-heading"><div><span class="eyebrow">ORGANIZATION IDENTITY</span><h2>${e(org.name)}</h2><p>This information identifies your organization throughout MyCity.</p></div><span class="workspace-settings-avatar">${e(initials(org.name))}</span></header>
        ${org.canEdit ? `<form data-form="${connected?'organizationSettings':'localOrganizationSettings'}" class="connected-settings-form"><div class="connected-settings-fields">${fields.map(([key,label,value,type,max])=>`<label>${e(label)}<input name="${key}" type="${type}" maxlength="${max}" value="${e(value || '')}" ${key==='name'?'required':''}></label>`).join('')}</div><p class="form-error" role="alert" tabindex="-1"></p><div class="connected-settings-actions"><span>${connected?'Changes are saved to the organization record.':'Changes are saved in this local preview.'}</span><button type="submit" class="btn primary">Save Organization</button></div></form>` : `<div class="connected-settings-readonly"><p>Only an organization owner can change these settings.</p>${fields.map(([,label,value])=>`<div><span>${e(label)}</span><strong>${e(value || 'Not provided')}</strong></div>`).join('')}</div>`}
      </section>
      <aside class="workspace-settings-aside" aria-label="Organization controls">
        ${settingLink(ctx,'#/coordinator/profile','leaf','Public Profile','Control what residents and volunteers see.')}
        ${settingLink(ctx,'#/coordinator/staff','people','Staff & Roles','Invite organization members and manage access.')}
        ${settingLink(ctx,'#/coordinator/reports','reports','Reports','Review participation, service, and exports.')}
        ${settingLink(ctx,'data-page="documents"','book','Documents & Waivers','Maintain reusable organizational resources.','nav')}
      </aside>
    </div>
    <section class="workspace-settings-notes"><article><span>${icon('people')}</span><div><strong>Workspace ownership</strong><p>Organization owners control staff access and the organization’s public identity. Personal Civic-Participant accounts remain separate.</p></div></article><article><span>${icon('pin')}</span><div><strong>City Network</strong><p>${e(context?.cityName||localOrg?.location||'Your selected city')} determines the local organizations, opportunities, and residents available in this workspace.</p></div></article></section>
  </div>`;
}

export function renderAccountSettings(ctx, context, error) {
  const {e,icon,state,currentPerson,previewSampleData}=ctx;
  if(error&&!previewSampleData&&!context?.account)return `<section class="connected-settings-state panel"><h1>Account Settings</h1><p role="alert">${e(error)}</p><a class="btn secondary" href="/login">Sign in again</a></section>`;
  const person=currentPerson();
  const account=context?.account||{name:person.name,email:person.email||'',username:'',avatarUrl:''};
  const connected=Boolean(context?.account&&!previewSampleData);
  const roles=(context?.identities||[]).map(identity=>identity.role==='issuer'?identity.label:'Civic-Participant').filter((value,index,list)=>list.indexOf(value)===index);
  return `<div class="workspace-settings-page">
    <header class="workspace-page-hero participant"><div><span class="eyebrow">PERSONAL ACCOUNT · ${e(context?.cityName||'CITY NETWORK')}</span><h1>Account Settings</h1><p>Keep your sign-in identity current and review where your account has access.</p></div><span class="workspace-page-hero-mark">${icon('people')}</span></header>
    <div class="workspace-settings-layout">
      <section class="workspace-settings-primary panel"><header class="workspace-card-heading"><div><span class="eyebrow">ACCOUNT IDENTITY</span><h2>${e(account.name||'Civic Participant')}</h2><p>Your personal account stays separate from any organization you help manage.</p></div><span class="workspace-settings-avatar participant">${e(initials(account.name))}</span></header>
        <form data-form="${connected?'accountSettings':'localAccountSettings'}" class="connected-settings-form"><input type="hidden" name="avatarUrl" value="${e(account.avatarUrl||'')}"><div class="connected-settings-fields"><label>Display name<input name="name" required maxlength="100" value="${e(account.name||'')}"></label><label>Login email<input name="email" type="email" required maxlength="150" value="${e(account.email||'')}"></label><label class="span-2">Username <small>Optional · 3–30 lowercase letters, numbers, or underscores.</small><input name="username" maxlength="30" value="${e(account.username||'')}" placeholder="your_username" autocapitalize="none"></label></div><p class="form-error" role="alert" tabindex="-1"></p><div class="connected-settings-actions"><span>${connected?'Updates apply to every role connected to this login.':'Changes are saved in this local preview.'}</span><button type="submit" class="btn primary">Save Account</button></div></form>
      </section>
      <aside class="workspace-settings-aside" aria-label="Account controls">
        <a class="workspace-setting-link" href="/forgot-password">${icon('settings')}<span><strong>Password & security</strong><small>Send a secure password reset email.</small></span>${icon('chevron')}</a>
        <article class="workspace-setting-summary">${icon('switch')}<span><strong>Connected roles</strong><small>${e(roles.length?roles.join(' · '):'Civic-Participant')}</small></span></article>
        <article class="workspace-setting-summary">${icon('pin')}<span><strong>City Network</strong><small>${e(context?.cityName||'Berkeley')}</small></span></article>
      </aside>
    </div>
  </div>`;
}

export function renderReports(ctx, reports, error, loading) {
  const {state,e,icon,integratedPlatform,previewSampleData}=ctx;
  if(loading)return '<section class="connected-settings-state panel" role="status">Preparing organization reports…</section>';
  const verified=state.commitments.filter(item=>item.status==='verified');
  const roster=state.people.filter(person=>person.relationship==='member').length;
  const upcoming=state.activities.filter(activity=>!activity.archived&&activity.date>=new Date().toISOString().slice(0,10)&&activity.workStatus!=='Complete').length;
  const completed=state.activities.filter(activity=>activity.workStatus==='Complete').length;
  const summary={volunteers:reports?.summary?.volunteers??roster,verifiedCompletions:reports?.summary?.verifiedCompletions??verified.length,hours:reports?.summary?.hours??0,upcoming,completed};
  const exportReady=integratedPlatform&&!previewSampleData&&!error;
  return `<div class="workspace-reports-page">
    <header class="workspace-page-hero reports"><div><span class="eyebrow">ORGANIZATION REPORTING</span><h1>Reports</h1><p>Turn the work recorded in MyCity into a clear view of participation, delivery, and verified service.</p></div><span class="workspace-page-hero-mark">${icon('reports')}</span></header>
    ${error?`<div class="workspace-report-notice" role="status">${icon('info')}<span><strong>Live reporting is temporarily unavailable.</strong><small>${e(error)} The workspace view below uses the activity currently available in MyCity.</small></span></div>`:''}
    <section class="workspace-report-metrics" aria-label="Reporting overview"><article><span>${icon('people')}</span><small>Volunteers served with</small><strong>${e(summary.volunteers)}</strong></article><article><span>${icon('check')}</span><small>Verified contributions</small><strong>${e(summary.verifiedCompletions)}</strong></article><article><span>${icon('clock')}</span><small>Verified volunteer hours</small><strong>${e(summary.hours)}</strong></article><article><span>${icon('calendar')}</span><small>Scheduled activities</small><strong>${e(summary.upcoming)}</strong></article></section>
    <div class="workspace-report-grid"><section class="panel workspace-report-card"><header class="workspace-card-heading"><div><span class="eyebrow">SERVICE DELIVERY</span><h2>Activity record</h2><p>A practical view of the work your organization has scheduled and completed.</p></div></header><div class="workspace-report-rows"><div><span>Upcoming activities</span><strong>${e(summary.upcoming)}</strong></div><div><span>Completed activities</span><strong>${e(summary.completed)}</strong></div><div><span>Verified contributions</span><strong>${e(summary.verifiedCompletions)}</strong></div></div><a class="btn secondary" href="#/coordinator/calendar">Open Calendar</a></section>
      <section class="panel workspace-report-card"><header class="workspace-card-heading"><div><span class="eyebrow">EXPORTS</span><h2>Contribution records</h2><p>Download recorded participation for internal analysis, grant reporting, or audit preparation.</p></div></header><div class="workspace-export-note">${icon('reports')}<span><strong>Contributions CSV</strong><small>Volunteer, activity, status, check-in, verified hours, and last update.</small></span></div>${exportReady?'<a class="btn primary" href="/api/reports?type=contributions">Download CSV</a>':'<button class="btn primary" disabled>Download available with live records</button>'}</section>
    </div><p class="workspace-report-footnote">Reports reflect information recorded in MyCity. Verify attendance and completed service before using totals externally.</p>
  </div>`;
}
