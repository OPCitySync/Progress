import { communicationGroups, ensureCommunications, issuerNotices, volunteerInbox } from './communication-model.js';

const shortDate=value=>{
  if(!value||value==='Just now')return value||'Recently';
  const date=new Date(value.includes?.('T')?value:`${value}T12:00:00`);
  return Number.isNaN(date.getTime())?value:date.toLocaleDateString('en-US',{month:'short',day:'numeric'});
};
const fullDate=value=>{
  if(!value||value==='Just now')return value||'Recently';
  const date=new Date(value.includes?.('T')?value:`${value}T12:00:00`);
  return Number.isNaN(date.getTime())?value:date.toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:value.includes?.('T')?'numeric':undefined,minute:value.includes?.('T')?'2-digit':undefined});
};
const activeCommitment=(state,personId,activityId)=>state.commitments.some(item=>item.personId===personId&&item.activityId===activityId&&['confirmed','proposed','waitlisted'].includes(item.status));
const communicationActivities=(state,ui,archived=false)=>state.activities.filter(activity=>!!activity.archived===archived&&(ui.mode==='coordinator'||activeCommitment(state,ui.person,activity.id))).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
const includesQuery=(query,...values)=>!query||values.join(' ').toLowerCase().includes(query);
const eventMeta=(ctx,activity)=>`${ctx.dateLabel(activity.date)} · ${activity.time} · ${activity.location}`;
const messageCount=(state,activityId)=>state.messages.filter(message=>message.activityId===activityId).length;

function empty(icon,title,text) {return `<div class="communication-empty">${icon}<h3>${title}</h3><p>${text}</p></div>`;}
function search(ctx,placeholder) {return `<label class="communication-search">${ctx.icon('search')}<span class="sr-only">${placeholder}</span><input id="communication-search" type="search" value="${ctx.e(ctx.ui.communicationQuery||'')}" placeholder="${placeholder}"></label>`;}
function dateTile(ctx,activity) {const date=activity.date?new Date(`${activity.date}T12:00:00`):null;return `<time class="communication-date"><strong>${date?date.getDate():'—'}</strong><span>${date?date.toLocaleDateString('en-US',{month:'short'}):'TBD'}</span></time>`;}
function eventRow(ctx,activity,selected) {
  const count=messageCount(ctx.state,activity.id);
  return `<button type="button" class="communication-list-row event ${selected?'active':''}" data-action="commSelect" data-kind="event" data-id="${ctx.e(activity.id)}">${dateTile(ctx,activity)}<span><small>${activity.archived?'Archived conversation':'Activity conversation'}</small><strong>${ctx.e(activity.title)}</strong><em>${ctx.e(eventMeta(ctx,activity))}</em><i>${ctx.icon('message')} ${count} ${count===1?'message':'messages'}</i></span></button>`;
}
function eventConversation(ctx,activity,archived=false) {
  const messages=ctx.state.messages.filter(message=>message.activityId===activity.id),self=ctx.ui.mode==='coordinator'?'Maya':ctx.currentPerson().name.split(' ')[0];
  return `<header class="communication-detail-header"><span class="communication-detail-icon">${ctx.icon(archived?'archive':'message')}</span><div><span class="eyebrow">${archived?'ARCHIVED ACTIVITY CHAT':'LIVE ACTIVITY CHAT'}</span><h2>${ctx.e(activity.title)}</h2><p>${ctx.e(eventMeta(ctx,activity))}</p></div>${ctx.button('Open Activity →','activity',`data-id="${ctx.e(activity.id)}"`,'text-button')}</header><div class="communication-thread">${messages.map(message=>`<article class="communication-bubble ${message.author===self||ctx.ui.mode==='coordinator'&&message.author==='Maya'?'self':''}"><strong>${ctx.e(message.author===self?'You':message.author)}</strong><p>${ctx.e(message.text)}</p><time>${ctx.e(message.time)}</time></article>`).join('')||empty(ctx.icon('message'),'Start the conversation.','Share an arrival detail, practical question, or update with this activity team.')}</div>${archived?'<footer class="communication-readonly">This conversation is read-only because the activity has ended.</footer>':`<form data-form="message" data-activity="${ctx.e(activity.id)}" class="communication-composer"><label><span class="sr-only">Message this activity team</span><textarea name="text" rows="2" maxlength="1500" required placeholder="Write to this activity team…"></textarea></label><button class="btn primary" type="submit">Send ${ctx.icon('arrow')}</button></form>`}`;
}

function issuerMessages(ctx,query) {
  const messages=ctx.state.communications.outbound.filter(message=>includesQuery(query,message.subject,message.body,message.audienceLabel));
  const selected=messages.find(message=>message.id===ctx.ui.communicationSelection)||messages[0];
  const list=messages.map(message=>`<button type="button" class="communication-list-row ${selected?.id===message.id?'active':''}" data-action="commSelect" data-kind="message" data-id="${ctx.e(message.id)}"><span class="communication-row-icon">${ctx.icon('message')}</span><span><small>To: ${ctx.e(message.audienceLabel)}</small><strong>${ctx.e(message.subject)}</strong><em>${ctx.e(message.body)}</em><i>${message.recipientIds.length} ${message.recipientIds.length===1?'recipient':'recipients'} · ${shortDate(message.createdAt)}</i></span></button>`).join('');
  const detail=selected?`<header class="communication-detail-header"><span class="communication-detail-icon">${ctx.icon('message')}</span><div><span class="eyebrow">SENT MESSAGE</span><h2>${ctx.e(selected.subject)}</h2><p>To ${ctx.e(selected.audienceLabel)} · ${fullDate(selected.createdAt)}</p></div></header><div class="communication-message-body"><p>${ctx.e(selected.body)}</p></div><footer class="communication-delivery">${ctx.icon('check')} Delivered to ${selected.recipientIds.length} ${selected.recipientIds.length===1?'volunteer':'volunteers'}</footer>`:empty(ctx.icon('message'),'No messages sent yet.','Use New Message to write to a volunteer, a role group, or your full roster.');
  return {list:list||empty(ctx.icon('message'),'No messages match.','Try another recipient, subject, or phrase.'),detail};
}

function issuerNotifications(ctx,query) {
  const notices=issuerNotices(ctx.state).filter(notice=>includesQuery(query,notice.title,notice.body,notice.kind));
  const selected=notices.find(notice=>notice.id===ctx.ui.communicationSelection)||notices[0],read=new Set(ctx.state.communications.readNoticeIds);
  const list=notices.map(notice=>`<button type="button" class="communication-list-row notice ${selected?.id===notice.id?'active':''} ${read.has(notice.id)?'':'unread'}" data-action="commSelect" data-kind="notice" data-id="${ctx.e(notice.id)}"><span class="communication-row-icon gold">${ctx.icon(notice.kind==='application'?'people':'info')}</span><span><small>${ctx.e(notice.kind==='application'?'Application update':'Coordination update')}${read.has(notice.id)?'':' · New'}</small><strong>${ctx.e(notice.title)}</strong><em>${ctx.e(notice.body)}</em><i>${shortDate(notice.time)}</i></span></button>`).join('');
  const detail=selected?`<header class="communication-detail-header"><span class="communication-detail-icon gold">${ctx.icon(selected.kind==='application'?'people':'info')}</span><div><span class="eyebrow">${selected.kind==='application'?'APPLICATION UPDATE':'COORDINATION UPDATE'}</span><h2>${ctx.e(selected.title)}</h2><p>${fullDate(selected.time)}</p></div></header><div class="communication-message-body"><p>${ctx.e(selected.body)}</p></div>${selected.action?`<footer class="communication-detail-actions">${ctx.button(selected.actionLabel,selected.action,`data-id="${ctx.e(selected.actionId)}"`,'btn primary')}</footer>`:''}`:empty(ctx.icon('check'),'You’re all caught up.','New application and coordination updates will appear here.');
  return {list:list||empty(ctx.icon('info'),'No notifications match.','Try another person, activity, or phrase.'),detail};
}

function issuerEvents(ctx,query) {
  const archived=ctx.ui.communicationChatView==='archive',activities=communicationActivities(ctx.state,ctx.ui,archived).filter(activity=>includesQuery(query,activity.title,activity.program,activity.location));
  const selected=activities.find(activity=>activity.id===ctx.ui.communicationSelection)||activities[0];
  return {list:activities.map(activity=>eventRow(ctx,activity,selected?.id===activity.id)).join('')||empty(ctx.icon(archived?'archive':'calendar'),archived?'No archived conversations.':'No activity conversations are open.',archived?'Ended activity chats will remain here for reference.':'Create or publish an activity to begin coordinating with its team.'),detail:selected?eventConversation(ctx,selected,archived):empty(ctx.icon('message'),'Select an activity chat.','The conversation and activity context will appear here.')};
}

function volunteerInboxView(ctx,query) {
  const entries=volunteerInbox(ctx.state,ctx.ui.person).filter(item=>includesQuery(query,item.subject,item.body,item.author||'')),read=new Set(ctx.state.communications.readBy[ctx.ui.person]||[]);
  const selected=entries.find(item=>item.id===ctx.ui.communicationSelection)||entries[0];
  const list=entries.map(item=>`<button type="button" class="communication-list-row ${selected?.id===item.id?'active':''} ${item.kind==='message'&&!read.has(item.id)?'unread':''}" data-action="commSelect" data-kind="inbox" data-id="${ctx.e(item.id)}"><span class="communication-row-icon ${item.kind==='notice'?'gold':''}">${ctx.icon(item.kind==='notice'?'info':'message')}</span><span><small>${item.kind==='notice'?'Organization update':`From ${ctx.e(item.author)}`}${item.kind==='message'&&!read.has(item.id)?' · New':''}</small><strong>${ctx.e(item.subject)}</strong><em>${ctx.e(item.body)}</em><i>${shortDate(item.createdAt)}</i></span></button>`).join('');
  const detail=selected?`<header class="communication-detail-header"><span class="communication-detail-icon ${selected.kind==='notice'?'gold':''}">${ctx.icon(selected.kind==='notice'?'info':'message')}</span><div><span class="eyebrow">${selected.kind==='notice'?'ORGANIZATION UPDATE':`FROM ${ctx.e(selected.author).toUpperCase()}`}</span><h2>${ctx.e(selected.subject)}</h2><p>${fullDate(selected.createdAt)}</p></div></header><div class="communication-message-body"><p>${ctx.e(selected.body)}</p></div>${selected.activityId?`<footer class="communication-detail-actions">${ctx.button('Open Activity','activity',`data-id="${ctx.e(selected.activityId)}"`,'btn primary')}</footer>`:''}`:empty(ctx.icon('message'),'Your inbox is clear.','Messages from your organization will appear here.');
  return {list:list||empty(ctx.icon('message'),'No inbox messages match.','Try another sender, subject, or phrase.'),detail};
}

export function renderConversations(ctx) {
  ensureCommunications(ctx.state);
  const issuer=ctx.ui.mode==='coordinator',allowed=issuer?['messages','events','notifications']:['inbox','events','archive'];
  const pane=allowed.includes(ctx.ui.communicationPane)?ctx.ui.communicationPane:allowed[0],query=(ctx.ui.communicationQuery||'').trim().toLowerCase();
  let result;
  if(issuer&&pane==='messages')result=issuerMessages(ctx,query);
  else if(issuer&&pane==='notifications')result=issuerNotifications(ctx,query);
  else if(!issuer&&pane==='inbox')result=volunteerInboxView(ctx,query);
  else {
    if(!issuer)ctx.ui.communicationChatView=pane==='archive'?'archive':'active';
    result=issuerEvents(ctx,query);
  }
  const notices=issuerNotices(ctx.state),unreadNotices=notices.filter(notice=>!ctx.state.communications.readNoticeIds.includes(notice.id)).length;
  const inbox=volunteerInbox(ctx.state,ctx.ui.person),read=new Set(ctx.state.communications.readBy[ctx.ui.person]||[]),unreadInbox=inbox.filter(item=>item.kind==='message'&&!read.has(item.id)).length;
  const tabs=issuer?[["messages","message","Messages",0],["events","calendar","Activity Chats",0],["notifications","info","Notifications",unreadNotices]]:[["inbox","message","Inbox",unreadInbox],["events","calendar","Activity Chats",0],["archive","archive","Archive",0]];
  const placeholder=pane==='messages'?'Search sent messages':pane==='notifications'?'Search notifications':pane==='inbox'?'Search inbox':'Search activity chats';
  return `<section class="panel communications-shell"><header class="communications-header"><div><span class="eyebrow">${issuer?'ORGANIZATION COMMUNICATION':'YOUR COMMUNICATIONS'}</span><h1>${issuer?'Communication Center':'Messages'}</h1><p>${issuer?'Send deliberate messages, coordinate activity teams, and review system updates in one place.':'Keep organization messages and practical activity conversations together.'}</p></div>${issuer&&pane==='messages'?ctx.button(`${ctx.icon('plus')}New Message`,'commNew','','btn communications-new-message'):''}</header><nav class="communication-tabs" aria-label="Message types">${tabs.map(([key,glyph,label,count])=>ctx.button(`${ctx.icon(glyph)}<span>${label}</span>${count?`<em>${count}</em>`:''}`,'commPane',`data-pane="${key}" aria-pressed="${pane===key}"`,`communication-tab ${pane===key?'active':''}`)).join('')}</nav><div class="communication-workspace" id="communication-workspace"><aside class="communication-list-pane">${search(ctx,placeholder)}${issuer&&pane==='events'?`<div class="communication-chat-switch">${ctx.button('Active','commChatView',`data-view="active" aria-pressed="${ctx.ui.communicationChatView!=='archive'}"`,ctx.ui.communicationChatView!=='archive'?'active':'')}${ctx.button('Archived','commChatView',`data-view="archive" aria-pressed="${ctx.ui.communicationChatView==='archive'}"`,ctx.ui.communicationChatView==='archive'?'active':'')}</div>`:''}<div class="communication-list">${result.list}</div></aside><article class="communication-detail">${result.detail}</article></div></section>`;
}

export function renderCommunicationComposer(ctx) {
  const roster=ctx.state.people.filter(person=>['member','joining','event-only'].includes(person.relationship)),groups=communicationGroups(ctx.state);
  return `<form data-form="commSend" class="communication-message-form"><div class="dialog-body"><p class="dialog-intro">Send an organization message without mixing it into an activity chat. Recipients receive their own inbox copy.</p><fieldset class="communication-audience"><legend>Send to</legend><label><input type="radio" name="audienceType" value="individual" checked><span><strong>Individuals</strong><small>Choose one or more volunteers</small></span></label><label><input type="radio" name="audienceType" value="group"><span><strong>Role Group</strong><small>Everyone with the same roster role</small></span></label><label><input type="radio" name="audienceType" value="roster"><span><strong>Full Roster</strong><small>All current volunteers</small></span></label></fieldset><div class="communication-recipient-fields"><fieldset data-audience="individual"><legend>Choose volunteers</legend><div class="communication-recipient-list">${roster.map(person=>`<label><input type="checkbox" name="recipientIds" value="${ctx.e(person.id)}"><span>${ctx.avatar(person,'small')}<strong>${ctx.e(person.name)}</strong><small>${ctx.e(person.role)}</small></span></label>`).join('')}</div></fieldset><label data-audience="group">Volunteer role group<select name="groupId"><option value="">Choose a role group</option>${groups.map(group=>`<option value="${ctx.e(group.id)}">${ctx.e(group.label)} · ${group.memberIds.length}</option>`).join('')}</select></label><div data-audience="roster" class="communication-roster-summary">${ctx.icon('people')}<div><strong>Everyone on the current volunteer roster</strong><p>${roster.length} ${roster.length===1?'person':'people'} will receive this message.</p></div></div></div><label>Subject<input name="subject" maxlength="160" required placeholder="What is this message about?"></label><label>Message<textarea name="body" rows="5" maxlength="5000" required placeholder="Write a clear update for your volunteers…"></textarea></label><p class="form-error" role="alert" tabindex="-1"></p></div><div class="dialog-footer">${ctx.button('Cancel','close','','btn secondary')}<button class="btn primary" type="submit">Send Message</button></div></form>`;
}
