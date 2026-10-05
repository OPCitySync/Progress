import { confirmedCount, missingRequirements } from './model.js';
import { today, readinessIssues } from './passport-model.js';
import { blockersFor } from './program-model.js';
import { HOME_ORG } from './recruitment-model.js';
import { planningDate, planningMonday } from './planning-model.js';

export function ensureIssuerHome(state) {
  state.issuerHome ||= { acknowledgements: [], notes: [] };
  return state;
}
const published = (state, a) => !a.archived && state.programWorkspace.programs.find(p => p.id === a.programId)?.status !== 'draft';
export function homeQueue(state, date = today(), includeAcknowledged = false) {
  const items = [];
  const add = (key, kind, title, detail, action, attrs, label, priority = 2) => items.push({ key, kind, title, detail, action, attrs, label, priority });
  for (const p of state.people.filter(p => p.relationship === 'joining')) {
    add(`member:${p.id}`, 'people', `Welcome ${p.name}`, 'Review organization membership and the next step together.', 'person', {id:p.id}, 'Review volunteer', 0);
  }
  for (const a of state.recruitment.applications.filter(a => a.orgId === HOME_ORG && a.submittedAt && ['submitted','reviewing','onboarding'].includes(a.status))) {
    const p = state.people.find(p => p.id === a.personId);
    add(`application:${a.id}:${a.status}:${a.updatedAt || a.submittedAt}`, 'people', `${a.status === 'onboarding' ? 'Continue onboarding for' : 'Review application from'} ${p?.name || 'volunteer'}`, `${a.position.title}${a.replyBy ? ` · Reply target ${a.replyBy}` : ''}`, 'rcApplication', {id:a.id}, a.status === 'onboarding' ? 'Open welcome plan' : 'Review application', 0);
  }
  for (const c of readinessIssues(state,date)) {
    const a = state.activities.find(a => a.id === c.activityId);
    if (!published(state,a) || a.workStatus === 'Complete') continue;
    const p = state.people.find(p => p.id === c.personId), r = a.roles.find(r => r.id === c.roleId);
    const missing = missingRequirements(p,r,state,a.date || date);
    add(`readiness:${c.id}:${missing.sort().join(',')}`, 'care', `Review ${p.name}’s preparation`, `${a.title} · A confirmed place needs a preparation check.`, 'person', {id:p.id}, 'Review preparation', 0);
  }
  for (const a of state.activities.filter(a => published(state,a) && a.workStatus !== 'Complete')) {
    const p = state.programWorkspace.programs.find(p => p.id === a.programId);
    if (p?.status === 'complete') continue;
    if (a.workStatus === 'Ready for review') {
      add(`review:${a.id}:${a.evidence || a.progress}`, 'review', `Review the result · ${a.title}`, `${a.reviewer || 'Coordinator'} · Ready for a decision.`, 'pgOpen', {id:a.programId,tab:'plan'}, 'Review work', 0);
    } else if (['event','shift'].includes(a.type) && a.date && a.date < date && confirmedCount(state,a.id)) {
      const team=state.commitments.filter(c=>c.activityId===a.id&&c.status==='confirmed');
      const unrecorded=team.filter(c=>c.attendance!=='present').length;
      add(`attendance:${a.id}:${team.map(c=>`${c.id}:${c.attendance}`).sort().join('|')}`, 'review', `Review attendance · ${a.title}`, `${a.date} · ${unrecorded ? `${unrecorded} attendance records to review` : 'Attendance recorded; review the handoff and completion.'}`, 'activity', {id:a.id}, 'Review activity', 0);
    } else if (a.type === 'project' && a.date && a.date < date) {
      add(`overdue:${a.id}:${a.date}:${a.workStatus}`, 'care', `Follow up · ${a.title}`, `Due ${a.date} · ${a.owner || 'Needs an owner'}`, 'activity', {id:a.id}, 'Review task', 1);
    } else if (a.date >= date && a.date <= planningDate(date,7) && blockersFor(state,a).length) {
      add(`blocked:${a.id}:${blockersFor(state,a).join('|')}`, 'care', `Unblock ${a.title}`, blockersFor(state,a).join(' · '), 'activity', {id:a.id}, 'Review dependencies', 1);
    }
    if (['event','shift'].includes(a.type) && a.date >= date && a.date <= planningDate(date,7)) {
      const open = a.roles.reduce((n,r)=>n+Math.max(0,r.capacity-confirmedCount(state,a.id,r.id)),0);
      if (open) add(`staffing:${a.id}:${a.date}:${open}`, 'staffing', `${open} open ${open===1?'place':'places'} · ${a.title}`, `${a.date} · ${a.time} · Invitations count after acceptance.`, 'activity', {id:a.id}, 'Coordinate team');
    }
  }
  const acknowledged = new Set((state.issuerHome?.acknowledgements || []).map(x=>x.key));
  return items.filter(x=>includeAcknowledged || !acknowledged.has(x.key)).sort((a,b)=>a.priority-b.priority);
}

export function calendarRange(anchor, period='month') {
  const month = anchor.slice(0,7)+'-01';
  const start = period==='week' ? planningMonday(anchor) : month;
  const d = new Date(month+'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth()+1);
  const end = period==='week' ? planningDate(start,7) : d.toISOString().slice(0,10);
  const gridStart = period==='week' ? start : planningMonday(start);
  const gridEnd = period==='week' ? end : planningDate(planningMonday(planningDate(end,-1)),7);
  const days=[]; for(let date=gridStart;date<gridEnd;date=planningDate(date,1)) days.push(date);
  return {start,end,days};
}
export function moveCalendar(anchor, period, direction) {
  if(period==='week') return planningDate(anchor,direction*7);
  const d=new Date(anchor.slice(0,7)+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+direction);return d.toISOString().slice(0,10);
}
export function calendarEntries(state) {
  return [
    ...state.activities.filter(a=>published(state,a)&&a.date).map(a=>({id:a.id,kind:a.type,start:a.date,end:a.date,title:a.title,time:a.time,location:a.location,program:a.program,capacity:a.roles.reduce((n,r)=>n+r.capacity,0),confirmed:confirmedCount(state,a.id),status:a.workStatus})),
    ...(state.issuerHome?.notes || []).map(n=>({id:n.id,kind:'note',start:n.start.slice(0,10),end:n.end.slice(0,10),title:n.title,time:`${n.start.slice(11)}–${n.end.slice(11)}`,location:n.location,description:n.description,tone:n.tone,startTime:n.start,endTime:n.end}))
  ].sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title));
}
export const entriesOnDay = (entries,date) => entries.filter(x=>x.start<=date && x.end>=date && !(x.kind==='note' && x.end===date && x.endTime.endsWith('T00:00')));
const validDateTime = value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value+'Z')) && new Date(value+'Z').toISOString().slice(0,16)===value;
export function transitionIssuerHome(current,action,date=today()) {
  if(action.actor!=='coordinator') throw Error('Only the organization coordinator can change this overview.');
  const state=ensureIssuerHome(structuredClone(current)), home=state.issuerHome;
  let notice;
  if(action.type==='acknowledge') {
    const item=homeQueue(state,date).find(x=>x.key===action.key);
    if(!item) throw Error('This item has already changed or been acknowledged.');
    home.acknowledgements.unshift({...item,at:new Date().toISOString()});
    notice='Acknowledged. The underlying work is unchanged; restore it from History.';
  } else if(action.type==='restore') {
    if(!home.acknowledgements.some(x=>x.key===action.key)) throw Error('This item is no longer in history.');
    home.acknowledgements=home.acknowledgements.filter(x=>x.key!==action.key);
    notice='Acknowledgement removed. If still needed, the action is back in your queue.';
  } else if(action.type==='saveNote') {
    const title=String(action.title||'').trim(), start=action.start, end=action.end;
    if(!title || title.length>120) throw Error('Give this calendar note a title of up to 120 characters.');
    if(!validDateTime(start)||!validDateTime(end)||end<=start) throw Error('Choose valid dates and an end time after the start.');
    if(!['sage','sand','peach','lilac'].includes(action.tone)) throw Error('Choose a calendar color.');
    let note=home.notes.find(n=>n.id===action.id);
    if(action.id&&!note) throw Error('This calendar note no longer exists.');
    const values={title,start,end,tone:action.tone,location:String(action.location||'').trim().slice(0,200),description:String(action.description||'').trim().slice(0,1000)};
    if(note) Object.assign(note,values);else home.notes.push({id:crypto.randomUUID(),...values});
    notice='Organization note saved to this browser’s calendar.';
  } else throw Error('Unknown overview action.');
  return {state,notice};
}
