import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, transition } from './model.js';
import { ensureRecruitment, transitionRecruitment, visibleApplications, onboardingSteps, occupiedPlaces, myApplication, positionOpen } from './recruitment-model.js';
import { transitionPassport } from './passport-model.js';
import { recruitmentDialog } from './recruitment-view.js';

const day='2026-09-23';
const initial=()=>ensureRecruitment(createInitialState());
const act=(s,a,date=day)=>transitionRecruitment(s,{actor:'robin',orgId:'berkeley-neighbors',...a},date);
const answers={motivation:'I enjoy helping neighbors.',availability:'Tuesday afternoons',experience:'Happy to learn.',answer:'Packing and welcoming.',email:'robin@example.org',consent:true};
const apply=(s,extra={})=>act(s,{type:'saveApplication',personId:'robin',positionId:'food-team',...answers,submit:true,...extra});
const review=(s,id,status='offered',extra={})=>act(s,{actor:'coordinator',type:'review',applicationId:id,status,note:'Let us start with a supported first shift.',offerUntil:'2026-09-30',...extra});
const onboarding=(positionId='food-team',orgId='berkeley-neighbors')=>{let {state,id}=apply(initial(),{positionId});state=review(state,id,'offered',{orgId}).state;state=act(state,{type:'acceptOffer',applicationId:id}).state;return {state,id};};

test('migration is additive, idempotent and preserves passport, feed, membership and schedules',()=>{
  const state=createInitialState();const before=structuredClone(state);ensureRecruitment(state);const copy=structuredClone(state);ensureRecruitment(state);assert.deepEqual(state,copy);
  for(const key of ['people','passports','commitments','feed'])assert.deepEqual(state[key],before[key]);assert.equal(state.recruitment.applications.length,0);
});
test('private drafts can be incomplete, persist, and are invisible to every reviewer',()=>{
  const {state,id}=apply(initial(),{submit:false,consent:false,motivation:'',availability:'',email:''});
  assert.equal(state.recruitment.applications[0].status,'draft');assert.equal(visibleApplications(state,'coordinator','berkeley-neighbors').length,0);assert.equal(visibleApplications(state,'robin').length,1);
  assert.throws(()=>review(state,id),/Private drafts/);assert.throws(()=>apply(state,{submit:true,consent:false}),/Confirm/);
  const withdrawn=act(state,{type:'withdraw',applicationId:id}).state;
  assert.equal(visibleApplications(withdrawn,'coordinator','berkeley-neighbors').length,0);
  assert.throws(()=>act(withdrawn,{type:'message',actor:'coordinator',applicationId:id,note:'I should not see this draft.'}),/Private drafts/);
});
test('submission updates the draft once, acknowledges a reply target, and creates no membership or booking',()=>{
  const start=initial();const draft=apply(start,{submit:false});const result=apply(draft.state);
  assert.equal(result.id,draft.id);assert.equal(result.state.recruitment.applications.length,1);assert.equal(result.state.recruitment.applications[0].replyBy,'2026-09-28');
  assert.deepEqual(result.state.people,start.people);assert.deepEqual(result.state.commitments,start.commitments);assert.equal(result.state.recruitment.memberships.length,0);
  assert.throws(()=>apply(result.state),/already have/);
});
test('submission requires only the published short form and affirmative consent',()=>{
  for(const extra of [{motivation:''},{availability:''},{email:'not-email'},{answer:''},{consent:false}])assert.throws(()=>apply(initial(),extra));
  assert.equal(apply(initial(),{experience:''}).state.recruitment.applications[0].status,'submitted');
});
test('owner, reviewer and organization scope prevent cross-person and cross-organization changes',()=>{
  const {state,id}=apply(initial());
  assert.equal(visibleApplications(state,'alex').length,0);assert.equal(visibleApplications(state,'coordinator','tool-library').length,0);
  assert.throws(()=>review(state,id,'reviewing',{orgId:'tool-library'}),/workspace/);
  assert.throws(()=>act(state,{type:'acceptOffer',applicationId:id,actor:'alex'}),/Only the applicant/);
  assert.throws(()=>act(state,{type:'message',applicationId:id,actor:'alex',note:'read this'}),/Only the applicant/);
  assert.throws(()=>apply(initial(),{actor:'alex'}),/Only the volunteer/);
});
test('assisted applications need volunteer approval and cannot take over a private draft',()=>{
  assert.throws(()=>apply(initial(),{actor:'coordinator',assisted:true,consent:false}),/approved/);
  const good=apply(initial(),{actor:'coordinator',assisted:true});assert.equal(good.state.recruitment.applications[0].assisted,true);
  const draft=apply(initial(),{submit:false});assert.throws(()=>apply(draft.state,{actor:'coordinator',assisted:true}),/private draft/);
});
test('helped applications never prefill from an unshared passport',()=>{
  const state=initial();state.passports.profiles.robin.skills='PRIVATE PASSPORT SKILLS';
  const ctx={state,ui:{recruitOrg:'berkeley-neighbors'},e:v=>String(v??''),button:()=>'',errorOutput:()=>'',currentPerson:()=>state.people.find(p=>p.id==='robin')};
  assert.equal(recruitmentDialog(ctx,'Assist',{id:'food-team',person:'robin'}).content.includes('PRIVATE PASSPORT SKILLS'),false);
});
test('published terms are snapshotted and a later role change does not change an application',()=>{
  const {state,id}=apply(initial());state.recruitment.positions.find(p=>p.id==='food-team').requirements.push('driver');
  assert.deepEqual(state.recruitment.applications.find(a=>a.id===id).position.requirements,['welcome','waiver','food']);
});
test('questions hand the next step to the applicant and a reply returns it to the reviewer',()=>{
  let {state,id}=apply(initial());state=review(state,id,'needs-info').state;assert.equal(state.recruitment.applications[0].status,'needs-info');assert.equal(state.recruitment.applications[0].firstResponseAt,day);
  state=act(state,{type:'message',applicationId:id,note:'Tuesday is best.'}).state;assert.equal(state.recruitment.applications[0].status,'reviewing');assert.equal(state.recruitment.applications[0].messages.length,2);
});
test('offers reserve onboarding capacity; waitlisted volunteers are never auto-admitted',()=>{
  const start=initial();start.recruitment.positions.find(p=>p.id==='food-team').capacity=1;
  let {state,id}=apply(start);state=review(state,id).state;assert.equal(occupiedPlaces(state,'food-team',day),1);
  const second=apply(state,{actor:'elena',personId:'elena'});assert.throws(()=>review(second.state,second.id),/reserved/);
  const wait=review(second.state,second.id,'waitlisted').state;assert.equal(myApplication(wait,'elena','food-team').status,'waitlisted');
  const declined=act(wait,{type:'declineOffer',applicationId:id}).state;assert.equal(occupiedPlaces(declined,'food-team',day),0);
  assert.equal(review(declined,second.id).state.recruitment.applications.find(a=>a.id===second.id).status,'offered');
});
test('expired offers release capacity and cannot be accepted; renewal is a fresh organization decision',()=>{
  let {state,id}=apply(initial());state=review(state,id,'offered',{offerUntil:'2026-09-24'}).state;
  assert.equal(occupiedPlaces(state,'food-team','2026-09-25'),0);assert.throws(()=>act(state,{type:'acceptOffer',applicationId:id},'2026-09-25'),/no longer available/);
  state=act(state,{actor:'coordinator',type:'review',applicationId:id,status:'offered',offerUntil:'2026-10-01',note:'Renewed after discussion.'},'2026-09-25').state;
  assert.equal(act(state,{type:'acceptOffer',applicationId:id},'2026-09-25').state.recruitment.applications[0].status,'onboarding');
});
test('offer acceptance starts onboarding without creating membership, shifts or local preparation',()=>{
  const {state,id}=onboarding();assert.equal(state.recruitment.applications[0].status,'onboarding');assert.equal(state.people.find(p=>p.id==='robin').relationship,'interested');
  assert.equal(state.commitments.some(c=>c.personId==='robin'),false);assert.equal(onboardingSteps(state,state.recruitment.applications[0]).some(s=>s.done),false);
  assert.throws(()=>act(state,{type:'activate',actor:'coordinator',applicationId:id}),/Complete the shared/);
});
test('each onboarding step enforces its owner and a named buddy is required',()=>{
  const {state,id}=onboarding('delivery-team');
  assert.throws(()=>act(state,{type:'completeStep',applicationId:id,key:'driver',note:'I approve myself'}),/workspace/);
  assert.throws(()=>act(state,{type:'completeStep',actor:'coordinator',applicationId:id,key:'welcome',note:'For the volunteer'}),/Only the applicant/);
  assert.throws(()=>act(state,{type:'completeStep',actor:'coordinator',applicationId:id,key:'orientation',note:'Done'}),/Name a buddy/);
});
test('activation follows mutual acceptance and complete preparation, adds one roster relationship and no booking',()=>{
  let {state,id}=onboarding();
  for(const key of ['welcome','waiver','food'])state=act(state,{type:'completeStep',applicationId:id,key,note:'Reviewed the preparation with the team.'}).state;
  state=act(state,{type:'completeStep',actor:'coordinator',applicationId:id,key:'orientation',note:'Introduced and discussed support.',buddy:'Sam',firstStep:'Choose a kitchen shift together.'}).state;
  state=act(state,{type:'activate',actor:'coordinator',applicationId:id}).state;
  assert.equal(state.people.find(p=>p.id==='robin').relationship,'member');assert.equal(state.recruitment.memberships.length,1);assert.equal(state.commitments.some(c=>c.personId==='robin'),false);
  assert.throws(()=>act(state,{type:'activate',actor:'coordinator',applicationId:id}),/accept the role/);
});
test('other organization onboarding never modifies Berkeley preparation or roster',()=>{
  let {state,id}=onboarding('library-welcome','tool-library');const original=structuredClone(state.people.find(p=>p.id==='robin'));
  for(const key of ['welcome','waiver'])state=act(state,{type:'completeStep',applicationId:id,key,note:'Reviewed local welcome.'}).state;
  state=act(state,{type:'completeStep',actor:'coordinator',orgId:'tool-library',applicationId:id,key:'orientation',note:'Introduced at the desk.',buddy:'Jordan',firstStep:'Agree a desk shift.'}).state;
  state=act(state,{type:'activate',actor:'coordinator',orgId:'tool-library',applicationId:id}).state;
  assert.deepEqual(state.people.find(p=>p.id==='robin'),original);assert.equal(state.recruitment.memberships[0].orgId,'tool-library');assert.equal(state.recruitment.preparation['tool-library'].robin.welcome,true);
});
test('accepted passport evidence is reused dynamically; revoked sharing removes its coverage',()=>{
  let {state,id}=apply(initial(),{personId:'elena',actor:'elena'});state=review(state,id).state;state=act(state,{type:'acceptOffer',applicationId:id,actor:'elena'}).state;
  const passport=(s,a)=>transitionPassport(s,{personId:'elena',actor:'elena',...a},day).state;
  state=passport(state,{type:'share',orgId:'berkeley-neighbors',recordIds:['elena-food'],sections:[],purpose:'Review my training.',expires:'2026-10-23'});
  state=passport(state,{type:'decide',actor:'coordinator',recordId:'elena-food',outcome:'accepted',basis:'Current agreed training.'});
  const app=state.recruitment.applications.find(a=>a.id===id);assert.equal(onboardingSteps(state,app).find(s=>s.key==='food').portable,true);
  state=passport(state,{type:'revokeShare',grantId:state.passports.grants[0].id});assert.equal(onboardingSteps(state,app).find(s=>s.key==='food').done,false);
});
test('withdrawal preserves existing memberships and work and releases a reserved place',()=>{
  let {state,id}=apply(initial(),{personId:'alex',actor:'alex'});state=review(state,id).state;const original=structuredClone(state.people);const plans=structuredClone(state.commitments);
  state=act(state,{type:'withdraw',actor:'alex',applicationId:id,note:'Not enough time.'}).state;
  assert.deepEqual(state.people,original);assert.deepEqual(state.commitments,plans);assert.equal(occupiedPlaces(state,'food-team',day),0);
});
test('pausing and closing stop new submissions but preserve existing offers and applicant access',()=>{
  let {state,id}=apply(initial());state=review(state,id).state;state=act(state,{actor:'coordinator',type:'positionStatus',positionId:'food-team',status:'closed'}).state;
  assert.throws(()=>apply(state,{actor:'elena',personId:'elena'}),/not accepting/);assert.equal(visibleApplications(state,'robin').length,1);
  assert.equal(act(state,{type:'acceptOffer',applicationId:id}).state.recruitment.applications[0].status,'onboarding');
});
test('open events keep their direct signup path; paused, draft and expired postings cannot accept applications',()=>{
  assert.throws(()=>apply(initial(),{positionId:'try-garden'}),/not accepting/);
  for(const status of ['draft','paused','closed']){const state=initial();state.recruitment.positions[0].status=status;assert.throws(()=>apply(state),/not accepting/);}
  assert.equal(positionOpen({status:'open',deadline:'2026-09-22'},day),false);
});
test('role draft, publication and scoped organization editing are functional',()=>{
  const payload={type:'savePosition',actor:'coordinator',orgId:'tool-library',title:'Catalog helper',impact:'Easier borrowing.',tasks:'Update the catalog.',commitment:'One hour remotely.',experience:'No experience needed.',support:'Jordan helps.',mode:'Remote',pathway:'conversation',capacity:2,responseDays:5,requirements:['welcome'],question:'What interests you?'};
  let {state,id}=act(initial(),payload);assert.equal(state.recruitment.positions[0].status,'draft');assert.equal(positionOpen(state.recruitment.positions[0],day),false);
  state=act(state,{type:'positionStatus',actor:'coordinator',orgId:'tool-library',positionId:id,status:'open'}).state;assert.equal(positionOpen(state.recruitment.positions[0],day),true);
  assert.throws(()=>act(state,{...payload,positionId:id}),/Published roles/);
  assert.throws(()=>act(state,{type:'saveOrganization',actor:'robin',mission:'Overwrite'}),/workspace/);
});
