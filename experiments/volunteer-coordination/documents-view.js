import { DOCUMENT_CATEGORIES, isLiabilityWaiver } from './documents-model.js';

const displayDate = value => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const safeReference = value => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
};

export function renderDocumentList(ctx) {
  const {state,e,icon,button,badge}=ctx;
  const documents=state.documentLibrary.items;
  return `<div class="documents-list-count">${documents.length} ${documents.length===1?'document':'documents'}</div>${documents.map(document=>{
    const program=state.programWorkspace.programs.find(program=>program.id===document.programId);
    const waiver=isLiabilityWaiver(document);
    return `<article class="documents-row${waiver?' documents-row-waiver':''}"><span class="documents-file-icon">${icon('book')}</span><div class="documents-row-copy"><div class="documents-row-meta">${waiver?'<span class="documents-waiver-label">Liability Waiver</span>':badge(document.category,'sage')}${document.sample?'<span>Sample record</span>':''}<span>Updated ${displayDate(document.updatedAt)}</span></div><h3>${e(document.title)}</h3><p>${e(document.summary)}</p>${document.fileName?`<span class="documents-file-name">${icon('book')} ${e(document.fileName)}</span>`:program?`<span class="documents-program-name">${icon('work')} ${e(program.name)}</span>`:'<span class="documents-program-name">Organization-wide</span>'}</div>${button('View details '+icon('arrow'),'docOpen',`data-id="${e(document.id)}"`,'btn secondary small')}</article>`;
  }).join('')||'<div class="documents-empty"><h3>No documents match this view.</h3><p>Try a different search or category.</p></div>'}`;
}

export function renderDocuments(ctx) {
  const {icon,button}=ctx;
  return `<div class="page-heading documents-page-heading"><div><h1>Documents</h1><p>Keep your organization’s guidance, reference links, and program materials easy to find.</p></div></div>
    <section class="panel documents-panel" aria-label="Document library"><div class="documents-panel-header"><div><span class="eyebrow">ORGANIZATION LIBRARY</span><h2>Documents &amp; Resources</h2></div><div class="documents-header-actions">${button(icon('plus')+'Liability Waiver','docWaiver','','btn secondary documents-waiver-action')}${button(icon('plus')+'Add Document','docAdd','','btn primary')}</div></div><div id="documents-results">${renderDocumentList(ctx)}</div></section>
    <p class="microcopy documents-note">This library is a browser-local preview. Uploaded waiver files stay in this browser and are not shared with volunteers.</p>`;
}

export function renderDocumentDetail(ctx,id,fileUrl='') {
  const {state,e,icon,button,badge}=ctx;
  const document=state.documentLibrary.items.find(item=>item.id===id);
  if(!document)return null;
  const program=state.programWorkspace.programs.find(item=>item.id===document.programId);
  const reference=safeReference(document.referenceUrl);
  return {title:document.title,content:`<div class="dialog-body documents-detail"><div class="documents-detail-meta">${isLiabilityWaiver(document)?'<span class="documents-waiver-label">Liability Waiver</span>':badge(document.category,'sage')}${document.sample?badge('Sample record'):''}<span>Updated ${displayDate(document.updatedAt)}</span></div><p class="documents-detail-summary">${e(document.summary)}</p>${document.content?`<section><h3>${isLiabilityWaiver(document)?'Instructions':'Notes'}</h3><p>${e(document.content)}</p></section>`:''}${program?`<section><h3>Connected program</h3><p>${e(program.name)}</p></section>`:''}${fileUrl?`<a class="btn primary" href="${e(fileUrl)}" download="${e(document.fileName)}">Download ${e(document.fileName)} ${icon('external')}</a>`:document.fileName?'<p class="microcopy">The uploaded file is unavailable in this browser.</p>':reference?`<a class="btn secondary" href="${e(reference)}" target="_blank" rel="noopener noreferrer">Open external document ${icon('external')}</a>`:''}<p class="microcopy">${document.sample?'This is an example document record.':document.fileName?'This file is saved only in this browser preview.':'Saved in this browser preview. No file is attached.'}</p></div><div class="dialog-footer">${button('Close','close','','btn secondary')}${program?button('Open program '+icon('arrow'),'pgOpen',`data-id="${e(program.id)}" data-tab="resources"`,'btn primary'):''}</div>`};
}

export function renderDocumentForm(ctx,type='document') {
  const {state,e,button,errorOutput}=ctx;
  if(type==='liability-waiver')return `<form data-form="docAdd"><input type="hidden" name="documentType" value="liability-waiver"><div class="dialog-body"><p class="dialog-intro">Add the waiver volunteers will need to review before joining public activities.</p><label>Waiver title<input name="title" maxlength="100" required value="Volunteer liability waiver"></label><label>Short description<textarea name="summary" rows="2" maxlength="240" required placeholder="When this waiver applies"></textarea></label><label class="file-input">Upload waiver file<input name="waiverFile" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required></label><p class="microcopy">PDF, DOC, or DOCX · up to 10 MB</p><label>Instructions <span class="optional">optional</span><textarea name="content" rows="3" maxlength="4000" placeholder="What should volunteers know before reviewing this waiver?"></textarea></label><p class="microcopy">The file is saved in this browser preview. No signature is collected or shared.</p>${errorOutput()}</div><div class="dialog-footer">${button('Cancel','close','','btn secondary')}<button class="btn primary" type="submit">Add Liability Waiver</button></div></form>`;
  return `<form data-form="docAdd"><div class="dialog-body"><p class="dialog-intro">Add guidance or a web reference to your organization’s local library.</p><label>Title<input name="title" maxlength="100" required placeholder="Volunteer welcome guide"></label><label>Category<select name="category">${DOCUMENT_CATEGORIES.map(category=>`<option value="${e(category)}">${e(category)}</option>`).join('')}</select></label><label>Related program <span class="optional">optional</span><select name="programId"><option value="">Organization-wide</option>${state.programWorkspace.programs.map(program=>`<option value="${e(program.id)}">${e(program.name)}</option>`).join('')}</select></label><label>Short description<textarea name="summary" rows="2" maxlength="240" required placeholder="What will your team find here?"></textarea></label><label>Document notes <span class="optional">add notes or a link below</span><textarea name="content" rows="4" maxlength="4000" placeholder="Write the guidance here…"></textarea></label><label>External document link <span class="optional">optional</span><input name="referenceUrl" type="url" placeholder="https://…"></label><p class="microcopy">This preview saves the record in this browser. It does not upload a file or share the document with volunteers.</p>${errorOutput()}</div><div class="dialog-footer">${button('Cancel','close','','btn secondary')}<button class="btn primary" type="submit">Add document</button></div></form>`;
}
