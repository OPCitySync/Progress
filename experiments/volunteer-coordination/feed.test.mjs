import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from './model.js';
import { ensureFeed, heartCount, participantQueueItems, selectFeedPosts, transitionFeed } from './feed-model.js';
import { ensureRecruitment } from './recruitment-model.js';
import { renderFeed, renderVolunteerActionHistory } from './feed-view.js';

test('adding the feed to existing saved state preserves all coordination edits', () => {
  const old = createInitialState(); delete old.feed;
  old.people[0].availability = 'Only on Sundays';
  const migrated = ensureFeed(old);
  assert.equal(migrated.feed.posts.length, 4);
  assert.equal(migrated.people[0].availability, 'Only on Sundays');
  assert.deepEqual(migrated.commitments, old.commitments);
  assert.equal(ensureFeed(migrated), migrated);
  assert.deepEqual(migrated.feed.queueAcknowledgements, {});
});

test('participant queue acknowledgements are reversible, person-scoped, and preserve the underlying action', () => {
  const before = ensureRecruitment(createInitialState());
  const item = participantQueueItems(before, 'alex').find(entry => entry.key.startsWith('commitment:c6:')) || participantQueueItems(before, 'alex')[0];
  assert.ok(item);
  const acknowledged = transitionFeed(before, { type: 'acknowledgeQueue', actor: 'alex', key: item.key }).state;
  assert.deepEqual(acknowledged.commitments, before.commitments);
  assert.equal(participantQueueItems(acknowledged, 'alex').some(entry => entry.key === item.key), false);
  assert.equal(participantQueueItems(acknowledged, 'robin').some(entry => entry.key === item.key), false);
  assert.equal(acknowledged.feed.queueAcknowledgements.alex[0].key, item.key);
  const restored = transitionFeed(acknowledged, { type: 'restoreQueue', actor: 'alex', key: item.key }).state;
  assert.ok(participantQueueItems(restored, 'alex').some(entry => entry.key === item.key));
  assert.throws(() => transitionFeed(acknowledged, { type: 'acknowledgeQueue', actor: 'alex', key: item.key }), /changed|acknowledged/);
});

test('organization publication is shared without creating membership or a commitment', () => {
  const before = createInitialState();
  const { state, postId } = transitionFeed(before, { type: 'publish', actor: 'coordinator', body: 'Come join us!', activityId: 'garden' });
  assert.equal(selectFeedPosts(state, { actor: 'robin' })[0].id, postId);
  assert.equal(state.feed.posts[0].activityId, 'garden');
  assert.deepEqual(state.people, before.people);
  assert.deepEqual(state.commitments, before.commitments);
  assert.throws(() => transitionFeed(before, { type: 'publish', actor: 'alex', body: 'Test' }), /coordinators/);
});

test('publication rejects private activities, invalid attachments, and empty or overlong text', () => {
  const state = createInitialState();
  const publish = values => transitionFeed(state, { type: 'publish', actor: 'coordinator', body: 'Update', ...values });
  assert.throws(() => publish({ activityId: 'pantry' }), /Only public/);
  assert.throws(() => publish({ activityId: 'missing' }), /Only public/);
  assert.throws(() => publish({ body: ' ' }), /1,000/);
  assert.throws(() => publish({ body: 'a'.repeat(1001) }), /1,000/);
  assert.throws(() => publish({ imageUrl: 'javascript:alert(1)' }), /image/);
  assert.throws(() => publish({ imageUrl: 'data:image/png;base64,AAAA' }), /description/);
  assert.equal(publish({ imageUrl: 'data:image/png;base64,AAAA', imageAlt: 'Sample image' }).state.feed.posts[0].imageAlt, 'Sample image');
});

test('likes toggle per viewer and trending uses the current total', () => {
  let state = createInitialState(); const postId = 'garden-invitation';
  state = transitionFeed(state, { type: 'like', postId, actor: 'alex' }).state;
  state = transitionFeed(state, { type: 'like', postId, actor: 'robin' }).state;
  assert.equal(heartCount(state.feed.posts.find(p => p.id === postId)), 26);
  state = transitionFeed(state, { type: 'like', postId, actor: 'alex' }).state;
  assert.equal(heartCount(state.feed.posts.find(p => p.id === postId)), 25);
  assert.deepEqual(state.feed.posts.find(p => p.id === postId).likedBy, ['robin']);
  assert.equal(selectFeedPosts(state, { filter: 'trending' })[0].id, 'tools-together');
});

test('bookmarks are private to each sample persona and filter/search compose', () => {
  let state = createInitialState();
  state = transitionFeed(state, { type: 'bookmark', postId: 'garden-invitation', actor: 'alex' }).state;
  assert.equal(selectFeedPosts(state, { saved: true, actor: 'alex' }).length, 1);
  assert.equal(selectFeedPosts(state, { saved: true, actor: 'coordinator' }).length, 0);
  assert.equal(selectFeedPosts(state, { saved: true, actor: 'robin' }).length, 0);
  assert.equal(selectFeedPosts(state, { saved: true, actor: 'alex', query: 'repair' }).length, 0);
  assert.equal(selectFeedPosts(state, { query: 'tool library' })[0].id, 'tools-together');
  assert.equal(selectFeedPosts(state, { filter: 'news' }).length, 0);
  state = transitionFeed(state, { type: 'bookmark', postId: 'garden-invitation', actor: 'alex' }).state;
  assert.equal(selectFeedPosts(state, { saved: true, actor: 'alex' }).length, 0);
});

test('participant feed places actionable work below the toolbar and City Pulse below local organizations', () => {
  const state = ensureRecruitment(createInitialState());
  const ui = { mode: 'volunteer', person: 'alex', item: '', feedFilter: 'all', feedSaved: false, feedQuery: '', feedQueueCollapsed: false };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const icon = name => `<i data-icon="${name}"></i>`;
  const button = (label, action, attrs = '', className = 'btn') => `<button class="${className}" data-action="${action}" ${attrs}>${label}</button>`;
  const badge = label => `<span>${escapeHtml(label)}</span>`;
  const avatar = person => `<span>${escapeHtml(person.name)}</span>`;
  const html = renderFeed({
    state, ui, e: escapeHtml, icon, button, badge, avatar, dateLabel: value => value,
    currentPerson: () => state.people.find(person => person.id === ui.person),
    confirmedCount: (source, activityId) => source.commitments.filter(commitment => commitment.activityId === activityId && commitment.status === 'confirmed').length,
  });
  assert.match(html, /city-feed-control-stack has-action-queue/);
  assert.match(html, /Action Queue/);
  assert.match(html, /Review invitation/);
  assert.match(html, /data-action="feedQueueToggle"/);
  assert.match(html, /data-action="feedQueueHistory"/);
  assert.match(html, /data-icon="history"/);
  assert.match(html, /data-action="feedQueueAcknowledge"/);
  assert.match(html, />Acknowledge</);
  assert.match(html, /aria-expanded="true"/);
  assert.doesNotMatch(html, /View My Volunteering/);
  assert.doesNotMatch(html, /city-attention/);
  assert.ok(html.indexOf('Local organizations') < html.indexOf('CITY PULSE'));
  assert.match(html, />Messages</);
  assert.doesNotMatch(html, />Conversations</);

  ui.feedQueueCollapsed = true;
  const collapsed = renderFeed({
    state, ui, e: escapeHtml, icon, button, badge, avatar, dateLabel: value => value,
    currentPerson: () => state.people.find(person => person.id === ui.person),
    confirmedCount: (source, activityId) => source.commitments.filter(commitment => commitment.activityId === activityId && commitment.status === 'confirmed').length,
  });
  assert.match(collapsed, /aria-expanded="false"/);
  assert.doesNotMatch(collapsed, /id="participant-action-queue-items"/);
  assert.doesNotMatch(collapsed, /Review invitation/);
});

test('participant action history explains acknowledgement and restores an item', () => {
  const original = ensureRecruitment(createInitialState());
  const item = participantQueueItems(original, 'alex')[0];
  const state = transitionFeed(original, { type: 'acknowledgeQueue', actor: 'alex', key: item.key }).state;
  const html = renderVolunteerActionHistory({
    state,
    ui: { person: 'alex' },
    e: value => String(value ?? ''),
    icon: name => `<i data-icon="${name}"></i>`,
    button: (label, action, attrs = '') => `<button data-action="${action}" ${attrs}>${label}</button>`,
  });
  assert.match(html, /Acknowledgements record what you’ve seen/);
  assert.match(html, /data-action="feedQueueRestore"/);
  assert.match(html, /Still actionable/);
});

test('participant action queue keeps History available after the final item is acknowledged', () => {
  let state = ensureRecruitment(createInitialState());
  const ui = { mode: 'volunteer', person: 'alex', item: '', feedFilter: 'all', feedSaved: false, feedQuery: '', feedQueueCollapsed: false };
  for (const item of participantQueueItems(state, ui.person)) {
    state = transitionFeed(state, { type: 'acknowledgeQueue', actor: ui.person, key: item.key }).state;
  }
  const html = renderFeed({
    state, ui, e: value => String(value ?? ''), icon: name => `<i data-icon="${name}"></i>`,
    button: (label, action, attrs = '', className = 'btn') => `<button class="${className}" data-action="${action}" ${attrs}>${label}</button>`,
    badge: label => `<span>${label}</span>`, avatar: person => `<span>${person.name}</span>`, dateLabel: value => value,
    currentPerson: () => state.people.find(person => person.id === ui.person), confirmedCount: () => 0,
  });
  assert.match(html, /Action Queue <span>0<\/span>/);
  assert.match(html, /data-action="feedQueueHistory"/);
  assert.match(html, /You’re all caught up\./);
});
