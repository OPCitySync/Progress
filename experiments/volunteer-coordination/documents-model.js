export const DOCUMENT_CATEGORIES = ['Guides', 'Operations', 'Safety', 'Forms'];
export const MAX_WAIVER_FILE_SIZE = 10 * 1024 * 1024;

const clean = value => String(value ?? '').trim();
export const isLiabilityWaiver = document => document?.documentType === 'liability-waiver' || /waiver|liability|participation agreement/i.test(`${document?.title || ''} ${document?.category || ''} ${document?.summary || ''}`);

export function ensureDocuments(state) {
  if (state.documentLibrary) {
    const sampleWaiver = state.documentLibrary.items.find(document => document.id === 'sample-liability-waiver');
    if (sampleWaiver) sampleWaiver.documentType = 'liability-waiver';
    if (!state.documentLibrary.items.some(document => document.id === 'sample-liability-waiver')) {
      state.documentLibrary.items.push({
        id: 'sample-liability-waiver', title: 'Volunteer liability waiver', category: 'Forms', documentType: 'liability-waiver',
        summary: 'Participation agreement required for public volunteer opportunities.',
        content: 'Please review the organization\'s participation agreement before confirming a place. The current version is maintained in Organizational Resources.',
        programId: '', referenceUrl: '', updatedAt: '2026-09-12', sample: true,
      });
    }
    return state;
  }
  const programId = name => state.programWorkspace?.programs.find(program => program.name === name)?.id || '';
  state.documentLibrary = {
    version: 1,
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
  return state;
}

export function saveDocument(current, values) {
  const state = ensureDocuments(structuredClone(current));
  const title = clean(values.title);
  const summary = clean(values.summary);
  const content = clean(values.content);
  const referenceUrl = clean(values.referenceUrl);
  const documentType = clean(values.documentType);
  if (documentType && documentType !== 'liability-waiver') throw Error('Choose a supported document type.');
  const category = documentType === 'liability-waiver' ? 'Forms' : clean(values.category);
  const programId = documentType === 'liability-waiver' ? '' : clean(values.programId);
  const fileName = clean(values.fileName);
  const fileSize = Number(values.fileSize);
  const fileType = clean(values.fileType);
  if (!title || title.length > 100) throw Error('Give the document a title of up to 100 characters.');
  if (!DOCUMENT_CATEGORIES.includes(category)) throw Error('Choose a document category.');
  if (!summary || summary.length > 240) throw Error('Add a short description of up to 240 characters.');
  if (documentType === 'liability-waiver' && (!/\.(pdf|doc|docx)$/i.test(fileName) || !Number.isInteger(fileSize) || fileSize < 1 || fileSize > MAX_WAIVER_FILE_SIZE)) throw Error('Upload a PDF, DOC, or DOCX waiver under 10 MB.');
  if (documentType !== 'liability-waiver' && !content && !referenceUrl) throw Error('Add document notes or a reference link.');
  if (content.length > 4000) throw Error('Keep document notes under 4,000 characters.');
  if (programId && !state.programWorkspace?.programs.some(program => program.id === programId)) throw Error('Choose an existing program.');
  if (referenceUrl) {
    let url;
    try { url = new URL(referenceUrl); } catch { throw Error('Enter a complete web link starting with https://.'); }
    if (!['https:', 'http:'].includes(url.protocol)) throw Error('Use an HTTP or HTTPS reference link.');
  }
  state.documentLibrary.items.unshift({
    id: globalThis.crypto.randomUUID(), title, category, documentType, summary, content, programId,
    referenceUrl, fileName, fileSize: documentType === 'liability-waiver' ? fileSize : 0, fileType,
    updatedAt: new Date().toISOString().slice(0, 10), sample: false,
  });
  return { state, id: state.documentLibrary.items[0].id, notice: documentType === 'liability-waiver' ? 'Liability waiver uploaded to this browser preview.' : 'Document reference added to this browser preview.' };
}
