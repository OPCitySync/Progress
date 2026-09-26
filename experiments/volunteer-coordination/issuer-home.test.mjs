import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, transition } from './model.js';
import { ensureRecruitment, HOME_ORG } from './recruitment-model.js';
import { ensureIssuerHome, homeQueue, calendarRange, moveCalendar, calendarEntries, entriesOnDay, transitionIssuerHome } from './issuer-home-model.js';
const initial=()=>ensureIssuerHome(ensureRecruitment(createInitialState()));
const apply=(state,action)=>transitionIssuerHome(state,{actor:'coordinator',...action},'2026-09-26').state;

test('overview migration preserves work and existing acknowledgements and notes',()=>{
  const s=initial(),activities=structuredClone(s.activities);
  s.issuerHome.notes.push({id:'existing'});ensureIssuerHome(s);
  assert.deepEqual(s.activities,activities);assert.equal(s.issuerHome.notes.length,1);
});
test('action acknowledgement is reversible, persisted, and never completes underlying work',()=>{
  const s=initial(),item=homeQueue(s,'2026-09-26').find(x=>x.key.startsWith('staffing:garden:'));
  const next=apply(s,{type:'acknowledge',key:item.key});
  assert.deepEqual(next.activities,s.activities);assert.deepEqual(next.commitments,s.commitments);
  assert.equal(s.issuerHome.acknowledgements.length,0);
  const reloaded=JSON.parse(JSON.stringify(next));assert.ok(!homeQueue(reloaded,'2026-09-26').some(x=>x.key===item.key));
  assert.ok(homeQueue(apply(reloaded,{type:'restore',key:item.key}),'2026-09-26').some(x=>x.key===item.key));
  assert.throws(()=>apply(next,{type:'acknowledge',key:item.key}),/changed|acknowledged/);
});
test('staffing need resurfaces when confirmed coverage changes; invitations alone do not fill places',()=>{
  const s=initial(),item=homeQueue(s,'2026-09-26').find(x=>x.key.startsWith('staffing:garden:'));
  let next=apply(s,{type:'acknowledge',key:item.key});
  next=transition(next,{type:'commit',actor:'coordinator',personId:'morgan',activityId:'garden',roleId:'garden',status:'proposed'}).state;
  assert.ok(!homeQueue(next,'2026-09-26').some(x=>x.key.startsWith('staffing:garden:')));
  next.commitments.find(c=>c.activityId==='garden'&&c.personId==='morgan').status='confirmed';
  assert.ok(homeQueue(next,'2026-09-26').some(x=>x.key.startsWith('staffing:garden:')&&x.key!==item.key));
});
test('queue excludes other organization applications, drafts, archived and completed work',()=>{
  const s=initial();s.recruitment.applications=[{id:'ours',personId:'robin',orgId:HOME_ORG,submittedAt:'2026-09-24',status:'submitted',position:{title:'Garden helper'}},{id:'theirs',personId:'robin',orgId:'other-org',submittedAt:'2026-09-24',status:'submitted',position:{title:'Private application'}}];
  s.activities.find(a=>a.id==='garden').workStatus='Complete';
  s.activities.find(a=>a.id==='pantry').archived=true;
  const q=homeQueue(s,'2026-09-26');assert.ok(q.some(x=>x.key.startsWith('application:ours:')));assert.ok(!q.some(x=>x.key.includes('theirs')||x.key.startsWith('staffing:garden:')||x.key.startsWith('staffing:pantry:')));
  s.programWorkspace.programs.forEach(p=>p.status='draft');assert.ok(!homeQueue(s,'2026-09-26').some(x=>['staffing','review'].includes(x.kind)));
});
test('month and week boundaries stay aligned through leap years and year changes',()=>{
  const feb=calendarRange('2028-02-29');assert.equal(feb.start,'2028-02-01');assert.equal(feb.end,'2028-03-01');assert.ok(feb.days.includes('2028-02-29'));assert.equal(feb.days.length%7,0);
  assert.deepEqual(calendarRange('2027-01-01','week').days,['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
  assert.equal(moveCalendar('2026-12-31','month',1),'2027-01-01');assert.equal(moveCalendar('2026-09-26','week',-1),'2026-09-19');
});
test('past sessions surface attendance review until their work is complete',()=>{
  const s=initial(),a=s.activities.find(a=>a.id==='pantry');a.date='2026-09-25';
  assert.ok(homeQueue(s,'2026-09-26').some(x=>x.key.startsWith('attendance:pantry:')));
  assert.ok(!homeQueue(s,'2026-09-26').some(x=>x.key.startsWith('staffing:pantry:')));
  a.workStatus='Complete';assert.ok(!homeQueue(s,'2026-09-26').some(x=>x.key.startsWith('attendance:pantry:')));
});
test('calendar notes span days without booking volunteers and exclude a midnight end day',()=>{
  const s=initial(),next=apply(s,{type:'saveNote',title:'Planning retreat',start:'2026-09-30T09:00',end:'2026-10-02T00:00',tone:'sage'});
  assert.deepEqual(next.commitments,s.commitments);assert.deepEqual(next.activities,s.activities);
  const entries=calendarEntries(next);assert.ok(entriesOnDay(entries,'2026-10-01').some(x=>x.title==='Planning retreat'));assert.ok(!entriesOnDay(entries,'2026-10-02').some(x=>x.title==='Planning retreat'));
  const id=next.issuerHome.notes[0].id,edited=apply(next,{type:'saveNote',id,title:'Team planning',start:'2026-10-01T10:00',end:'2026-10-01T11:00',tone:'lilac'});
  assert.equal(edited.issuerHome.notes.length,1);assert.equal(edited.issuerHome.notes[0].title,'Team planning');
});
test('note validation and coordinator-only mutations reject invalid or stale actions',()=>{
  const s=initial(),action={type:'saveNote',title:'Meeting',start:'2026-09-26T10:00',end:'2026-09-26T11:00',tone:'sage'};
  for(const override of [{start:'2026-02-30T10:00'},{end:action.start},{title:' '},{tone:'unknown'},{id:'missing'}]) assert.throws(()=>apply(s,{...action,...override}));
  assert.throws(()=>transitionIssuerHome(s,{...action,actor:'volunteer'}),/coordinator/);
  assert.throws(()=>apply(s,{type:'restore',key:'missing'}),/history/);
});
