import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState} from './model.js';
import {ensureCommunications,communicationGroups,transitionCommunication,volunteerInbox} from './communication-model.js';
import {renderConversations} from './communication-view.js';

const initial=()=>ensureCommunications(createInitialState());
const apply=(state,action)=>transitionCommunication(state,action).state;
const ctx=(state,ui={})=>({state,ui:{mode:'coordinator',person:'alex',communicationPane:'messages',communicationChatView:'active',communicationQuery:'',communicationSelection:'',...ui},e:value=>String(value??''),icon:name=>`<i>${name}</i>`,button:(label,action,attrs='',classes='btn')=>`<button class="${classes}" data-action="${action}" ${attrs}>${label}</button>`,avatar:person=>person.name,dateLabel:value=>value,currentPerson:()=>state.people.find(person=>person.id===(ui.person||'alex'))});

test('communication migration is additive and idempotent',()=>{
 const state=createInitialState(),before=structuredClone(state.commitments);ensureCommunications(state);const migrated=structuredClone(state);ensureCommunications(state);assert.deepEqual(state,migrated);assert.deepEqual(state.commitments,before);assert.equal(state.communications.outbound.length,2);
});

test('organization messages snapshot roster recipients without creating commitments',()=>{
 const before=initial();const state=apply(before,{type:'send',actor:'coordinator',audienceType:'roster',subject:'Schedule update',body:'Please review the new arrival time.'});const sent=state.communications.outbound[0];
 assert.equal(sent.audienceLabel,'Full volunteer roster');assert.ok(sent.recipientIds.includes('alex'));assert.ok(!sent.recipientIds.includes('robin'));assert.deepEqual(state.commitments,before.commitments);assert.equal(before.communications.outbound.length,2);
});

test('role groups and individual recipients stay explicitly scoped',()=>{
 const start=initial(),group=communicationGroups(start).find(item=>item.label==='Delivery team');assert.deepEqual(group.memberIds.sort(),['jamie','priya']);
 const grouped=apply(start,{type:'send',actor:'coordinator',audienceType:'group',groupId:group.id,subject:'Driver note',body:'Please check your route.'});assert.deepEqual(grouped.communications.outbound[0].recipientIds.sort(),['jamie','priya']);
 const individual=apply(start,{type:'send',actor:'coordinator',audienceType:'individual',recipientIds:['jules'],subject:'Review',body:'The draft is ready.'});assert.deepEqual(individual.communications.outbound[0].recipientIds,['jules']);
});

test('message sending enforces organization authority and a real audience',()=>{
 const state=initial();assert.throws(()=>apply(state,{type:'send',actor:'alex',audienceType:'roster',subject:'Hello',body:'Test'}),/organization account/);assert.throws(()=>apply(state,{type:'send',actor:'coordinator',audienceType:'individual',recipientIds:['missing'],subject:'Hello',body:'Test'}),/at least one/);assert.throws(()=>apply(state,{type:'send',actor:'coordinator',audienceType:'roster',subject:'',body:'Test'}),/subject/);
});

test('inbox reads are private to the addressed volunteer',()=>{
 let state=initial();const message=volunteerInbox(state,'alex').find(item=>item.kind==='message');state=apply(state,{type:'readMessage',actor:'alex',messageId:message.id});assert.ok(state.communications.readBy.alex.includes(message.id));assert.equal(state.communications.readBy.priya,undefined);assert.throws(()=>apply(state,{type:'readMessage',actor:'robin',messageId:message.id}),/not available/);
});

test('consolidated views expose issuer modes and the volunteer inbox without editor controls',()=>{
 const state=initial(),issuer=renderConversations(ctx(state));assert.match(issuer,/Communication Center/);assert.match(issuer,/Messages/);assert.match(issuer,/Activity Chats/);assert.match(issuer,/Notifications/);assert.match(issuer,/New Message/);
 const volunteer=renderConversations(ctx(state,{mode:'volunteer',person:'alex',communicationPane:'inbox'}));assert.match(volunteer,/Messages/);assert.match(volunteer,/Inbox/);assert.match(volunteer,/Archive/);assert.doesNotMatch(volunteer,/New Message/);
});
