import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from './model.js';
import { ensureFeed, heartCount, participantQueueItems, selectFeedPosts, transitionFeed } from './feed-model.js';
import { ensureRecruitment } from './recruitment-model.js';
import { ensurePrograms } from './program-model.js';
import { ensureProfiles } from './profile-model.js';
import { ensureIssuerHome } from './issuer-home-model.js';
import { renderFeed, renderVolunteerActionHistory } from './feed-view.js';
import { ISSUER_SECTIONS, issuerNavigation } from './navigation-view.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const icon = name => `<i data-icon="${name}"></i>`;
const button = (label, action, attrs = '', className = 'btn') => `<button class="${className}" data-action="${action}" ${attrs}>${label}</button>`;
const badge = label => `<span>${escapeHtml(label)}</span>`;
const avatar = person => `<span>${escapeHtml(person.name)}</span>`;
const confirmedCount = (source, activityId) => source.commitments.filter(commitment => commitment.activityId === activityId && commitment.status === 'confirmed').length;

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
  const html = renderFeed({
    state, ui, e: escapeHtml, icon, button, badge, avatar, dateLabel: value => value,
    currentPerson: () => state.people.find(person => person.id === ui.person),
    confirmedCount,
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
  assert.match(html, /data-action="feedSearchToggle"/);
  assert.match(html, /aria-label="Search MyCity Feed"/);
  assert.doesNotMatch(html, /id="feed-search"/);
  assert.doesNotMatch(html, /city-search-row/);
  assert.doesNotMatch(html, /feed-result-count/);
  assert.match(html, /<span>Bookmarks<\/span>/);
  assert.doesNotMatch(html, /<span>Bookmarks \d+<\/span>/);
  assert.doesNotMatch(html, /data-action="feedCompose"/);

  ui.feedSearchOpen = true;
  const searching = renderFeed({
    state, ui, e: escapeHtml, icon, button, badge, avatar, dateLabel: value => value,
    currentPerson: () => state.people.find(person => person.id === ui.person),
    confirmedCount,
  });
  assert.match(searching, /id="feed-toolbar-search"/);
  assert.match(searching, /id="feed-search"/);
  assert.match(searching, /aria-label="Close feed search"/);

  ui.feedSearchOpen = false;
  ui.feedQueueCollapsed = true;
  const collapsed = renderFeed({
    state, ui, e: escapeHtml, icon, button, badge, avatar, dateLabel: value => value,
    currentPerson: () => state.people.find(person => person.id === ui.person),
    confirmedCount,
  });
  assert.match(collapsed, /aria-expanded="false"/);
  assert.doesNotMatch(collapsed, /id="participant-action-queue-items"/);
  assert.doesNotMatch(collapsed, /Review invitation/);
});

test('issuer feed opens its public profile from the avatar without an action queue', () => {
  const state = ensureIssuerHome(ensureProfiles(ensurePrograms(ensureRecruitment(createInitialState()))));
  const ui = {
    mode: 'coordinator', person: 'alex', item: '', recruitOrg: 'berkeley-neighbors',
    feedFilter: 'all', feedSaved: false, feedQuery: '', feedPublicProfile: false,
    home: { anchor: '2026-10-06', period: 'month', day: '', selectedEntry: '', queueCollapsed: false, queueAll: false },
  };
  const context = {
    state, ui, e: escapeHtml, icon, button, badge, avatar, dateLabel: value => value,
    currentPerson: () => state.people.find(person => person.id === ui.person), confirmedCount,
    platformContext: null, integratedPlatform: false, assetBase: '',
  };
  const feed = renderFeed(context);
  assert.match(feed, /data-action="feedSearchToggle"/);
  assert.match(feed, /aria-label="Search MyCity Feed"/);
  assert.doesNotMatch(feed, /city-search-row/);
  assert.doesNotMatch(feed, /feed-result-count/);
  assert.match(feed, /<span>Saved<\/span>/);
  assert.doesNotMatch(feed, /<span>Saved \d+<\/span>/);
  assert.match(feed, /data-action="feedCompose"/);
  assert.match(feed, /city-profile-identity-card is-compact/);
  assert.match(feed, /city-person-cover profile-banner-art/);
  assert.match(feed, /city-profile-logo/);
  assert.match(feed, /class="city-profile-avatar" data-action="feedPublicProfile" data-view="profile"/);
  assert.match(feed, /aria-label="View Berkeley Neighbors public profile"/);
  assert.doesNotMatch(feed, /View Public Profile/);
  assert.match(feed, /Discover City Network/);
  assert.match(feed, /href="#\/coordinator\/discover"/);
  assert.doesNotMatch(feed, /city-feed-issuer-queue/);
  assert.doesNotMatch(feed, /city-issuer-queue-copy/);
  assert.doesNotMatch(feed, /has-issuer-queue/);
  assert.doesNotMatch(feed, /Pending organization actions/);
  assert.doesNotMatch(feed, /data-home-action="history"/);
  assert.doesNotMatch(feed, /data-home-action="acknowledge"/);
  assert.doesNotMatch(feed, /data-home-action="collapse"/);
  assert.doesNotMatch(feed, /You’re all caught up/);
  assert.doesNotMatch(feed, /city-feed-floating-actions/);
  assert.doesNotMatch(feed, /city-quick-actions/);
  assert.match(feed, /id="feed-posts"/);

  const quietState = structuredClone(state);
  quietState.activities = [];
  quietState.recruitment.applications = [];
  quietState.people.forEach(person => { person.relationship = 'member'; });
  const quietFeed = renderFeed({ ...context, state: quietState });
  assert.doesNotMatch(quietFeed, /city-feed-issuer-queue/);
  assert.doesNotMatch(quietFeed, /has-issuer-queue/);

  const originalLocation = globalThis.location;
  globalThis.location = { origin: 'http://localhost:4320' };
  try {
    ui.feedPublicProfile = true;
    const profile = renderFeed(context);
    assert.match(profile, /Embedded public profile/);
    assert.match(profile, /city-layout city-layout-issuer is-profile-view/);
    assert.match(profile, /city-profile-identity-card is-expanded/);
    assert.match(profile, /Berkeley Neighbors/);
    assert.match(profile, /Back to MyCity Feed/);
    assert.match(profile, /data-view="feed"/);
    assert.match(profile, /data-action="pfAppearance"/);
    assert.match(profile, /data-action="pfOverview"/);
    assert.match(profile, /data-action="pfAbout"/);
    assert.match(profile, /data-action="pfContact"/);
    assert.match(profile, /data-action="pfLinks"/);
    assert.match(profile, /A PERSON YOU CAN TURN TO/);
    assert.match(profile, />Socials</);
    assert.doesNotMatch(profile, /Edit Public Profile|data-action="pfEditor"/);
    assert.doesNotMatch(profile, /FIND YOUR WAY IN|Ways to get involved/);
    assert.doesNotMatch(profile, /id="feed-posts"/);
    assert.doesNotMatch(profile, /aria-label="Your organization space"/);
    assert.doesNotMatch(profile, /Discover City Network/);
    assert.doesNotMatch(profile, /class="city-profile-avatar"/);
    assert.doesNotMatch(profile, /public-profile-hero/);
    assert.equal((profile.match(/profile-banner-art/g)||[]).length,1);
    assert.match(profile, /aria-label="Public profile details"/);
    assert.doesNotMatch(profile, /CITY PULSE/);
    assert.doesNotMatch(profile, /city-feed-floating-actions/);

    const connectedShell = structuredClone(state);
    connectedShell.recruitment.organizations = [];
    const emptyProfile = renderFeed({ ...context, state: connectedShell, integratedPlatform: true, platformContext: { cityName: 'Berkeley', organization: { name: 'Riverside Food Bank' } } });
    assert.match(emptyProfile, /Riverside Food Bank/);
    assert.match(emptyProfile, /Your public profile is ready to be shaped/);
    assert.match(emptyProfile, /city-profile-identity-card is-expanded/);
    assert.doesNotMatch(emptyProfile, /Organization not found/);
  } finally {
    if (originalLocation === undefined) delete globalThis.location;
    else globalThis.location = originalLocation;
  }
});

test('issuer Home opens the command center without a duplicated quick-action subheader', () => {
  const state = ensureIssuerHome(ensureProfiles(ensurePrograms(ensureRecruitment(createInitialState()))));
  const ui = { mode: 'coordinator', page: 'feed', person: 'alex' };
  const html = issuerNavigation({
    state, ui, e: escapeHtml, icon, button, avatar, assetBase: '', integratedPlatform: false,
    connectedPlatform: false, coordinatorName: 'Coordinator', platformContext: null,
    currentPerson: () => state.people.find(person => person.id === ui.person),
  });
  assert.equal(ISSUER_SECTIONS[0].page, 'home');
  assert.deepEqual(ISSUER_SECTIONS.map(section => [section.label, section.page]), [
    ['Home', 'home'],
    ['Volunteers', 'people'],
    ['MyCity Feed', 'feed'],
  ]);
  assert.equal(ISSUER_SECTIONS.some(section => section.id === 'profile'), false);
  assert.match(html, /href="#\/coordinator\/home"[^>]*aria-label="MyCity home"/);
  assert.match(html, /href="#\/coordinator\/feed" class="issuer-section-link is-active" aria-current="true"[^>]*>.*?<span>MyCity Feed<\/span>/s);
  assert.doesNotMatch(html, /class="issuer-quickbar"/);
  assert.doesNotMatch(html, /Schedule Activity/);
  assert.doesNotMatch(html, /Invite Volunteers/);
  assert.doesNotMatch(html, />Overview</);
  assert.match(html, />MyCity Feed</);
  assert.doesNotMatch(html, />City Network</);
  assert.doesNotMatch(html, />Public Profile</);
});

test('organization command center is the current primary Home destination', () => {
  const state = ensureIssuerHome(ensureProfiles(ensurePrograms(ensureRecruitment(createInitialState()))));
  const ui = { mode: 'coordinator', page: 'home', person: 'alex' };
  const html = issuerNavigation({
    state, ui, e: escapeHtml, icon, button, avatar, assetBase: '', integratedPlatform: false,
    connectedPlatform: false, coordinatorName: 'Coordinator', platformContext: null,
    currentPerson: () => state.people.find(person => person.id === ui.person),
  });
  assert.match(html, /href="#\/coordinator\/home" class="issuer-section-link is-active" aria-current="true"/);
  assert.doesNotMatch(html, /issuer-quickbar/);
});

test('workspace pages keep their local tabs under the three-section application header', () => {
  const state = ensureIssuerHome(ensureProfiles(ensurePrograms(ensureRecruitment(createInitialState()))));
  const ui = { mode: 'coordinator', page: 'documents', person: 'alex' };
  const html = issuerNavigation({
    state, ui, e: escapeHtml, icon, button, avatar, assetBase: '', integratedPlatform: false,
    connectedPlatform: false, coordinatorName: 'Coordinator', platformContext: null,
    currentPerson: () => state.people.find(person => person.id === ui.person),
  });
  assert.match(html, /href="#\/coordinator\/home" class="issuer-section-link is-active" aria-current="true"/);
  assert.match(html, /aria-label="Workspace navigation"/);
  assert.match(html, />Programs<\/a>/);
  assert.match(html, />Documents<\/a>/);
  assert.match(html, />Planning<\/a>/);
  assert.doesNotMatch(html, /<span>Workspace<\/span>/);
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
