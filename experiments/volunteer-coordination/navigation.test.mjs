import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from './model.js';
import { ensureRecruitment } from './recruitment-model.js';
import { issuerNavigation, volunteerNavigation } from './navigation-view.js';
import { renderAccountSettings, renderConnectedSettings, renderReports } from './connected-settings.js';

const e=value=>String(value??'');
const icon=name=>`<i data-icon="${name}"></i>`;
const button=(label,action,attrs='',cls='')=>`<button class="${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const base=(mode='coordinator')=>{
  const state=ensureRecruitment(createInitialState());
  return {state,ui:{mode,page:'home'},e,icon,button,avatar:person=>`<span>${person.name}</span>`,currentPerson:()=>state.people[0],contextOrg:state.recruitment.organizations[0],coordinatorName:'Maya Thompson',assetBase:'/mycity',integratedPlatform:true,connectedPlatform:true,previewSampleData:false,platformContext:{accountName:'Alex Rivera',cityName:'Berkeley',organization:{name:'Berkeley Neighbors'},identities:[{id:'issuer',label:'Berkeley Neighbors',role:'issuer',active:mode==='coordinator'},{id:'person',label:'Alex Rivera',role:'participant',active:mode==='volunteer'}]}};
};

test('issuer account menu keeps current MyCity destinations and removes the legacy workspace bridge',()=>{
  const html=issuerNavigation(base());
  assert.ok(html.indexOf('header-notifications') < html.indexOf('header-conversations'));
  assert.match(html,/aria-label="Notifications · 2"/);
  assert.match(html,/Sam left a handoff for the garden team/);
  assert.match(html,/data-icon="bell"/);
  assert.match(html,/Civic-Participant role/);
  assert.match(html,/href="#\/coordinator\/feed\/profile"[^>]*>[\s\S]*Organization Profile/);
  assert.match(html,/href="#\/coordinator\/reports"/);
  assert.match(html,/href="#\/coordinator\/settings"/);
  assert.match(html,/Help &amp; Support/);
  assert.match(html,/Switch City/);
  assert.match(html,/Sign Out/);
  assert.doesNotMatch(html,/Connected workspace<small>/);
  assert.doesNotMatch(html,/aesthetic-lab/);
});

test('Civic-Participant account menu contains account access without duplicate feature shortcuts',()=>{
  const ctx=base('volunteer');ctx.ui.mode='volunteer';
  ctx.state.notifications.unshift({id:'notice-1',personId:ctx.currentPerson().id,activityId:'pantry',text:'Your shift details changed.',time:'Just now'});
  const html=volunteerNavigation(ctx);
  assert.ok(html.indexOf('header-notifications') < html.indexOf('header-conversations'));
  assert.match(html,/Your shift details changed\./);
  assert.match(html,/data-action="activity" data-id="pantry"/);
  const menu=html.slice(html.indexOf('<section class="header-profile-dropdown"'));
  assert.match(menu,/Issuer Organization/);
  assert.match(menu,/href="#\/volunteer\/settings"/);
  assert.match(menu,/Account Settings/);
  assert.match(menu,/City Network/);
  assert.match(menu,/Sign Out/);
  assert.doesNotMatch(menu,/Volunteer Passport/);
  assert.doesNotMatch(menu,/Connected workspace/);
  assert.doesNotMatch(menu,/Availability &amp; preferences/);
  assert.doesNotMatch(menu,/<span>Messages<\/span>/);
});

test('new settings and reports pages expose the useful controls inside the MyCity shell',()=>{
  const issuer=base();issuer.previewSampleData=true;issuer.integratedPlatform=true;
  const orgSettings=renderConnectedSettings(issuer,null,'');
  assert.match(orgSettings,/Organization Settings/);
  assert.match(orgSettings,/Staff & Roles/);
  assert.match(orgSettings,/Documents & Waivers/);
  assert.match(orgSettings,/Workspace ownership/);
  const participant=base('volunteer');participant.ui.mode='volunteer';
  const accountSettings=renderAccountSettings(participant,{account:{name:'Alex Rivera',email:'alex@example.org',username:'alex',avatarUrl:''},cityName:'Berkeley',identities:participant.platformContext.identities},'');
  assert.match(accountSettings,/Account Settings/);
  assert.match(accountSettings,/Password & security/);
  assert.match(accountSettings,/Connected roles/);
  const reports=renderReports(issuer,null,'',false);
  assert.match(reports,/Organization Reporting/i);
  assert.match(reports,/Verified contributions/);
  assert.match(reports,/Contributions CSV/);
  assert.doesNotMatch(reports,/Civic credits/i);
});
