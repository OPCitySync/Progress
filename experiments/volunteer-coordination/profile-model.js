import { ensureRecruitment, positionOpen } from './recruitment-model.js';
import { availableActivity } from './program-model.js';
export const PALETTES = { forest:['#1c2924','#456750','#b9d0ae'], citysync:['#15151e','#35488b','#9aace7'], terracotta:['#352120','#865044','#efbd67'], amethyst:['#261b35','#684c8f','#d7b8f3'] };
export const BANNERS = { original:'Original', 'folded-ribbon':'Folded Ribbon', confluence:'Confluence', 'civic-mosaic':'Civic Mosaic' };
export const PROFILE_FIELDS = { tagline:['Tagline',120], mission:['Mission',1200], causes:['Cause areas',240], location:['Location',240], email:['Public email',200], phone:['Phone',80], website:['Website',500], description:['About the organization',1600], support:['Access & support',800], welcome:['Your welcome',1000], contact:['Volunteer contact',100] };
export function ensureProfiles(state) {
  ensureRecruitment(state);
  for(const o of state.recruitment.organizations) if(!o.profile) o.profile={tagline:o.id==='berkeley-neighbors'?'Good things happen when neighbors show up.':'A place for your kind of help.',causes:[o.cause],phone:'',website:'',socials:{},palette:o.color==='sand'?'terracotta':o.color==='blue'?'citysync':'forest',banner:'confluence',logo:'',cover:'',coverAlt:'',featuredRoleId:'',updatedAt:''};
  return state;
}
export function safeWebLink(value) {
  if(!value)return '';
  try { const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:''; } catch { return ''; }
}
export const safeProfileImage = value => /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value||'') && value.length<=700000;
export const publicRoles = (state,orgId) => state.recruitment.positions.filter(p=>p.orgId===orgId&&positionOpen(p)&& (p.pathway!=='event'||state.activities.some(a=>a.id===p.activityId&&a.visibility==='public'&&availableActivity(state,a)&&a.workStatus!=='Complete')));
export const publicActivities = (state,orgId) => orgId==='berkeley-neighbors'?state.activities.filter(a=>a.visibility==='public'&&availableActivity(state,a)&&a.workStatus!=='Complete'):[];
export function transitionProfile(current,action) {
  const state=ensureProfiles(structuredClone(current));
  if(action.actor!=='coordinator'||action.orgId!==action.editorOrgId)throw Error('Use this organization’s coordinator profile workspace.');
  const o=state.recruitment.organizations.find(o=>o.id===action.orgId);
  if(!o)throw Error('Organization not found.');
  const p=o.profile;
  if(action.type==='field') {
    const spec=PROFILE_FIELDS[action.field];if(!spec)throw Error('Unknown profile field.');
    const value=String(action.value||'').trim();if(value.length>spec[1])throw Error(`Keep ${spec[0].toLowerCase()} under ${spec[1]} characters.`);
    if(['mission','location','contact','support','welcome','causes'].includes(action.field)&&!value)throw Error('Add this information so volunteers know what to expect.');
    if(action.field==='email'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw Error('Enter a valid public email address.');
    if(action.field==='website'&&value&&!safeWebLink(value))throw Error('Use a full http or https website address.');
    if(action.field==='causes') { const causes=[...new Set(value.split(',').map(s=>s.trim()).filter(Boolean))];if(!causes.length||causes.length>6)throw Error('Add between one and six cause areas.');p.causes=causes;o.cause=causes[0]; }
    else if(['tagline','phone','website'].includes(action.field))p[action.field]=value;
    else o[action.field]=value;
  } else if(action.type==='appearance') {
    if(!PALETTES[action.palette]||!BANNERS[action.banner])throw Error('Choose an available palette and banner style.');
    for(const name of ['logo','cover'])if(action[name]&&!safeProfileImage(action[name]))throw Error('Choose a PNG, JPEG, or WebP image under 500 KB.');
    if(action.cover&&!String(action.coverAlt||'').trim())throw Error('Describe the cover image for visitors who cannot see it.');
    Object.assign(p,{palette:action.palette,banner:action.banner,logo:action.logo||'',cover:action.cover||'',coverAlt:String(action.coverAlt||'').trim().slice(0,240)});
  } else if(action.type==='links') {
    const socials={};for(const name of ['instagram','facebook','linkedin','twitter']) { const value=String(action[name]||'').trim();if(value&&!safeWebLink(value))throw Error(`Use a full http or https address for ${name}.`);socials[name]=value; } p.socials=socials;
  } else if(action.type==='featured') {
    if(action.roleId&&!publicRoles(state,o.id).some(r=>r.id===action.roleId))throw Error('Choose a currently open pathway from this organization.');p.featuredRoleId=action.roleId||'';
  } else throw Error('Unknown profile action.');
  p.updatedAt=new Date().toISOString();
  return {state,notice:'Profile saved. Your local public page and discovery are updated.'};
}
