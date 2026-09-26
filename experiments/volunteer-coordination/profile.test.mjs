import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState} from './model.js';
import {ensureProfiles,transitionProfile,publicRoles,publicActivities,safeWebLink,safeProfileImage} from './profile-model.js';
const initial=()=>ensureProfiles(createInitialState());
const act=(s,a)=>transitionProfile(s,{actor:'coordinator',editorOrgId:'berkeley-neighbors',orgId:'berkeley-neighbors',...a}).state;
const org=s=>s.recruitment.organizations[0];
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
