export const DOCUMENT_CATEGORIES = ['Guides', 'Operations', 'Safety', 'Forms'];
export const MAX_WAIVER_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_DOCUMENT_FILE_SIZE = 10 * 1024 * 1024;

const clean = value => String(value ?? '').trim();
export const isLiabilityWaiver = document => document?.documentType === 'liability-waiver' || /waiver|liability|participation agreement/i.test(`${document?.title || ''} ${document?.category || ''} ${document?.summary || ''}`);

export function liabilityWaiversForActivity(state, programId = '', selectedId = '') {
  return (state.documentLibrary?.items || []).filter(document => {
    if (!isLiabilityWaiver(document)) return false;
    const programIds = Array.isArray(document.programIds) ? document.programIds : document.programId ? [document.programId] : [];
    return document.id === selectedId || document.allVolunteerActivities || programIds.length === 0 || Boolean(programId && programIds.includes(programId));
  });
}

function migrateProgramResources(state) {
  for (const program of state.programWorkspace?.programs || []) {
    for (const resource of program.resources || []) {
      if (state.documentLibrary.items.some(document => document.legacyResourceId === resource.id)) continue;
      const content = clean(resource.text);
      state.documentLibrary.items.push({
        id: `program-resource-${resource.id}`,
        title: clean(resource.title) || 'Program resource',
        category: 'Operations',
        documentType: '',
        summary: content.slice(0, 240) || `Resource for ${program.name}.`,
        content,
        programId: program.id,
        programIds: [program.id],
        allVolunteerActivities: false,
        referenceUrl: '',
        fileName: '',
        fileSize: 0,
        fileType: '',
        updatedAt: clean(resource.date).slice(0, 10) || new Date().toISOString().slice(0, 10),
        sample: false,
        legacyResourceId: resource.id,
      });
    }
  }
}

export function ensureDocuments(state) {
  if (state.documentLibrary) {
    state.documentLibrary.version = 2;
    if (state.allowSampleData === false) state.documentLibrary.items = state.documentLibrary.items.filter(document => !document.sample && !String(document.id || '').startsWith('sample-'));
    const sampleWaiver = state.documentLibrary.items.find(document => document.id === 'sample-liability-waiver');
    if (sampleWaiver) sampleWaiver.documentType = 'liability-waiver';
    if (state.allowSampleData !== false && !state.documentLibrary.items.some(document => document.id === 'sample-liability-waiver')) {
      state.documentLibrary.items.push({
        id: 'sample-liability-waiver', title: 'Volunteer liability waiver', category: 'Forms', documentType: 'liability-waiver',
        summary: 'Participation agreement required for public volunteer opportunities.',
        content: 'Please review the organization\'s participation agreement before confirming a place. The current version is maintained in Organizational Resources.',
        programId: '', referenceUrl: '', updatedAt: '2026-09-12', sample: true,
      });
    }
    for (const document of state.documentLibrary.items) {
      if (!Array.isArray(document.programIds)) document.programIds = document.programId ? [document.programId] : [];
      document.allVolunteerActivities = Boolean(document.allVolunteerActivities);
    }
    migrateProgramResources(state);
    return state;
  }
  if (state.allowSampleData === false) {
    state.documentLibrary = { version: 2, items: [] };
    return state;
  }
  const programId = name => state.programWorkspace?.programs.find(program => program.name === name)?.id || '';
  state.documentLibrary = {
    version: 2,
    items: [
      {
        id: 'sample-welcome-guide', title: 'Volunteer welcome guide', category: 'Guides',
        summary: 'A clear first-day introduction for new volunteers.',
        content: 'Where to arrive, who to ask for, what to bring, and how to get support during your first activity.',
        programId: programId('Volunteer experience'), referenceUrl: '', updatedAt: '2026-09-18', sample: true,
      },
      {
        id: 'sample-distribution-plan', title: 'Food distribution runbook', category: 'Operations',
        summary: 'The shared checklist for packing and distribution days.',
        content: 'Prepare the space, confirm supplies and roles, welcome the team, record any gaps, and leave a handoff for the next session.',
        programId: programId('Neighborhood food access'), referenceUrl: '', updatedAt: '2026-09-15', sample: true,
      },
      {
        id: 'sample-garden-safety', title: 'Community garden safety notes', category: 'Safety',
        summary: 'Practical guidance for garden volunteers and coordinators.',
        content: 'Check tools and irrigation before work begins. Share accessible routes, drinking water, and the contact for any safety concern.',
        programId: programId('Community green spaces'), referenceUrl: '', updatedAt: '2026-09-10', sample: true,
      },
      {
        id: 'sample-liability-waiver', title: 'Volunteer liability waiver', category: 'Forms', documentType: 'liability-waiver',
        summary: 'Participation agreement required for public volunteer opportunities.',
        content: 'Please review the organization\'s participation agreement before confirming a place. The current version is maintained in Organizational Resources.',
        programId: '', referenceUrl: '', updatedAt: '2026-09-12', sample: true,
      },
    ],
  };
  for (const document of state.documentLibrary.items) {
    document.programIds = document.programId ? [document.programId] : [];
    document.allVolunteerActivities = false;
  }
  migrateProgramResources(state);
  return state;
}

function normalizedDocument(state, values, existing = null) {
  const title = clean(values.title);
  const summary = clean(values.summary);
  const content = clean(values.content);
  const referenceUrl = clean(values.referenceUrl);
  const documentType = existing?.documentType || clean(values.documentType);
  if (documentType && documentType !== 'liability-waiver') throw Error('Choose a supported document type.');
  const category = documentType === 'liability-waiver' ? 'Forms' : clean(values.category);
  const programId = documentType === 'liability-waiver' ? '' : clean(values.programId);
  const fileName = clean(values.fileName ?? existing?.fileName);
  const fileSize = Number(values.fileSize ?? existing?.fileSize ?? 0);
  const fileType = clean(values.fileType ?? existing?.fileType);
  if (!title || title.length > 100) throw Error('Give the document a title of up to 100 characters.');
  if (!DOCUMENT_CATEGORIES.includes(category)) throw Error('Choose a document category.');
  if (!summary || summary.length > 240) throw Error('Add a short description of up to 240 characters.');
  if (documentType === 'liability-waiver' && (!existing || fileName) && (!/\.(pdf|doc|docx)$/i.test(fileName) || !Number.isInteger(fileSize) || fileSize < 1 || fileSize > MAX_WAIVER_FILE_SIZE)) throw Error('Upload a PDF, DOC, or DOCX waiver under 10 MB.');
  if (documentType !== 'liability-waiver' && fileName && (!/\.(pdf|doc|docx|txt|md|csv)$/i.test(fileName) || !Number.isInteger(fileSize) || fileSize < 1 || fileSize > MAX_DOCUMENT_FILE_SIZE)) throw Error('Upload a PDF, DOC, DOCX, TXT, MD, or CSV file under 10 MB.');
  if (documentType !== 'liability-waiver' && !content && !referenceUrl && !fileName) throw Error('Upload a file, add document notes, or include a reference link.');
  if (content.length > 4000) throw Error('Keep document notes under 4,000 characters.');
  if (programId && !state.programWorkspace?.programs.some(program => program.id === programId)) throw Error('Choose an existing program.');
  if (referenceUrl) {
    let url;
    try { url = new URL(referenceUrl); } catch { throw Error('Enter a complete web link starting with https://.'); }
    if (!['https:', 'http:'].includes(url.protocol)) throw Error('Use an HTTP or HTTPS reference link.');
  }
  return { title, category, documentType, summary, content, programId, referenceUrl, fileName, fileSize, fileType };
}

export function saveDocument(current, values) {
  const state = ensureDocuments(structuredClone(current));
  const document = normalizedDocument(state, values);
  state.documentLibrary.items.unshift({
    id: globalThis.crypto.randomUUID(), ...document,
    programIds: document.programId ? [document.programId] : [], allVolunteerActivities: false,
    updatedAt: new Date().toISOString().slice(0, 10), sample: false,
  });
  return { state, id: state.documentLibrary.items[0].id, notice: document.documentType === 'liability-waiver' ? 'Liability waiver uploaded to this browser preview.' : document.programId ? 'Program resource added to Documents & Resources.' : 'Document added to this browser preview.' };
}

export function updateDocument(current, id, values) {
  const state = ensureDocuments(structuredClone(current));
  const existing = state.documentLibrary.items.find(document => document.id === id);
  if (!existing) throw Error('Document not found.');
  const document = normalizedDocument(state, values, existing);
  Object.assign(existing, document, { updatedAt: new Date().toISOString().slice(0, 10), sample: false });
  if (!isLiabilityWaiver(existing)) existing.programIds = existing.programId ? [existing.programId] : [];
  return { state, id, notice: 'Document changes saved.' };
}

export function assignDocument(current, id, assignment = {}) {
  const state = ensureDocuments(structuredClone(current));
  const document = state.documentLibrary.items.find(item => item.id === id);
  if (!document) throw Error('Document not found.');
  const programs = state.programWorkspace?.programs || [];
  const waiver = isLiabilityWaiver(document);
  let assignedActivities = 0;
  if (waiver) {
    const allVolunteerActivities = Boolean(assignment.allVolunteerActivities);
    const programIds = [...new Set(assignment.programIds || [])].filter(Boolean);
    if (!allVolunteerActivities && programIds.some(programId => !programs.some(program => program.id === programId))) throw Error('Choose existing programs for this waiver.');
    document.programId = '';
    document.programIds = allVolunteerActivities ? [] : programIds;
    document.allVolunteerActivities = allVolunteerActivities;
    for (const activity of state.activities || []) {
      if (activity.archived || !['event', 'shift'].includes(activity.type)) continue;
      const inScope = allVolunteerActivities || programIds.includes(activity.programId);
      if (inScope) {
        activity.waiverDocumentId = document.id;
        assignedActivities += 1;
      } else if (activity.waiverDocumentId === document.id) activity.waiverDocumentId = '';
    }
  } else {
    const programId = clean(assignment.programId);
    if (programId && !programs.some(program => program.id === programId)) throw Error('Choose an existing program.');
    document.programId = programId;
    document.programIds = programId ? [programId] : [];
    document.allVolunteerActivities = false;
  }
  document.updatedAt = new Date().toISOString().slice(0, 10);
  document.sample = false;
  const assignedPrograms = waiver ? document.programIds.length : document.programId ? 1 : 0;
  return {
    state,
    id,
    notice: document.allVolunteerActivities
      ? `${document.title} assigned to all ${assignedActivities} volunteer ${assignedActivities === 1 ? 'activity' : 'activities'}.`
      : assignedPrograms
        ? `${document.title} assigned to ${assignedPrograms} ${assignedPrograms === 1 ? 'program' : 'programs'}.`
        : `${document.title} is no longer assigned to a program.`,
  };
}

export function deleteDocument(current, id) {
  const state = ensureDocuments(structuredClone(current));
  const index = state.documentLibrary.items.findIndex(document => document.id === id);
  if (index < 0) throw Error('Document not found.');
  const [document] = state.documentLibrary.items.splice(index, 1);
  if (document.legacyResourceId && document.programId) {
    const program = state.programWorkspace?.programs.find(item => item.id === document.programId);
    if (program) program.resources = (program.resources || []).filter(resource => resource.id !== document.legacyResourceId);
  }
  let clearedWaivers = 0;
  for (const activity of state.activities || []) {
    if (activity.waiverDocumentId !== id) continue;
    activity.waiverDocumentId = '';
    clearedWaivers += 1;
  }
  return {
    state,
    id,
    notice: clearedWaivers
      ? `${document.title} deleted. ${clearedWaivers} public ${clearedWaivers === 1 ? 'activity needs' : 'activities need'} a new liability waiver.`
      : `${document.title} deleted.`,
  };
}
