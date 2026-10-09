import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from './model.js';
import { ensureRecruitment } from './recruitment-model.js';
import { ensureStaff, transitionStaff } from './staff-model.js';
import { renderStaff, staffDialog } from './staff-view.js';

const initial=()=>ensureStaff(ensureRecruitment(createInitialState()));
const ctx=state=>({state,e:value=>String(value??''),icon:name=>`<i data-icon="${name}"></i>`,button:(label,action,attrs='',cls='')=>`<button class="${cls}" data-action="${action}" ${attrs}>${label}</button>`,avatar:person=>`<span>${person.name}</span>`,badge:(label,tone)=>`<span class="${tone}">${label}</span>`});

test('organization staff is separate from the volunteer roster and exposes role controls',()=>{
  const state=initial(),html=renderStaff(ctx(state));
  assert.match(html,/Organization Staff/);
  assert.match(html,/Invite Team Member/);
  assert.match(html,/Create Custom Role/);
  assert.match(html,/Maya Thompson/);
  assert.doesNotMatch(html,/Jules Okafor/);
});

test('coordinators can create a custom role and invite a staff member into it',()=>{
  let state=initial();
  let result=transitionStaff(state,{type:'saveRole',actor:'coordinator',name:'Volunteer Coordinator',description:'Coordinates people and preparation.',permissions:['volunteers','schedule']});
  state=result.state;
  const role=state.programWorkspace.staffRoles.find(item=>item.name==='Volunteer Coordinator');
  assert.deepEqual(role.permissions,['volunteers','schedule']);
  result=transitionStaff(state,{type:'inviteMember',actor:'coordinator',name:'Jordan Lee',email:'jordan@example.org',roleId:role.id});
  const member=result.state.programWorkspace.organizationMembers.find(item=>item.email==='jordan@example.org');
  assert.equal(member.status,'invited');
  assert.equal(member.active,false);
  assert.equal(member.role,'Volunteer Coordinator');
});

test('staff dialogs distinguish organization access from volunteer roles',()=>{
  const state=initial();
  const invite=staffDialog(ctx(state),'invite');
  const role=staffDialog(ctx(state),'role');
  assert.match(invite.content,/data-form="staffInvite"/);
  assert.match(invite.content,/separate from adding a volunteer/);
  assert.match(role.content,/data-form="staffRole"/);
  assert.match(role.content,/do not change volunteer positions/);
});
