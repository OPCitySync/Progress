import { today } from './passport-model.js';
import { availableActivity } from './program-model.js';
import { feedActor, heartCount, participantQueueItems, selectFeedPosts } from './feed-model.js';
import { HOME_ORG } from './recruitment-model.js';
import { issuerProfileIdentity, issuerProfileOrganization, renderEmbeddedPublicProfile } from './profile-view.js';

function postCard(ctx, post) {
  const { state, ui, e, icon, avatar, button, badge, dateLabel, confirmedCount } = ctx;
  const actor = feedActor(ui.mode, ui.person);
  const liked = post.likedBy.includes(actor);
  const saved = post.savedBy.includes(actor);
  // Linking an activity never publishes its private roster or preparation data.
  const activity = state.activities.find(a => a.id === post.activityId && a.visibility === 'public' && availableActivity(state,a));
  const time = new Date(post.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return `<article id="post-${e(post.id)}" class="panel city-post" aria-label="Update from ${e(post.organization)}">
    <header class="city-post-header">${avatar({ name: post.organization, color: post.color })}<div><h2>${button(e(post.organization), 'rcOrg', `data-id="${e(post.orgId)}"`, 'title-button')}</h2><p>Community organization <span>·</span> <time datetime="${e(post.createdAt)}">${e(time)}</time></p></div><span class="city-post-location">${icon('pin')} Berkeley</span></header>
    <p class="city-post-body">${e(post.body)}</p>
    ${post.imageUrl ? `<img class="city-post-image" src="${e(post.imageUrl)}" alt="${e(post.imageAlt)}" loading="lazy">` : ''}
    ${activity ? `<button class="city-activity-link" data-action="activity" data-id="${e(activity.id)}"><span class="action-symbol sage">${icon('calendar')}</span><span><small>COME BE PART OF IT</small><strong>${e(activity.title)}</strong><span>${dateLabel(activity.date)} · ${e(activity.time)} · ${Math.max(0, activity.roles.reduce((sum, r) => sum + r.capacity, 0) - confirmedCount(state, activity.id))} places open</span></span>${icon('arrow')}</button>` : ''}
    <div class="city-post-summary"><span>${icon('heart')} <strong>${heartCount(post)}</strong> ${heartCount(post) === 1 ? 'person appreciates' : 'people appreciate'} this</span><span>Posted to MyCity</span></div>
    <div class="city-post-actions">${button(icon('heart') + (liked ? 'Liked' : 'Like'), 'feedLike', `data-id="${e(post.id)}" aria-pressed="${liked}"`, `city-action ${liked ? 'liked' : ''}`)}${button(icon('link') + 'Share', 'feedShare', `data-id="${e(post.id)}"`, 'city-action')}${button(icon('bookmark') + (saved ? 'Saved' : 'Bookmark'), 'feedBookmark', `data-id="${e(post.id)}" aria-pressed="${saved}"`, `city-action ${saved ? 'saved' : ''}`)}</div>
  </article>`;
}

export function renderFeedResults(ctx) {
  const { state, ui, icon, button } = ctx;
  const actor = feedActor(ui.mode, ui.person);
  const selected = ui.item && state.feed.posts.find(p => p.id === ui.item);
  const posts = ui.item ? (selected ? [selected] : []) : selectFeedPosts(state, { filter: ui.feedFilter, saved: ui.feedSaved, actor, query: ui.feedQuery });
  const emptyTitle = ui.item ? 'This local post isn’t available.' : ui.feedSaved ? 'Keep the good things close.' : ui.feedFilter === 'news' ? 'Local news, when it’s connected.' : 'No updates match this view.';
  const emptyBody = ui.item ? (ctx.integratedPlatform ? 'This update is no longer available.' : 'This link may belong to another browser’s sample data, or the demo may have been reset.') : ui.feedSaved ? 'Bookmark a city update to find it here.' : ui.feedFilter === 'news' ? 'No local news sources are connected yet. Organization updates are available in All and Organizations.' : state.feed.posts.length ? 'Try a different search or return to all updates.' : 'Updates from organizations in your City Network will appear here.';
  return { count: posts.length, html: `${posts.length ? posts.map(post => postCard(ctx, post)).join('') : `<section class="panel city-empty">${icon(ui.feedSaved ? 'bookmark' : 'feed')}<h2>${emptyTitle}</h2><p>${emptyBody}</p>${button('See all updates ' + icon('arrow'), 'feedAll', '', 'btn secondary')}</section>`}` };
}

export function renderFeed(ctx) {
  const { state, ui, e, icon, button, badge, dateLabel } = ctx;
  const coordinator = ui.mode === 'coordinator';
  const results = renderFeedResults(ctx);
  const feedFilters = [['all', 'All'], ['news','News'], ['organizations', 'Organizations'], ['trending', 'Trending']];
  const searchOpen = Boolean(ui.feedSearchOpen || ui.feedQuery);
  const toolbarSearch = `${button(icon('search'),'feedSearchToggle',`aria-label="${searchOpen?'Close feed search':'Search MyCity Feed'}" aria-expanded="${searchOpen}" aria-controls="feed-toolbar-search"`,'city-feed-search-toggle')}${searchOpen?`<label class="search-box city-toolbar-search" id="feed-toolbar-search">${icon('search')}<input id="feed-search" aria-label="Search city updates" placeholder="Search updates…" value="${e(ui.feedQuery)}"></label>`:''}`;
  const bookmarkLabel = coordinator ? 'Saved' : 'Bookmarks';
  const publicActivities = state.activities.filter(a => a.visibility === 'public' && availableActivity(state,a));
  const myCommitments = state.commitments.filter(c => c.personId === ui.person && c.status === 'confirmed').map(c => state.activities.find(a => a.id === c.activityId)).filter(a => a?.date && a.date >= today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 2);
  const participantQueue = coordinator ? '' : volunteerActionQueue(ctx);
  const events = items => items.map(a => `<button class="city-calendar-item" data-action="activity" data-id="${e(a.id)}"><span class="city-date"><strong>${dateLabel(a.date, { day: 'numeric' })}</strong><small>${dateLabel(a.date, { month: 'short' })}</small></span><span><strong>${e(a.title)}</strong><small>${e(a.time)}</small></span>${icon('chevron')}</button>`).join('');
  const feedContent=`<h1 class="sr-only">MyCity Feed</h1>
      <div class="city-feed-control-stack ${participantQueue ? 'has-action-queue' : ''}"><div class="city-toolbar city-toolbar-issuer"><div class="city-filter-tools"><div class="tabs" aria-label="MyCity Feed filters">${feedFilters.map(([key, label]) => button(label, 'feedFilter', `data-filter="${key}" aria-pressed="${!ui.feedSaved && ui.feedFilter === key && !ui.item}"`, `tab ${!ui.feedSaved && ui.feedFilter === key && !ui.item ? 'active' : ''}`)).join('')}</div>${toolbarSearch}</div><div class="city-tools">${button(icon('bookmark') + `<span>${bookmarkLabel}</span>`, 'feedSaved', `aria-pressed="${ui.feedSaved}" aria-label="${ui.feedSaved ? 'Show all MyCity posts' : 'Show bookmarked posts'}"`, `btn small ${ui.feedSaved ? 'primary' : 'secondary'}`)}${coordinator ? button(icon('plus') + 'Post', 'feedCompose', '', 'btn small primary') : ''}</div></div>${participantQueue}</div>
      ${ui.item ? `<div class="city-feed-caption">${button('← Back to all updates', 'feedAll', '', 'text-button')}<span>Post permalink</span></div>` : ''}
      <div id="feed-posts">${results.html}</div>`;
  const profileView=coordinator&&ui.feedPublicProfile;
  return `<div class="city-layout ${coordinator ? 'city-layout-issuer' : ''} ${profileView?'is-profile-view':''}">${profileView?'':coordinator ? issuerFeedAside(ctx) : volunteerFeedAside(ctx)}<section class="city-stream" aria-label="${profileView?'Public Profile':'MyCity Feed'}">
      ${coordinator&&ui.feedPublicProfile?renderEmbeddedPublicProfile(ctx):feedContent}
    </section><aside class="city-rail" aria-label="City context">
      ${!coordinator && myCommitments.length ? `<section class="panel city-rail-card"><div class="section-heading"><div><span class="eyebrow">MY CALENDAR</span><h2>Your next plans</h2></div>${icon('calendar')}</div>${events(myCommitments)}${button('My Volunteering ' + icon('arrow'), 'nav', 'data-page="applications"', 'text-button')}</section>` : ''}
      ${coordinator ? cityPulseCard(ctx, publicActivities, true) : `<section class="panel city-rail-card city-neighbors"><span class="eyebrow">GET TO KNOW YOUR CITY</span><h2>Local organizations</h2>${state.recruitment.organizations.slice(0,3).map(org=>`<button class="city-neighbor" data-action="rcOrg" data-id="${e(org.id)}">${ctx.avatar({name:org.name,color:'sage'},'small')}<span><strong>${e(org.name)}</strong><small>${e(org.location)}</small></span>${icon('chevron')}</button>`).join('')}${button('Discover organizations →','nav','data-page="discover"','text-button')}</section>${cityPulseCard(ctx, publicActivities, true)}`}
    </aside></div>`;
}

function volunteerActionQueue(ctx) {
  const { state, ui, e, icon, button } = ctx;
  const items = participantQueueItems(state, ui.person);
  const hasHistory = (state.feed?.queueAcknowledgements?.[ui.person] || []).length > 0;
  if (!items.length && !hasHistory) return '';
  const attributes = item => Object.entries(item.attrs).map(([key, value]) => `data-${key}="${e(value)}"`).join(' ');
  const expanded = !ui.feedQueueCollapsed;
  return `<section class="city-feed-action-queue" aria-label="Action Queue"><header><h2 tabindex="-1" id="participant-queue-title">Action Queue <span>${items.length}</span></h2><div class="button-row">${button(icon('history'), 'feedQueueHistory', 'aria-label="Open action history"', 'icon-button')}${button(icon('down'), 'feedQueueToggle', `aria-expanded="${expanded}" aria-controls="participant-action-queue-items" aria-label="${expanded ? 'Collapse' : 'Expand'} Action Queue"`, 'icon-button')}</div></header>${expanded ? `<div id="participant-action-queue-items">${items.length ? items.slice(0, 4).map(item => `<article><div><small>${e(item.kind)}</small><strong>${e(item.title)}</strong></div><div class="participant-queue-actions">${button('Acknowledge', 'feedQueueAcknowledge', `data-key="${e(item.key)}" aria-label="Acknowledge: ${e(item.title)}"`, 'btn secondary small')}${button(e(item.label) + icon('arrow'), item.action, attributes(item), 'btn primary small')}</div></article>`).join('') : '<p class="participant-queue-empty">You’re all caught up.</p>'}</div>${items.length > 4 ? `<footer>+${items.length - 4} more ${items.length - 4 === 1 ? 'action' : 'actions'} in My Volunteering</footer>` : ''}` : ''}</section>`;
}

export function renderVolunteerActionHistory(ctx) {
  const { state, ui, e, icon, button } = ctx;
  const history = state.feed?.queueAcknowledgements?.[ui.person] || [];
  const live = new Set(participantQueueItems(state, ui.person, true).map(item => item.key));
  return `<div class="dialog-body"><p class="dialog-intro">Acknowledgements record what you’ve seen. They don’t accept an invitation, submit an application, or change a commitment.</p>${history.map(item => `<article class="home-history-row"><div><strong>${e(item.title)}</strong><p>${e(item.kind)}</p><small>${e(new Date(item.at).toLocaleString())} · ${live.has(item.key) ? 'Still actionable' : 'Resolved or changed'}</small></div>${button(icon('refresh') + 'Restore', 'feedQueueRestore', `data-key="${e(item.key)}"`, 'btn secondary small')}</article>`).join('') || '<div class="home-calendar-empty"><h3>No acknowledgements yet.</h3><p>Items you acknowledge will appear here.</p></div>'}</div>`;
}

function cityPulseCard(ctx, publicActivities, sticky = false) {
  const { state, badge } = ctx;
  return `<section class="panel city-rail-card ${sticky ? 'city-rail-lock' : ''}"><div class="section-heading"><div><span class="eyebrow">CITY PULSE</span><h2>People making it happen.</h2></div>${ctx.integratedPlatform?'':badge('Demo')}</div><div class="city-pulse"><div><span class="legend-dot green"></span><span>Organizations sharing updates</span><strong>${new Set(state.feed.posts.map(post => post.orgId)).size}</strong></div><div><span class="legend-dot yellow"></span><span>Neighbors volunteering</span><strong>${state.people.filter(person => person.relationship === 'member').length}</strong></div><div><span class="legend-dot green"></span><span>Public activities to explore</span><strong>${publicActivities.length}</strong></div></div><p class="microcopy">Counts reflect the records currently available in this workspace.</p></section>`;
}

export function renderFeedComposer(ctx) {
  const { state, e, icon, button, avatar, errorOutput } = ctx;
  const organization=state.recruitment.organizations.find(org=>org.id===HOME_ORG);
  const organizationName=ctx.platformContext?.organization?.name||organization?.name||'Your organization';
  return `<form data-form="feedPublish"><div class="dialog-body"><div class="profile-banner">${avatar({ name: organizationName, color: 'sage' })}<div><strong>${e(organizationName)}</strong><small>Posting to your City Network</small></div></div><label>Share an update<textarea name="body" id="feed-body" rows="5" maxlength="1000" required placeholder="Share an update with your city — an invitation, a milestone, or a thank-you…"></textarea></label><div class="city-character-count"><span>Visible in coordinator and volunteer views</span><span id="feed-char-count">0 / 1,000</span></div><label>Attach a public activity <span class="optional">optional</span><select name="activityId"><option value="">An update without an activity</option>${state.activities.filter(a => a.visibility === 'public' && availableActivity(state,a)).map(a => `<option value="${e(a.id)}">${e(a.title)}</option>`).join('')}</select></label><label class="city-image-upload">${icon('image')} Add an image <span class="optional">optional · up to 500 KB</span><input type="file" id="feed-image" accept="image/png,image/jpeg,image/webp,image/gif"></label><div id="feed-image-preview"></div><p class="microcopy">Updates are stored in this workspace while the remaining platform data connections are completed.</p>${errorOutput()}</div><div class="dialog-footer">${button('Cancel', 'close', '', 'btn secondary')}<button class="btn primary" type="submit" id="feed-publish-button">Post to MyCity ${icon('arrow')}</button></div></form>`;
}

function issuerFeedAside(ctx) {
  const {e,icon}=ctx,organization=issuerProfileOrganization(ctx);
  return `<aside class="city-personal city-personal-issuer" aria-label="Your organization space">${issuerProfileIdentity(ctx,organization)}<a class="panel city-network-card city-rail-lock" href="#/coordinator/discover"><span class="city-network-symbol">${icon('external')}</span><span><small>YOUR CITY NETWORK</small><strong>Discover City Network</strong><em>Find organizations working across ${e(organization.location||'your city')}.</em></span>${icon('arrow')}</a></aside>`;
}

function volunteerFeedAside(ctx) {
  const {state,currentPerson,e,avatar,icon,button}=ctx,p=currentPerson(),profile=state.passports.profiles[p.id]||{};
  const commitments=state.commitments.filter(c=>c.personId===p.id&&c.status==='confirmed').length;
  const applications=state.recruitment.applications.filter(a=>a.personId===p.id&&!['declined','withdrawn','offer-declined'].includes(a.status)).length;
  return `<aside class="city-personal" aria-label="Your volunteer space"><section class="panel city-person-card city-rail-lock"><div class="city-person-cover"><span>${icon('leaf')}</span></div><div class="city-person-identity">${avatar(p,'large')}<h2>${e(p.name)}</h2><span>${e(profile.city||'Your volunteer community')}</span><p>${e(profile.bio||'A little time. A place to make a difference.')}</p>${button('View my passport →','nav','data-page="passport"','text-button')}</div><div class="city-person-links"><a href="#/volunteer/applications">${icon('calendar')}<span>My Volunteering</span><strong>${commitments+applications}</strong></a><a href="#/volunteer/messages">${icon('message')}<span>Messages</span>${icon('chevron')}</a></div></section></aside>`;
}
