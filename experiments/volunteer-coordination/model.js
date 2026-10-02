import { ensurePrograms, validateActivityPlan, occurrenceDates } from './program-model.js';
import { ensurePassport, requirementReady, today } from './passport-model.js';
import { createFeedState } from './feed-model.js';
import { isLiabilityWaiver } from './documents-model.js';
export const STORAGE_KEY = 'citysync-volunteer-studio-v1';
export const REQUIREMENTS = {
  welcome: { title: 'Read our welcome', detail: 'How we work, who to ask, and what to expect.', self: true },
  waiver: { title: 'Participation agreement', detail: 'Preview the preparation step. No real waiver is signed in this prototype.', self: true },
  food: { title: 'Food packing introduction', detail: 'Review safe packing and the first-shift guide.', self: true },
  driver: { title: 'Driving qualification', detail: 'A coordinator reviews your qualification before delivery assignments.', self: false },
};
export const id = () => globalThis.crypto.randomUUID();
const person = (id, name, role, color, requirements = {}, extra = {}) => ({ id, name, email: name.toLowerCase().replaceAll(' ', '.') + '@example.org', relationship: 'member', role, color, requirements: { welcome: true, waiver: true, food: true, driver: false, ...requirements }, availability: 'Saturday mornings', preference: 'A regular team and practical, hands-on work', ...extra });
export function createInitialState() {
  return ensurePrograms(ensurePassport({
    version: 1,
    feed: createFeedState(),
    people: [
      person('alex', 'Alex Chen', 'Packing & garden team', 'sage'),
      person('priya', 'Priya Patel', 'Delivery team', 'peach', { driver: true }),
      person('jamie', 'Jamie Rivera', 'Delivery team', 'lilac', { driver: true }, { availability: 'Weekends, 8am–1pm' }),
      person('sam', 'Sam Williams', 'Garden & packing team', 'sand'),
      person('elena', 'Elena Brooks', 'Interested in food packing', 'blue', { food: false }, { relationship: 'joining', reviewPending: true, availability: 'Tuesday afternoons' }),
      person('theo', 'Theo Martin', 'Packing team', 'peach'),
      person('morgan', 'Morgan Lee', 'Packing team', 'sage'),
      person('jules', 'Jules Okafor', 'Design & communications', 'lilac', {}, { availability: 'Remote · 2 hours a week' }),
      person('robin', 'Robin Ellis', 'Exploring ways to help', 'sand', { welcome: false, waiver: false, food: false }, { relationship: 'interested', availability: 'Sunday mornings' }),
    ],
    activities: [
      { id: 'pantry', title: 'Saturday food distribution', type: 'shift', program: 'Neighborhood food access', date: '2026-09-26', time: '9:00–11:00 AM', location: 'North Berkeley Community Center', description: 'Pack fresh produce and pantry essentials, then help deliver them to our neighbors. First-timers work alongside an experienced teammate.', visibility: 'members', enrollment: 'both', roles: [{ id: 'packing', name: 'Packing', capacity: 4, requires: ['welcome', 'waiver', 'food'] }, { id: 'delivery', name: 'Drivers', capacity: 2, requires: ['welcome', 'waiver', 'driver'] }], contact: 'Maya · Coordinator', bring: 'Comfortable shoes and a water bottle. Supplies are provided.', recurrence: 'Every Saturday', next: 'Check delivery addresses before loading the van.', owner: 'Priya Patel', progress: 'Packing station labels and delivery bags are ready.', color: 'sage' },
      { id: 'garden', title: 'A little care for the garden', type: 'event', program: 'Community green spaces', date: '2026-09-27', time: '10:00 AM–12:00 PM', location: 'Ohlone Community Garden', description: 'Spend a relaxed morning clearing beds and planting fall greens. No experience needed. Come once, or find your regular Sunday crew.', visibility: 'public', enrollment: 'both', roles: [{ id: 'garden', name: 'Garden team', capacity: 8, requires: ['welcome', 'waiver'] }], contact: 'Sam · Team lead', bring: 'Closed-toe shoes and sun protection. We have spare gloves.', recurrence: 'One-time event', next: 'Repair the irrigation connection at bed 4 before planting.', owner: 'Sam Williams', progress: 'Beds 1–3 are cleared. Compost is beside the tool shed.', color: 'sand' },
      { id: 'website', title: 'Make our volunteer welcome clearer', type: 'project', program: 'Volunteer experience', date: '2026-09-30', time: 'Flexible · about 2 hours', location: 'Remote', description: 'Create a one-page welcome guide that helps new volunteers feel prepared for their first visit. Share a draft for Maya to review.', visibility: 'members', enrollment: 'both', roles: [{ id: 'design', name: 'Welcome guide', capacity: 1, requires: ['welcome'] }], contact: 'Maya · Coordinator', bring: 'The current welcome notes are included in the project brief.', recurrence: 'Deliverable due Sep 30', next: 'Turn the outline into a first draft with arrival instructions.', owner: 'Jules Okafor', progress: 'Outline agreed. Include accessibility details and the day-of contact.', projectStatus: 'In progress', color: 'lilac' },
      { id: 'meals', title: 'Tuesday community kitchen', type: 'shift', program: 'Neighborhood food access', date: '2026-09-29', time: '3:00–5:00 PM', location: 'North Berkeley Community Center', description: 'Join a small, familiar team preparing a welcoming neighborhood meal.', visibility: 'members', enrollment: 'both', roles: [{ id: 'kitchen', name: 'Kitchen team', capacity: 4, requires: ['welcome', 'waiver', 'food'] }], contact: 'Maya · Coordinator', bring: 'Closed-toe shoes. Aprons are provided.', recurrence: 'Every Tuesday', next: 'Confirm the seasonal menu with the team.', owner: 'Sam Williams', progress: 'The pantry inventory is updated.', color: 'peach' },
    ],
    commitments: [
      { id: 'c1', personId: 'alex', activityId: 'pantry', roleId: 'packing', status: 'confirmed' },
      { id: 'c2', personId: 'priya', activityId: 'pantry', roleId: 'delivery', status: 'confirmed' },
      { id: 'c3', personId: 'jamie', activityId: 'pantry', roleId: 'delivery', status: 'proposed' },
      { id: 'c4', personId: 'sam', activityId: 'pantry', roleId: 'packing', status: 'confirmed' },
      { id: 'c5', personId: 'theo', activityId: 'pantry', roleId: 'packing', status: 'confirmed' },
      { id: 'c6', personId: 'morgan', activityId: 'pantry', roleId: 'packing', status: 'waitlisted' },
      { id: 'c7', personId: 'alex', activityId: 'garden', roleId: 'garden', status: 'proposed' },
      { id: 'c8', personId: 'sam', activityId: 'garden', roleId: 'garden', status: 'confirmed' },
      { id: 'c9', personId: 'jules', activityId: 'website', roleId: 'design', status: 'confirmed' },
    ],
    messages: [
      { id: 'm1', activityId: 'pantry', author: 'Maya', text: 'The new packing layout is ready. Priya will lead a quick walkthrough at 9. Thanks for being here!', time: 'Yesterday, 4:30 PM' },
      { id: 'm2', activityId: 'garden', author: 'Sam', text: 'Beds 1–3 are ready. The next crew can pick up with irrigation at bed 4; see the handoff above.', time: 'Yesterday, 2:15 PM' },
      { id: 'm3', activityId: 'website', author: 'Jules', text: 'I have the outline ready. I’ll include the bus stop and accessible entrance in the first draft.', time: 'Today, 9:10 AM' },
    ],
    notifications: [],
    activityLog: [{ text: 'Sam left a handoff for the garden team', time: 'Yesterday' }, { text: 'Elena completed her welcome and agreement', time: 'Yesterday' }],
  }));
}
export const missingRequirements = (person, role, state, date = today()) => role.requires.filter(key => state ? !requirementReady(state, person, key, date) : !person.requirements[key]);
export const confirmedCount = (state, activityId, roleId) => state.commitments.filter(c => c.activityId === activityId && (!roleId || c.roleId === roleId) && c.status === 'confirmed').length;
export const activeCommitment = (state, personId, activityId) => state.commitments.find(c => c.personId === personId && c.activityId === activityId && ['confirmed', 'proposed', 'waitlisted'].includes(c.status));
export function transition(current, action) {
  const state = ensurePrograms(structuredClone(current));
  let notice = 'Saved';
  const log = (text, activityId = '', actor = 'Berkeley Neighbors') => {
    state.activityLog.unshift({ text, time: 'Just now' });
    const activity = state.activities.find(item => item.id === activityId);
    if (activity?.programId) state.programWorkspace.history.unshift({ id: id(), programId: activity.programId, activityId, text, detail: '', actor, date: new Date().toISOString() });
  };
  const notify = (personId, text, activityId) => state.notifications.unshift({ id: id(), personId, text, activityId });
  const getPerson = key => { const p = state.people.find(p => p.id === key); if (!p) throw Error('Person not found.'); return p; };
  const getActivity = key => { const a = state.activities.find(a => a.id === key); if (!a) throw Error('Activity not found.'); return a; };
  if (action.type === 'addPerson') {
    const name = action.name.trim(); const email = action.email.trim().toLowerCase();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Add a name and valid email address.');
    if (state.people.some(p => p.email.toLowerCase() === email)) throw Error('This email is already in People. Open their existing record.');
    state.people.push({ id: id(), name, email, relationship: action.method === 'existing' ? 'member' : 'invited', role: action.role || 'Getting started', color: 'sage', requirements: { welcome: false, waiver: false, food: false, driver: false }, availability: 'Not shared yet', preference: '' });
    notice = action.method === 'existing' ? 'Existing member added. Preparation remains visible.' : 'Invitation created in this demo. No email was sent.';
    log(`${name} ${action.method === 'existing' ? 'was added as an existing member' : 'was invited to join'}`);
  } else if (action.type === 'requirement') {
    const p = getPerson(action.personId);
    const requirement = REQUIREMENTS[action.key] || Object.values(state.recruitment?.requirementLibrary || {}).flat().find(item => item.id === action.key);
    if (!requirement) throw Error('Unknown preparation step.');
    if ((requirement.owner === 'coordinator' || requirement.self === false) && action.actor !== 'coordinator') throw Error('A coordinator needs to review this step.');
    p.requirements[action.key] = true;
    notice = `${requirement.title} completed`;
    log(`${p.name} completed ${requirement.title.toLowerCase()}`);
  } else if (action.type === 'membership') {
    const p = getPerson(action.personId);
    if (!['joining', 'member', 'paused', 'former'].includes(action.relationship)) throw Error('Unknown membership state.');
    p.relationship = action.relationship;
    p.reviewPending = action.relationship === 'joining';
    notice = action.relationship === 'member' ? `${p.name} is now on the team. Readiness is tracked separately.` : 'Relationship updated. Existing commitments are preserved.';
    log(`${p.name}: ${action.relationship === 'member' ? 'joined the team' : action.relationship}`);
    notify(p.id, action.relationship === 'member' ? 'Welcome to the team! Your preparation checklist shows what is next.' : `Your organization relationship is now ${action.relationship}.`);
  } else if (action.type === 'preferences') {
    Object.assign(getPerson(action.personId), { availability: action.availability.trim(), preference: action.preference.trim() });
    notice = 'Preferences shared with your coordinator. No shifts were booked.';
  } else if (action.type === 'commit') {
    const a = getActivity(action.activityId); const p = getPerson(action.personId); const role = a.roles.find(r => r.id === action.roleId);
    if (!role) throw Error('Choose a role.');
    if (a.archived || a.workStatus === 'Complete') throw Error('This activity is closed to new commitments.');
    if (state.programWorkspace.programs.find(p=>p.id===a.programId)?.status === 'draft') throw Error('Activate the program before accepting commitments.');
    if (['paused', 'former', 'invited'].includes(p.relationship)) throw Error('This person must join or resume membership first.');
    if (a.visibility === 'members' && p.relationship !== 'member') throw Error('Join the organization before signing up for team activities.');
    if (action.actor !== 'coordinator' && a.enrollment === 'managed') throw Error('This activity uses coordinator invitations.');
    if (activeCommitment(state, p.id, a.id)) throw Error('There is already a commitment or invitation for this activity.');
    const missing = missingRequirements(p, role, state, a.date > today() ? a.date : today());
    if (missing.length && action.status === 'confirmed') throw Error('Complete the preparation checklist before confirming.');
    if (!['confirmed', 'proposed', 'waitlisted'].includes(action.status)) throw Error('Choose a valid commitment state.');
    if (action.status === 'confirmed' && confirmedCount(state, a.id, role.id) >= role.capacity) throw Error('This role is full. Join the waitlist instead.');
    state.commitments.push({ id: id(), personId: p.id, activityId: a.id, roleId: role.id, status: action.status });
    if (p.relationship === 'interested' && action.status !== 'proposed') p.relationship = 'event-only';
    notice = action.status === 'proposed' ? 'Invitation proposed. It will count as coverage after acceptance.' : action.status === 'waitlisted' ? 'Added to the waitlist. A place will require confirmation.' : 'Your place is confirmed';
    log(`${p.name}: ${action.status} · ${a.title}`, a.id, action.actor === 'coordinator' ? 'Maya Thompson' : p.name);
    if (action.status === 'proposed') notify(p.id, `You’re invited: ${a.title}. Please accept or decline.`, a.id);
  } else if (action.type === 'respond') {
    const c = state.commitments.find(c => c.id === action.commitmentId);
    if (!c || c.status !== 'proposed') throw Error('This invitation is no longer pending.');
    const a = getActivity(c.activityId); const p = getPerson(c.personId); const role = a.roles.find(r => r.id === c.roleId);
    if (action.accept) {
      if (a.archived || a.workStatus === 'Complete') throw Error('This activity is closed to new commitments.');
    if (state.programWorkspace.programs.find(p=>p.id===a.programId)?.status === 'draft') throw Error('Activate the program before accepting commitments.');
      if (['paused', 'former', 'invited'].includes(p.relationship) || (a.visibility === 'members' && p.relationship !== 'member')) throw Error('Join or resume membership before accepting.');
      if (missingRequirements(p, role, state, a.date > today() ? a.date : today()).length) throw Error('Finish the preparation steps before accepting.');
      if (confirmedCount(state, a.id, role.id) >= role.capacity) throw Error('This role has filled. Decline this invitation and join the waitlist.');
      c.status = 'confirmed'; notice = 'Accepted. Both calendars now show this commitment.';
    } else { c.status = 'declined'; notice = 'Invitation declined. Your coordinator can invite someone else.'; }
    log(`${p.name} ${action.accept ? 'accepted' : 'declined'} · ${a.title}`, a.id, p.name);
  } else if (action.type === 'cancel') {
    const c = state.commitments.find(c => c.id === action.commitmentId);
    if (!c || !['confirmed', 'proposed', 'waitlisted'].includes(c.status)) throw Error('This commitment is no longer active.');
    c.status = 'canceled'; c.cancellationNote = (action.note || '').trim();
    const p = getPerson(c.personId); const a = getActivity(c.activityId);
    notice = 'Cancellation recorded. Coverage and the coordinator’s action list are updated.';
    log(`${p.name} canceled · ${a.title}${c.cancellationNote ? ' · ' + c.cancellationNote : ''}`, a.id, p.name);
    notify('coordinator', `${p.name} can’t attend ${a.title}. Review coverage and invite a replacement.`, a.id);
  } else if (action.type === 'offerWaitlist') {
    const c = state.commitments.find(c => c.id === action.commitmentId);
    if (!c || c.status !== 'waitlisted') throw Error('This person is no longer waitlisted.');
    const a = getActivity(c.activityId); const role = a.roles.find(r => r.id === c.roleId);
    if (confirmedCount(state, a.id, role.id) >= role.capacity) throw Error('This role is still full.');
    c.status = 'proposed'; notify(c.personId, `A place opened in ${a.title}. Accept to confirm.`, a.id);
    notice = 'Place offered. It is pending until the volunteer accepts.';
    log(`${getPerson(c.personId).name} was offered a place · ${a.title}`, a.id, 'Maya Thompson');
  } else if (action.type === 'attendance') {
    const c = state.commitments.find(c => c.id === action.commitmentId);
    if (!c || c.status !== 'confirmed') throw Error('Only confirmed participants can be checked in.');
    c.attendance = action.attendance;
    notice = 'Attendance updated';
    const activity = getActivity(c.activityId);
    log(`${getPerson(c.personId).name}: attendance ${action.attendance} · ${activity.title}`, activity.id, 'Maya Thompson');
  } else if (action.type === 'message') {
    getActivity(action.activityId);
    if (!action.text.trim()) throw Error('Write a message first.');
    state.messages.push({ id: id(), activityId: action.activityId, author: action.author, text: action.text.trim(), time: 'Just now' });
    notice = 'Message added to the activity conversation';
  } else if (action.type === 'handoff') {
    const a = getActivity(action.activityId);
    a.progress = action.progress.trim(); a.next = action.next.trim(); a.owner = action.owner.trim();
    if (action.projectStatus && action.projectStatus !== a.projectStatus) throw Error('Use Program Activities to submit and review completion.');
    notice = 'Handoff saved for the next person'; log(`Handoff updated · ${a.title}`, a.id, 'Maya Thompson');
  } else if (action.type === 'updateProgramActivity') {
    const activity = getActivity(action.activityId);
    const program = state.programWorkspace.programs.find(program => program.id === activity.programId);
    if (action.actor !== 'coordinator' || !['event','shift'].includes(activity.type) || !program) throw Error('Only an organization coordinator can edit this program activity.');
    if (['complete','archived'].includes(program.status) || activity.workStatus === 'Complete') throw Error('Completed or archived program activities are read-only.');
    const title = action.title?.trim();
    const description = action.description?.trim();
    const assignmentMode = action.assignmentMode;
    const durations = ['30 minutes','45 minutes','1 hour','1.5 hours','2 hours','4 hours'];
    if (!title || !description || !action.time || !action.location?.trim()) throw Error('Add the activity title, description, date, time, duration, and location.');
    if (!['manual','roster','public'].includes(assignmentMode)) throw Error('Choose how volunteers are assigned.');
    if (!durations.includes(action.duration)) throw Error('Choose one of the available activity durations.');
    validateActivityPlan(state,{...action,workType:activity.type,programId:program.id,owner:activity.owner,reviewer:activity.reviewer,acceptance:activity.acceptance});
    const requirements = [...new Set(Array.isArray(action.requires) ? action.requires : [])];
    const publicOffering = assignmentMode === 'public';
    if (publicOffering) {
      const waiver = state.documentLibrary?.items?.find(document => document.id === action.waiverDocumentId && isLiabilityWaiver(document));
      if (!waiver) throw Error('Choose a liability waiver from Organizational Resources.');
      if (!requirements.includes('waiver')) throw Error('Liability waiver preparation is required for public activities.');
    }
    Object.assign(activity,{
      title,description,date:action.date,time:action.time,duration:action.duration,location:action.location.trim(),assignmentMode,
      visibility:publicOffering?'public':'members',enrollment:assignmentMode==='manual'?'managed':'self',
      waiverDocumentId:publicOffering?action.waiverDocumentId:'',
      recurrence:activity.type==='shift'?`Every ${Number(action.interval||7)===14?'two weeks':'week'} · program activity`:'One-Time Activity'
    });
    if (activity.roles[0]) activity.roles[0].requires = requirements;
    notice = 'Program activity updated.';
    log(`Activity updated · ${activity.title}`,activity.id,'Maya Thompson');
  } else if (action.type === 'createActivity') {
    const programActivity = Boolean(action.programActivity && action.programId);
    const coordinatedActivity = ['event','shift'].includes(action.workType) && Boolean(action.assignmentMode);
    const publicOffering = coordinatedActivity && action.assignmentMode === 'public';
    if (!action.title?.trim() || (coordinatedActivity ? !action.description?.trim() : !action.roleName?.trim())) throw Error(coordinatedActivity ? 'Give the activity a title and description.' : 'Give the activity and its role a name.');
    if (!coordinatedActivity && (!Number.isInteger(Number(action.capacity)) || Number(action.capacity) < 1)) throw Error('Capacity must be a positive whole number.');
    const requirements = [...new Set(Array.isArray(action.requires) ? action.requires : [])];
    if (publicOffering) {
      const waiver = state.documentLibrary?.items?.find(document => document.id === action.waiverDocumentId && isLiabilityWaiver(document));
      if (!waiver) throw Error('Choose a liability waiver from Organizational Resources.');
      if (!requirements.includes('waiver')) throw Error('Liability waiver preparation is required for public activities.');
    }
    const program = validateActivityPlan(state, action);
    const dates = action.workType === 'shift' && !coordinatedActivity ? occurrenceDates(action.date, action.occurrences || 1, action.interval || 7) : [action.date];
    if (program?.end && dates.some(date => date > program.end)) throw Error('All occurrences must fit within the program dates.');
    const seriesId = action.workType === 'shift' ? id() : '';
    for (const date of dates) state.activities.push({ id: id(), title: action.title.trim(), type: action.workType, program: program?.name || 'Organization activities', programId: program?.id || '', programActivity, date, time: action.time || 'Time to be agreed', duration: action.duration || '', location: action.location || 'Location to be agreed', description: action.description?.trim() || '', visibility: action.visibility, enrollment: action.enrollment, assignmentMode: action.assignmentMode || '', waiverDocumentId: action.waiverDocumentId || '', roles: [{ id: id(), name: (action.roleName || 'Volunteer team').trim(), capacity: Number(action.capacity || 10), requires: requirements }], contact: 'Maya · Coordinator', bring: 'Your coordinator will share any preparation details here.', recurrence: action.workType === 'shift' ? `Every ${Number(action.interval || 7) === 7 ? 'week' : 'two weeks'}${programActivity ? ' · program activity' : coordinatedActivity ? ' · standalone activity' : ` · ${dates.length} dated occurrences`}` : action.workType === 'project' ? 'Defined deliverable' : 'One-Time Activity', seriesId, next: action.next || 'Agree on the first step with the team.', owner: action.owner || '', progress: 'Ready to get started.', color: 'sage', workStatus: 'Not started', dependencies: action.dependencies || [], acceptance: action.acceptance || 'Activity delivered and handoff recorded.', reviewer: action.reviewer || program?.lead || 'Maya Thompson', milestone: action.milestone || 'Delivery', evidence: '', blocker: '' });
    if (program) state.programWorkspace.history.unshift({ id: id(), programId: program.id, activityId: state.activities.at(-1).id, text: `${action.title.trim()} ${dates.length > 1 ? `created with ${dates.length} dates` : 'activity created'}`, detail: '', actor: 'Maya Thompson', date: new Date().toISOString() });
    notice = dates.length > 1 ? `${dates.length} occurrences created. Volunteers choose each date separately.` : 'Activity created. Invite people or let eligible volunteers sign up.';
    log(`New activity · ${action.title.trim()}`);
  } else throw Error('Unknown action.');
  return { state: ensurePassport(state), notice };
}

export function parseCSV(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (ch === ',' && !quoted) { row.push(field.trim()); field = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(field.trim()); if (row.some(Boolean)) rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (quoted) throw Error('A quoted CSV field is not closed.');
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw Error('Include a header row and at least one person.');
  const header = rows.shift().map(h => h.toLowerCase().replace(/^\uFEFF/, ''));
  if (!header.includes('name') || !header.includes('email')) throw Error('The CSV needs name and email columns.');
  return rows.map(r => ({ name: r[header.indexOf('name')] || '', email: r[header.indexOf('email')] || '', role: header.includes('role') ? r[header.indexOf('role')] : '' }));
}
