import { volunteerResume, RESUME_SECTIONS, recordStatus, today } from './passport-model.js';

export function resumeSheet(ctx, printable = false) {
  const {state,e,ui}=ctx,r=volunteerResume(state,ui.person);
  return `<article class="${printable ? 'passport-print-sheet ' : ''}resume-sheet"><header><span class="eyebrow">VOLUNTEER RÉSUMÉ</span><h2>${e(r.name)}</h2>${r.about?.city?`<p>${e(r.about.city)}</p>`:''}${r.email?`<p>${e(r.email)}</p>`:''}</header>
    ${r.about?.bio?`<section><h3>About me</h3><p>${e(r.about.bio)}</p></section>`:''}
    ${r.about?.skills||r.about?.languages?`<section><h3>Skills & languages</h3>${r.about.skills?`<p>${e(r.about.skills)}</p><small>Skills are self-described.</small>`:''}${r.about.languages?`<p>${e(r.about.languages)}</p>`:''}</section>`:''}
    ${r.availability!==undefined?`<section><h3>When I can help</h3><p>${e(r.availability)}</p><p>${e(r.preference)}</p></section>`:''}
    ${['service','training'].map(kind=>{const records=r.records.filter(x=>x.kind===kind);return records.length?`<section><h3>${kind==='service'?'Volunteer experience':'Learning & training'}</h3>${records.map(x=>`<div class="resume-entry"><div><h4>${e(x.title)}</h4><time>${e(x.date)}</time></div><p class="resume-organization">${e(x.issuer)}${x.hours!=null?` · ${e(x.hours)} hours`:''}</p><p>${e(x.summary)}</p><small>${e(({attested:'Organization confirmed','self-reported':'Self-reported',disputed:'Correction requested',withdrawn:'Confirmation withdrawn',expired:'Expired','not yet valid':'Not yet valid'})[recordStatus(x)]||recordStatus(x))}${x.demo?' · Sample record':''}${x.expires?` · Expires ${e(x.expires)}`:''}</small>${x.attestation?`<p class="resume-source">Confirmed by ${e(x.attestation.by)} · ${e(x.attestation.date)}<br>Basis: ${e(x.attestation.basis)}</p>`:''}${x.correction?`<p>Correction requested: ${e(x.correction)}</p>`:''}${x.withdrawalReason?`<p>Withdrawal: ${e(x.withdrawalReason)}</p>`:''}</div>`).join('')}</section>`:'';}).join('')}
    ${!r.records.length&&!r.about&&!r.email&&r.availability===undefined?'<div class="resume-placeholder"><h3>Make this résumé yours.</h3><p>Choose profile details and completed records, then save your selection to see them here.</p></div>':''}
    <footer>Prepared ${e(today())} · MyCity local prototype. Sample confirmations are fictional. This is a dated copy; evidence status can change.</footer></article>`;
}
export function renderResume(ctx) {
  if (ctx.integratedPlatform) return connectedResume(ctx);
  const {state,ui,e,button}=ctx,selection=state.passports.resumes[ui.person]||{sections:[],recordIds:[]};
  const records=state.passports.records.filter(r=>r.personId===ui.person).sort((a,b)=>b.date.localeCompare(a.date));
  return `<div class="page-heading"><div><span class="eyebrow">THE EXPERIENCE YOU WANT TO SHARE</span><h1>My volunteer résumé<span class="heading-dot">.</span></h1><p>Build a personal summary from your passport. You choose what makes the page.</p></div>${button('Preview / Print PDF','resumePreview','','btn primary')}</div>
    <div class="resume-layout"><aside class="panel detail-section resume-controls"><form data-form="resumeSave"><span class="eyebrow">BUILD YOUR RÉSUMÉ</span><h2>Choose what to include</h2><p class="muted">Your name is included. Everything else is optional.</p><fieldset class="passport-choices"><legend>Profile details</legend>${Object.entries(RESUME_SECTIONS).map(([key,label])=>`<label><input type="checkbox" name="sections" value="${key}" ${selection.sections.includes(key)?'checked':''}><span>${e(label)}</span></label>`).join('')}</fieldset><fieldset class="passport-choices"><legend>Completed records</legend>${records.map(r=>`<label><input type="checkbox" name="recordIds" value="${e(r.id)}" ${selection.recordIds.includes(r.id)?'checked':''}><span>${e(r.title)}<small>${e(r.issuer)} · ${e(recordStatus(r))}</small></span></label>`).join('')||'<p class="muted">No records yet. Add completed contributions or learning in History.</p>'}</fieldset><button type="submit" class="btn primary full-width">Save selection & update preview</button><p class="microcopy">Save changes before printing. Your choices stay in this browser for this volunteer.</p></form><hr>${button('Edit profile','ppProfile','','text-button')}${button('Add a record','ppAdd','','text-button')}<p class="microcopy">This does not grant an organization access to your passport. A printed or downloaded copy cannot be recalled.</p></aside><div><div class="resume-preview-label"><span>YOUR SAVED PREVIEW</span><span>${selection.recordIds.length} selected ${selection.recordIds.length === 1 ? 'record' : 'records'}</span></div>${resumeSheet(ctx)}</div></div>`;
}

function connectedResume(ctx) {
  const { e, button, badge, platformResume, platformResumeError, platformResumeLoading, platformContext } = ctx;
  if (platformContext?.role && platformContext.role !== 'participant') {
    return `<section class="panel connected-resume-state"><h1>Volunteer Résumé</h1><p>Switch to your volunteer workspace to manage your digital résumé.</p></section>`;
  }
  if (platformResumeError) {
    return `<section class="panel connected-resume-state"><h1>Volunteer Résumé</h1><p role="alert">${e(platformResumeError)}</p>${button('Try again', 'resumeReload', '', 'btn secondary')}</section>`;
  }
  if (platformResumeLoading || !platformResume) {
    return '<section class="panel connected-resume-state" role="status"><h1>Volunteer Résumé</h1><p>Loading your digital résumé…</p></section>';
  }
  const resume = platformResume;
  const publicPath = resume.isPublic && resume.token ? `/resume/${encodeURIComponent(resume.token)}` : '';
  const publicUrl = publicPath ? `${typeof location === 'undefined' ? '' : location.origin}${publicPath}` : '';
  return `<div class="connected-resume-page">
    <section class="panel connected-resume-share"><div class="connected-resume-share-copy"><span class="eyebrow">SHAREABLE DIGITAL PAGE</span><h1>Volunteer Résumé</h1><p>Your verified contributions create a résumé that stays current as organizations confirm new work.</p></div><div class="connected-resume-share-status"><span>External page</span>${badge(resume.isPublic ? 'Shareable' : 'Private', resume.isPublic ? 'sage' : 'neutral')}</div><div class="connected-resume-actions">${button(resume.isPublic ? 'Make Resume Private' : 'Create Shareable Page', 'resumeVisibility', `data-public="${!resume.isPublic}"`, resume.isPublic ? 'btn secondary' : 'btn primary')}${publicPath ? `<a class="btn secondary" href="${e(publicPath)}" target="_blank" rel="noopener noreferrer">View External Page</a>${button('Copy Link', 'resumeCopyLink', `data-path="${e(publicPath)}"`, 'btn secondary')}` : ''}</div>${publicUrl ? `<div class="connected-resume-link"><span>Share this link</span><code>${e(publicUrl)}</code></div>` : `<p class="connected-resume-private-note">Only you can see this page. Create a shareable page when you are ready to send your résumé.</p>`}</section>
    <div class="connected-resume-preview-label"><span>YOUR DIGITAL PAGE</span><span>Updates from verified contributions</span></div>${connectedResumeSheet(ctx, resume)}
  </div>`;
}

function connectedResumeSheet(ctx, resume) {
  const { e, badge } = ctx;
  const contributions = resume.contributions.map(contribution => `<article class="connected-resume-entry"><div><h3>${e(contribution.opportunity)}</h3><p>${e(contribution.org)} · ${e(resumeContributionDate(contribution))}</p></div><span>${contribution.hours == null ? 'Verified contribution' : `${e(contribution.hours)} hours`}${badge('Organization verified', 'sage')}</span></article>`).join('');
  return `<article class="connected-resume-sheet"><header><div><span class="eyebrow">MYCITY · VOLUNTEER RÉSUMÉ</span><h2>${e(resume.name)}</h2><p>Volunteer since ${e(resumeDate(resume.joinedAt))}</p></div>${badge('Verified experience', 'sage')}</header><section class="connected-resume-totals"><div><strong>${e(resume.totals.contributions)}</strong><span>Contributions</span></div><div><strong>${e(resume.totals.hours)}</strong><span>Volunteer hours</span></div><div><strong>${e(resume.totals.organizations)}</strong><span>Organizations</span></div></section><section class="connected-resume-history"><span class="eyebrow">VOLUNTEER EXPERIENCE</span>${contributions || '<div class="empty-state compact">Verified contributions will appear here after an organization confirms your work.</div>'}</section><footer>Shared by the volunteer through MyCity. Each listed contribution was verified by the issuing organization.</footer></article>`;
}

function resumeContributionDate(contribution) {
  if (contribution.when) return resumeDate(contribution.when);
  if (contribution.whenLabel) return contribution.whenLabel;
  return resumeDate(contribution.verifiedAt);
}

function resumeDate(value) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
