import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from './model.js';
import { ensureFeed, heartCount, selectFeedPosts, transitionFeed } from './feed-model.js';

test('adding the feed to existing saved state preserves all coordination edits', () => {
  const old = createInitialState(); delete old.feed;
  old.people[0].availability = 'Only on Sundays';
  const migrated = ensureFeed(old);
  assert.equal(migrated.feed.posts.length, 4);
  assert.equal(migrated.people[0].availability, 'Only on Sundays');
  assert.deepEqual(migrated.commitments, old.commitments);
  assert.equal(ensureFeed(migrated), migrated);
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
