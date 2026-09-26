import { requirementReady, today } from './passport-model.js';

export const HOME_ORG = 'berkeley-neighbors';
export const APPLICATION_LABELS = { draft: 'Draft', submitted: 'Submitted', reviewing: 'In review', 'needs-info': 'Your reply needed', waitlisted: 'Waitlisted', offered: 'Offer to consider', onboarding: 'Getting ready', active: 'On the team', declined: 'Not this time', withdrawn: 'Withdrawn', 'offer-declined': 'Offer declined' };
export const TERMINAL = ['declined', 'withdrawn', 'offer-declined'];
const uid = () => crypto.randomUUID();
const assert = (condition, message) => { if (!condition) throw Error(message); };
const clean = (value, max = 1200) => String(value || '').trim().slice(0, max);
const dateValid = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
export const addDays = (date, days) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0,10); };

export function ensureRecruitment(state) {
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
  const details = {
    welcome: ['Meet the organization', 'volunteer', 'Read the welcome below and note who to contact, where to arrive, and how to ask for help.'],
    waiver: ['Review the participation agreement', 'volunteer', 'Discuss the role, support, expenses and how either side can raise concerns. This is a demo preparation acknowledgment; no legal agreement is signed.'],
    food: ['Food packing introduction', 'volunteer', 'Review hygiene, safe packing and allergen handling with the team, or share relevant passport training for review.'],
    driver: ['Driving qualification review', 'coordinator', 'Review the role-specific driving qualification through the organization’s normal process. Record a short completion note, not document numbers or check reports.']
  };
  const steps = application.position.requirements.map(key => ({ key, title: details[key][0], owner: details[key][1], detail: details[key][2], done: application.orgId === HOME_ORG ? requirementReady(state,p,key) : !!local[key], portable: application.orgId === HOME_ORG && !p.requirements[key] && requirementReady(state,p,key) }));
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
  const reviewOrg = orgId => assert(coordinator && org?.id === orgId, 'Use this organization’s recruitment workspace.');
  const person = personId => { const p = state.people.find(p => p.id === personId); assert(p, 'Volunteer not found.'); return p; };
  let notice = 'Saved'; let resultId;
  if (action.type === 'savePosition') {
    reviewOrg(action.orgId);
    let position = action.positionId && r.positions.find(p => p.id === action.positionId);
    if (position) { reviewOrg(position.orgId); assert(position.status === 'draft', 'Published roles keep their terms. Create a new role for material changes.'); }
    const requirements = [...new Set(action.requirements || [])];
    assert(requirements.every(k => ['welcome','waiver','food','driver'].includes(k)), 'Unknown onboarding step.');
    assert(['application','conversation'].includes(action.pathway), 'Choose a short application or a conversation-first pathway.');
    assert(['In person','Remote','Hybrid'].includes(action.mode), 'Choose a work mode.');
    assert(clean(action.title,120) && clean(action.impact) && clean(action.tasks) && clean(action.commitment) && clean(action.experience) && clean(action.support), 'Describe the role, impact, time, experience and support before saving.');
    assert(Number.isInteger(Number(action.capacity)) && Number(action.capacity)>0 && Number(action.capacity)<=100, 'Choose between 1 and 100 onboarding places.');
    assert(Number.isInteger(Number(action.responseDays)) && Number(action.responseDays)>0 && Number(action.responseDays)<=30, 'Set an initial reply target between 1 and 30 calendar days.');
    assert(!action.deadline || dateValid(action.deadline) && action.deadline>=date, 'Use a closing date today or later.');
    if (action.activityId) assert(action.orgId === HOME_ORG && state.activities.some(a => a.id === action.activityId), 'Choose an activity belonging to this organization.');
    const values = { title: clean(action.title,120), impact: clean(action.impact,500), tasks: clean(action.tasks), commitment: clean(action.commitment,300), experience: clean(action.experience,600), support: clean(action.support,600), mode: action.mode, pathway: action.pathway, capacity: Number(action.capacity), responseDays: Number(action.responseDays), deadline: action.deadline || '', question: clean(action.question,240), check: clean(action.check,200), requirements, activityId: action.activityId || '' };
    if (position) Object.assign(position, values); else { position = { id: uid(), orgId: org.id, status: 'draft', version: 1, ...values }; r.positions.unshift(position); }
    resultId = position.id; notice = 'Role draft saved. Preview it before publishing.';
  } else if (action.type === 'positionStatus') {
    const p = r.positions.find(p => p.id === action.positionId); assert(p,'Position not found.'); reviewOrg(p.orgId);
    assert(['open','paused','closed'].includes(action.status), 'Choose a valid publication state.');
    assert(action.status !== 'open' || !p.deadline || p.deadline>=date, 'The closing date has passed. Create a new recruitment round.');
    p.status = action.status; notice = action.status === 'open' ? 'Position published in organization discovery.' : 'New applications stopped. Existing applicants keep their next steps.';
  } else if (action.type === 'saveOrganization') {
    reviewOrg(action.orgId); assert(clean(action.mission) && clean(action.support) && clean(action.welcome), 'Describe the mission, access/support and welcome.');
    org.mission=clean(action.mission,500); org.support=clean(action.support,800); org.welcome=clean(action.welcome,1000); notice='Organization profile and welcome updated.';
  } else if (action.type === 'bookmark') {
    person(action.actor); assert(!coordinator && org,'Choose an organization.');
    const saved=r.saved[action.actor] || []; r.saved[action.actor]=saved.includes(org.id) ? saved.filter(id=>id!==org.id) : [...saved,org.id]; notice='Your saved organizations updated.';
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
    if (!application) { application={id:uid(),personId:p.id,orgId:position.orgId,positionId:position.id,status:'draft',answers:{},completed:{},history:[],messages:[],createdAt:new Date().toISOString()};r.applications.unshift(application); }
    application.answers=answers; application.position=structuredClone(position); application.contact=r.organizations.find(o=>o.id===position.orgId).contact;
    if(action.submit) { application.status='submitted';application.submittedAt=date;application.replyBy=addDays(date,position.responseDays); application.history.push({status:'submitted',by:coordinator?application.contact:p.name,date,note:coordinator?'Application entered with the volunteer’s approval.':'Application received. No membership or shifts created.'}); application.assisted=coordinator; }
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
    } else if(action.type==='completeStep') {
      assert(['onboarding','active'].includes(a.status),'Accept a role offer before beginning onboarding.');
      const step=onboardingSteps(state,a).find(s=>s.key===action.key);assert(step,'Unknown onboarding step.');assert(!step.done,'This step is already complete or covered by accepted evidence.');
      if(step.owner==='coordinator')review();else own();
      assert(reply,'Record what was completed or discussed.');
      if(action.key==='orientation') { assert(clean(action.buddy,120)&&clean(action.firstStep,300),'Name a buddy and agree a practical first step.');a.buddy=clean(action.buddy,120);a.firstStep=clean(action.firstStep,300); }
      if(['welcome','waiver','food','driver'].includes(action.key)) { if(a.orgId===HOME_ORG)p.requirements[action.key]=true;else {r.preparation[a.orgId]??={};r.preparation[a.orgId][p.id]??={};r.preparation[a.orgId][p.id][action.key]=true;} }
      a.completed[action.key]={by:coordinator?a.contact:p.name,date,note:reply};a.history.push({status:a.status,by:coordinator?a.contact:p.name,date,note:`${step.title}: ${reply}`});notice='Onboarding step recorded.';
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
