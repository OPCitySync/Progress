import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, transition, missingRequirements } from './model.js';
import { volunteerResume, ensurePassport, transitionPassport, sharedPassport, requirementReady, acceptedEvidence, passportExport, recordStatus, portableFoodEligible, readinessIssues } from './passport-model.js';
import { renderPassport } from './passport-view.js';
import { VOLUNTEER_SECTIONS } from './navigation-view.js';

const date = '2026-09-23';
const act = (state, action) => transitionPassport(state, { personId: 'elena', actor: 'elena', ...action }, date).state;
const share = (state, extra = {}) => act(state, { type: 'share', orgId: 'berkeley-neighbors', sections: [], recordIds: ['elena-food'], expires: '2026-10-23', purpose: 'Packing readiness', ...extra });
const accept = state => act(state, { type: 'decide', actor: 'coordinator', recordId: 'elena-food', outcome: 'accepted', basis: 'Issuer and current course meet our food-packing/1 agreement.' });
const ready = state => requirementReady(state, state.people.find(p => p.id === 'elena'), 'food', date);

test('migration preserves existing people, feed, commitments and local readiness; is idempotent', () => {
  const state = createInitialState(); delete state.passports;
  const before = structuredClone(state); ensurePassport(state);
  assert.deepEqual(state.people, before.people); assert.deepEqual(state.commitments, before.commitments); assert.deepEqual(state.feed, before.feed);
  const passport = structuredClone(state.passports); ensurePassport(state); assert.deepEqual(state.passports, passport);
  assert.equal(state.passports.grants.length, 0); assert.equal(sharedPassport(state, 'elena'), null);
  assert.equal(state.passports.records.some(r => r.personId === 'robin'), false);
});
test('selected view excludes unselected contact, preferences, profile, other people, and newly added records', () => {
  let state = share(createInitialState());
  state = act(state, { type: 'addRecord', kind: 'service', title: 'Helped set up', organizationId: 'berkeley-neighbors', date: '2026-09-20', summary: 'Arranged tables', hours: 2 });
  const view = sharedPassport(state, 'elena', 'berkeley-neighbors', date);
  assert.equal(view.records.length, 1); assert.equal(view.records[0].id, 'elena-food');
  for (const field of ['email', 'about', 'availability', 'preference', 'audit', 'relationship']) assert.equal(field in view, false);
  assert.equal(sharedPassport(state, 'elena', 'tool-library', date), null);
});
test('owner and reviewer actions enforce persona boundaries', () => {
  const state = share(createInitialState());
  assert.throws(() => act(state, { type: 'share', actor: 'alex' }), /Only the volunteer/);
  assert.throws(() => act(state, { type: 'profile', actor: 'coordinator', bio: 'Override' }), /Only the volunteer/);
  assert.throws(() => act(state, { type: 'decide', recordId: 'elena-food', outcome: 'accepted', basis: 'Approve myself' }), /coordinator/);
  assert.throws(() => accept(createInitialState()), /not currently shared/);
  assert.throws(() => share(state, { recordIds: ['alex-service'] }), /own records/);
});
test('sharing does not grant readiness; scoped acceptance does and leaves membership and local checks intact', () => {
  let state = share(createInitialState()); assert.equal(ready(state), false);
  state = accept(state); assert.equal(ready(state), true);
  const p = state.people.find(p => p.id === 'elena');
  assert.equal(p.requirements.food, false); assert.equal(p.relationship, 'joining');
  assert.equal(requirementReady(state, p, 'driver', date), false);
  p.requirements.welcome = false; p.requirements.waiver = false;
  assert.deepEqual(missingRequirements(p, { requires: ['food', 'welcome', 'waiver'] }, state, date), ['welcome', 'waiver']);
});
test('consent expiry and revocation close access and invalidate derived readiness, retaining commitments', () => {
  let state = accept(share(createInitialState()));
  state.commitments.push({ id: 'future', personId: 'elena', activityId: 'meals', roleId: 'kitchen', status: 'confirmed' });
  assert.equal(acceptedEvidence(state, 'elena', 'food', '2026-10-24'), null);
  const before = structuredClone(state.commitments);
  state = act(state, { type: 'revokeShare', grantId: state.passports.grants[0].id });
  assert.equal(sharedPassport(state, 'elena', 'berkeley-neighbors', date), null); assert.equal(ready(state), false);
  assert.deepEqual(state.commitments, before); assert.equal(state.passports.decisions.length, 1);
});
test('new sharing requires a fresh acceptance, including after a revoked grant', () => {
  let state = accept(share(createInitialState()));
  state = share(state); assert.equal(ready(state), false);
  state = accept(state); assert.equal(ready(state), true);
  assert.equal(state.passports.grants.filter(g => !g.revokedAt).length, 1);
});
test('expired, disputed, untrusted and wrong-standard training cannot satisfy readiness', () => {
  for (const mutation of [r => r.expires = '2026-09-22', r => r.status = 'disputed', r => r.organizationId = 'external', r => r.standard = 'food-packing/2', r => r.attestation.organizationId = 'tool-library', r => r.status = 'self-reported']) {
    const state = share(createInitialState()); mutation(state.passports.records.find(r => r.id === 'elena-food'));
    assert.throws(() => accept(state), /does not meet/);
  }
});
test('dispute and follow-up suspend an existing acceptance and keep a reason', () => {
  const accepted = accept(share(createInitialState()));
  const disputed = act(accepted, { type: 'dispute', recordId: 'elena-food', basis: 'The completion date is wrong.' });
  assert.equal(ready(disputed), false); assert.equal(recordStatus(disputed.passports.records.find(r => r.id === 'elena-food'), date), 'disputed');
  const followup = act(accepted, { type: 'decide', actor: 'coordinator', recordId: 'elena-food', outcome: 'needs-follow-up', basis: 'Please clarify course coverage.' });
  assert.equal(ready(followup), false); assert.match(followup.passports.decisions[0].basis, /clarify/);
  assert.equal(followup.passports.decisions.length, 2); assert.equal(followup.passports.decisions[1].outcome, 'accepted');
  assert.match(followup.passports.decisions[1].basis, /Issuer and current course/);
});
test('reviewers cannot impersonate an external issuer or attest unshared records', () => {
  const state = share(createInitialState());
  assert.throws(() => act(state, { type: 'attest', actor: 'coordinator', recordId: 'elena-food', basis: 'Looks fine' }), /issuing organization/);
  assert.throws(() => act(state, { type: 'withdraw', actor: 'coordinator', recordId: 'elena-food', basis: 'Change' }), /issuing organization/);
});
test('local record confirmation records provenance; withdrawal invalidates its acceptance', () => {
  let state = act(createInitialState(), { type: 'addRecord', kind: 'training', title: 'Food packing', organizationId: 'berkeley-neighbors', standard: 'food-packing/1', date: '2026-09-10', expires: '2027-09-10', summary: 'Packing and hygiene' });
  const id = state.passports.records.at(-1).id;
  assert.equal(portableFoodEligible(state.passports.records.at(-1), date), false);
  state = share(state, { recordIds: [id] });
  state = act(state, { type: 'attest', actor: 'coordinator', recordId: id, basis: 'Course register 27' });
  assert.equal(ready(state), false);
  state = act(state, { type: 'decide', actor: 'coordinator', recordId: id, outcome: 'accepted', basis: 'Meets course standard.' });
  assert.equal(ready(state), true);
  state = act(state, { type: 'withdraw', actor: 'coordinator', recordId: id, basis: 'Register entry was incorrect.' });
  assert.equal(ready(state), false); assert.equal(state.passports.records.at(-1).attestation.by, 'Maya Thompson');
});
test('existing local preparation survives a passport expiry', () => {
  const state = accept(share(createInitialState())); const p = state.people.find(p => p.id === 'elena'); p.requirements.food = true;
  assert.equal(requirementReady(state, p, 'food', '2028-01-01'), true);
});
test('future activity readiness checks expiry at the activity date', () => {
  const state = accept(share(createInitialState(), { expires: '2026-09-25' }));
  const p = state.people.find(p => p.id === 'elena');
  assert.deepEqual(missingRequirements(p, { requires: ['food'] }, state, '2026-09-29'), ['food']);
});
test('passport acceptance feeds real signup rules without auto-joining or booking', () => {
  const state = accept(share(createInitialState()));
  // Use an undated test activity so this check is stable as the sample calendar ages.
  state.activities.find(a => a.id === 'meals').date = '';
  state.passports.grants[0].expires = '2099-01-01'; state.passports.records.find(r => r.id === 'elena-food').expires = '2099-01-01';
  const signup = { type: 'commit', personId: 'elena', activityId: 'meals', roleId: 'kitchen', status: 'confirmed', actor: 'volunteer' };
  assert.throws(() => transition(state, signup), /Join the organization/);
  const joined = transition(state, { type: 'membership', personId: 'elena', relationship: 'member' }).state;
  const signedUp = transition(joined, signup).state;
  assert.equal(signedUp.commitments.at(-1).status, 'confirmed');
});
test('completed service is self-reported until issuer confirmation; no hours manufactured from schedules', () => {
  let state = createInitialState(); const before = state.passports.records.length;
  state = transition(state, { type: 'attendance', commitmentId: 'c1', attendance: 'present' }).state;
  assert.equal(state.passports.records.length, before);
  state = act(state, { type: 'addRecord', kind: 'service', title: 'Garden support', organizationId: 'external', issuer: 'Neighborhood group', date, hours: '', summary: 'Prepared planting beds' });
  const r = state.passports.records.at(-1); assert.equal(r.hours, null); assert.equal(r.status, 'self-reported');
  assert.throws(() => act(state, { type: 'addRecord', kind: 'service', title: 'Future shift', date: '2026-10-01' }), /completion date/);
});
test('export includes only the owner’s record and history with a versioned schema', () => {
  const state = accept(share(createInitialState(), { sections: ['about', 'contact'] }));
  const exported = passportExport(state, 'elena');
  assert.equal(exported.schemaVersion, 1); assert.equal(exported.prototype, true);
  assert.equal(exported.records.every(r => r.personId === 'elena'), true);
  assert.equal(JSON.stringify(exported).includes('Alex Chen'), false);
  assert.equal('commitments' in exported, false);
});
test('invalid share dates, empty selections, and invalid sections are rejected without mutating source', () => {
  const state = createInitialState(); const before = structuredClone(state);
  for (const extra of [{ expires: '2026-02-31' }, { expires: '2026-09-23' }, { expires: '2030-01-01' }, { sections: [], recordIds: [] }, { sections: ['requirements'] }]) assert.throws(() => share(state, extra));
  assert.deepEqual(state, before);
});
test('new roster entries receive an empty passport immediately', () => {
  const state = transition(createInitialState(), { type: 'addPerson', name: 'New Volunteer', email: 'new@example.org', method: 'existing' }).state;
  const person = state.people.at(-1);
  assert.deepEqual(state.passports.profiles[person.id], { city: '', languages: '', skills: '', bio: '', openForVolunteering: false });
  assert.equal(state.passports.records.some(r => r.personId === person.id), false);
});
test('readiness alerts survive follow-up and cover future dates without flagging completed past work', () => {
  let state = accept(share(createInitialState()));
  state.commitments.push({ id: 'review-plan', personId: 'elena', activityId: 'meals', roleId: 'kitchen', status: 'confirmed' });
  assert.equal(readinessIssues(state, date).some(c => c.id === 'review-plan'), false);
  state = act(state, { type: 'decide', actor: 'coordinator', recordId: 'elena-food', outcome: 'needs-follow-up', basis: 'Please recheck the course record.' });
  assert.equal(readinessIssues(state, date).some(c => c.id === 'review-plan'), true);
  assert.equal(readinessIssues(state, '2026-10-01').some(c => c.id === 'review-plan'), false);
});


test('résumé starts private and empty without deriving experience from commitments', () => {
  const state = ensurePassport(createInitialState());
  assert.deepEqual(volunteerResume(state, 'alex'), { name: 'Alex Chen', records: [] });
  assert.equal(state.passports.grants.length, 0);
});
test('résumé saves explicit selections, excludes contact and future additions, and survives migration', () => {
  let state = act(createInitialState(), {type:'resume', sections:['about'], recordIds:['elena-food']});
  state = act(state, {type:'addRecord', kind:'service', title:'New contribution', organizationId:'berkeley-neighbors', date:'2026-09-20', summary:'Packed supplies', hours:2});
  state = ensurePassport(JSON.parse(JSON.stringify(state)));
  const view = volunteerResume(state, 'elena');
  assert.equal(view.records.length, 1);
  assert.equal(view.records[0].id, 'elena-food');
  assert.equal(view.about.city, 'Berkeley');
  for (const key of ['email','availability','preference','audit','grants']) assert.equal(key in view, false);
  assert.equal(state.passports.grants.length, 0);
  assert.deepEqual(volunteerResume(state, 'alex'), {name:'Alex Chen',records:[]});
});
test('résumé rejects other volunteers’ records and coordinator edits', () => {
  assert.throws(() => act(createInitialState(), {type:'resume', sections:[], recordIds:['alex-service']}), /own records/);
  assert.throws(() => act(createInitialState(), {type:'resume', actor:'coordinator', sections:[], recordIds:[]}), /Only the volunteer/);
  assert.throws(() => act(createInitialState(), {type:'resume', sections:['requirements'], recordIds:[]}), /Unknown résumé/);
});
test('résumé reflects changed evidence status and keeps its projection independent', () => {
  let state = act(createInitialState(), {type:'resume', sections:[], recordIds:['elena-food']});
  state = act(state, {type:'dispute', recordId:'elena-food', basis:'Completion date needs correcting'});
  const view = volunteerResume(state, 'elena');
  assert.equal(view.records[0].status, 'disputed');
  assert.equal(view.records[0].correction, 'Completion date needs correcting');
  view.records[0].title = 'Changed copy';
  assert.notEqual(state.passports.records.find(r => r.id==='elena-food').title, 'Changed copy');
});

test('passport keeps experience on MyPassport and removes the standalone History tab', () => {
  const state = ensurePassport(createInitialState());
  const output = renderPassport({
    state,
    ui: { mode: 'volunteer', page: 'passport', person: 'alex' },
    currentPerson: () => state.people.find(person => person.id === 'alex'),
    e: value => String(value ?? ''),
    button: (label, action, attrs = '', classes = 'btn') => `<button class="${classes}" data-action="${action}" ${attrs}>${label}</button>`,
    badge: (label, tone = '') => `<span class="badge ${tone}">${label}</span>`,
    avatar: () => '<span class="avatar"></span>',
    icon: name => `<span class="icon">${name}</span>`,
  });

  assert.deepEqual(VOLUNTEER_SECTIONS.find(section => section.id === 'passport').tabs, [['passport', 'MyPassport'], ['resume', 'Résumé']]);
  assert.match(output, /<span class="eyebrow">VOLUNTEER PASSPORT<\/span>/);
  assert.match(output, /<h2>My Experience<\/h2>/);
  assert.match(output, /<h2>Volunteer Experience<\/h2>/);
  assert.match(output, /Neighborhood pantry team/);
  assert.match(output, /Contribution · Berkeley Neighbors · 2026-09-12/);
  assert.match(output, /Share MyPassport with City Network/);
  assert.ok(output.indexOf('+ Add a record') < output.indexOf('>Edit<'));
  assert.ok(output.indexOf('Choose what to share') < output.indexOf('Share MyPassport with City Network'));
  assert.doesNotMatch(output, /Share my passport|Make Passport Open/);
  assert.doesNotMatch(output, /YOUR EXPERIENCE GOES WITH YOU|Keep a record of what you bring|MYCITY · VOLUNTEER PASSPORT|What I bring|Edit profile|Update availability & preferences|Self-reported and organization-confirmed records/);
  assert.doesNotMatch(output, /Explore my history|data-page="history"|My volunteer history/);

  state.passports.profiles.alex.openForVolunteering = true;
  const visibleOutput = renderPassport({
    state,
    ui: { mode: 'volunteer', page: 'passport', person: 'alex' },
    currentPerson: () => state.people.find(person => person.id === 'alex'),
    e: value => String(value ?? ''),
    button: (label, action, attrs = '', classes = 'btn') => `<button class="${classes}" data-action="${action}" ${attrs}>${label}</button>`,
    badge: (label, tone = '') => `<span class="badge ${tone}">${label}</span>`,
    avatar: () => '<span class="avatar"></span>',
    icon: name => `<span class="icon">${name}</span>`,
  });
  assert.match(visibleOutput, /Remove from City Network/);
});
