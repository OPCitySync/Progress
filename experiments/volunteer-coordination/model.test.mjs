import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, transition, confirmedCount, activeCommitment, parseCSV } from './model.js';

const apply = (state, action) => transition(state, action).state;

test('membership approval preserves incomplete role preparation and creates no commitments', () => {
  const before = createInitialState();
  const after = apply(before, { type: 'membership', personId: 'elena', relationship: 'member' });
  assert.equal(after.people.find(p => p.id === 'elena').relationship, 'member');
  assert.equal(after.people.find(p => p.id === 'elena').requirements.food, false);
  assert.deepEqual(after.commitments, before.commitments);
  assert.equal(before.people.find(p => p.id === 'elena').relationship, 'joining');
});

test('a public event participant can confirm without being admitted as an ongoing member', () => {
  let state = createInitialState();
  for (const key of ['welcome', 'waiver']) state = apply(state, { type: 'requirement', personId: 'robin', key, actor: 'volunteer' });
  state = apply(state, { type: 'commit', activityId: 'garden', roleId: 'garden', personId: 'robin', status: 'confirmed', actor: 'volunteer' });
  assert.equal(state.people.find(p => p.id === 'robin').relationship, 'event-only');
  assert.equal(activeCommitment(state, 'robin', 'garden').status, 'confirmed');
  assert.throws(() => apply(state, { type: 'commit', activityId: 'pantry', roleId: 'packing', personId: 'robin', status: 'confirmed', actor: 'volunteer' }), /Join the organization/);
});

test('proposals do not count as coverage; acceptance does and cannot repeat', () => {
  let state = createInitialState();
  assert.equal(confirmedCount(state, 'garden'), 1);
  state = apply(state, { type: 'respond', commitmentId: 'c7', accept: true });
  assert.equal(confirmedCount(state, 'garden'), 2);
  assert.throws(() => apply(state, { type: 'respond', commitmentId: 'c7', accept: true }), /no longer pending/);
});

test('late cancellation, waitlist offer, and volunteer acceptance preserve membership and capacity', () => {
  let state = createInitialState();
  state = apply(state, { type: 'cancel', commitmentId: 'c1', note: 'Unexpected conflict' });
  assert.equal(confirmedCount(state, 'pantry', 'packing'), 2);
  assert.equal(state.people.find(p => p.id === 'alex').relationship, 'member');
  assert.match(state.notifications[0].text, /Alex Chen can’t attend/);
  state = apply(state, { type: 'offerWaitlist', commitmentId: 'c6' });
  assert.equal(confirmedCount(state, 'pantry', 'packing'), 2);
  state = apply(state, { type: 'respond', commitmentId: 'c6', accept: true });
  assert.equal(confirmedCount(state, 'pantry', 'packing'), 3);
});

test('capacity is rechecked at acceptance when other volunteers take the last place', () => {
  let state = createInitialState();
  state = apply(state, { type: 'requirement', personId: 'jules', key: 'driver', actor: 'coordinator' });
  state = apply(state, { type: 'commit', activityId: 'pantry', roleId: 'delivery', personId: 'jules', status: 'proposed', actor: 'coordinator' });
  const invitationId = state.commitments.at(-1).id;
  state = apply(state, { type: 'respond', commitmentId: 'c3', accept: true });
  assert.throws(() => apply(state, { type: 'respond', commitmentId: invitationId, accept: true }), /role has filled/);
  assert.equal(confirmedCount(state, 'pantry', 'delivery'), 2);
});

test('private activities allow prepared members to self-sign up', () => {
  const state = apply(createInitialState(), { type: 'commit', activityId: 'meals', roleId: 'kitchen', personId: 'alex', status: 'confirmed', actor: 'volunteer' });
  assert.equal(activeCommitment(state, 'alex', 'meals').status, 'confirmed');
});

test('qualification is role-specific and cannot be self-approved', () => {
  let state = createInitialState();
  assert.throws(() => apply(state, { type: 'requirement', personId: 'jules', key: 'driver', actor: 'volunteer' }), /coordinator/);
  assert.throws(() => apply(state, { type: 'commit', activityId: 'pantry', roleId: 'delivery', personId: 'jules', status: 'confirmed', actor: 'volunteer' }), /preparation/);
  state = apply(state, { type: 'requirement', personId: 'jules', key: 'driver', actor: 'coordinator' });
  state = apply(state, { type: 'commit', activityId: 'pantry', roleId: 'delivery', personId: 'jules', status: 'confirmed', actor: 'volunteer' });
  assert.equal(activeCommitment(state, 'jules', 'pantry').status, 'confirmed');
});

test('pausing preserves previous plans but prevents new commitments', () => {
  const before = createInitialState();
  const state = apply(before, { type: 'membership', personId: 'alex', relationship: 'paused' });
  assert.deepEqual(state.commitments, before.commitments);
  assert.throws(() => apply(state, { type: 'respond', commitmentId: 'c7', accept: true }), /resume membership/);
  assert.throws(() => apply(state, { type: 'commit', activityId: 'meals', roleId: 'kitchen', personId: 'alex', status: 'confirmed', actor: 'coordinator' }), /resume membership/);
});

test('duplicate emails and duplicate activity commitments cannot create parallel records', () => {
  const state = createInitialState();
  assert.throws(() => apply(state, { type: 'addPerson', name: 'Different Name', email: ' ALEX.CHEN@example.org ', method: 'existing' }), /already in People/);
  assert.throws(() => apply(state, { type: 'commit', activityId: 'pantry', roleId: 'packing', personId: 'alex', status: 'confirmed', actor: 'volunteer' }), /already a commitment/);
});

test('availability changes never create bookings', () => {
  const before = createInitialState();
  const after = apply(before, { type: 'preferences', personId: 'alex', availability: 'Sundays only', preference: 'Monthly' });
  assert.deepEqual(after.commitments, before.commitments);
});

test('CSV preview understands quoted commas, escaped quotes, and CRLF', () => {
  assert.deepEqual(parseCSV('name,email,role\r\n"Chen, Casey",casey@example.org,"Garden ""lead"""\r\n'), [{ name: 'Chen, Casey', email: 'casey@example.org', role: 'Garden "lead"' }]);
  assert.throws(() => parseCSV('name,role\nAlex,Driver'), /name and email/);
  assert.throws(() => parseCSV('name,email\n"Alex,a@example.org'), /not closed/);
});

test('handoffs and conversations stay attached to the selected project', () => {
  let state = createInitialState();
  state = apply(state, { type: 'handoff', activityId: 'website', progress: 'Draft complete', next: 'Maya reviews', owner: 'Maya' });
  state = apply(state, { type: 'message', activityId: 'website', author: 'Jules', text: 'Ready for a review.' });
  assert.equal(state.activities.find(a => a.id === 'website').progress, 'Draft complete');
  assert.equal(state.messages.at(-1).activityId, 'website');
  assert.equal(state.activities.find(a => a.id === 'garden').owner, 'Sam Williams');
});
