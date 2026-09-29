// Program coordination is local to Berkeley Neighbors in this exploration.
const uid = () => globalThis.crypto.randomUUID();
export const ACTIVITY_TYPES = { event: 'One-Time Activity', shift: 'Recurring Activity', project: 'Program Task' };
export const WORK_STATES = ['Not started', 'In progress', 'Ready for review', 'Complete'];
const clean = value => String(value ?? '').trim();
const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d+'T12:00:00Z').toISOString().slice(0,10) === d;
const SAMPLE_WORKSPACE_MEMBERS = [
  { id: 'issuer-maya', name: 'Maya Thompson', role: 'Organization administrator', workspaceAccess: true, active: true },
  { id: 'issuer-avery', name: 'Avery Morgan', role: 'Organization member', workspaceAccess: true, active: true },
  { id: 'issuer-riley', name: 'Riley Chen', role: 'Organization member', workspaceAccess: true, active: true },
];
export const workspaceProgramLeads = state => (state.programWorkspace?.organizationMembers || []).filter(member => member.active && member.workspaceAccess);
export function ensurePrograms(state) {
  if (!state.programWorkspace) {
    state.programWorkspace = { version: 1, programs: [], history: [] };
    const briefs = {
      'Neighborhood food access': ['Make fresh food available to 120 neighborhood households during the fall pilot.', 'Weekly packing, distribution, and a Tuesday community kitchen in North Berkeley.', 'Long-term case management and deliveries outside Berkeley.', '120 households served; record weekly totals and unmet requests.', 'Maya Thompson'],
      'Community green spaces': ['Prepare four community garden beds for fall planting.', 'Repair irrigation, prepare beds, and plant accessible shared growing spaces.', 'Major construction or expansion beyond the current garden.', 'Four beds planted, with working irrigation and a care handoff.', 'Sam Williams'],
      'Volunteer experience': ['Help new volunteers arrive informed and confident.', 'Produce and test a one-page welcome guide for Berkeley Neighbors.', 'A website rebuild or a new recruitment campaign.', 'Guide reviewed for accessibility and tested with two newcomers.', 'Maya Thompson'],
    };
    for (const a of state.activities) {
      if (['ongoing','standby'].includes(a.type)) {
        a.retiredType = a.type; a.archived = true;
        continue; // Preserve historical relationships without turning a pool into a booking.
      }
      const name = a.program || 'Community volunteering';
      let p = state.programWorkspace.programs.find(p => p.name === name);
      if (!p) {
        const b = briefs[name];
        p = { id: uid(), name, purpose: b?.[0] || '', scope: b?.[1] || '', excluded: b?.[2] || '', success: b?.[3] || '', lead: b?.[4] || '', start: '2026-09-01', end: '2026-10-31', status: b ? 'active' : 'draft', resources: [], updates: [] };
        state.programWorkspace.programs.push(p);
      }
      a.programId = p.id; a.workStatus = a.projectStatus || 'Not started'; a.dependencies = []; a.milestone = 'Delivery'; a.acceptance = a.type === 'project' ? 'A usable one-page guide reviewed by Maya, including arrival and accessibility information.' : 'Session delivered and the next team has a clear handoff.'; a.reviewer = p.lead; a.evidence = ''; a.blocker = '';
    }
    const garden = state.activities.find(a => a.id === 'garden');
    if (garden) {
      const setup = { ...structuredClone(garden), id: 'garden-irrigation', title: 'Repair and test bed 4 irrigation', type: 'project', date: '2026-09-25', time: 'About 90 minutes', visibility: 'members', description: 'Replace the connector and test water flow before the planting morning.', roles: [{ id: 'repair', name: 'Irrigation repair', capacity: 2, requires: ['welcome','waiver'] }], recurrence: 'Defined deliverable', owner: 'Sam Williams', milestone: 'Prepare the site', acceptance: 'All four beds receive water; record a leak test and leave a usable handoff.', progress: 'Replacement connector is in the shed.', next: 'Fit the connector and run a ten-minute leak test.', workStatus: 'Not started', dependencies: [], evidence: '' };
      state.activities.push(setup); garden.dependencies = [setup.id]; garden.milestone = 'Plant & hand over';
    }
  }
  // Issuer workspace accounts are separate from the volunteer roster.
  if (!Array.isArray(state.programWorkspace.organizationMembers)) state.programWorkspace.organizationMembers = structuredClone(SAMPLE_WORKSPACE_MEMBERS);
  for (const position of state.recruitment?.positions || []) {
    if (position.id === 'delivery-team' && position.activityId === 'standby') position.activityId = 'pantry';
    if (['food-team','delivery-team','try-garden'].includes(position.id) && !position.programId && position.activityId) position.programId = state.activities.find(activity => activity.id === position.activityId)?.programId || '';
  }
  return state;
}
export const programActivities = (state, programId) => state.activities.filter(a => !a.archived && a.programId === programId);
export const dependenciesOf = (state, a) => (a.dependencies || []).map(id => state.activities.find(t => t.id === id)).filter(Boolean);
export const blockersFor = (state, a) => [a.blocker, ...dependenciesOf(state, a).filter(t => t.workStatus !== 'Complete').map(t => `Waiting for: ${t.title}`)].filter(Boolean);
export function programHealth(state, p, date = new Date().toISOString().slice(0,10)) {
  const work = programActivities(state, p.id);
  return { total: work.length, complete: work.filter(a => a.workStatus === 'Complete').length, blocked: work.filter(a => a.workStatus !== 'Complete' && blockersFor(state,a).length), review: work.filter(a => a.workStatus === 'Ready for review'), overdue: work.filter(a => a.date && a.date < date && a.workStatus !== 'Complete'), unowned: work.filter(a => !clean(a.owner) && a.workStatus !== 'Complete') };
}
export function validateDependencies(state, activityId, programId, deps) {
  for (const dep of deps) {
    const a = state.activities.find(a => a.id === dep && !a.archived);
    if (!a || a.programId !== programId) throw Error('Dependencies must belong to this program.');
    const visit = (id, seen = new Set()) => {
      if (id === activityId) throw Error('This dependency would create a circular work plan.');
      if (seen.has(id)) return;
      seen.add(id);
      for (const next of state.activities.find(a => a.id === id)?.dependencies || []) visit(next, seen);
    };
    visit(dep);
  }
}
export function validateActivityPlan(state, action) {
  if (!ACTIVITY_TYPES[action.workType]) throw Error('Choose One-Time Activity, Recurring Activity, or Program Task.');
  const p = state.programWorkspace?.programs.find(p => p.id === action.programId);
  if (action.programId && !p) throw Error('Choose an existing program.');
  if (action.workType === 'project' && !p) throw Error('A Program Task must belong to a program.');
  if (p?.status === 'complete') throw Error('This program is complete. Create work in an active or draft program.');
  if (!validDate(action.date)) throw Error('Choose a valid activity date or due date.');
  if (p && ((p.start && action.date < p.start) || (p.end && action.date > p.end))) throw Error('The activity date must fall within the program dates.');
  if (action.workType === 'project' && (!clean(action.acceptance) || !clean(action.reviewer))) throw Error('Define the deliverable acceptance criteria and reviewer.');
  validateDependencies(state, '', action.programId, action.dependencies || []);
  return p;
}
export function occurrenceDates(first, count, interval) {
  count = Number(count); interval = Number(interval);
  if (!validDate(first) || !Number.isInteger(count) || count < 1 || count > 12 || ![7,14].includes(interval)) throw Error('Choose 1–12 occurrences, weekly or every two weeks.');
  return Array.from({ length: count }, (_, i) => { const d = new Date(first+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+i*interval); return d.toISOString().slice(0,10); });
}
export function transitionProgram(current, action) {
  const state = ensurePrograms(structuredClone(current));
  const ws = state.programWorkspace;
  const coordinator = action.actor === 'coordinator';
  const requireCoordinator = () => { if (!coordinator) throw Error('Only the organization coordinator can change this plan.'); };
  let p = ws.programs.find(p => p.id === action.programId);
  let resultId = p?.id;
  let note = 'Program updated';
  if (action.type === 'saveProgram') {
    requireCoordinator();
    if (action.programId && !p) throw Error('Program not found.');
    const name = clean(action.name), purpose = clean(action.purpose);
    if (!name || !purpose) throw Error('Add a program name and its purpose and goals.');
    if (name.length > 100 || purpose.length > 1500) throw Error('Keep the program name and purpose within the field limits.');
    if (ws.programs.some(other => other.id !== p?.id && other.name.toLowerCase() === name.toLowerCase())) throw Error('A program already uses this name.');
    if (p?.status === 'complete') throw Error('Completed program briefs are retained as a record.');
    if (p) {
      const lead = workspaceProgramLeads(state).find(member => member.id === action.leadMemberId);
      if (!lead) throw Error('Choose an organization member with workspace access as the program lead.');
      Object.assign(p, { name, purpose, lead: lead.name, leadMemberId: lead.id });
    } else {
      const lead = workspaceProgramLeads(state).find(member => member.id === action.leadMemberId);
      if (!lead) throw Error('Choose an organization member with workspace access as the program lead.');
      p = { id: uid(), name, purpose, scope: '', excluded: '', success: '', lead: lead.name, leadMemberId: lead.id, start: '', end: '', status: 'draft', resources: [], updates: [] };
      ws.programs.push(p);
    }
    resultId = p.id;
    for (const a of programActivities(state,p.id)) a.program = p.name;
    note = 'Program details saved';
  } else {
    if (!p) throw Error('Program not found.');
    const work = programActivities(state,p.id);
    if (action.type === 'programStatus') {
      requireCoordinator();
      if (!['active','complete','archived'].includes(action.status) || p.status === 'complete' || p.status === 'archived') throw Error('Choose a valid program transition.');
      if (action.status === 'archived') {
        p.status = 'archived'; p.archivedAt = new Date().toISOString(); p.outcomeReview = clean(action.note) || 'Program archived';
        note = 'Program archived';
      } else {
        if (action.status === 'active' && (!clean(p.purpose) || !clean(p.lead))) throw Error('Add a purpose and program lead before activation.');
        if (action.status === 'complete' && (p.status !== 'active' || !work.length || work.some(a => a.workStatus !== 'Complete') || !clean(action.note))) throw Error('Complete the work and record an outcome review before closing this program.');
        p.status = action.status; p.outcomeReview = clean(action.note); note = `Program ${p.status === 'active' ? 'activated' : 'completed with an outcome review'}`;
      }
    } else if (action.type === 'resource' || action.type === 'update') {
      requireCoordinator();
      if (p.status === 'complete') throw Error('This program is complete.');
      if (action.type === 'resource') {
        if (!clean(action.title) || !clean(action.text)) throw Error('Give the resource a title and useful instructions or a link.');
        p.resources.push({ id: uid(), title: clean(action.title), text: clean(action.text), date: new Date().toISOString() }); note = 'Resource added to the program';
      } else {
        if (!clean(action.text)) throw Error('Record the decision, progress, or help needed.');
        p.updates.unshift({ id: uid(), kind: ['Decision','Progress','Risk'].includes(action.kind) ? action.kind : 'Progress', text: clean(action.text), date: new Date().toISOString(), author: 'Maya Thompson' }); note = 'Program update recorded';
      }
    } else {
      const a = work.find(a => a.id === action.activityId);
      if (!a) throw Error('Activity not found in this program.');
      if (action.type === 'plan') {
        requireCoordinator();
        if (p.status === 'complete' || ['Complete','Ready for review'].includes(a.workStatus)) throw Error('Return this work to progress before changing its plan.');
        const deps = [...new Set(action.dependencies || [])];
        validateDependencies(state,a.id,p.id,deps);
        if (a.workStatus !== 'Not started' && deps.some(id => state.activities.find(t => t.id === id).workStatus !== 'Complete')) throw Error('Started work cannot gain unfinished prerequisites.');
        if (!clean(action.owner) || !clean(action.acceptance) || !clean(action.reviewer) || !validDate(action.date)) throw Error('Set an owner, due date, acceptance criteria, and reviewer.');
        if ((p.start && action.date < p.start) || (p.end && action.date > p.end)) throw Error('The activity date must fall within the program dates.');
        Object.assign(a, { owner: clean(action.owner), milestone: clean(action.milestone) || 'Delivery', acceptance: clean(action.acceptance), reviewer: clean(action.reviewer), date: action.date, dependencies: deps, blocker: clean(action.blocker), next: clean(action.next) });
        note = 'Activity plan updated; no volunteer was booked';
      } else if (action.type === 'workStatus') {
        const participant = state.commitments.some(c => c.activityId === a.id && c.personId === action.actor && c.status === 'confirmed');
        if (!coordinator && !participant) throw Error('Only a confirmed contributor can update this work.');
        if (p.status !== 'active') throw Error('Activate the program before starting work.');
        const from = a.workStatus;
        const to = action.status;
        const allowed = { 'Not started': ['In progress'], 'In progress': ['Ready for review'], 'Ready for review': ['In progress','Complete'], 'Complete': ['In progress'] };
        if (!allowed[from]?.includes(to)) throw Error('Follow the work sequence: start, submit, then review.');
        if (['Ready for review','Complete'].includes(from)) requireCoordinator();
        if (from === 'Complete' && work.some(t => (t.dependencies || []).includes(a.id) && t.workStatus !== 'Not started')) throw Error('Downstream work has already started. Resolve it before reopening this prerequisite.');
        if (blockersFor(state,a).length) throw Error('Resolve the blockers and complete prerequisites before moving work forward.');
        if (!clean(a.owner) || !clean(a.acceptance) || !clean(a.reviewer)) throw Error('Set the owner, acceptance criteria, and reviewer first.');
        if (to === 'Ready for review' && !clean(action.note)) throw Error('Describe the result and the evidence for review.');
        if ((to === 'Complete' || from === 'Ready for review' || from === 'Complete') && !clean(action.note)) throw Error('Record the review decision or reason for reopening.');
        a.workStatus = to;
        if (a.type === 'project') a.projectStatus = to;
        if (to !== 'Complete') delete a.review;
        if (to === 'Ready for review') a.evidence = clean(action.note);
        if (to === 'Complete') a.review = { note: clean(action.note), actor: 'Maya Thompson', onBehalfOf: a.reviewer, date: new Date().toISOString() };
        note = `${a.title}: ${to}`;
      } else throw Error('Unknown program action.');
    }
  }
  ws.history.unshift({ id: uid(), programId: p.id, activityId: action.activityId || '', text: note, detail: clean(action.note), actor: coordinator ? 'Maya Thompson' : state.people.find(p => p.id === action.actor)?.name || action.actor, date: new Date().toISOString() });
  return { state, id: resultId, notice: note };
}

export const availableActivity = (state, a) => !!a && !a.archived && state.programWorkspace?.programs.find(p=>p.id===a.programId)?.status !== 'draft';
