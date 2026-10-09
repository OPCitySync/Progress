import { ensurePrograms } from './program-model.js';

const uid=()=>globalThis.crypto.randomUUID();
const clean=value=>String(value??'').trim();

export const STAFF_PERMISSIONS = [
  ['volunteers','Manage volunteers'],
  ['programs','Manage programs'],
  ['schedule','Plan activities'],
  ['communications','Message teams and publish updates'],
  ['documents','Manage documents'],
  ['settings','Manage organization settings'],
];

const defaults = [
  {id:'staff-role-owner',name:'Organization owner',description:'Full access to the organization workspace.',permissions:STAFF_PERMISSIONS.map(([id])=>id),system:true},
  {id:'staff-role-admin',name:'Organization administrator',description:'Coordinates the organization’s people, programs, and daily work.',permissions:STAFF_PERMISSIONS.map(([id])=>id),system:true},
  {id:'staff-role-member',name:'Organization member',description:'Participates in the organization workspace with standard access.',permissions:['programs','schedule','communications','documents'],system:true},
];

const roleFor=(roles,name)=>roles.find(role=>role.name.toLowerCase()===clean(name).toLowerCase());

export function ensureStaff(state) {
  ensurePrograms(state);
  const workspace=state.programWorkspace;
  if(!Array.isArray(workspace.staffRoles))workspace.staffRoles=structuredClone(defaults);
  else for(const role of defaults)if(!workspace.staffRoles.some(item=>item.id===role.id))workspace.staffRoles.push(structuredClone(role));
  for(const member of workspace.organizationMembers){
    member.status||=member.active===false?'invited':'active';
    member.active=member.status==='active';
    member.workspaceAccess=member.workspaceAccess!==false;
    if(!member.roleId){
      const matched=roleFor(workspace.staffRoles,member.role)||roleFor(workspace.staffRoles,'Organization member');
      member.roleId=matched?.id||'';
    }
    if(!member.role)member.role=workspace.staffRoles.find(role=>role.id===member.roleId)?.name||'Organization member';
  }
  return state;
}

export function transitionStaff(current,action) {
  const state=ensureStaff(structuredClone(current));
  if(action.actor!=='coordinator')throw Error('Only an organization administrator can manage staff.');
  const workspace=state.programWorkspace;
  let notice='Organization staff updated.';
  if(action.type==='saveRole'){
    const name=clean(action.name),description=clean(action.description);
    if(name.length<2||name.length>80)throw Error('Give the organization role a name between 2 and 80 characters.');
    if(description.length>300)throw Error('Keep the role description under 300 characters.');
    const valid=new Set(STAFF_PERMISSIONS.map(([id])=>id));
    const permissions=[...new Set(action.permissions||[])].filter(permission=>valid.has(permission));
    if(!permissions.length)throw Error('Choose at least one workspace permission.');
    const role=action.roleId?workspace.staffRoles.find(item=>item.id===action.roleId):null;
    if(action.roleId&&!role)throw Error('This organization role no longer exists.');
    if(role?.system)throw Error('Built-in roles cannot be edited. Create a custom role instead.');
    if(workspace.staffRoles.some(item=>item.id!==role?.id&&item.name.toLowerCase()===name.toLowerCase()))throw Error('An organization role already uses this name.');
    if(role)Object.assign(role,{name,description,permissions});
    else workspace.staffRoles.push({id:uid(),name,description,permissions,system:false,createdAt:new Date().toISOString()});
    for(const member of workspace.organizationMembers.filter(member=>member.roleId===role?.id))member.role=name;
    notice=role?'Organization role updated.':'Organization role created.';
  } else if(action.type==='inviteMember'){
    const name=clean(action.name),email=clean(action.email).toLowerCase();
    const role=workspace.staffRoles.find(item=>item.id===action.roleId);
    if(name.length<2||name.length>100)throw Error('Enter the team member’s full name.');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid email address.');
    if(!role)throw Error('Choose an organization role.');
    if(workspace.organizationMembers.some(member=>clean(member.email).toLowerCase()===email))throw Error('That email already belongs to an organization team member.');
    workspace.organizationMembers.unshift({id:uid(),name,email,role:role.name,roleId:role.id,workspaceAccess:true,active:false,status:'invited',invitedAt:new Date().toISOString()});
    notice='Team invitation created.';
  } else throw Error('Unknown organization staff action.');
  return {state,notice};
}
