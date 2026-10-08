import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, transition } from './model.js';
import { ensurePrograms } from './program-model.js';
import { ensureDocuments } from './documents-model.js';
import { ensureRecruitment, transitionRecruitment, visibleApplications, onboardingSteps, occupiedPlaces, myApplication, positionOpen, volunteerRequirements } from './recruitment-model.js';
import { transitionPassport, sharedPassport, publicVolunteerPassport, passportExport } from './passport-model.js';
import { recruitmentDialog, renderRecruitment } from './recruitment-view.js';
import { homeQueue } from './issuer-home-model.js';
import { participantQueueItems } from './feed-model.js';

const day='2026-09-23';
const initial=()=>ensureDocuments(ensureRecruitment(createInitialState()));
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
  for(const key of ['welcome','waiver','food'])state=act(state,{type:'completeStep',applicationId:id,key,note:'Reviewed the preparation with the team.',...(key==='waiver'?{signerName:'Robin Ellis',documentAccepted:true}:{})}).state;
  state=act(state,{type:'completeStep',actor:'coordinator',applicationId:id,key:'orientation',note:'Introduced and discussed support.',buddy:'Sam',firstStep:'Choose a kitchen shift together.'}).state;
  state=act(state,{type:'activate',actor:'coordinator',applicationId:id}).state;
  assert.equal(state.people.find(p=>p.id==='robin').relationship,'member');assert.equal(state.recruitment.memberships.length,1);assert.equal(state.commitments.some(c=>c.personId==='robin'),false);
  assert.throws(()=>act(state,{type:'activate',actor:'coordinator',applicationId:id}),/accept the role/);
});
test('other organization onboarding never modifies Berkeley preparation or roster',()=>{
  let {state,id}=onboarding('library-welcome','tool-library');const original=structuredClone(state.people.find(p=>p.id==='robin'));
  for(const key of ['welcome','waiver'])state=act(state,{type:'completeStep',applicationId:id,key,note:'Reviewed local welcome.',...(key==='waiver'?{signerName:'Robin Ellis',documentAccepted:true}:{})}).state;
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
test('organizations define reusable role requirements while submitted applications keep their original checklist',()=>{
  const start=initial();
  assert.ok(volunteerRequirements(start,'berkeley-neighbors').some(requirement=>requirement.title==='Role Introduction'));
  assert.throws(()=>act(start,{type:'saveRequirement',title:'Safeguarding briefing',detail:'Review reporting and support.',owner:'coordinator',positionIds:['food-team']}),/workspace/);
  let result=act(start,{type:'saveRequirement',actor:'coordinator',title:'Safeguarding briefing',detail:'Review reporting and support.',owner:'coordinator',positionIds:['food-team']});
  const requirement=volunteerRequirements(result.state,'berkeley-neighbors').find(item=>item.title==='Safeguarding briefing');
  assert.ok(requirement);assert.ok(result.state.recruitment.positions.find(position=>position.id==='food-team').requirements.includes(requirement.id));
  const submitted=apply(result.state);const application=submitted.state.recruitment.applications.find(item=>item.id===submitted.id);
  assert.equal(application.position.requirementDefinitions.find(item=>item.id===requirement.id).detail,'Review reporting and support.');
  result=act(submitted.state,{type:'saveRequirement',actor:'coordinator',requirementId:requirement.id,title:'Safeguarding & support',detail:'Updated instructions for future applicants.',owner:'volunteer',positionIds:[]});
  assert.equal(result.state.recruitment.positions.find(position=>position.id==='food-team').requirements.includes(requirement.id),false);
  assert.equal(result.state.recruitment.applications.find(item=>item.id===submitted.id).position.requirementDefinitions.find(item=>item.id===requirement.id).title,'Safeguarding briefing');
});
test('every organization gets a permanent welcome requirement and a general volunteer role',()=>{
  const start=initial();
  for(const organization of start.recruitment.organizations) {
    const welcome=volunteerRequirements(start,organization.id).find(requirement=>requirement.id==='welcome');
    const general=start.recruitment.positions.find(position=>position.orgId===organization.id&&position.title==='General Volunteer');
    assert.ok(welcome);assert.equal(welcome.completionType,'welcome');assert.ok(general);assert.ok(general.requirements.includes('welcome'));
  }
  assert.ok(start.recruitment.positions.every(position=>position.requirements.includes('welcome')));
  assert.equal(start.recruitment.organizations.find(organization=>organization.id==='berkeley-neighbors').welcomeMessageCreated,false);
  const result=act(start,{type:'saveWelcome',actor:'coordinator',welcome:'Welcome. Here is how to get help and what to expect.'});
  const organization=result.state.recruitment.organizations.find(item=>item.id==='berkeley-neighbors');
  assert.equal(organization.welcomeMessageCreated,true);assert.match(organization.welcome,/how to get help/);
  assert.throws(()=>act(result.state,{type:'saveRequirement',actor:'coordinator',requirementId:'welcome',title:'Changed',detail:'Changed',completionType:'read',positionIds:[]}),/permanent requirement/);
});
test('requirements can use organization documents for reading, signature, provision, or review',()=>{
  const start=ensureDocuments(initial());
  const document=start.documentLibrary.items.find(item=>item.id==='sample-liability-waiver');
  let result=act(start,{type:'saveRequirement',actor:'coordinator',title:'Consent and waiver',detail:'Read and sign before your first activity.',completionType:'sign',documentId:document.id,positionIds:['general-volunteer']});
  const requirement=volunteerRequirements(result.state,'berkeley-neighbors').find(item=>item.title==='Consent and waiver');
  assert.equal(requirement.owner,'volunteer');assert.equal(requirement.documentId,document.id);assert.equal(requirement.completionType,'sign');
  assert.ok(result.state.recruitment.positions.find(position=>position.id==='general-volunteer').requirements.includes(requirement.id));
  assert.throws(()=>act(start,{type:'saveRequirement',actor:'coordinator',title:'Unsigned form',detail:'Please sign.',completionType:'sign',positionIds:[]}),/Choose the document/);
  result=act(result.state,{type:'saveRequirement',actor:'coordinator',requirementId:requirement.id,title:'Coordinator review',detail:'A coordinator confirms the conversation.',completionType:'organization',documentId:'',positionIds:[]});
  assert.equal(volunteerRequirements(result.state,'berkeley-neighbors').find(item=>item.id===requirement.id).owner,'coordinator');
  const ctx={state:start,ui:{recruitOrg:'berkeley-neighbors'},e:value=>String(value??''),button:text=>text,errorOutput:()=>'',currentPerson:()=>start.people.find(person=>person.id==='robin')};
  const dialog=recruitmentDialog(ctx,'Requirement');
  for(const text of ['Read or view information','Acknowledge or sign a document','Provide information or a file','Organization confirms completion','Volunteer liability waiver'])assert.ok(dialog.content.includes(text));
});
test('external background screening coordinates provider work without storing or sharing the report',()=>{
  let result=act(initial(),{type:'saveRequirement',actor:'coordinator',title:'Role background screening',detail:'Complete the external screening after accepting the role.',completionType:'screening',screeningProvider:'checkr',startMethod:'organization-invite',volunteerUrl:'',organizationUrl:'https://dashboard.checkr.com/',payer:'organization',validMonths:24,positionIds:['food-team']});
  const requirement=volunteerRequirements(result.state,'berkeley-neighbors').find(item=>item.title==='Role background screening');
  assert.equal(requirement.owner,'shared');assert.equal(requirement.providerName,'Checkr');assert.equal(requirement.documentId,'');
  let application=apply(result.state);let state=review(application.state,application.id).state;state=act(state,{type:'acceptOffer',applicationId:application.id}).state;
  let step=onboardingSteps(state,state.recruitment.applications.find(item=>item.id===application.id)).find(item=>item.key===requirement.id);
  assert.equal(step.phase,'not-started');assert.equal(step.owner,'coordinator');
  assert.match(homeQueue(state,day).find(item=>item.key.startsWith(`screening:${application.id}:`)).title,/Start Role background screening/);
  assert.throws(()=>act(state,{type:'screeningDeclare',applicationId:application.id,key:requirement.id,completionConfirmed:true}),/Wait for the organization/);
  state=act(state,{type:'screeningInvite',actor:'coordinator',applicationId:application.id,key:requirement.id,candidateUrl:'https://candidate.checkr.com/invite/abc',invitationSent:true,note:'Use the secure provider link.'}).state;
  step=onboardingSteps(state,state.recruitment.applications.find(item=>item.id===application.id)).find(item=>item.key===requirement.id);assert.equal(step.owner,'volunteer');assert.equal(step.phase,'awaiting-volunteer');
  assert.equal(participantQueueItems(state,'robin').find(item=>item.key.startsWith(`screening:${application.id}:`)).label,'Open provider steps');
  state=act(state,{type:'screeningDeclare',applicationId:application.id,key:requirement.id,completionConfirmed:true,note:'Completed with the provider.'}).state;
  step=onboardingSteps(state,state.recruitment.applications.find(item=>item.id===application.id)).find(item=>item.key===requirement.id);assert.equal(step.owner,'coordinator');assert.equal(step.phase,'awaiting-verification');
  assert.equal(homeQueue(state,day).find(item=>item.key.startsWith(`screening:${application.id}:`)).label,'Review screening');
  assert.throws(()=>act(state,{type:'screeningVerify',applicationId:application.id,key:requirement.id,providerReviewed:true,note:'Self-approved.'}),/workspace/);
  state=act(state,{type:'screeningVerify',actor:'coordinator',applicationId:application.id,key:requirement.id,providerReviewed:true,note:'Meets the role policy.',expiresAt:'2028-09-23'}).state;
  step=onboardingSteps(state,state.recruitment.applications.find(item=>item.id===application.id)).find(item=>item.key===requirement.id);assert.equal(step.done,true);assert.equal(step.phase,'satisfied');
  const privateCredential=state.passports.screeningCredentials.find(item=>item.requirementId===requirement.id);assert.equal(privateCredential.personId,'robin');assert.equal(privateCredential.private,true);
  assert.equal(JSON.stringify(publicVolunteerPassport(state,'robin')||{}).includes(requirement.title),false);
  state.passports.profiles.robin.openForVolunteering=true;
  state=transitionPassport(state,{type:'share',personId:'robin',actor:'robin',orgId:'berkeley-neighbors',sections:['about'],recordIds:[],purpose:'Role review',expires:'2026-10-23'},day).state;
  assert.equal(JSON.stringify(sharedPassport(state,'robin','berkeley-neighbors',day)).includes(requirement.title),false);
  assert.equal(passportExport(state,'robin').privateScreeningCredentials.some(item=>item.requirementId===requirement.id),true);
  assert.equal(JSON.stringify(state).includes('SSN'),false);assert.equal(JSON.stringify(state).includes('background report'),false);
});
test('the Volunteer Requirement editor exposes the manual external screening configuration',()=>{
  const state=initial();const ctx={state,ui:{recruitOrg:'berkeley-neighbors'},e:value=>String(value??''),button:text=>text,errorOutput:()=>'',currentPerson:()=>state.people.find(person=>person.id==='robin')};
  const dialog=recruitmentDialog(ctx,'Requirement');
  for(const text of ['External background screening','Screening provider','How screening begins','Who pays the provider?','Organization review portal','Keep sensitive data with the provider'])assert.match(dialog.content,new RegExp(text.replace(/[?]/g,'\\?')));
  assert.doesNotMatch(dialog.content,/upload.+background report/i);
});
test('onboarding signatures bind the volunteer to the current document version',()=>{
  let {state,id}=onboarding();
  assert.throws(()=>act(state,{type:'completeStep',applicationId:id,key:'waiver',note:'Signed.'}),/type your full name/);
  state=act(state,{type:'completeStep',applicationId:id,key:'waiver',note:'Electronically signed.',signerName:'Robin Ellis',documentAccepted:true}).state;
  const application=state.recruitment.applications.find(item=>item.id===id);
  const signature=application.completed.waiver.signature;
  assert.equal(signature.documentId,'sample-liability-waiver');
  assert.equal(onboardingSteps(state,application).find(step=>step.key==='waiver').done,true);
  state.documentLibrary.items.find(item=>item.id===signature.documentId).updatedAt='2026-09-24';
  assert.equal(onboardingSteps(state,application).find(step=>step.key==='waiver').done,false);
});
test('application management separates Passport, public, and invite-link pathways',()=>{
  let start=initial();start.passports.profiles.robin.openForVolunteering=true;
  start=act(start,{type:'inviteToPosition',actor:'coordinator',personId:'robin',positionId:'food-team',message:'Your experience may fit this role.'}).state;
  let result=apply(start);
  const passportApplication=result.state.recruitment.applications.find(application=>application.id===result.id);
  assert.equal(passportApplication.source,'passport-invite');assert.equal(result.state.recruitment.invitations[0].status,'applied');
  result=act(result.state,{type:'startInviteLink',actor:'elena',personId:'elena'});
  const linkApplication=result.state.recruitment.applications.find(application=>application.id===result.id);
  assert.equal(linkApplication.source,'invite-link');assert.equal(linkApplication.position.title,'General Volunteer');assert.equal(linkApplication.status,'submitted');
  assert.equal(result.state.people.find(person=>person.id==='elena').relationship,'joining');
  const reviewed=act(result.state,{type:'review',actor:'coordinator',applicationId:linkApplication.id,status:'reviewing',note:'Let us discuss the best role.'}).state;
  assert.equal(reviewed.recruitment.applications.find(application=>application.id===linkApplication.id).status,'reviewing');
  const ctx={state:reviewed,ui:{page:'recruitment',mode:'coordinator',recruitOrg:'berkeley-neighbors',recruitmentTab:'applications'},e:value=>String(value??''),button:text=>text,badge:text=>text,icon:()=>''};
  const page=renderRecruitment(ctx);
  for(const title of ['Passport Invitations & Interest','Public Applications & Interest','Volunteer Invite Links'])assert.ok(page.includes(title));
  assert.equal(page.includes('recruitment-stage-flow'),false);
});
test('Passport outreach can invite a role, invite a public activity, or begin only a conversation',()=>{
  let state=ensureDocuments(initial());state.passports.profiles.robin.openForVolunteering=true;
  state=act(state,{type:'inviteToActivity',actor:'coordinator',personId:'robin',activityId:'garden',message:'Would you like to join this garden day?'}).state;
  const activityInvitation=state.recruitment.invitations.find(invitation=>invitation.kind==='activity');
  const commitment=state.commitments.find(item=>item.id===activityInvitation.commitmentId);
  assert.equal(commitment.status,'proposed');assert.equal(state.people.find(person=>person.id==='robin').relationship,'interested');
  state=transition(state,{type:'requirement',personId:'robin',key:'welcome',actor:'volunteer'}).state;
  state=transition(state,{type:'respond',commitmentId:commitment.id,accept:true,signerName:'Robin Ellis',waiverAccepted:true}).state;
  assert.equal(state.commitments.find(item=>item.id===commitment.id).status,'confirmed');
  assert.equal(state.recruitment.invitations.find(invitation=>invitation.id===activityInvitation.id).status,'accepted');
  state=act(state,{type:'startPassportConversation',actor:'coordinator',personId:'robin',message:'Your neighborhood experience caught our attention. Would you like to talk?'}).state;
  const conversation=state.recruitment.invitations.find(invitation=>invitation.kind==='conversation');
  assert.equal(conversation.status,'contacted');
  assert.equal(state.communications.outbound[0].audienceType,'outreach');
  assert.equal(state.commitments.filter(item=>item.personId==='robin').length,1);
  assert.equal(state.recruitment.applications.filter(item=>item.personId==='robin').length,0);
});
test('volunteer applications and commitments share one My Volunteering page',()=>{
  const state=initial();
  const ctx={state,ui:{page:'applications',mode:'volunteer',person:'alex',recruitOrg:'berkeley-neighbors'},e:value=>String(value??''),button:(text,action)=>`<button data-action="${action}">${text}</button>`,badge:text=>text,dateLabel:value=>value,icon:()=>''};
  const page=renderRecruitment(ctx);
  for(const title of ['My Volunteering','Keep applications, invitations, and the plans you have accepted in one place.','Commitments','Applications &amp; Role Invitations'])assert.ok(page.includes(title));
  assert.match(page,/<section class="recruit-hero volunteer-opportunities-hero">/);
  assert.equal(page.includes('recruit-hero-orbit'),false);
  assert.equal(page.includes('Share Availability'),false);
  assert.equal(page.includes('Discover Organizations'),false);
  assert.ok(page.includes('Saturday food distribution'));
});
test('participant discovery opens with a city-specific impact pathway and no extra page heading',()=>{
  const state=initial();
  const ctx={state,ui:{page:'discover',mode:'volunteer',person:'alex',discoveryQuery:'',discoveryCause:'all',discoverySaved:false},platformContext:{cityName:'Berkeley'},e:value=>String(value??''),button:(text,action,attrs='',className='btn')=>`<button class="${className}" data-action="${action}" ${attrs}>${text}</button>`,icon:()=>''};
  const page=renderRecruitment(ctx);
  for(const text of ['DISCOVER ORGANIZATIONS IN BERKELEY','Help Local Organizations make an Impact.','01 · Discover Local Organizations','02 · View Local Impact','03 · Signal Interest','04 · Apply','05 · Contribute'])assert.ok(page.includes(text));
  for(const removed of ['Find your people','My Volunteering','You don’t need to arrive','Meet an organization. Try an open event.'])assert.equal(page.includes(removed),false);
  assert.match(page,/<section class="recruit-hero recruit-hero-participant">[\s\S]*<h1>Help Local Organizations make an Impact\.<\/h1>/);
  assert.equal(page.includes('recruit-hero-orbit'),false);
});
test('program role creation uses the short role form and supplies recruitment defaults',()=>{
  const state=initial();const program=state.programWorkspace.programs.find(p=>p.name==='Neighborhood food access');
  const ctx={state,ui:{recruitOrg:'berkeley-neighbors'},e:v=>String(v??''),button:(text)=>text,errorOutput:()=>'',currentPerson:()=>state.people.find(p=>p.id==='robin')};
  const dialog=recruitmentDialog(ctx,'Role',{program:program.id});
  assert.equal(dialog.title,'Create Program Role');
  for(const text of ['The difference this role makes','Time, duration and flexibility','Experience needed / what can be learned','Support, equipment and access options','Application pathway','New volunteer places','Initial reply target','Preparation after an accepted offer','Suggested first activity']) assert.equal(dialog.content.includes(text),false);
  const result=act(state,{type:'savePosition',actor:'coordinator',orgId:'berkeley-neighbors',programId:program.id,title:'Garden welcome role',tasks:'Welcome volunteers to the garden.',mode:'Remote'});
  const role=result.state.recruitment.positions.find(position=>position.id===result.id);
  assert.equal(role.programId,program.id);assert.equal(role.capacity,1);assert.equal(role.pathway,'application');assert.deepEqual(role.requirements,['welcome']);
});
test('program roles are saved in the volunteer recruitment workspace and linked to one program',()=>{
  const start=ensurePrograms(initial());
  const program=start.programWorkspace.programs.find(p=>p.name==='Neighborhood food access');
  const payload={type:'savePosition',actor:'coordinator',orgId:'berkeley-neighbors',programId:program.id,title:'Program welcome volunteer',impact:'Help neighbors join the program.',tasks:'Welcome new volunteers.',commitment:'One hour a week.',experience:'Learn with the team.',support:'A buddy helps.',mode:'In person',pathway:'application',capacity:2,responseDays:5,requirements:['welcome'],activityId:'meals'};
  assert.throws(()=>act(start,{...payload,programId:'missing'}),/Choose an active or draft program/);
  assert.throws(()=>act(start,{...payload,activityId:'garden'}),/activity in this program/);
  const {state,id}=act(start,payload);
  assert.equal(state.recruitment.positions.find(position=>position.id===id).programId,program.id);
  assert.equal(state.programWorkspace.history[0].programId,program.id);
  const published=act(state,{type:'positionStatus',actor:'coordinator',positionId:id,status:'open'}).state;
  assert.equal(published.recruitment.positions.find(position=>position.id===id).status,'open');
  assert.match(published.programWorkspace.history[0].text,/published/);
});
