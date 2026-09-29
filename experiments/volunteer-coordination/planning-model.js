import { transition, confirmedCount, activeCommitment } from './model.js';
import { today } from './passport-model.js';

export function planningMonday(date = today()) {
  const d = new Date(date+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay()+6)%7);
  return d.toISOString().slice(0,10);
}
export function planningDate(date, days) {
  const d=new Date(date+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10);
}
export function planningActivities(state, {mode='programs',programId=''}={}) {
  return state.activities.filter(a=>!a.archived && ['event','shift','project'].includes(a.type)
    && (mode==='programs' ? Boolean(a.programId) && (!programId || a.programId===programId) : !a.programId && a.type===(mode==='events'?'event':'shift')))
    .sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999') || a.title.localeCompare(b.title));
}
export function planningProblem(state, personId, activityId, date=today()) {
  const a=state.activities.find(a=>a.id===activityId),person=state.people.find(p=>p.id===personId);
  if(!a||a.archived||a.workStatus==='Complete')return 'This activity is closed to new invitations.';
  const program=state.programWorkspace.programs.find(p=>p.id===a.programId);
  if(program && program.status!=='active')return program.status==='draft'?'Activate this program before inviting volunteers.':'This program is closed.';
  if(a.date && a.date<date)return 'This date has passed. Choose an upcoming activity.';
  if(!person)return 'Choose a volunteer from the left rail.';
  if(['paused','former','invited'].includes(person.relationship))return 'This volunteer must join or resume membership first.';
  if(a.visibility==='members'&&person.relationship!=='member')return 'This activity needs an organization member.';
  if(activeCommitment(state,person.id,a.id))return 'This volunteer already has a commitment, invitation, or waitlist place.';
  if(!a.roles.some(r=>confirmedCount(state,a.id,r.id)<r.capacity))return 'All roles are full. Review the team before inviting someone else.';
  return '';
}
export function transitionPlanning(state, action, date=today()) {
  if(action.actor!=='coordinator')throw Error('Only a coordinator can change a plan.');
  if(action.type==='invite'){
    const problem=planningProblem(state,action.personId,action.activityId,date);if(problem)throw Error(problem);
    const a=state.activities.find(a=>a.id===action.activityId),role=a.roles.find(r=>r.id===action.roleId);
    if(!role)throw Error('Choose a role for this invitation.');
    if(confirmedCount(state,a.id,role.id)>=role.capacity)throw Error('This role is full. Choose another role.');
    return transition(state,{type:'commit',actor:'coordinator',personId:action.personId,activityId:a.id,roleId:role.id,status:'proposed'});
  }
  if(action.type==='remove'){
    const next=structuredClone(state),c=next.commitments.find(c=>c.id===action.commitmentId);
    if(!c||!['confirmed','proposed','waitlisted'].includes(c.status))throw Error('This place is no longer active.');
    const a=next.activities.find(a=>a.id===c.activityId),p=next.people.find(p=>p.id===c.personId);
    const wasInvitation=c.status==='proposed';c.status='canceled';c.cancellationNote=String(action.note||'').trim();
    c.canceledBy='coordinator';
    const text=`${wasInvitation?'Invitation withdrawn':'Removed from the plan'}: ${p.name} · ${a.title}`;
    next.activityLog.unshift({text,time:'Just now'});
    next.notifications.unshift({id:crypto.randomUUID(),personId:p.id,activityId:a.id,text:`Your coordinator ${wasInvitation?'withdrew your invitation to':'removed your place in'} ${a.title}.${c.cancellationNote?' '+c.cancellationNote:''}`});
    return {state:next,notice:wasInvitation?'Invitation withdrawn. Other dates are unchanged.':'Place removed. The volunteer’s local updates and coverage have been updated.'};
  }
  throw Error('Unknown planning action.');
}
