import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState} from './model.js';
import {ensureProfiles,transitionProfile,publicRoles,publicActivities,safeWebLink,safeProfileImage} from './profile-model.js';
import {renderProfile} from './profile-view.js';
const initial=()=>ensureProfiles(createInitialState());
const act=(s,a)=>transitionProfile(s,{actor:'coordinator',editorOrgId:'berkeley-neighbors',orgId:'berkeley-neighbors',...a}).state;
const org=s=>s.recruitment.organizations[0];
const renderContext=ui=>({
 state:initial(),ui:{person:'alex',recruitOrg:'berkeley-neighbors',...ui},assetBase:'/mycity',
 e:value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character])),
 button:(label,action,attrs='',classes='btn')=>`<button class="${classes}" data-action="${action}" ${attrs}>${label}</button>`,
 badge:(label,kind='neutral')=>`<span class="badge ${kind}">${label}</span>`,icon:()=>'',dateLabel:value=>value
});
test('profile migration preserves coordination, existing organization edits, and is idempotent',()=>{
 const s=initial();org(s).mission='An existing mission';const before=structuredClone(s);ensureProfiles(s);assert.deepEqual(s,before);assert.equal(org(s).mission,'An existing mission');
});
test('edits share canonical mission and contact data with discovery and recruitment',()=>{
 const before=initial();let s=act(before,{type:'field',field:'mission',value:'Help neighbors flourish.'});s=act(s,{type:'field',field:'email',value:'volunteer@example.org'});assert.equal(org(s).mission,'Help neighbors flourish.');assert.equal(org(s).email,'volunteer@example.org');assert.notEqual(org(before).mission,org(s).mission);assert.deepEqual(s.commitments,before.commitments);assert.deepEqual(s.recruitment.applications,before.recruitment.applications);
});
test('only the scoped coordinator edits the organization',()=>{
 const s=initial();for(const extra of [{actor:'alex'},{orgId:'tool-library'},{editorOrgId:'tool-library'}])assert.throws(()=>act(s,{type:'field',field:'mission',value:'Other mission',...extra}),/workspace/);
});
test('cause tags deduplicate and update the main discovery category',()=>{
 const s=act(initial(),{type:'field',field:'causes',value:'Food access, Community, Food access'});assert.deepEqual(org(s).profile.causes,['Food access','Community']);assert.equal(org(s).cause,'Food access');assert.throws(()=>act(s,{type:'field',field:'causes',value:', ,'}),/one and six/);
});
test('unsafe website/social protocols and invalid contact fields are rejected',()=>{
 const s=initial();for(const url of ['javascript:alert(1)','data:text/html,test','https://name:secret@example.org','not-a-url']){assert.equal(safeWebLink(url),'');assert.throws(()=>act(s,{type:'field',field:'website',value:url}),/http/);assert.throws(()=>act(s,{type:'links',instagram:url}),/http/);}
 assert.throws(()=>act(s,{type:'field',field:'email',value:'missing-at'}),/email/);assert.throws(()=>act(s,{type:'field',field:'mission',value:''}),/information/);assert.throws(()=>act(s,{type:'field',field:'privatePassport',value:'test'}),/Unknown/);
 assert.equal(safeWebLink('https://example.org'),'https://example.org/');
});
test('appearance validates palettes and image data and leaves other profile fields untouched',()=>{
 const s=initial(),png='data:image/png;base64,aGVsbG8=';
 assert.equal(safeProfileImage('data:image/svg+xml;base64,aGVsbG8='),false);
 assert.throws(()=>act(s,{type:'appearance',palette:'forest',banner:'confluence',cover:png}),/Describe/);
 assert.throws(()=>act(s,{type:'appearance',palette:'url(test)',banner:'confluence'}),/palette/);
 const n=act(s,{type:'appearance',palette:'amethyst',banner:'folded-ribbon',logo:png});assert.equal(org(n).profile.palette,'amethyst');assert.equal(org(n).mission,org(s).mission);
});
test('featured pathways are scoped and closed roles disappear without changing applications',()=>{
 let s=initial();assert.throws(()=>act(s,{type:'featured',roleId:'library-welcome'}),/this organization/);s=act(s,{type:'featured',roleId:'food-team'});assert.equal(org(s).profile.featuredRoleId,'food-team');s.recruitment.positions.find(p=>p.id==='food-team').status='closed';assert.ok(!publicRoles(s,org(s).id).some(p=>p.id==='food-team'));assert.throws(()=>act(s,{type:'featured',roleId:'food-team'}),/currently open/);
});
test('public profile excludes draft, archived, member-only and completed activities',()=>{
 const s=initial();assert.deepEqual(publicActivities(s,org(s).id).map(a=>a.id),['garden']);s.programWorkspace.programs.find(p=>p.id===s.activities.find(a=>a.id==='garden').programId).status='draft';assert.equal(publicActivities(s,org(s).id).length,0);assert.ok(!publicRoles(s,org(s).id).some(r=>r.pathway==='event'));assert.deepEqual(publicActivities(s,'tool-library'),[]);
});
test('organization public profile defaults to the external view with one owner edit control',()=>{
 globalThis.location={origin:'http://localhost:4320'};
 const page=renderProfile(renderContext({page:'profile',mode:'coordinator'}));
 assert.match(page,/ABOUT US/);assert.match(page,/Ways to get involved/);assert.match(page,/Edit Public Profile/);
 assert.equal((page.match(/data-action="pfEditor"/g)||[]).length,1);
 assert.match(page,/class="btn profile-banner-edit"/);assert.doesNotMatch(page,/← Discover organizations/);
 assert.doesNotMatch(page,/ORGANIZATION INFORMATION/);assert.doesNotMatch(page,/Customize appearance/);
});
test('profile editor is explicit and external organization views have no edit control',()=>{
 globalThis.location={origin:'http://localhost:4320'};
 const editor=renderProfile(renderContext({page:'profile',item:'edit',mode:'coordinator'}));
 assert.match(editor,/ORGANIZATION INFORMATION/);assert.match(editor,/View Public Profile/);assert.match(editor,/http:\/\/localhost:4320\/mycity\/#\/volunteer\/org-profile\/berkeley-neighbors/);
 assert.doesNotMatch(editor,/id="profile-org"/);
 const visitor=renderProfile(renderContext({page:'org-profile',item:'berkeley-neighbors',mode:'volunteer'}));
 assert.match(visitor,/ABOUT US/);assert.match(visitor,/← Discover organizations/);assert.doesNotMatch(visitor,/Edit Public Profile/);assert.doesNotMatch(visitor,/data-action="pfEditor"/);
 const otherOrganization=renderProfile(renderContext({page:'org-profile',item:'tool-library',mode:'coordinator'}));
 assert.doesNotMatch(otherOrganization,/data-action="pfEditor"/);
});
