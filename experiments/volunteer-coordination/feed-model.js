import { availableActivity } from './program-model.js';
const ORG_ID = 'berkeley-neighbors';
export const feedActor = (mode, personId) => mode === 'coordinator' ? 'coordinator' : personId;
export function createFeedState() {
  return {
    posts: [
      { id: 'garden-invitation', orgId: ORG_ID, organization: 'Berkeley Neighbors', organizationType: 'issuer', color: 'sage', createdAt: '2026-09-23T09:00:00-07:00', body: 'A small invitation for your Sunday: come spend a morning in the garden. We’re getting the beds ready for fall, and there’s room for people who have never planted a thing.\n\nBring your curiosity. We’ll bring the gloves, a friendly face, and a place to start.', imageUrl: '/assets/garden-story.svg', imageAlt: 'Illustration of raised garden beds and growing plants', activityId: 'garden', baseHearts: 24, likedBy: [], savedBy: [] },
      { id: 'tools-together', orgId: 'tool-library', organization: 'Berkeley Tool Library', organizationType: 'issuer', color: 'sand', createdAt: '2026-09-22T15:30:00-07:00', body: 'A repaired handle, a sharpened blade, a tool ready for its next neighbor. Our volunteer repair team gave 18 donated tools a second life this week.\n\nThank you to everyone who shared a little time and a lot of know-how.', imageUrl: null, imageAlt: '', activityId: null, baseHearts: 38, likedBy: [], savedBy: [] },
      { id: 'packing-thanks', orgId: ORG_ID, organization: 'Berkeley Neighbors', organizationType: 'issuer', color: 'sage', createdAt: '2026-09-22T11:15:00-07:00', body: 'Behind every bag of groceries is a team that makes time for their neighbors. To our packing crew, drivers, and everyone learning the ropes: thank you.\n\nThe new welcome guide is taking shape too. A clear first step makes it easier for the next person to join us.', imageUrl: '/assets/together-story.svg', imageAlt: 'Illustrated community poster reading Small acts. Shared care.', activityId: null, baseHearts: 19, likedBy: [], savedBy: [] },
      { id: 'creek-update', orgId: 'creek-friends', organization: 'Friends of Strawberry Creek', organizationType: 'issuer', color: 'blue', createdAt: '2026-09-21T16:00:00-07:00', body: 'The path beside the creek is a little clearer after this weekend. Our returning volunteers left notes for the next crew: which areas need attention, where the supplies live, and what is already done.\n\nSmall contributions add up when we make the next step easy to find.', imageUrl: null, imageAlt: '', activityId: null, baseHearts: 12, likedBy: [], savedBy: [] },
    ],
  };
}
export function ensureFeed(state) {
  return state.feed?.posts ? state : { ...state, feed: createFeedState() };
}
export const heartCount = post => post.baseHearts + post.likedBy.length;
export function selectFeedPosts(state, { filter = 'all', saved = false, actor = 'coordinator', query = '' } = {}) {
  let posts = ensureFeed(state).feed.posts.slice();
  if (saved) posts = posts.filter(p => p.savedBy.includes(actor));
  else if (filter === 'news') return [];
  else if (filter === 'organizations') posts = posts.filter(p => p.organizationType === 'issuer');
  const term = query.trim().toLowerCase();
  if (term) posts = posts.filter(p => `${p.organization} ${p.body}`.toLowerCase().includes(term));
  return posts.sort((a, b) => filter === 'trending' && !saved ? heartCount(b) - heartCount(a) || Date.parse(b.createdAt) - Date.parse(a.createdAt) : Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
export function transitionFeed(current, action) {
  const state = structuredClone(ensureFeed(current));
  const actor = action.actor;
  if (actor !== 'coordinator' && !state.people.some(p => p.id === actor)) throw Error('Choose a sample person first.');
  if (action.type === 'publish') {
    if (actor !== 'coordinator') throw Error('Organization coordinators publish city updates.');
    const body = String(action.body || '').trim();
    if (!body || body.length > 1000) throw Error('Write an update between 1 and 1,000 characters.');
    const activity = action.activityId && state.activities.find(a => a.id === action.activityId);
    if (action.activityId && (!availableActivity(state, activity) || activity.visibility !== 'public')) throw Error('Only public activities can be attached to a city update.');
    const imageUrl = action.imageUrl || null;
    if (imageUrl && (!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(imageUrl) || imageUrl.length > 750000)) throw Error('Choose a PNG, JPEG, WebP, or GIF image under 500 KB.');
    if (imageUrl && !String(action.imageAlt || '').trim()) throw Error('Add a short description of your image.');
    const post = { id: globalThis.crypto.randomUUID(), orgId: ORG_ID, organization: 'Berkeley Neighbors', organizationType: 'issuer', color: 'sage', createdAt: new Date().toISOString(), body, imageUrl, imageAlt: String(action.imageAlt || '').trim().slice(0, 240), activityId: activity?.id || null, baseHearts: 0, likedBy: [], savedBy: [] };
    state.feed.posts.unshift(post);
    return { state, notice: 'Posted to the sample MyCity Feed. Both views can see it.', postId: post.id };
  }
  const post = state.feed.posts.find(p => p.id === action.postId);
  if (!post) throw Error('That post could not be found.');
  const field = action.type === 'like' ? 'likedBy' : action.type === 'bookmark' ? 'savedBy' : null;
  if (!field) throw Error('Unknown feed action.');
  const has = post[field].includes(actor);
  post[field] = has ? post[field].filter(key => key !== actor) : [...post[field], actor];
  return { state, notice: action.type === 'like' ? (has ? 'Like removed' : 'A little appreciation shared') : (has ? 'Bookmark removed' : 'Saved to your bookmarks') };
}
