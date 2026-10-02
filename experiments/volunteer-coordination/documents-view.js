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
    const waiver=isLiabilityWaiver(document);
    const programIds=[...new Set([document.programId,...(document.programIds||[])].filter(Boolean))];
    const programs=programIds.map(id=>state.programWorkspace.programs.find(program=>program.id===id)).filter(Boolean);
    const assignment=document.allVolunteerActivities?'All volunteer activities':programs.length?programs.map(program=>program.name).join(', '):'Organization-wide';
    const menu=waiver
      ? `${button(document.allVolunteerActivities?'Assigned to All Volunteer Activities':'Assign to All Volunteer Activities','docAssignAll',`data-id="${e(document.id)}" ${document.allVolunteerActivities?'disabled':''}`,'documents-row-menu-item')}${button('Select Programs','docAssign',`data-id="${e(document.id)}"`,'documents-row-menu-item')}`
      : button('Assign to Program','docAssign',`data-id="${e(document.id)}"`,'documents-row-menu-item');
    return `<article class="documents-row${waiver?' documents-row-waiver':''}"><span class="documents-file-icon">${icon('book')}</span><div class="documents-row-copy"><div class="documents-row-meta">${waiver?'<span class="documents-waiver-label">Liability Waiver</span>':badge(document.category,'sage')}${document.sample?'<span>Sample record</span>':''}<span>Updated ${displayDate(document.updatedAt)}</span></div><h3>${e(document.title)}</h3><p>${e(document.summary)}</p><div class="documents-row-references">${document.fileName?`<span class="documents-file-name">${icon('book')} ${e(document.fileName)}</span>`:''}<span class="documents-program-name">${icon('work')} ${e(assignment)}</span></div></div><div class="documents-row-actions">${button('View Document '+icon('arrow'),'docOpen',`data-id="${e(document.id)}"`,'btn secondary small')}<details class="documents-row-menu"><summary aria-label="Manage ${e(document.title)}">…</summary><div class="documents-row-menu-panel" role="menu">${menu}</div></details></div></article>`;
  }).join('')||'<div class="documents-empty"><h3>No documents match this view.</h3><p>Try a different search or category.</p></div>'}`;
}

export function renderDocuments(ctx) {
  const {icon,button}=ctx;
  return `<div class="page-heading documents-page-heading"><div><h1>Documents</h1><p>Keep your organization’s guidance, reference links, and program materials easy to find.</p></div></div>
    <section class="panel documents-panel" aria-label="Document library"><div class="documents-panel-header"><div><span class="eyebrow">ORGANIZATION LIBRARY</span><h2>Documents &amp; Resources</h2></div><div class="documents-header-actions">${button(icon('plus')+'Liability Waiver','docWaiver','','btn secondary documents-waiver-action')}${button(icon('plus')+'Add Document','docAdd','','btn primary')}</div></div><div id="documents-results">${renderDocumentList(ctx)}</div></section>
    <p class="microcopy documents-note">This library is a browser-local preview. Uploaded files stay in this browser and are not shared with volunteers.</p>`;
}

export function renderDocumentDetail(ctx,id,fileUrl='') {
  const {state,e,icon,button,errorOutput}=ctx;
  const document=state.documentLibrary.items.find(item=>item.id===id);
  if(!document)return null;
  const program=state.programWorkspace.programs.find(item=>item.id===document.programId);
  const reference=safeReference(document.referenceUrl);
  const waiver=isLiabilityWaiver(document);
  const previewable=fileUrl&&(/application\/pdf|^text\//i.test(document.fileType||'')||/\.(pdf|txt|md|csv)$/i.test(document.fileName||''));
  const preview=fileUrl
    ? previewable
      ? `<iframe class="documents-file-preview" src="${e(fileUrl)}" title="Preview of ${e(document.title)}"></iframe>`
      : `<div class="documents-preview-empty">${icon('book')}<strong>${e(document.fileName)}</strong><p>This file type cannot be previewed in the browser. Download it to view the document.</p></div>`
    : document.content
      ? `<div class="documents-notes-preview"><span class="eyebrow">DOCUMENT NOTES</span><p>${e(document.content)}</p></div>`
      : `<div class="documents-preview-empty">${icon('book')}<strong>${e(document.fileName||'No file attached')}</strong><p>${document.fileName?'The uploaded file is unavailable in this browser.':'Add a file, notes, or a reference link below.'}</p></div>`;
  const fileActions=`<div class="documents-preview-actions">${fileUrl?`<a class="btn secondary small" href="${e(fileUrl)}" download="${e(document.fileName)}">Download ${icon('external')}</a>`:''}${reference?`<a class="btn secondary small" href="${e(reference)}" target="_blank" rel="noopener noreferrer">Open Link ${icon('external')}</a>`:''}</div>`;
  const category=waiver
    ? `<input type="hidden" name="category" value="Forms"><label>Category<input value="Forms" disabled></label>`
    : `<label>Category<select name="category">${DOCUMENT_CATEGORIES.map(category=>`<option value="${e(category)}" ${document.category===category?'selected':''}>${e(category)}</option>`).join('')}</select></label>`;
  const connectedProgram=waiver
    ? '<input type="hidden" name="programId" value="">'
    : `<label>Related program <span class="optional">optional</span><select name="programId"><option value="">Organization-wide</option>${state.programWorkspace.programs.map(item=>`<option value="${e(item.id)}" ${document.programId===item.id?'selected':''}>${e(item.name)}</option>`).join('')}</select></label>`;
  const accept=waiver?'.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document':'.pdf,.doc,.docx,.txt,.md,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv';
  return {title:`View Document · ${document.title}`,content:`<form data-form="docEdit" data-id="${e(document.id)}"><input type="hidden" name="documentType" value="${e(document.documentType||'')}"><div class="dialog-body documents-detail"><div class="documents-detail-meta">${waiver?'<span class="documents-waiver-label">Liability Waiver</span>':`<span>${e(document.category)}</span>`}${document.sample?'<span>Sample record</span>':''}<span>Updated ${displayDate(document.updatedAt)}</span>${program?`<span>${e(program.name)}</span>`:''}</div><section class="documents-preview-shell"><div class="documents-preview-heading"><h3>Document Preview</h3>${fileActions}</div>${preview}</section><div class="documents-editor-fields"><div class="form-grid"><label class="span-2">Document title<input name="title" maxlength="100" required value="${e(document.title)}"></label>${category}${connectedProgram}<label class="span-2">Short description<textarea name="summary" rows="2" maxlength="240" required>${e(document.summary)}</textarea></label><label class="span-2">Document notes <span class="optional">optional</span><textarea name="content" rows="4" maxlength="4000">${e(document.content||'')}</textarea></label><label class="span-2">Reference link <span class="optional">optional</span><input name="referenceUrl" type="url" value="${e(document.referenceUrl||'')}" placeholder="https://…"></label><label class="file-input span-2">${document.fileName?'Replace uploaded file':'Upload file'} <span class="optional">optional</span><input name="documentFile" type="file" accept="${accept}"></label></div><p class="microcopy">${document.fileName?`${e(document.fileName)} is currently attached. Choosing a replacement updates it when you save.`:'No file is currently attached.'}</p>${errorOutput()}</div></div><div class="dialog-footer"><div class="dialog-footer-start">${button('Delete Resource','docDelete',`data-id="${e(document.id)}"`,'text-button danger')}</div>${button('Close','close','','btn secondary')}<button class="btn primary" type="submit">Save Changes</button></div></form>`};
}

export function renderDocumentAssignment(ctx,id) {
  const {state,e,button,errorOutput}=ctx;
  const document=state.documentLibrary.items.find(item=>item.id===id);
  if(!document)return null;
  const waiver=isLiabilityWaiver(document);
  const selected=new Set(document.programIds||[]);
  const programs=state.programWorkspace.programs.filter(program=>program.status!=='archived');
  if(waiver) return {
    title:'Assign Liability Waiver to Programs',
    content:`<form data-form="docAssign" data-id="${e(document.id)}" data-waiver="true"><div class="dialog-body"><p class="dialog-intro">Choose the programs whose volunteer activities should use ${e(document.title)}. This replaces an “all volunteer activities” assignment.</p><fieldset class="documents-program-choices"><legend>Programs</legend>${programs.map(program=>`<label class="checkbox-label"><input type="checkbox" name="programIds" value="${e(program.id)}" ${selected.has(program.id)?'checked':''}> <span>${e(program.name)}</span></label>`).join('')||'<p>No active programs are available.</p>'}</fieldset><p class="microcopy">Leave every program unselected to keep the waiver organization-wide without assigning it to activities.</p>${errorOutput()}</div><div class="dialog-footer">${button('Cancel','close','','btn secondary')}<button type="submit" class="btn primary">Save Assignment</button></div></form>`,
  };
  return {
    title:'Assign Document to Program',
    content:`<form data-form="docAssign" data-id="${e(document.id)}"><div class="dialog-body"><p class="dialog-intro">Choose where ${e(document.title)} should appear. It remains available in Documents &amp; Resources.</p><label>Program<select name="programId"><option value="">No program assignment</option>${programs.map(program=>`<option value="${e(program.id)}" ${document.programId===program.id?'selected':''}>${e(program.name)}</option>`).join('')}</select></label>${errorOutput()}</div><div class="dialog-footer">${button('Cancel','close','','btn secondary')}<button type="submit" class="btn primary">Save Assignment</button></div></form>`,
  };
}

export function renderDocumentForm(ctx,type='document',programId='') {
  const {state,e,button,errorOutput}=ctx;
  if(type==='liability-waiver')return `<form data-form="docAdd"><input type="hidden" name="documentType" value="liability-waiver"><div class="dialog-body"><p class="dialog-intro">Add the waiver volunteers will need to review before joining public activities.</p><label>Waiver title<input name="title" maxlength="100" required value="Volunteer liability waiver"></label><label>Short description<textarea name="summary" rows="2" maxlength="240" required placeholder="When this waiver applies"></textarea></label><label class="file-input">Upload waiver file<input name="waiverFile" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required></label><p class="microcopy">PDF, DOC, or DOCX · up to 10 MB</p><label>Instructions <span class="optional">optional</span><textarea name="content" rows="3" maxlength="4000" placeholder="What should volunteers know before reviewing this waiver?"></textarea></label><p class="microcopy">The file is saved in this browser preview. No signature is collected or shared.</p>${errorOutput()}</div><div class="dialog-footer">${button('Cancel','close','','btn secondary')}<button class="btn primary" type="submit">Add Liability Waiver</button></div></form>`;
  if(type==='program') {
    const program=state.programWorkspace.programs.find(item=>item.id===programId);
    if(!program)return '';
    return `<form data-form="docAdd"><input type="hidden" name="programId" value="${e(program.id)}"><input type="hidden" name="summary" value=""><div class="dialog-body"><p class="dialog-intro">Add a document to ${e(program.name)}. It will also appear in Documents &amp; Resources.</p><label>Resource Title<input name="title" maxlength="100" required></label><label class="file-input">Upload file <span class="optional">optional</span><input name="documentFile" type="file" accept=".pdf,.doc,.docx,.txt,.md,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv"></label><p class="microcopy">PDF, DOC, DOCX, TXT, MD, or CSV · up to 10 MB</p><label>Instructions or Document Reference<textarea name="content" rows="4" maxlength="4000" required placeholder="Add useful instructions or context for the team."></textarea></label><label>Category<select name="category">${DOCUMENT_CATEGORIES.map(category=>`<option value="${e(category)}" ${category==='Operations'?'selected':''}>${e(category)}</option>`).join('')}</select></label><label>External document link <span class="optional">optional</span><input name="referenceUrl" type="url" placeholder="https://…"></label>${errorOutput()}</div><div class="dialog-footer">${button('Cancel','close','','btn secondary')}<button class="btn primary" type="submit">Add Program Resource</button></div></form>`;
  }
  return `<form data-form="docAdd"><div class="dialog-body"><p class="dialog-intro">Add guidance, an uploaded file, or a web reference to your organization’s local library.</p><label>Title<input name="title" maxlength="100" required placeholder="Volunteer welcome guide"></label><label class="file-input">Upload document <span class="optional">optional</span><input name="documentFile" type="file" accept=".pdf,.doc,.docx,.txt,.md,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv"></label><p class="microcopy">PDF, DOC, DOCX, TXT, MD, or CSV · up to 10 MB</p><label>Category<select name="category">${DOCUMENT_CATEGORIES.map(category=>`<option value="${e(category)}">${e(category)}</option>`).join('')}</select></label><label>Related program <span class="optional">optional</span><select name="programId"><option value="">Organization-wide</option>${state.programWorkspace.programs.map(program=>`<option value="${e(program.id)}">${e(program.name)}</option>`).join('')}</select></label><label>Short description<textarea name="summary" rows="2" maxlength="240" required placeholder="What will your team find here?"></textarea></label><label>Document notes <span class="optional">optional</span><textarea name="content" rows="4" maxlength="4000" placeholder="Write the guidance here…"></textarea></label><label>External document link <span class="optional">optional</span><input name="referenceUrl" type="url" placeholder="https://…"></label><p class="microcopy">Uploaded files stay in this browser preview.</p>${errorOutput()}</div><div class="dialog-footer">${button('Cancel','close','','btn secondary')}<button class="btn primary" type="submit">Add document</button></div></form>`;
}
