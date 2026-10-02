const uid=()=>globalThis.crypto.randomUUID();
const clean=(value,max=5000)=>String(value||'').trim().slice(0,max);

function activeRoster(state) {
  return state.people.filter(person=>['member','joining','event-only'].includes(person.relationship));
}

export function ensureCommunications(state) {
  if(!state.communications) {
    const roster=activeRoster(state).map(person=>person.id);
    state.communications={
      outbound:[
        {id:'message-weekend-briefing',subject:'Weekend volunteer briefing',body:'Thank you for being part of this weekend’s work. Activity-specific arrival details are available in each Event Chat.',audienceType:'roster',audienceLabel:'Full volunteer roster',recipientIds:roster,createdAt:'2026-09-24T16:30:00-07:00',author:'Maya Thompson'},
        {id:'message-welcome-draft',subject:'Welcome guide ready for review',body:'The revised volunteer welcome guide is ready. Please review the arrival and accessibility details before we share it with new volunteers.',audienceType:'individual',audienceLabel:'Jules Okafor',recipientIds:['jules'],createdAt:'2026-09-23T10:15:00-07:00',author:'Maya Thompson'},
      ],
      readBy:{},readNoticeIds:[],
    };
  }
  state.communications.outbound ||= [];
  state.communications.readBy ||= {};
  state.communications.readNoticeIds ||= [];
  return state;
}

export function communicationGroups(state) {
  const groups=new Map();
  for(const person of activeRoster(state)) {
    const label=person.role||'General Volunteer';
    if(!groups.has(label))groups.set(label,[]);
    groups.get(label).push(person.id);
  }
  return [...groups].map(([label,memberIds])=>({id:`role:${label}`,label,memberIds}));
}

export function issuerNotices(state) {
  const items=[];
  for(const application of state.recruitment?.applications||[]) {
    if(!application.submittedAt||!['submitted','reviewing','needs-info','waitlisted','offered','onboarding'].includes(application.status))continue;
    const person=state.people.find(item=>item.id===application.personId);
    const role=state.recruitment.positions.find(item=>item.id===application.positionId)||application.position;
    items.push({id:`application:${application.id}`,kind:'application',title:`${person?.name||'A volunteer'} · ${role?.title||'Volunteer role'}`,body:`Application status: ${application.status.replace('-', ' ')}. Review the application and agree on the next step.`,time:application.submittedAt||application.createdAt,action:'rcApplication',actionId:application.id,actionLabel:'Open Application'});
  }
  for(const commitment of state.commitments.filter(item=>item.status==='proposed')) {
    const person=state.people.find(item=>item.id===commitment.personId),activity=state.activities.find(item=>item.id===commitment.activityId);
    if(person&&activity)items.push({id:`commitment:${commitment.id}`,kind:'coordination',title:`Waiting on ${person.name}`,body:`An invitation for ${activity.title} is awaiting a response.`,time:activity.date,action:'activity',actionId:activity.id,actionLabel:'Open Activity'});
  }
  for(const notice of state.notifications.filter(item=>item.personId==='coordinator'))items.push({id:`notice:${notice.id}`,kind:'system',title:'Coordination update',body:notice.text,time:'Just now',action:notice.activityId?'activity':'',actionId:notice.activityId||'',actionLabel:notice.activityId?'Open Activity':''});
  return items;
}

export function volunteerInbox(state,personId) {
  const communications=ensureCommunications(state).communications;
  const messages=communications.outbound.filter(message=>message.recipientIds.includes(personId)).map(message=>({...message,kind:'message'}));
  const notices=state.notifications.filter(notice=>notice.personId===personId).map(notice=>({id:`notice:${notice.id}`,kind:'notice',subject:'Organization update',body:notice.text,createdAt:'Just now',activityId:notice.activityId||''}));
  return [...messages,...notices];
}

export function transitionCommunication(current,action) {
  const state=ensureCommunications(structuredClone(current)),communications=state.communications;
  if(action.type==='send') {
    if(action.actor!=='coordinator')throw Error('Only an organization account can send roster messages.');
    const subject=clean(action.subject,160),body=clean(action.body);
    if(!subject||!body)throw Error('Add a subject and message.');
    let recipientIds=[],audienceLabel='';
    if(action.audienceType==='roster') {
      recipientIds=activeRoster(state).map(person=>person.id);audienceLabel='Full volunteer roster';
    } else if(action.audienceType==='group') {
      const group=communicationGroups(state).find(item=>item.id===action.groupId);
      if(!group)throw Error('Choose a volunteer group.');
      recipientIds=group.memberIds;audienceLabel=group.label;
    } else if(action.audienceType==='individual') {
      recipientIds=[...new Set((action.recipientIds||[]).filter(id=>activeRoster(state).some(person=>person.id===id)))];
      if(!recipientIds.length)throw Error('Choose at least one volunteer.');
      audienceLabel=recipientIds.map(id=>state.people.find(person=>person.id===id)?.name).filter(Boolean).join(', ');
    } else throw Error('Choose who should receive this message.');
    if(!recipientIds.length)throw Error('This audience has no current volunteers.');
    communications.outbound.unshift({id:uid(),subject,body,audienceType:action.audienceType,audienceLabel,recipientIds,createdAt:new Date().toISOString(),author:'Maya Thompson'});
    return {state,notice:`Message saved for ${recipientIds.length} ${recipientIds.length===1?'volunteer':'volunteers'}.`};
  }
  if(action.type==='readMessage') {
    if(!state.people.some(person=>person.id===action.actor))throw Error('Volunteer not found.');
    if(!communications.outbound.some(message=>message.id===action.messageId&&message.recipientIds.includes(action.actor)))throw Error('This message is not available to this volunteer.');
    const read=new Set(communications.readBy[action.actor]||[]);read.add(action.messageId);communications.readBy[action.actor]=[...read];
    return {state,notice:'Message opened.'};
  }
  if(action.type==='readNotice') {
    if(action.actor!=='coordinator')throw Error('Only the organization can manage organization notifications.');
    const ids=new Set(communications.readNoticeIds);ids.add(action.noticeId);communications.readNoticeIds=[...ids];
    return {state,notice:'Notification marked as read.'};
  }
  throw Error('Unknown communication action.');
}
