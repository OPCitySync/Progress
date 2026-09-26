import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, transition } from './model.js';
import { ensurePrograms, transitionProgram, programHealth, blockersFor, occurrenceDates } from './program-model.js';
const initial = () => createInitialState();
const garden = s => s.activities.find(a=>a.id==='garden');
const apply = (s,a) => transitionProgram(s,{actor:'coordinator',programId:garden(s).programId,...a}).state;
const action = (activityId,status,note='Verified against the brief') => ({type:'workStatus',activityId,status,note});
const creation = s => ({type:'createActivity',title:'Weekly care',description:'Care for beds',roleName:'Gardeners',capacity:3,workType:'shift',date:'2026-09-27',programId:garden(s).programId,occurrences:3,interval:7,requires:[],visibility:'members',enrollment:'both',owner:'Sam',reviewer:'Maya',acceptance:'Beds watered'});

test('migration is additive, idempotent, archives retired types, and retains commitments',()=>{
 const s=initial();delete s.programWorkspace;
 s.activities=s.activities.filter(a=>a.id!=='garden-irrigation');
 s.activities.push({id:'legacy-pool',type:'standby'});s.commitments.push({id:'old',activityId:'legacy-pool',personId:'alex',status:'confirmed'});
 const before=structuredClone(s.commitments);ensurePrograms(s);
 const snapshot=structuredClone(s);ensurePrograms(s);assert.deepEqual(s,snapshot);assert.deepEqual(s.commitments,before);assert.equal(s.activities.find(a=>a.id==='legacy-pool').archived,true);
 assert.throws(()=>transition(s,{type:'commit',activityId:'legacy-pool',personId:'alex',roleId:'none',status:'confirmed'}));
});
test('seed exposes only three active activity types and links every task to a program',()=>{
 const s=initial();assert.deepEqual([...new Set(s.activities.filter(a=>!a.archived).map(a=>a.type))].sort(),['event','project','shift']);assert.ok(s.activities.filter(a=>a.type==='project').every(a=>a.programId));
});
test('a blocked activity cannot start until its prerequisite is accepted',()=>{
 let s=initial();assert.equal(blockersFor(s,garden(s)).length,1);
 assert.throws(()=>apply(s,action('garden','In progress')),/prerequisites/);
 for(const status of ['In progress','Ready for review','Complete'])s=apply(s,action('garden-irrigation',status));
 assert.equal(blockersFor(s,garden(s)).length,0);s=apply(s,action('garden','In progress'));assert.equal(garden(s).workStatus,'In progress');
});
test('submitting requires evidence and completion requires coordinator review',()=>{
 let s=initial();s=apply(s,action('garden-irrigation','In progress'));
 assert.throws(()=>apply(s,action('garden-irrigation','Complete')),/sequence/);
 assert.throws(()=>apply(s,action('garden-irrigation','Ready for review','')),/evidence/);
 s=apply(s,action('garden-irrigation','Ready for review'));
 assert.throws(()=>apply(s,{...action('garden-irrigation','Complete'),actor:'robin'}),/confirmed/);
 assert.throws(()=>apply(s,action('garden-irrigation','Complete','')),/review decision/);
});
test('confirmed contributors can submit but cannot approve their own work',()=>{
 let s=initial(), p=s.activities.find(a=>a.id==='website').programId;
 s=apply(s,{...action('website','Ready for review','Guide draft ready'),programId:p,actor:'jules'});
 assert.throws(()=>apply(s,{...action('website','Complete'),programId:p,actor:'jules'}),/coordinator/);
 assert.equal(s.activities.find(a=>a.id==='website').evidence,'Guide draft ready');
});
test('cycles, self dependencies, and cross-program prerequisites are rejected',()=>{
 const s=initial();const a=s.activities.find(a=>a.id==='garden-irrigation');const plan={type:'plan',activityId:a.id,owner:a.owner,acceptance:a.acceptance,reviewer:a.reviewer,date:a.date};
 for(const dependencies of [['garden'],[a.id],['pantry']])assert.throws(()=>apply(s,{...plan,dependencies}),/circular|belong/);
 assert.equal(a.dependencies.length,0);
});
test('reopening a prerequisite is blocked after dependent work starts',()=>{
 let s=initial();for(const status of ['In progress','Ready for review','Complete'])s=apply(s,action('garden-irrigation',status));s=apply(s,action('garden','In progress'));
 assert.throws(()=>apply(s,action('garden-irrigation','In progress')),/Downstream/);
});
test('external blockers prevent progress and clearing them preserves commitments',()=>{
 let s=initial();const a=s.activities.find(a=>a.id==='garden-irrigation');const plan={type:'plan',activityId:a.id,owner:a.owner,reviewer:a.reviewer,acceptance:a.acceptance,date:a.date,dependencies:[]};
 s=apply(s,{...plan,blocker:'Need the replacement part'});assert.throws(()=>apply(s,action(a.id,'In progress')),/blockers/);
 const before=structuredClone(s.commitments);s=apply(s,{...plan,blocker:''});s=apply(s,action(a.id,'In progress'));assert.deepEqual(s.commitments,before);
});
test('recurrence creates separate dated rosters without copying commitments',()=>{
 const before=initial(), s=transition(before,creation(before)).state, added=s.activities.slice(before.activities.length);
 assert.deepEqual(added.map(a=>a.date),['2026-09-27','2026-10-04','2026-10-11']);assert.equal(new Set(added.map(a=>a.seriesId)).size,1);assert.equal(new Set(added.map(a=>a.id)).size,3);assert.deepEqual(s.commitments,before.commitments);
});
test('recurrence rejects overflow beyond program dates and invalid counts',()=>{
 const s=initial();assert.throws(()=>transition(s,{...creation(s),occurrences:12}),/program dates/);
 for(const n of [0,13,1.5])assert.throws(()=>occurrenceDates('2026-09-23',n,7),/occurrences/);
 assert.throws(()=>occurrenceDates('2026-02-30',3,7));
});
test('tasks require program, deliverable, reviewer, and supported type',()=>{
 const s=initial();for(const change of [{workType:'standby'},{workType:'ongoing'},{workType:'project',programId:''},{workType:'project',acceptance:''},{workType:'project',reviewer:''}])assert.throws(()=>transition(s,{...creation(s),...change}));
});
test('handoff cannot bypass completion review',()=>{
 const s=initial();assert.throws(()=>transition(s,{type:'handoff',activityId:'website',progress:'Ready',next:'Done',owner:'Jules',projectStatus:'Complete'}),/work plan/);
});
test('program completion requires all accepted work and an outcome review',()=>{
 let s=initial();assert.throws(()=>apply(s,{type:'programStatus',status:'complete',note:'Good'}),/Complete the work/);
 for(const id of ['garden-irrigation','garden'])for(const status of ['In progress','Ready for review','Complete'])s=apply(s,action(id,status));
 assert.throws(()=>apply(s,{type:'programStatus',status:'complete',note:''}),/outcome review/);
 s=apply(s,{type:'programStatus',status:'complete',note:'Four beds planted and watered; care guide handed over.'});
 assert.equal(s.programWorkspace.programs.find(p=>p.id===garden(s).programId).status,'complete');
 assert.throws(()=>transition(s,creation(s)),/complete/);
});
test('draft program requires a complete brief, remains private, and cannot start work',()=>{
 let s=initial();const data={type:'saveProgram',actor:'coordinator',name:'Fall pilot',purpose:'Help neighbors',scope:'One neighborhood',excluded:'Other areas',success:'10 households receive food',lead:'Maya',start:'2026-09-23',end:'2026-10-31'};
 assert.throws(()=>transitionProgram(s,{...data,scope:''}),/Define/);
 const r=transitionProgram(s,data);s=r.state;const p=s.programWorkspace.programs.find(p=>p.id===r.id);assert.equal(p.status,'draft');
 s=transition(s,{...creation(s),workType:'event',programId:p.id}).state;
 assert.throws(()=>apply(s,{...action(s.activities.at(-1).id,'In progress'),programId:p.id}),/Activate/);
 assert.throws(()=>transition(s,{type:'commit',activityId:s.activities.at(-1).id,roleId:s.activities.at(-1).roles[0].id,personId:'alex',status:'confirmed'}),/Activate/);
});
test('only coordinators change program scope, dependencies, and resources',()=>{
 const s=initial();for(const type of ['saveProgram','plan','resource','update','programStatus'])assert.throws(()=>apply(s,{type,actor:'alex',activityId:'garden'}),/coordinator/);
});
test('health is derived and completion is separate from outcome reporting',()=>{
 const s=initial(), p=s.programWorkspace.programs.find(p=>p.id===garden(s).programId),h=programHealth(s,p,'2026-09-26');assert.equal(h.blocked.length,1);assert.equal(h.overdue.length,1);assert.equal(h.complete,0);assert.equal(h.total,2);
});

test('draft or retired activities cannot be shared into MyCity Feed',async()=>{
 const {transitionFeed,feedActor}=await import('./feed-model.js');
 const s=initial();s.programWorkspace.programs.find(p=>p.id===garden(s).programId).status='draft';
 assert.throws(()=>transitionFeed(s,{type:'publish',actor:feedActor('coordinator','alex'),activityId:'garden',body:'Come along'}),/Only public/);
 s.programWorkspace.programs.find(p=>p.id===garden(s).programId).status='active';garden(s).archived=true;
 assert.throws(()=>transitionFeed(s,{type:'publish',actor:feedActor('coordinator','alex'),activityId:'garden',body:'Come along'}),/Only public/);
});
test('in-review criteria cannot change and reopening removes current acceptance',()=>{
 let s=initial();for(const status of ['In progress','Ready for review'])s=apply(s,action('garden-irrigation',status));
 assert.throws(()=>apply(s,{type:'plan',activityId:'garden-irrigation'}),/Return this work/);
 s=apply(s,action('garden-irrigation','Complete'));s=apply(s,action('garden-irrigation','In progress','A leak returned; repair again'));
 assert.equal(s.activities.find(a=>a.id==='garden-irrigation').review,undefined);assert.equal(blockersFor(s,garden(s)).length,1);
 assert.ok(s.programWorkspace.history.some(h=>h.text.endsWith('Complete')));
});
