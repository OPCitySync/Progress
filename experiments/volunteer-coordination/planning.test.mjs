import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,confirmedCount,transition} from './model.js';
import {planningActivities,planningMonday,planningDate,transitionPlanning} from './planning-model.js';
const date='2026-09-24';
const manualGarden=s=>{const next=structuredClone(s),activity=next.activities.find(item=>item.id==='garden');Object.assign(activity,{assignmentMode:'manual',visibility:'members',enrollment:'managed'});return next;};
const invite=(s,extra={})=>transitionPlanning(manualGarden(s),{actor:'coordinator',type:'invite',activityId:'garden',personId:'morgan',roleId:'garden',...extra},date).state;
test('planning shows all dates in chronological order',()=>{
 assert.equal(planningMonday('2026-09-26'),'2026-09-21');
 assert.equal(planningDate('2026-12-28',7),'2027-01-04');
 const s=createInitialState(),items=planningActivities(s,{mode:'programs'});
 assert(items.some(a=>a.id==='garden'));
 assert(items.every((a,i)=>i===0 || (items[i-1].date||'9999').localeCompare(a.date||'9999')<=0));
});
test('planning respects activity access instead of assigning into self-service activities',()=>{
 const publicState=createInitialState();
 assert.throws(()=>transitionPlanning(publicState,{actor:'coordinator',type:'invite',activityId:'garden',personId:'morgan',roleId:'garden'},date),/public activity/);
 assert.throws(()=>transitionPlanning(publicState,{actor:'coordinator',type:'invite',activityId:'pantry',personId:'jules',roleId:'packing'},date),/Roster members choose/);
});
test('program activities stay under Programs while general categories show standalone work',()=>{
 let s=createInitialState();const programId=s.activities.find(a=>a.id==='garden').programId;
 const base={type:'createActivity',title:'Garden check',description:'Check the beds',roleName:'Garden team',capacity:2,date:'2026-09-28',requires:[],visibility:'members',enrollment:'both',owner:'Sam',reviewer:'Maya',acceptance:'Checked and handed off'};
 for(const workType of ['event','shift'])for(const linked of [true,false])s=transition(s,{...base,workType,programId:linked?programId:'',occurrences:2,interval:7}).state;
 const program=planningActivities(s,{mode:'programs',programId});
 const oneTime=planningActivities(s,{mode:'events'}),recurring=planningActivities(s,{mode:'recurring'});
 assert(program.some(activity=>activity.type==='project'));
 assert(program.some(activity=>activity.title==='Garden check'&&activity.type==='event'));
 assert(program.some(activity=>activity.title==='Garden check'&&activity.type==='shift'));
 assert(oneTime.some(activity=>activity.title==='Garden check')&&oneTime.every(activity=>activity.type==='event'&&!activity.programId&&!activity.archived));
 assert(recurring.some(activity=>activity.title==='Garden check')&&recurring.every(activity=>activity.type==='shift'&&!activity.programId&&!activity.archived));
 const all=planningActivities(s,{mode:'programs'});assert.equal(all.length,new Set(all.map(activity=>activity.id)).size);
});
test('a planning invitation persists without increasing confirmed coverage',()=>{
 const s=createInitialState(),count=confirmedCount(s,'garden'),next=invite(s);assert.equal(confirmedCount(next,'garden'),count);
 assert.equal(next.commitments.find(c=>c.personId==='morgan'&&c.activityId==='garden').status,'proposed');
 assert(next.notifications.some(n=>n.personId==='morgan'&&n.activityId==='garden'));
 assert.equal(JSON.parse(JSON.stringify(next)).commitments.length,s.commitments.length+1);
 assert.equal(s.commitments.some(c=>c.personId==='morgan'&&c.activityId==='garden'),false);
});
test('planning rejects duplicate invitations, unknown roles, full roles, and non-coordinators',()=>{
 const s=createInitialState();assert.throws(()=>invite(invite(s)),/already/);assert.throws(()=>invite(s,{roleId:'missing'}),/Choose a role/);
 assert.throws(()=>invite(s,{actor:'morgan'}),/Only a coordinator/);
 const a=s.activities.find(a=>a.id==='garden');a.roles[0].capacity=confirmedCount(s,a.id,a.roles[0].id);assert.throws(()=>invite(s),/full/);
});
test('planning rechecks membership, inactive programs, completion, and past dates',()=>{
 for(const status of ['draft','complete']){const s=createInitialState(),a=s.activities.find(a=>a.id==='garden');s.programWorkspace.programs.find(p=>p.id===a.programId).status=status;assert.throws(()=>invite(s),/program/);}
 const s=createInitialState();s.people.find(p=>p.id==='morgan').relationship='paused';assert.throws(()=>invite(s),/resume/);
 const done=createInitialState();done.activities.find(a=>a.id==='garden').workStatus='Complete';assert.throws(()=>invite(done),/closed/);
 assert.throws(()=>transitionPlanning(manualGarden(createInitialState()),{actor:'coordinator',type:'invite',activityId:'garden',personId:'morgan',roleId:'garden'},'2026-09-28'),/passed/);
});
test('incomplete preparation can receive an invitation, but cannot bypass acceptance checks',()=>{
 const s=createInitialState(),p=s.people.find(p=>p.id==='morgan');p.requirements.waiver=false;const next=invite(s),c=next.commitments.find(c=>c.personId==='morgan'&&c.activityId==='garden');
 assert.throws(()=>transition(next,{type:'respond',commitmentId:c.id,accept:true}),/preparation/);
});
test('removing a place changes only that occurrence and tells the affected volunteer',()=>{
 const s=invite(createInitialState()),c=s.commitments.find(c=>c.personId==='morgan'&&c.activityId==='garden');
 const next=transitionPlanning(s,{actor:'coordinator',type:'remove',commitmentId:c.id,note:'This invitation was added in error.'},date).state;
 assert.equal(next.commitments.find(x=>x.id===c.id).status,'canceled');assert.deepEqual(next.commitments.filter(x=>x.id!==c.id),s.commitments.filter(x=>x.id!==c.id));
 assert(next.notifications.some(n=>n.personId==='morgan'&&n.text.includes('withdrew')));
 assert.throws(()=>transitionPlanning(next,{actor:'coordinator',type:'remove',commitmentId:c.id}),/no longer/);
});
test('confirmed removal updates coverage, preserves membership and preparation',()=>{
 const s=createInitialState(),c=s.commitments.find(c=>c.activityId==='pantry'&&c.status==='confirmed'),n=confirmedCount(s,'pantry');
 const next=transitionPlanning(s,{actor:'coordinator',type:'remove',commitmentId:c.id},date).state;
 assert.equal(confirmedCount(next,'pantry'),n-1);assert.deepEqual(next.people,s.people);assert.equal(next.commitments.find(x=>x.id===c.id).canceledBy,'coordinator');
});
