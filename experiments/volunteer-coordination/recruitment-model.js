import { recordPrivateScreeningCredential, requirementReady, today } from './passport-model.js';

export const HOME_ORG = 'berkeley-neighbors';
export const APPLICATION_LABELS = { draft: 'Draft', submitted: 'Submitted', reviewing: 'In review', 'needs-info': 'Your reply needed', waitlisted: 'Waitlisted', offered: 'Offer to consider', onboarding: 'Getting ready', active: 'On the team', declined: 'Not this time', withdrawn: 'Withdrawn', 'offer-declined': 'Offer declined' };
export const TERMINAL = ['declined', 'withdrawn', 'offer-declined'];
const uid = () => crypto.randomUUID();
const assert = (condition, message) => { if (!condition) throw Error(message); };
const clean = (value, max = 1200) => String(value || '').trim().slice(0, max);
const dateValid = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
export const addDays = (date, days) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0,10); };
export const REQUIREMENT_COMPLETION_TYPES = ['read','sign','provide','organization','screening'];
export const SCREENING_PROVIDERS = {
  checkr: 'Checkr', sterling: 'Sterling Volunteers', 'ca-live-scan': 'California DOJ/FBI Live Scan', external: 'Other provider',
};
export const SCREENING_START_METHODS = ['organization-invite','volunteer-link','live-scan'];
const BASE_VOLUNTEER_REQUIREMENTS = [
  { id: 'welcome', title: 'Read our Welcome', detail: 'Review how the organization works, who to contact, where to arrive, and how to ask for help.', owner: 'volunteer', completionType: 'welcome', documentId: '' },
  { id: 'waiver', title: 'Participation Agreement', detail: 'Review the expectations, support, expenses, and how either side can raise a concern.', owner: 'volunteer', completionType: 'sign', documentId: 'sample-liability-waiver' },
  { id: 'role-introduction', title: 'Role Introduction', detail: 'Meet with the organization to review the role, its boundaries, and the support available.', owner: 'coordinator', completionType: 'organization', documentId: '' },
  { id: 'liability-waiver', title: 'Liability Waiver', detail: 'Review and acknowledge the current waiver attached to this volunteer role.', owner: 'volunteer', completionType: 'sign', documentId: 'sample-liability-waiver' },
  { id: 'food', title: 'Food Packing Introduction', detail: 'Review hygiene, safe packing, and allergen handling with the team.', owner: 'volunteer', completionType: 'read', documentId: 'sample-distribution-plan' },
  { id: 'driver', title: 'Driving Qualification Review', detail: 'The organization reviews the role-specific driving qualification before assigning delivery work.', owner: 'coordinator', completionType: 'organization', documentId: '' },
];
export const volunteerRequirements = (state, orgId = HOME_ORG) => state.recruitment?.requirementLibrary?.[orgId] || [];
export const volunteerRequirement = (state, orgId, requirementId) => volunteerRequirements(state, orgId).find(requirement => requirement.id === requirementId);
const validHttpUrl = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
const screeningExpiry = (date, months) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + Number(months || 12)); return d.toISOString().slice(0,10); };

export function ensureRecruitment(state) {
  if (!state.recruitment && state.allowSampleData === false) state.recruitment = {
    version: 1, organizations: [], positions: [], applications: [], memberships: [], preparation: {}, saved: {}, invitations: [], requirementLibrary: {}
  };
  if (!state.recruitment) state.recruitment = {
    version: 1,
    organizations: [
      { id: HOME_ORG, name: 'Berkeley Neighbors', cause: 'Food & community', color: 'sage', initial: 'BN', location: 'North Berkeley', mission: 'Make everyday essentials and neighborhood connection available to everyone.', description: 'A familiar team, a shared meal, a bag of groceries at the door. We bring neighbors together through food access and community spaces.', contact: 'Maya Thompson', email: 'maya@berkeley-neighbors.example', support: 'Step-free community center, seated packing options, a first-shift buddy, and agreed local travel expenses.', welcome: 'Meet Maya at the community center entrance. We will show you the supplies, introduce your buddy, explain breaks and expenses, and walk through how to ask for help or raise a concern.' },
      { id: 'tool-library', name: 'Berkeley Tool Library', cause: 'Repair & reuse', color: 'sand', initial: 'TL', location: 'West Berkeley', mission: 'Help neighbors borrow, repair and share the things they need.', description: 'Keep useful things in circulation. Our sample team welcomes people who like listening, organizing, fixing and learning alongside others.', contact: 'Jordan Park', email: 'jordan@tool-library.example', support: 'No tools or repair experience needed for the welcome desk. Seated tasks, supervised learning and flexible buddy shifts are available.', welcome: 'Jordan will meet you at the library desk. Learn the borrowing process, meet your buddy, find the accessible work area and discuss breaks, expenses and concerns. Tool use needs a separate supervised introduction.' },
      { id: 'creek-friends', name: 'Friends of Strawberry Creek', cause: 'Nature & outdoors', color: 'blue', initial: 'SC', location: 'Berkeley · outdoors & remote', mission: 'Care for the creek and help more neighbors feel connected to local nature.', description: 'Some of us care for the path; others tell its story. There are practical and remote ways to help, with clear handoffs between volunteers.', contact: 'Leah Nguyen', email: 'leah@creek-friends.example', support: 'Remote roles, flexible hours, and a named contact. Outdoor terrain varies; talk with us about a route or task that works for you.', welcome: 'Meet Leah online for remote work, or agree an accessible meeting point for outdoor work. We will share the project notes, introduce your buddy, explain expenses and how to raise concerns.' }
    ],
    positions: [
      { id: 'food-team', orgId: HOME_ORG, title: 'Community food team volunteer', impact: 'Help neighbors access fresh food and a welcoming weekly meal.', tasks: 'Pack produce, prepare the welcome table and work alongside the kitchen or distribution team.', commitment: 'One 2-hour shift every week or fortnight; choose each date separately.', mode: 'In person', pathway: 'application', experience: 'No previous experience required. Food packing training is provided or reviewed through your passport.', support: 'A first-shift buddy, seated tasks and a named coordinator.', requirements: ['welcome','waiver','food'], check: '', question: 'What kind of food-team work would you enjoy trying?', capacity: 4, responseDays: 5, deadline: '', status: 'open', activityId: 'meals', version: 1 },
      { id: 'delivery-team', orgId: HOME_ORG, title: 'Neighborhood delivery volunteer', impact: 'Bring groceries to neighbors who cannot get to the distribution point.', tasks: 'Agree a route, collect prepared bags and make deliveries with the team.', commitment: 'Weekend mornings, usually 2 hours. Accept only routes that fit.', mode: 'In person', pathway: 'conversation', experience: 'Comfort with local routes. The coordinator reviews driving qualification before any delivery.', support: 'Route briefing, a coordinator on call, and an agreed expenses process.', requirements: ['welcome','waiver','driver'], check: '', question: 'What would you like to discuss before deciding about delivery volunteering?', capacity: 2, responseDays: 5, deadline: '', status: 'open', activityId: 'pantry', version: 1 },
      { id: 'try-garden', orgId: HOME_ORG, title: 'Try a morning in the garden', impact: 'Make room for the next season of community growing.', tasks: 'Join a relaxed morning of planting and tending beds.', commitment: 'One morning. No ongoing membership required.', mode: 'In person', pathway: 'event', experience: 'No experience required. Choose a task that works for you.', support: 'Spare gloves and a friendly team lead.', requirements: ['welcome','waiver'], check: '', question: '', capacity: 8, responseDays: 1, deadline: '', status: 'open', activityId: 'garden', version: 1 },
      { id: 'library-welcome', orgId: 'tool-library', title: 'Tool library welcome volunteer', impact: 'Make borrowing easy and welcoming for more neighbors.', tasks: 'Welcome visitors, help with the catalog and keep the return desk organized. Repair work is a separate role.', commitment: 'A 2-hour desk shift twice a month, agreed with your buddy.', mode: 'In person', pathway: 'application', experience: 'Listening and curiosity matter more than tool knowledge.', support: 'A seated desk option, hands-on practice and buddy support.', requirements: ['welcome','waiver'], check: '', question: 'What helps you make a new visitor feel welcome?', capacity: 3, responseDays: 7, deadline: '', status: 'open', activityId: '', version: 1 },
      { id: 'creek-story', orgId: 'creek-friends', title: 'Community nature storyteller', impact: 'Help neighbors understand and take part in caring for the creek.', tasks: 'Turn team updates into a short accessible story or illustrated guide. Share a draft and leave a handoff.', commitment: 'Remote, around 2 hours a week for a 4-week project.', mode: 'Remote', pathway: 'conversation', experience: 'Writing, illustration or lived knowledge of the creek. Samples are optional; we can explore a first task together.', support: 'A clear brief, flexible deadlines and feedback from Leah.', requirements: ['welcome'], check: '', question: 'What would you enjoy making, and what support would help?', capacity: 2, responseDays: 7, deadline: '', status: 'open', activityId: '', version: 1 }
    ], applications: [], memberships: [], preparation: {}, saved: {}
  };
  state.recruitment.invitations ||= [];
  for (const invitation of state.recruitment.invitations) invitation.kind ||= 'role';
  state.recruitment.requirementLibrary ||= {};
  for (const organization of state.recruitment.organizations) {
    organization.welcomeMessageCreated = Boolean(organization.welcomeMessageCreated);
    const library = state.recruitment.requirementLibrary[organization.id] ||= [];
    const requirements = state.allowSampleData === false ? BASE_VOLUNTEER_REQUIREMENTS.filter(requirement => requirement.id === 'welcome') : BASE_VOLUNTEER_REQUIREMENTS;
    for (const requirement of requirements) {
      if (!library.some(item => item.id === requirement.id)) library.push(structuredClone(requirement));
    }
    for (const requirement of library) {
      const base = BASE_VOLUNTEER_REQUIREMENTS.find(item => item.id === requirement.id);
      requirement.completionType ||= base?.completionType || (requirement.owner === 'coordinator' ? 'organization' : 'read');
      requirement.documentId ??= base?.documentId || '';
      requirement.owner = requirement.completionType === 'screening' ? 'shared' : requirement.completionType === 'organization' ? 'coordinator' : 'volunteer';
      if (requirement.completionType === 'screening') {
        requirement.screeningProvider ||= 'external';
        requirement.providerName ||= SCREENING_PROVIDERS[requirement.screeningProvider] || 'External provider';
        requirement.startMethod ||= requirement.screeningProvider === 'ca-live-scan' ? 'live-scan' : 'organization-invite';
        requirement.volunteerUrl ||= requirement.screeningProvider === 'ca-live-scan' ? 'https://oag.ca.gov/fingerprints/locations' : '';
        requirement.organizationUrl ||= '';
        requirement.payer ||= 'organization';
        requirement.validMonths ||= 12;
      }
    }
    const defaultRoleId = organization.id === HOME_ORG ? 'general-volunteer' : `general-volunteer-${organization.id}`;
    if (!state.recruitment.positions.some(position => position.id === defaultRoleId)) {
      state.recruitment.positions.push({
        id: defaultRoleId, orgId: organization.id, title: 'General Volunteer',
        impact: `Support ${organization.name} wherever an extra pair of hands can help.`,
        tasks: 'Choose from available activities with the organization and agree each commitment separately.',
        commitment: 'Flexible; agree activities individually.', mode: 'In person', pathway: 'application',
        experience: 'No previous experience required.', support: 'A coordinator will help identify a suitable first step.',
        requirements: ['welcome'], check: '', question: '', capacity: 25, responseDays: 7,
        deadline: '', status: 'open', activityId: '', programId: '', version: 1, systemDefault: true,
      });
    }
  }
  for (const position of state.recruitment.positions) {
    if (position.programId && position.status === 'draft') position.status = 'open';
    position.requirements ||= [];
    if (!position.requirements.includes('welcome')) position.requirements.unshift('welcome');
  }
  for (const application of state.recruitment.applications) {
    application.source ||= 'public';
    application.screenings ||= {};
    application.position.requirementDefinitions ||= application.position.requirements.map(requirementId => structuredClone(volunteerRequirement(state, application.orgId, requirementId) || { id: requirementId, title: requirementId, detail: 'Complete this role requirement with the organization.', owner: 'coordinator' }));
  }
  return state;
}
export function positionOpen(position, date = today()) { return position.status === 'open' && (!position.deadline || position.deadline >= date); }
export const occupiedPlaces = (state, positionId, date = today()) => state.recruitment.applications.filter(a => a.positionId === positionId && (['onboarding','active'].includes(a.status) || a.status === 'offered' && a.offerUntil >= date)).length;
export const myApplication = (state, personId, positionId) => state.recruitment.applications.find(a => a.personId === personId && a.positionId === positionId && !TERMINAL.includes(a.status));
export function visibleApplications(state, actor, orgId) {
  return state.recruitment.applications.filter(a => actor === 'coordinator' ? a.orgId === orgId && !!a.submittedAt && a.status !== 'draft' : a.personId === actor);
}
export function onboardingSteps(state, application) {
  const p = state.people.find(p => p.id === application.personId);
  const local = state.recruitment.preparation[application.orgId]?.[p.id] || {};
  const snapshots = application.position.requirementDefinitions || [];
  const steps = application.position.requirements.map(key => {
    const requirement = snapshots.find(item => item.id === key) || volunteerRequirement(state, application.orgId, key) || { id: key, title: key, detail: 'Complete this role requirement with the organization.', owner: 'coordinator' };
    const document = requirement.documentId && state.documentLibrary?.items?.find(item => item.id === requirement.documentId);
    const signature = application.completed?.[key]?.signature;
    const signedCurrentVersion = requirement.completionType === 'sign' && Boolean(document && signature?.documentId === document.id && signature.documentUpdatedAt === document.updatedAt);
    if (requirement.completionType === 'screening') {
      const attempt = application.screenings?.[key] || {};
      const completed = application.completed?.[key]?.screening;
      const active = completed?.status === 'satisfied' && (!completed.expiresAt || completed.expiresAt >= today());
      const renewalInProgress = attempt.status && attempt.status !== 'satisfied';
      const phase = active ? 'satisfied' : renewalInProgress ? attempt.status : completed?.expiresAt && completed.expiresAt < today() ? 'expired' : 'not-started';
      const owner = ['awaiting-verification','invitation-needed','expired'].includes(phase) ? 'coordinator'
        : phase === 'not-started' && requirement.startMethod === 'organization-invite' ? 'coordinator' : 'volunteer';
      return { key, title: requirement.title, owner, detail: requirement.detail, completionType: 'screening', documentId: '', done: active, portable: false, phase, screening: structuredClone(requirement), attempt: structuredClone(attempt), completed: structuredClone(completed || null) };
    }
    const done = requirement.completionType === 'sign' ? signedCurrentVersion : application.orgId === HOME_ORG ? requirementReady(state,p,key) : !!local[key];
    return { key, title: requirement.title, owner: requirement.owner, detail: requirement.detail, completionType: requirement.completionType || 'read', documentId: requirement.documentId || '', done, portable: key === 'food' && application.orgId === HOME_ORG && !p.requirements[key] && requirementReady(state,p,key) };
  });
  if (application.position.check) steps.push({ key: 'role-check', title: application.position.check, owner: 'coordinator', detail: 'Explain the process to the volunteer and record completion of this role-specific check. Do not enter sensitive reports.', done: !!application.completed['role-check'] });
  steps.push({ key: 'orientation', title: 'Meet your buddy & agree the first step', owner: 'coordinator', detail: 'Introduce the volunteer to their buddy, confirm practical access and support, explain expenses and concerns, and agree a first activity or project handoff.', done: !!application.completed.orientation });
  return steps;
}
export function applicationNext(application, date = today()) {
  return { draft: ['You', 'Finish and submit when you are ready.'], submitted: [application.contact, `Initial reply target: ${application.replyBy} (calendar days).`], reviewing: [application.contact, 'The organization is reviewing your interests and the role together.'], 'needs-info': ['You', 'Reply to the coordinator’s question below.'], waitlisted: [application.contact, 'The team will contact you if a place becomes available. No place is promised.'], offered: ['You', application.offerUntil < date ? 'This offer has expired. Ask the coordinator to renew it.' : `Accept or decline by ${application.offerUntil}.`], onboarding: ['You & your coordinator', 'Complete the shared welcome plan; each step has an owner.'], active: ['You', 'Choose a first activity or agree a plan with your buddy. No shift was booked automatically.'], declined: ['You', 'Read the feedback below. You can explore another role or ask a question.'], withdrawn: ['You', 'Application closed at your request.'], 'offer-declined': ['You', 'Offer declined. You are welcome to explore another opportunity.'] }[application.status];
}

export function transitionRecruitment(current, action, date = today()) {
  const state = ensureRecruitment(structuredClone(current)); const r = state.recruitment;
  const coordinator = action.actor === 'coordinator';
  const org = r.organizations.find(o => o.id === action.orgId);
  const coordinatorName = state.programWorkspace?.organizationMembers?.find(member=>member.connectedAccount)?.name || org?.contact || 'Maya Thompson';
  const reviewOrg = orgId => assert(coordinator && org?.id === orgId, 'Use this organization’s recruitment workspace.');
  const person = personId => { const p = state.people.find(p => p.id === personId); assert(p, 'Volunteer not found.'); return p; };
  let notice = 'Saved'; let resultId;
  if (action.type === 'savePosition') {
    reviewOrg(action.orgId);
    let position = action.positionId && r.positions.find(p => p.id === action.positionId);
    if (position) { reviewOrg(position.orgId); assert(position.status === 'draft' || Boolean(position.programId), 'Published roles keep their terms. Create a new role for material changes.'); }
    const programRole = Boolean(action.programId);
    const requirements = [...new Set(['welcome', ...(action.requirements || (programRole&&position?position.requirements:[]))])];
    assert(requirements.every(key => volunteerRequirement(state, action.orgId, key)), 'Unknown onboarding step.');
    const pathway = action.pathway || position?.pathway || 'application';
    const mode = action.mode || position?.mode || 'In person';
    assert(['application','conversation'].includes(pathway), 'Choose a short application or a conversation-first pathway.');
    assert(['In person','Remote','Hybrid'].includes(mode), 'Choose a work mode.');
    if (programRole) {
      assert(clean(action.title,120) && clean(action.tasks), 'Add a role title and description.');
    } else {
      assert(clean(action.title,120) && clean(action.impact) && clean(action.tasks) && clean(action.commitment) && clean(action.experience) && clean(action.support), 'Describe the role, impact, time, experience and support before saving.');
      assert(Number.isInteger(Number(action.capacity)) && Number(action.capacity)>0 && Number(action.capacity)<=100, 'Choose between 1 and 100 onboarding places.');
      assert(Number.isInteger(Number(action.responseDays)) && Number(action.responseDays)>0 && Number(action.responseDays)<=30, 'Set an initial reply target between 1 and 30 calendar days.');
      assert(!action.deadline || dateValid(action.deadline) && action.deadline>=date, 'Use a closing date today or later.');
    }
    if (action.activityId) assert(action.orgId === HOME_ORG && state.activities.some(a => a.id === action.activityId), 'Choose an activity belonging to this organization.');
    const programId = action.programId || '';
    if (programId) assert(action.orgId === HOME_ORG && state.programWorkspace?.programs.some(program => program.id === programId && program.status !== 'complete'), 'Choose an active or draft program in this organization.');
    if (programId && action.activityId) assert(state.activities.some(activity => activity.id === action.activityId && activity.programId === programId), 'Choose an activity in this program.');
    const values = { title: clean(action.title,120), impact: clean(action.impact || position?.impact || action.tasks,500), tasks: clean(action.tasks), commitment: clean(action.commitment || position?.commitment || 'Program activity',300), experience: clean(action.experience || position?.experience || 'Open to learning',600), support: clean(action.support || position?.support || 'A coordinator will share the next step.',600), mode, pathway, capacity: Number(action.capacity || position?.capacity || 1), responseDays: Number(action.responseDays || position?.responseDays || 7), deadline: action.deadline || position?.deadline || '', question: clean(action.question || position?.question,240), check: clean(action.check || position?.check,200), requirements, activityId: action.activityId || position?.activityId || '', programId };
    if (position) Object.assign(position, values, programRole ? { status: 'open' } : {}); else { position = { id: uid(), orgId: org.id, status: programRole ? 'open' : 'draft', version: 1, ...values }; r.positions.unshift(position); }
    if (programId) state.programWorkspace.history.unshift({ id: uid(), programId, activityId: '', text: `${position.title} role ${action.positionId ? 'updated' : 'created'}`, detail: '', actor: coordinatorName, date: new Date().toISOString() });
    resultId = position.id; notice = programRole ? `Program role ${action.positionId ? 'updated' : 'created'}.` : 'Role draft saved. Preview it before publishing.';
  } else if (action.type === 'deletePosition') {
    const position = r.positions.find(position => position.id === action.positionId); assert(position,'Position not found.'); reviewOrg(position.orgId);
    assert(position.programId,'Only roles created within a program can be deleted here.');
    assert(!r.applications.some(application => application.positionId === position.id && !TERMINAL.includes(application.status)),'This role has an active application and cannot be deleted.');
    r.positions = r.positions.filter(item => item.id !== position.id);
    r.invitations = r.invitations.filter(invitation => invitation.positionId !== position.id);
    if (state.programWorkspace) state.programWorkspace.history.unshift({ id: uid(), programId: position.programId, activityId: '', text: `${position.title} role deleted`, detail: '', actor: coordinatorName, date: new Date().toISOString() });
    notice = 'Program role deleted.';
  } else if (action.type === 'positionStatus') {
    const p = r.positions.find(p => p.id === action.positionId); assert(p,'Position not found.'); reviewOrg(p.orgId);
    assert(['open','paused','closed'].includes(action.status), 'Choose a valid publication state.');
    assert(action.status !== 'open' || !p.deadline || p.deadline>=date, 'The closing date has passed. Create a new recruitment round.');
    p.status = action.status; notice = action.status === 'open' ? 'Position published in organization discovery.' : 'New applications stopped. Existing applicants keep their next steps.';
    if (p.programId && state.programWorkspace) state.programWorkspace.history.unshift({ id: uid(), programId: p.programId, activityId: '', text: `${p.title} role ${action.status === 'open' ? 'published' : action.status}`, detail: '', actor: coordinatorName, date: new Date().toISOString() });
  } else if (action.type === 'saveRequirement') {
    reviewOrg(action.orgId);
    const title=clean(action.title,120),detail=clean(action.detail,800);
    assert(title&&detail,'Add a requirement name and clear instructions.');
    const library=volunteerRequirements(state,action.orgId);
    let requirement=action.requirementId&&library.find(item=>item.id===action.requirementId);
    assert(!action.requirementId||requirement,'Volunteer requirement not found.');
    assert(requirement?.id!=='welcome','The welcome message is managed from its permanent requirement.');
    const completionType=action.completionType||requirement?.completionType||(action.owner==='coordinator'?'organization':'read');
    const documentId=completionType==='screening'?'':clean(action.documentId||'',200);
    assert(REQUIREMENT_COMPLETION_TYPES.includes(completionType),'Choose how this requirement is completed.');
    const document=documentId&&state.documentLibrary?.items?.find(item=>item.id===documentId);
    assert(!documentId||document,'Choose a document from this organization’s library.');
    assert(completionType!=='sign'||document,'Choose the document the volunteer needs to acknowledge or sign.');
    const owner=completionType==='screening'?'shared':completionType==='organization'?'coordinator':'volunteer';
    let screening={};
    if(completionType==='screening') {
      const screeningProvider=clean(action.screeningProvider,40);
      const startMethod=clean(action.startMethod,40);
      const providerName=screeningProvider==='external'?clean(action.providerName,120):SCREENING_PROVIDERS[screeningProvider];
      const volunteerUrl=clean(action.volunteerUrl,500),organizationUrl=clean(action.organizationUrl,500);
      const validMonths=Number(action.validMonths||12),payer=clean(action.payer,20);
      assert(SCREENING_PROVIDERS[screeningProvider]&&providerName,'Choose and name the screening provider.');
      assert(SCREENING_START_METHODS.includes(startMethod),'Choose how the screening begins.');
      assert(['organization','volunteer'].includes(payer),'Choose who pays the provider.');
      assert(Number.isInteger(validMonths)&&validMonths>=1&&validMonths<=60,'Choose a renewal period between 1 and 60 months.');
      assert(!volunteerUrl||validHttpUrl(volunteerUrl),'Use a valid volunteer screening link.');
      assert(!organizationUrl||validHttpUrl(organizationUrl),'Use a valid organization provider link.');
      assert(startMethod!=='volunteer-link'||volunteerUrl,'Add the link volunteers use to begin screening.');
      screening={screeningProvider,providerName,startMethod,volunteerUrl,organizationUrl,payer,validMonths};
    }
    assert(!library.some(item=>item.id!==action.requirementId&&item.title.toLowerCase()===title.toLowerCase()),'A requirement with this name already exists.');
    if(requirement)Object.assign(requirement,{title,detail,owner,completionType,documentId,...screening});
    else {requirement={id:`custom-${uid()}`,title,detail,owner,completionType,documentId,...screening};library.push(requirement);}
    const selected=new Set(Array.isArray(action.positionIds)?action.positionIds:action.positionIds?[action.positionIds]:[]);
    assert([...selected].every(positionId=>r.positions.some(position=>position.id===positionId&&position.orgId===action.orgId)),'Choose roles from this organization.');
    for(const position of r.positions.filter(position=>position.orgId===action.orgId)) {
      position.requirements ||= [];
      position.requirements=selected.has(position.id)?[...new Set([...position.requirements,requirement.id])]:position.requirements.filter(requirementId=>requirementId!==requirement.id);
    }
    resultId=requirement.id;notice=`${requirement.title} saved and assigned to ${selected.size} ${selected.size===1?'role':'roles'}.`;
  } else if (action.type === 'saveWelcome') {
    reviewOrg(action.orgId);
    const welcome=clean(action.welcome,1600);
    assert(welcome,'Write a welcome message for prospective volunteers.');
    org.welcome=welcome;org.welcomeMessageCreated=true;notice='Volunteer welcome message saved.';
  } else if (action.type === 'saveOrganization') {
    reviewOrg(action.orgId); assert(clean(action.mission) && clean(action.support) && clean(action.welcome), 'Describe the mission, access/support and welcome.');
    org.mission=clean(action.mission,500); org.support=clean(action.support,800); org.welcome=clean(action.welcome,1000); notice='Organization profile and welcome updated.';
  } else if (action.type === 'bookmark') {
    if (!coordinator) person(action.actor); assert(org,'Choose an organization.');
    const saved=r.saved[action.actor] || []; r.saved[action.actor]=saved.includes(org.id) ? saved.filter(id=>id!==org.id) : [...saved,org.id]; notice='Watchlist updated.';
  } else if (action.type === 'inviteToPosition') {
    reviewOrg(action.orgId);
    const p=person(action.personId);
    const position=r.positions.find(p=>p.id===action.positionId);
    assert(state.passports?.profiles?.[p.id]?.openForVolunteering,'This volunteer is no longer open to invitations.');
    assert(position&&position.orgId===action.orgId&&positionOpen(position,date)&&position.pathway!=='event','Choose an open volunteer role from your organization.');
    assert(!r.invitations.some(invitation=>invitation.personId===p.id&&invitation.positionId===position.id&&invitation.status==='pending'),'An invitation for this role is already waiting for this volunteer.');
    r.invitations.unshift({id:uid(),kind:'role',personId:p.id,orgId:action.orgId,positionId:position.id,status:'pending',message:clean(action.message,500),createdAt:new Date().toISOString()});
    notice=`Invitation sent to ${p.name} for ${position.title}.`;
  } else if (action.type === 'inviteToActivity') {
    reviewOrg(action.orgId);
    const p=person(action.personId);
    const activity=state.activities.find(item=>item.id===action.activityId&&!item.archived);
    assert(state.passports?.profiles?.[p.id]?.openForVolunteering,'This volunteer is no longer open to invitations.');
    assert(activity&&activity.assignmentMode==='public'&&activity.visibility==='public','Choose an open public activity.');
    const role=activity.roles.find(item=>item.id===action.roleId)||activity.roles[0];
    assert(role,'Choose an activity role.');
    assert(!state.commitments.some(item=>item.personId===p.id&&item.activityId===activity.id&&['confirmed','proposed','waitlisted'].includes(item.status)),'This volunteer already has an active place or invitation for this activity.');
    const commitment={id:uid(),personId:p.id,activityId:activity.id,roleId:role.id,status:'proposed',source:'passport-activity-invite'};
    state.commitments.push(commitment);
    r.invitations.unshift({id:uid(),kind:'activity',personId:p.id,orgId:action.orgId,activityId:activity.id,commitmentId:commitment.id,status:'pending',message:clean(action.message,500),createdAt:new Date().toISOString()});
    state.notifications.unshift({id:uid(),personId:p.id,text:`${org.name} invited you to ${activity.title}. Review the requirements, then accept or decline.`,activityId:activity.id});
    notice=`Activity invitation sent to ${p.name}. Their place remains unconfirmed until they accept.`;
  } else if (action.type === 'startPassportConversation') {
    reviewOrg(action.orgId);
    const p=person(action.personId),message=clean(action.message,1000);
    assert(state.passports?.profiles?.[p.id]?.openForVolunteering,'This volunteer is no longer open to organization outreach.');
    assert(message,'Write a short introduction and reason for connecting.');
    state.communications ||= {outbound:[],readBy:{},readNoticeIds:[]};
    state.communications.outbound.unshift({id:uid(),subject:'An invitation to connect',body:message,audienceType:'outreach',audienceLabel:p.name,recipientIds:[p.id],createdAt:new Date().toISOString(),author:org.contact});
    r.invitations.unshift({id:uid(),kind:'conversation',personId:p.id,orgId:action.orgId,status:'contacted',message,createdAt:new Date().toISOString()});
    notice=`A conversation invitation was sent to ${p.name}. No role or activity was assigned.`;
  } else if (action.type === 'startInviteLink') {
    const p=person(action.personId);assert(action.actor===p.id,'Only the invited volunteer can begin this pathway.');
    const position=r.positions.find(position=>position.orgId===action.orgId&&position.systemDefault&&position.title==='General Volunteer');
    assert(position&&positionOpen(position,date),'This organization’s general volunteer pathway is not open.');
    let application=myApplication(state,p.id,position.id);
    if(!application) {
      application={
        id:uid(),personId:p.id,orgId:position.orgId,positionId:position.id,status:'submitted',source:'invite-link',
        answers:{motivation:'Responded through the organization’s volunteer invite link.',availability:p.availability||'To be discussed',experience:'',answer:'',email:p.email},
        completed:{},history:[{status:'submitted',by:p.name,date,note:'Volunteer responded through the organization’s invite link.'}],messages:[],
        createdAt:new Date().toISOString(),submittedAt:date,replyBy:addDays(date,position.responseDays),position:structuredClone(position),contact:org.contact,
      };
      application.position.requirementDefinitions=position.requirements.map(requirementId=>structuredClone(volunteerRequirement(state,position.orgId,requirementId)));
      r.applications.unshift(application);
    }
    p.relationship='joining';p.reviewPending=true;resultId=application.id;notice='Your response was shared with the organization. They have the next step.';
  } else if (action.type === 'saveApplication') {
    const p=person(action.personId); const position=r.positions.find(p=>p.id===action.positionId);
    assert(position && positionOpen(position,date) && position.pathway!=='event', 'This position is not accepting applications.');
    assert(action.actor===p.id || coordinator && org?.id===position.orgId && action.assisted===true, 'Only the volunteer or their authorized assisting coordinator can apply.');
    if (coordinator) assert(action.consent===true, 'Confirm the volunteer asked for help and approved these answers.');
    let application=myApplication(state,p.id,position.id);
    assert(!application || application.status==='draft', 'You already have an application for this position.');
    assert(!coordinator || !application, 'A private draft belongs to the volunteer. Ask them to finish it.');
    const answers={ motivation:clean(action.motivation), availability:clean(action.availability,300), experience:clean(action.experience), answer:clean(action.answer), email:clean(action.email,200) };
    if (action.submit) assert(answers.motivation && answers.availability && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email) && (!position.question || answers.answer), 'Add your interest, availability, valid email and the role question before submitting.');
    if (action.submit) assert(action.consent===true, 'Confirm you want this organization to receive your application.');
    const invitation=r.invitations.find(invitation=>invitation.personId===p.id&&invitation.positionId===position.id&&invitation.status==='pending');
    if (!application) { application={id:uid(),personId:p.id,orgId:position.orgId,positionId:position.id,status:'draft',source:invitation?'passport-invite':'public',answers:{},completed:{},history:[],messages:[],createdAt:new Date().toISOString()};r.applications.unshift(application); }
    application.answers=answers; application.position=structuredClone(position); application.position.requirementDefinitions=position.requirements.map(requirementId=>structuredClone(volunteerRequirement(state,position.orgId,requirementId))); application.contact=r.organizations.find(o=>o.id===position.orgId).contact;
    if(action.submit) { application.status='submitted';application.submittedAt=date;application.replyBy=addDays(date,position.responseDays); application.history.push({status:'submitted',by:coordinator?application.contact:p.name,date,note:coordinator?'Application entered with the volunteer’s approval.':'Application received. No membership or shifts created.'}); application.assisted=coordinator; if(invitation)invitation.status='applied'; }
    resultId=application.id;notice=action.submit?'Application received. Your next step and reply target are on your application.':'Private draft saved. The organization cannot see it.';
  } else {
    const a=r.applications.find(a=>a.id===action.applicationId); assert(a,'Application not found.');
    const p=person(a.personId); const own=()=>assert(action.actor===p.id,'Only the applicant can make this choice.'); const review=()=>{reviewOrg(a.orgId);assert(a.status!=='draft'&&!!a.submittedAt,'Private drafts are not visible to coordinators.');};
    const log=(status,note)=>{a.status=status;a.history.push({status,by:coordinator?a.contact:p.name,date,note});};
    const reply=clean(action.note); resultId=a.id;
    if(action.type==='review') {
      review();assert(['submitted','reviewing','needs-info','waitlisted','offered'].includes(a.status),'This application is not awaiting a recruitment decision.');
      assert(['reviewing','needs-info','waitlisted','offered','declined'].includes(action.status),'Choose a valid review action.');
      assert(reply,'Explain the decision or next step to the applicant.');
      if(action.status==='offered') {
        const position=r.positions.find(p=>p.id===a.positionId);assert(positionOpen(position,date),'Reopen recruitment before offering a new place.');
        assert(occupiedPlaces(state,a.positionId,date)-(a.status==='offered'&&a.offerUntil>=date?1:0)<position.capacity,'All onboarding places are reserved. Waitlist this application or free a place.');
        assert(dateValid(action.offerUntil)&&action.offerUntil>date&&action.offerUntil<=addDays(date,30),'Give the volunteer between 1 and 30 days to consider the offer.'); a.offerUntil=action.offerUntil;
      }
      a.firstResponseAt ||= date;log(action.status,reply);a.messages.push({by:a.contact,actor:'coordinator',date,text:reply});notice='Decision and next step shared in the application.';
    } else if(action.type==='acceptOffer') {
      own();assert(a.status==='offered'&&a.offerUntil>=date,'This offer is no longer available. Ask the coordinator to renew it.');
      const position=r.positions.find(p=>p.id===a.positionId);assert(occupiedPlaces(state,a.positionId,date)<=position.capacity,'Places have changed. Ask the coordinator to review the offer.');
      log('onboarding','Volunteer accepted the role offer. Onboarding started.');a.acceptedAt=date;notice='Offer accepted. Your welcome plan is ready; no shifts were booked.';
    } else if(action.type==='declineOffer') { own();assert(a.status==='offered','There is no offer to decline.');log('offer-declined',reply||'The volunteer declined this offer.');notice='Offer declined. The organization can offer the place to someone else.';
    } else if(action.type==='withdraw') { own();assert(![...TERMINAL,'active'].includes(a.status),'This application cannot be withdrawn here. Active memberships are managed separately.');log('withdrawn',reply||'The volunteer withdrew their application.');notice='Application withdrawn. Other memberships and commitments are unchanged.';
    } else if(action.type==='message') {
      if(coordinator)review();else own();assert(a.status!=='draft'&&reply,'Write a message on a submitted application.');
      if(coordinator)a.firstResponseAt ||= date;
      a.messages.push({by:coordinator?a.contact:p.name,actor:action.actor,date,text:reply});
      if(!coordinator&&a.status==='needs-info')log('reviewing','Volunteer replied; coordinator has the next step.');notice='Message added to this application. No external email sent.';
    } else if(action.type==='screeningInvite') {
      assert(['onboarding','active'].includes(a.status),'Accept a role offer before beginning onboarding.');review();
      const step=onboardingSteps(state,a).find(step=>step.key===action.key&&step.completionType==='screening');assert(step,'Background screening requirement not found.');
      assert(['not-started','expired','volunteer-action-required'].includes(step.phase),'This screening invitation has already been sent or is awaiting review.');
      const candidateUrl=clean(action.candidateUrl,500);assert(!candidateUrl||validHttpUrl(candidateUrl),'Use a valid volunteer invitation link.');
      assert(action.invitationSent===true,'Confirm that the provider invitation or instructions were sent.');
      a.screenings[action.key]={status:'awaiting-volunteer',candidateUrl,invitedAt:new Date().toISOString(),invitedBy:a.contact,note:clean(action.note,600)};
      a.history.push({status:a.status,by:a.contact,date,note:`${step.title}: screening invitation sent.`});notice='Screening invitation recorded. The volunteer has the next step.';
    } else if(action.type==='screeningDeclare') {
      assert(['onboarding','active'].includes(a.status),'Accept a role offer before beginning onboarding.');own();
      const step=onboardingSteps(state,a).find(step=>step.key===action.key&&step.completionType==='screening');assert(step,'Background screening requirement not found.');
      assert(!step.done&&!['awaiting-verification','invitation-needed'].includes(step.phase),'This screening is not ready for the volunteer’s completion update.');
      assert(!(step.phase==='not-started'&&step.screening.startMethod==='organization-invite'),'Wait for the organization to send the provider invitation.');
      assert(action.completionConfirmed===true,'Confirm that you completed the provider’s process.');
      a.screenings[action.key]={...a.screenings[action.key],status:'awaiting-verification',declaredAt:new Date().toISOString(),declaredBy:p.name,note:clean(action.note,600)};
      a.history.push({status:a.status,by:p.name,date,note:`${step.title}: volunteer reported the external process complete.`});notice='Completion sent to the organization for verification.';
    } else if(action.type==='screeningVerify') {
      assert(['onboarding','active'].includes(a.status),'Accept a role offer before beginning onboarding.');review();
      const step=onboardingSteps(state,a).find(step=>step.key===action.key&&step.completionType==='screening');assert(step,'Background screening requirement not found.');
      assert(step.phase==='awaiting-verification','Wait for the volunteer to report completion before verifying this requirement.');
      assert(action.providerReviewed===true,'Confirm that you reviewed the result in the authorized external system.');
      const note=clean(action.note,600);assert(note,'Record the basis for satisfying this role requirement without copying report details.');
      const expiresAt=clean(action.expiresAt,10)||screeningExpiry(date,step.screening.validMonths);assert(dateValid(expiresAt)&&expiresAt>=date,'Use a valid expiration date today or later.');
      const screening={status:'satisfied',provider:step.screening.screeningProvider,providerName:step.screening.providerName,verifiedAt:date,expiresAt,reviewer:a.contact};
      a.screenings[action.key]={...a.screenings[action.key],status:'satisfied',verifiedAt:new Date().toISOString(),verifiedBy:a.contact};
      a.completed[action.key]={by:a.contact,date,note,screening};
      recordPrivateScreeningCredential(state,{applicationId:a.id,requirementId:step.key,requirementTitle:step.title,personId:p.id,organizationId:a.orgId,organizationName:org.name,roleId:a.positionId,roleTitle:a.position.title,providerName:step.screening.providerName,verifiedAt:date,expiresAt,reviewer:a.contact});
      a.history.push({status:a.status,by:a.contact,date,note:`${step.title}: requirement satisfied through ${step.screening.providerName}.`});notice='Background screening requirement satisfied. A private Passport credential was added.';
    } else if(action.type==='screeningFollowup') {
      assert(['onboarding','active'].includes(a.status),'Accept a role offer before beginning onboarding.');review();
      const step=onboardingSteps(state,a).find(step=>step.key===action.key&&step.completionType==='screening');assert(step&&step.phase==='awaiting-verification','This screening is not awaiting review.');
      const note=clean(action.note,600);assert(note,'Tell the volunteer what they need to do next.');
      a.screenings[action.key]={...a.screenings[action.key],status:'volunteer-action-required',reviewedAt:new Date().toISOString(),reviewedBy:a.contact,note};
      a.messages.push({by:a.contact,actor:'coordinator',date,text:`${step.title}: ${note}`});a.history.push({status:a.status,by:a.contact,date,note:`${step.title}: follow-up requested.`});notice='Follow-up requested. The volunteer has the next step.';
    } else if(action.type==='completeStep') {
      assert(['onboarding','active'].includes(a.status),'Accept a role offer before beginning onboarding.');
      const step=onboardingSteps(state,a).find(s=>s.key===action.key);assert(step,'Unknown onboarding step.');assert(step.completionType!=='screening','Use the background screening workflow for this requirement.');assert(!step.done,'This step is already complete or covered by accepted evidence.');
      if(step.owner==='coordinator')review();else own();
      assert(reply,'Record what was completed or discussed.');
      let signature;
      if(step.completionType==='sign') {
        const document=state.documentLibrary?.items?.find(item=>item.id===step.documentId);
        const signerName=clean(action.signerName,120);
        assert(document,'The organization needs to attach the current document before this step can be signed.');
        assert(action.documentAccepted===true&&signerName.length>=2,'Review the current document, type your full name, and consent before signing.');
        signature={documentId:document.id,documentTitle:document.title,documentUpdatedAt:document.updatedAt,signerName,acceptedAt:new Date().toISOString()};
      }
      if(action.key==='orientation') { assert(clean(action.buddy,120)&&clean(action.firstStep,300),'Name a buddy and agree a practical first step.');a.buddy=clean(action.buddy,120);a.firstStep=clean(action.firstStep,300); }
      if(!['orientation','role-check'].includes(action.key)) { if(a.orgId===HOME_ORG)p.requirements[action.key]=true;else {r.preparation[a.orgId]??={};r.preparation[a.orgId][p.id]??={};r.preparation[a.orgId][p.id][action.key]=true;} }
      a.completed[action.key]={by:coordinator?a.contact:p.name,date,note:reply,...(signature?{signature}:{})};a.history.push({status:a.status,by:coordinator?a.contact:p.name,date,note:`${step.title}: ${reply}`});notice=signature?'Document signed and onboarding step recorded.':'Onboarding step recorded.';
    } else if(action.type==='activate') {
      review();assert(a.status==='onboarding'&&a.acceptedAt,'The volunteer must accept the role offer first.');
      assert(onboardingSteps(state,a).every(s=>s.done),'Complete the shared onboarding plan before activating the role.');
      if(a.orgId===HOME_ORG) {assert(!['paused','former'].includes(p.relationship),'Ask the volunteer to resume their organization membership first.');p.relationship='member';p.reviewPending=false;}
      if(!r.memberships.some(m=>m.personId===p.id&&m.orgId===a.orgId))r.memberships.push({id:uid(),personId:p.id,orgId:a.orgId,since:date,sourceApplication:a.id});
      log('active','Coordinator completed onboarding and activated the role.');notice='Volunteer activated on this organization’s roster. A first shift still needs their agreement.';
    } else throw Error('Unknown recruitment action.');
  }
  return {state,notice,id:resultId};
}
