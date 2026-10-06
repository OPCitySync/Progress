import { ensureIssuerHome } from './issuer-home-model.js';
import { homeCalendar } from './issuer-home-view.js';
import { bindIssuerHome } from './issuer-home-controller.js';
import { renderPlanning } from './planning-view.js';
import { bindPlanning } from './planning-controller.js';
import { assignDocument, deleteDocument, ensureDocuments, isLiabilityWaiver, liabilityWaiversForActivity, saveDocument, updateDocument } from './documents-model.js';
import { loadDocumentFile, removeDocumentFile, saveDocumentFile } from './documents-files.js';
import { renderDocuments, renderDocumentList, renderDocumentDetail, renderDocumentForm, renderDocumentAssignment } from './documents-view.js';
import { loadMyCityContext, saveOrganizationSettings, switchMyCityIdentity, renderConnectedSettings } from './connected-settings.js';
import { loadMyCityResume, setMyCityResumeVisibility } from './connected-resume.js';
import { renderResume, resumeSheet } from './resume-view.js';
import { issuerNavigation, volunteerNavigation } from './navigation-view.js';
import { ensureProfiles, transitionProfile } from './profile-model.js';
import { renderProfile, profileDialog, appearancePreview } from './profile-view.js';
import { ensurePrograms, transitionProgram, ACTIVITY_TYPES } from './program-model.js';
import { renderPrograms, programDialog, programActivityContext } from './program-view.js';
import { ensureRecruitment, transitionRecruitment, HOME_ORG, volunteerRequirements, volunteerRequirement } from './recruitment-model.js';
import { renderRecruitment, recruitmentDialog, discoveryResults } from './recruitment-view.js';
import { ensurePassport, transitionPassport, requirementReady, sharedPassport, passportExport, today, readinessIssues } from './passport-model.js';
import { renderPassport, passportDialog, printablePassport } from './passport-view.js';
import { ensureFeed, feedActor, transitionFeed } from './feed-model.js';
import { renderFeed, renderFeedResults, renderFeedComposer, renderVolunteerActionHistory } from './feed-view.js';
import { ensureCommunications, transitionCommunication } from './communication-model.js';
import { renderConversations, renderCommunicationComposer } from './communication-view.js';
import { STORAGE_KEY, REQUIREMENTS, createEmptyState, createInitialState, transition, missingRequirements, confirmedCount, activeCommitment, assignmentModeOf, activityWaiverConsent, parseCSV } from './model.js';

// The connected application and standalone prototype can share an origin in
// local development, but the application must never load prototype fixtures.
const dataMode = document.querySelector('meta[name="citysync-data-mode"]')?.content;
const integratedPlatform = dataMode === 'integrated-platform' || dataMode === 'integrated-preview-sample-data';
const storageKey = integratedPlatform
  ? `${STORAGE_KEY}-mycity-connected-v1` : STORAGE_KEY;
let connectedContext = null;
let connectedContextError = '';
let connectedResume = null;
let connectedResumeError = '';
let connectedResumeLoading = false;

let state;
const bootstrapParticipant = location.hash.replace(/^#\/?/, '').split('/')[0] === 'volunteer';
const newState = () => integratedPlatform ? createEmptyState({ participant: bootstrapParticipant }) : createInitialState();
try {
  if (integratedPlatform) localStorage.removeItem(`${STORAGE_KEY}-mycity-branch`);
  const saved = JSON.parse(localStorage.getItem(storageKey));
  state = saved?.version === 1 && Array.isArray(saved.people) && Array.isArray(saved.activities) && Array.isArray(saved.commitments) ? saved : newState();
} catch { state = newState(); }
state = ensureCommunications(ensureDocuments(ensureProfiles(ensurePrograms(ensureRecruitment(ensurePassport(ensureFeed(state)))))));
try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
const ui = { home: {anchor:today(),period:'month',day:'',selectedEntry:'',queueCollapsed:false,queueAll:false}, planning: {mode:'programs',programId:'',query:'',personId:''}, documentsQuery: '', documentsCategory: 'all', recruitOrg: HOME_ORG, recruitmentTab: 'setup', discoveryQuery: '', discoveryCause: 'all', discoverySaved: false, passportSort: 'name', feedFilter: 'all', feedSaved: false, feedQuery: '', feedQueueCollapsed: false, feedPublicProfile: false, feedImage: null, communicationPane:'messages', communicationChatView:'active', communicationQuery:'', communicationSelection:'', mode: bootstrapParticipant ? 'volunteer' : 'coordinator', page: 'home', person: integratedPlatform ? 'connected-account' : 'alex', query: '', filter: 'all', dialog: null, csv: [] };
try { const savedPerson = sessionStorage.getItem(storageKey + '-persona'); if (state.people.some(p => p.id === savedPerson)) ui.person = savedPerson; } catch {}
try { const savedOrg = sessionStorage.getItem(storageKey + '-recruit-org'); if (state.recruitment.organizations.some(o => o.id === savedOrg)) ui.recruitOrg = savedOrg; } catch {}
const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
let toastTimer;
let dialogTrigger;
const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = {
  switch: '<path d="M3 7h18m-4-4 4 4-4 4M21 17H3m4-4-4 4 4 4"/>',
  reports: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 17v-3m4 3v-6m4 6v-4"/>',
  settings: '<path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 3.5m0 3h.01"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m5 4 5 5-5 5M9 12h10"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
  feed: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M7 8h4v4H7zM15 8h2m-2 4h2M7 16h10"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  bookmark: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4Z"/>',
  link: '<path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m4 2 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m21 15-6-6-12 12"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v2"/>',
  work: '<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V4h8v3M3 12a24 24 0 0 0 18 0M12 12v3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h3m4 0h3"/>',
  message: '<path d="M21 11a9 9 0 0 1-9 9H3l1.5-4.5A9 9 0 1 1 21 11Z"/><path d="M8 10h8m-8 4h5"/>',
  archive: '<path d="M4 7h16v13H4zM3 3h18v4H3zm6 8h6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  leaf: '<path d="M20 3C10 2 3 6 4 13c1 7 10 8 14 1 2-4 2-8 2-11ZM4 21l11-12"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  book: '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1m0-15c3-2 6-2 9-1v15c-3-1-6-1-9 1V5Z"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.work}</svg>`;
const button = (label, action, attrs = '', cls = 'btn') => `<button type="button" class="${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const badge = (text, kind = 'neutral') => `<span class="badge ${kind}">${e(text)}</span>`;
const emptyPerson = () => ({ id: 'connected-account', name: connectedContext?.accountName || 'Your Account', email: '', relationship: 'interested', role: '', color: 'sage', requirements: {}, availability: 'Not shared yet', preference: '', connectedAccount: true });
const avatar = (p = emptyPerson(), size = '') => `<span class="avatar ${e(p.color || 'sage')} ${size}" aria-hidden="true">${e(String(p.name || 'Account').split(' ').map(w => w[0]).slice(0, 2).join(''))}</span>`;
const currentPerson = () => state.people.find(p => p.id === ui.person) || state.people.find(p => p.connectedAccount) || state.people[0] || emptyPerson();
const orgMode = () => ui.mode === 'coordinator';
const packingReady = p => ['welcome', 'waiver', 'food'].every(key => requirementReady(state, p, key));
const deliveryReady = p => ['welcome', 'waiver', 'driver'].every(key => requirementReady(state, p, key));
const dateLabel = (date, options = { weekday: 'short', month: 'short', day: 'numeric' }) => date ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', options) : 'As needed';
const titleForType = type => ACTIVITY_TYPES[type] || 'Archived activity';
const canSee = a => !a.archived && (orgMode() || (state.programWorkspace.programs.find(p => p.id === a.programId)?.status !== 'draft' && (assignmentModeOf(a) === 'public' || currentPerson().relationship === 'member')) || activeCommitment(state, currentPerson().id, a.id));
const commitmentsFor = a => state.commitments.filter(c => c.activityId === a.id && ['confirmed', 'proposed', 'waitlisted'].includes(c.status));
const assignmentLabel = a => ({ manual: 'Organization assigns', roster: 'Open to roster', public: 'Open to public' }[assignmentModeOf(a)] || 'Organization assigns');
function toast(message) { const t = document.querySelector('#toast'); t.textContent = message; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 4800); }
function save() { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { toast('Browser storage is unavailable. Changes will last for this visit only.'); } }
function applyConnectedContext(context) {
  if (!integratedPlatform || !context) return;
  if (context.role === 'issuer' && context.organization) {
    const organization = context.organization;
    const existing = state.recruitment.organizations.find(item => item.id === HOME_ORG) || {};
    const initial = organization.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'OR';
    state.people = state.people.filter(person => !person.connectedAccount);
    state.recruitment.organizations = [
      {
        ...existing,
        id: HOME_ORG,
        platformId: organization.id,
        connectedOrganization: true,
        name: organization.name,
        cause: existing.cause || '',
        color: existing.color || 'sage',
        initial,
        location: organization.location || context.cityName || '',
        mission: existing.mission || '',
        description: existing.description || '',
        contact: context.accountName || existing.contact || '',
        email: organization.email || '',
        support: existing.support || '',
        welcome: existing.welcome || '',
        profile: existing.profile || {
          tagline: '', causes: [], phone: organization.phone || '', website: '', socials: {}, palette: 'forest', banner: 'confluence',
          logo: organization.logoUrl || '', cover: '', coverAlt: '', featuredRoleId: '', updatedAt: '',
        },
      },
      ...state.recruitment.organizations.filter(item => item.id !== HOME_ORG),
    ];
    const members = state.programWorkspace.organizationMembers.filter(member => !member.connectedAccount);
    members.unshift({ id: 'connected-account', name: context.accountName || 'Organization account', role: organization.canEdit ? 'Organization owner' : 'Organization member', workspaceAccess: true, active: true, connectedAccount: true });
    state.programWorkspace.organizationMembers = members;
    ui.recruitOrg = HOME_ORG;
  } else {
    let person = state.people.find(item => item.connectedAccount);
    if (!person) {
      person = emptyPerson();
      state.people.unshift(person);
    }
    Object.assign(person, { name: context.accountName || 'Your Account', connectedAccount: true });
    ui.person = person.id;
  }
  state = ensureCommunications(ensureDocuments(ensureProfiles(ensurePrograms(ensureRecruitment(ensurePassport(ensureFeed(state)))))));
  const person = state.people.find(item => item.connectedAccount);
  if (person) {
    const profile = state.passports.profiles[person.id] ||= { city: '', languages: '', skills: '', bio: '', openForVolunteering: false };
    if (!profile.city && context.cityName) profile.city = context.cityName;
  }
  save();
}
function act(action, options = {}) {
  try {
    const result = transition(state, action); state = result.state; save();
    if (!options.keepDialog) closeDialog(); render(); toast(result.notice); return true;
  } catch (error) {
    const output = dialog.open && dialog.querySelector('.form-error');
    if (output) { output.textContent = error.message; output.focus(); } else toast(error.message);
    return false;
  }
}
function navigate(page, item) { closeDialog(); ui.query = ''; ui.filter = 'all'; location.hash = `/${ui.mode}/${page}${item ? '/' + item : ''}`; readRoute(); }
function readRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'join') { ui.mode = 'volunteer'; ui.person = 'robin'; ui.page = 'organization'; ui.item = ''; }
  else { ui.mode = parts[0] === 'volunteer' ? 'volunteer' : 'coordinator'; ui.page = parts[1] || 'home'; ui.item = parts[2]; }
  if (ui.mode === 'coordinator' && ui.page === 'home') {
    ui.page = 'feed'; ui.item = '';
    history.replaceState(null, '', `${location.pathname}${location.search}#/coordinator/feed`);
  }
  if (ui.mode === 'coordinator' && ['work', 'schedule'].includes(ui.page)) {
    ui.page = 'planning'; ui.item = '';
    history.replaceState(null, '', `${location.pathname}${location.search}#/coordinator/planning`);
  }
  if (ui.mode === 'volunteer' && ui.page === 'schedule') {
    ui.page = 'applications'; ui.item = '';
    history.replaceState(null, '', `${location.pathname}${location.search}#/volunteer/applications`);
  }
  if (ui.mode === 'volunteer' && ui.page === 'history') {
    ui.page = 'passport'; ui.item = '';
    history.replaceState(null, '', `${location.pathname}${location.search}#/volunteer/passport`);
  }
  render(); window.scrollTo(0, 0); void refreshConnectedResume();
}

async function refreshConnectedResume(force = false) {
  if (!integratedPlatform || ui.mode !== 'volunteer' || ui.page !== 'resume') return;
  if (!force && (connectedResume || connectedResumeLoading)) return;
  connectedResumeLoading = true;
  connectedResumeError = '';
  render();
  try {
    connectedResume = await loadMyCityResume();
  } catch (error) {
    connectedResume = null;
    connectedResumeError = error.message;
  } finally {
    connectedResumeLoading = false;
    render();
  }
}
function showDialog(title, content, wide = false) {
  if (!dialog.open) dialogTrigger = document.activeElement;
  dialog.className = wide ? 'wide' : '';
  dialog.innerHTML = `<div class="dialog-head"><div><span class="eyebrow">${e(workspaceLabel().toUpperCase())}</span><h2 id="dialog-title">${e(title)}</h2></div>${button(icon('close'), 'close', 'aria-label="Close dialog"', 'icon-button')}</div>${content}`;
  if (!dialog.open) dialog.showModal();
}
function releaseDocumentFileUrl() { if (ui.documentFileUrl) { URL.revokeObjectURL(ui.documentFileUrl); ui.documentFileUrl = ''; } }
function closeDialog() { if (ui.passportExportUrl) { const url = ui.passportExportUrl; setTimeout(() => URL.revokeObjectURL(url), 5000); ui.passportExportUrl = null; } if (dialog.open) { dialog.close(); if (dialogTrigger?.isConnected) dialogTrigger.focus(); } releaseDocumentFileUrl(); ui.dialog = null; }
const errorOutput = () => '<p class="form-error" role="alert" tabindex="-1"></p>';
function recruitmentContextOrg() {
  if (!state.recruitment) return null;
  const orgId = ['recruitment','profile'].includes(ui.page) ? ui.recruitOrg : ui.page === 'org-profile' ? ui.item : ui.page === 'position' ? state.recruitment.positions.find(p => p.id === ui.item)?.orgId : ui.page === 'application' ? state.recruitment.applications.find(a => a.id === ui.item)?.orgId : null;
  return state.recruitment.organizations.find(o => o.id === orgId) || null;
}
const workspaceLabel = () => integratedPlatform && orgMode() ? connectedContext?.organization?.name || recruitmentContextOrg()?.name || 'Organization' : !orgMode() && ['passport','history','resume'].includes(ui.page) ? 'My passport' : recruitmentContextOrg()?.name || (['discover','applications'].includes(ui.page) ? 'Your city' : 'Berkeley Neighbors');
const coordinatorName = () => integratedPlatform ? connectedContext?.accountName || 'Organization account' : recruitmentContextOrg()?.contact || 'Maya Thompson';
function pageHeader(kicker, title, subtitle, controls = '') { return `<div class="page-heading"><div>${kicker ? `<span class="eyebrow">${kicker}</span>` : ''}<h1>${title}</h1><p>${subtitle}</p></div><div class="page-actions">${controls}</div></div>`; }
function stat(label, value, detail, glyph) { return `<div class="stat"><div class="stat-top"><span>${label}</span>${icon(glyph)}</div><strong>${value}</strong><small>${detail}</small></div>`; }
function coverage(a) {
  return a.roles.map(r => { const count = confirmedCount(state, a.id, r.id); const pending = state.commitments.filter(c => c.activityId === a.id && c.roleId === r.id && c.status === 'proposed').length; return `<div class="coverage-role"><div><span>${e(r.name)}</span><strong>${count}<span> / ${r.capacity}</span></strong></div><div class="progress-track"><span style="width:${Math.min(100, count / r.capacity * 100)}%" class="${count >= r.capacity ? 'full' : ''}"></span></div><small>${count >= r.capacity ? 'Fully covered' : `${r.capacity - count} ${r.capacity - count === 1 ? 'place' : 'places'} to fill`}${pending ? ` · ${pending} invitation pending` : ''}</small></div>`; }).join('');
}
function illustration() { return `<svg class="hero-art" viewBox="0 0 260 170" aria-hidden="true"><circle cx="170" cy="65" r="52" fill="#d9e8ac"/><path d="M25 152c34-51 76-76 117-42 35-41 75-26 105 42" fill="#78947b"/><path d="M89 139c3-38 2-70-10-93m11 42c-30 0-44-18-35-30 24 0 36 18 35 30m0 24c30-1 49-20 39-33-25 0-37 20-39 33" fill="#dfeabc"/><path d="M178 144V76m0 27c-24 0-35-12-31-25 22 1 32 13 31 25m0 18c28-3 39-16 34-29-24 1-32 18-34 29" fill="#b8cfa0"/><path d="m24 32 5-13 5 13 13 5-13 5-5 13-5-13-13-5Z" fill="#b8cfa0"/><path d="m228 54 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z" fill="#b8cfa0"/></svg>`; }
function dashboard() {
  return homeCalendar(feedContext());
}

function peopleRows() {
  const people = state.people.filter(p => [p.name, p.email, p.role].join(' ').toLowerCase().includes(ui.query.toLowerCase()) && (ui.filter === 'all' || p.relationship === ui.filter));
  return people.length ? people.map(p => { const next = state.commitments.find(c => c.personId === p.id && c.status === 'confirmed'); const a = next && state.activities.find(a => a.id === next.activityId); return `<tr><td><button class="person-cell" data-action="person" data-id="${e(p.id)}">${avatar(p)}<span><strong>${e(p.name)}</strong><small>${e(p.email)}</small></span></button></td><td>${badge(p.relationship === 'member' ? 'Team member' : p.relationship === 'event-only' ? 'Event participant' : p.relationship[0].toUpperCase() + p.relationship.slice(1), p.relationship === 'member' ? 'sage' : p.relationship === 'joining' ? 'sand' : 'neutral')}<small class="cell-sub">${e(p.role)}</small></td><td>${packingReady(p) ? `<span class="ready-text">${icon('check')} Packing ready</span>` : `<span class="pending-text">${icon('clock')} Preparation pending</span>`}<small class="cell-sub">${deliveryReady(p) ? 'Delivery ready' : 'Delivery preparation pending'}</small></td><td>${e(p.availability)}</td><td>${a ? `<strong class="cell-date">${dateLabel(a.date)}</strong><small class="cell-sub">${e(a.title)}</small>` : '<span class="muted">No upcoming commitment</span>'}</td><td>${button(icon('chevron'), 'person', `data-id="${e(p.id)}" aria-label="Open ${e(p.name)}"`, 'icon-button')}</td></tr>`; }).join('') : '<tr><td colspan="6"><div class="empty-state">No people match this view. Try a different filter.</div></td></tr>';
}
function peoplePage() { return `<section class="panel table-panel"><div class="roster-card-heading"><h1>Volunteer Roster</h1>${button(icon('plus') + 'Add Volunteers', 'addPeople', '', 'btn primary')}</div><div class="table-tools"><div class="tabs" aria-label="Filter people">${[['all', 'Everyone'], ['joining', 'Joining'], ['member', 'Team'], ['invited', 'Invited'], ['paused', 'Paused']].map(([key, label]) => button(label, 'peopleFilter', `data-filter="${key}" aria-pressed="${ui.filter === key}"`, `tab ${ui.filter === key ? 'active' : ''}`)).join('')}</div><label class="search-box">${icon('search')}<input id="people-search" placeholder="Find a person…" aria-label="Find a person" value="${e(ui.query)}"></label></div><div class="table-scroll"><table><thead><tr><th>PERSON</th><th>RELATIONSHIP</th><th>READY FOR</th><th>AVAILABILITY</th><th>NEXT COMMITMENT</th><th></th></tr></thead><tbody id="people-rows">${peopleRows()}</tbody></table></div><div class="table-caption">People stay visible while they prepare, take a break, or wait for their next commitment.</div></section>`; }
function personDialog(personId) {
  const p = state.people.find(p => p.id === personId); if (!p) return;
  ui.dialog = { type: 'person', id: personId };
  const commitments = state.commitments.filter(c => c.personId === p.id && ['confirmed', 'proposed', 'waitlisted'].includes(c.status));
  showDialog(p.name, `<div class="dialog-body"><div class="profile-banner">${avatar(p, 'large')}<div><strong>${e(p.role)}</strong><p>${e(p.email)}</p>${badge(p.relationship === 'member' ? 'Team member' : p.relationship, p.relationship === 'member' ? 'sage' : 'sand')}</div></div>${p.relationship === 'joining' ? `<div class="callout sand"><strong>Ready for an organization decision</strong><p>Approve membership once. Preparation for each kind of work remains separate.</p>${button('Approve membership ' + icon('check'), 'approveMember', `data-id="${e(p.id)}"`, 'btn primary')}</div>` : ''}<div class="detail-section"><h3>Volunteer Requirements</h3>${button('View shared passport', 'ppOpen', `data-person="${e(p.id)}"`, 'text-button')}<p class="muted">Requirements are managed in Recruitment & Onboarding and assigned to specific volunteer roles.</p>${requirementRows(p, volunteerRequirements(state, HOME_ORG), true)}</div><div class="detail-section"><h3>Preferences & availability</h3><p>${e(p.availability)}<br><span class="muted">${e(p.preference || 'No preferences shared yet.')}</span></p></div><div class="detail-section"><h3>Agreed and proposed work</h3>${commitments.length ? commitments.map(c => { const a = state.activities.find(a => a.id === c.activityId); return `<button class="simple-row" data-action="activity" data-id="${e(a.id)}"><span>${e(a.title)}<small>${dateLabel(a.date)} · ${e(a.time)}</small></span>${badge(c.status, c.status === 'confirmed' ? 'sage' : 'sand')}</button>`; }).join('') : '<p class="muted">No commitments yet. Being on the team does not create a booking.</p>'}</div>${errorOutput()}</div><div class="dialog-footer">${p.relationship === 'member' ? button('Pause membership', 'pauseMember', `data-id="${e(p.id)}"`, 'btn secondary') : p.relationship === 'paused' ? button('Resume membership', 'approveMember', `data-id="${e(p.id)}"`, 'btn secondary') : ''}${button('Done', 'close', '', 'btn primary')}</div>`, true);
}
function requirementRows(p, keys, coordinator = orgMode(), date = today()) {
  return keys.map(item => { const key=typeof item==='string'?item:item.id;const r=typeof item==='string'?(volunteerRequirement(state,HOME_ORG,key)||REQUIREMENTS[key]):item;if(!r)return'';const self=r.owner?r.owner==='volunteer':r.self; const done = requirementReady(state, p, key, date); return `<div class="requirement-row"><span class="check-circle ${done ? 'done' : ''}">${icon(done ? 'check' : 'clock')}</span><div><strong>${e(r.title)}</strong><small>${e(r.detail)}</small></div>${done ? badge(p.requirements[key] ? 'Complete' : 'Passport accepted', 'sage') : (coordinator || self) ? button(coordinator && !self ? 'Review' : 'Open', 'requirement', `data-person="${e(p.id)}" data-key="${e(key)}"`, 'btn small secondary') : badge('Organization review', 'sand')}</div>`; }).join('');
}
function activityCard(a) {
  const total = a.roles.reduce((n, r) => n + r.capacity, 0); const count = confirmedCount(state, a.id); const mine = activeCommitment(state, currentPerson().id, a.id);
  return `<article class="activity-card"><div class="activity-art ${e(a.color)}"><span class="art-label">${e(a.program)}</span>${icon(a.type === 'project' ? 'book' : a.id === 'garden' ? 'leaf' : 'work', 'art-icon')}<span class="art-corner">${a.type === 'project' ? 'MAKE SOMETHING USEFUL' : 'SHOW UP. MAKE A DIFFERENCE.'}</span></div><div class="activity-card-body"><div class="card-tags">${badge(titleForType(a.type), a.color)}${a.type === 'project' ? badge('Program team') : badge(assignmentLabel(a), assignmentModeOf(a) === 'public' ? 'sage' : assignmentModeOf(a) === 'roster' ? 'lilac' : 'neutral')}</div><h3><button data-action="activity" data-id="${e(a.id)}">${e(a.title)}</button></h3><p class="card-description">${e(a.description)}</p><div class="card-meta">${icon('calendar')} ${dateLabel(a.date)}<span>·</span>${e(a.time)}</div><div class="card-meta">${icon('pin')} ${e(a.location)}</div><div class="card-bottom"><span>${!orgMode() && mine ? badge(mine.status, mine.status === 'confirmed' ? 'sage' : 'sand') : `${count} of ${total} confirmed`}</span>${button('View ' + icon('arrow'), 'activity', `data-id="${e(a.id)}"`, 'text-button')}</div></div></article>`;
}
function workPage() {
  const activities = state.activities.filter(canSee);
  const header = orgMode()
    ? pageHeader('MANY WAYS TO MAKE A DIFFERENCE', 'Work worth doing', 'One-time activities, recurring dates, and scoped program tasks.', button(icon('plus') + 'Create activity', 'create', '', 'btn primary'))
    : `<section class="recruit-hero volunteer-opportunities-hero"><div><span class="eyebrow">VOLUNTEER OPPORTUNITIES</span><h1>Create an Impact.</h1><p>Choose something that fits your interests, your time, and your life.</p></div></section>`;
  return `${header}<div class="activity-grid">${activities.map(activityCard).join('') || '<div class="panel empty-state">No opportunities are available right now.</div>'}</div>${orgMode()&&state.activities.some(a=>a.archived)?`<details class="panel detail-section"><summary>Historical activity records</summary><p>Previous activity types are closed to new signups. Their records are retained.</p>${state.activities.filter(a=>a.archived).map(a=>button(e(a.title),'activity',`data-id="${e(a.id)}"`,'text-button')).join('')}</details>`:''}`;
}
function commitmentControls(c, a) {
  if (c.status === 'proposed') return `<div class="button-row">${button('Accept invitation', 'respond', `data-id="${e(c.id)}" data-accept="yes"`, 'btn primary')}${button('Decline', 'respond', `data-id="${e(c.id)}" data-accept="no"`, 'btn secondary')}</div>`;
  if (c.status === 'confirmed') return `<div class="button-row">${badge('You’re confirmed', 'sage')}${button(a.type === 'project' ? 'Step back from this task' : 'I can’t attend', 'cancel', `data-id="${e(c.id)}"`, 'text-button danger')}</div>`;
  return `<div class="button-row">${badge('On the waitlist', 'sand')}${button('Leave waitlist', 'cancel', `data-id="${e(c.id)}"`, 'text-button')}</div>`;
}
function activityPage() {
  const a = state.activities.find(a => a.id === ui.item);
  if (!a || (!canSee(a) && !(a.archived && (orgMode() || activeCommitment(state,currentPerson().id,a.id))))) return `<div class="empty-state">This activity is available to team members.${button('View your organization', 'nav', 'data-page="organization"', 'btn primary')}</div>`;
  if (a.archived) return pageHeader('HISTORICAL RECORD', e(a.title), 'This activity type has been retired. Previous commitments are preserved; new signups are closed.') + `<section class="panel detail-section"><h2>Previous commitments</h2>${commitmentsFor(a).map(c => `<p>${e(state.people.find(p=>p.id===c.personId)?.name)} · ${e(c.status)}</p>`).join('') || '<p>No commitments recorded.</p>'}</section>`;
  const mode = assignmentModeOf(a);
  const list = state.commitments.filter(commitment => commitment.activityId === a.id && ['confirmed','proposed','waitlisted','verified'].includes(commitment.status));
  const mine = activeCommitment(state, currentPerson().id, a.id);
  const verifiedMine = state.commitments.find(commitment => commitment.personId === currentPerson().id && commitment.activityId === a.id && commitment.status === 'verified');
  const participantCta = mine || verifiedMine || a.workStatus === 'Complete' ? ''
    : mode === 'manual' ? '<span class="activity-managed-label">Organization assignment</span>'
    : a.type === 'project' ? button('Contribute to this task', 'signup', `data-id="${e(a.id)}"`, 'btn primary')
    : button(mode === 'public' ? 'Claim Open Place' : 'Join Roster Activity', 'signup', `data-id="${e(a.id)}"`, 'btn primary');
  const coordinatorCta = a.workStatus !== 'Complete' && mode === 'manual' ? button(icon('plus') + 'Invite a volunteer', 'assign', `data-id="${e(a.id)}"`, 'btn primary') : '';
  const pathway = mode === 'manual'
    ? [['1','Organization chooses from its approved roster'],['2','Volunteer accepts or declines'],['3','Accepted place becomes confirmed']]
    : mode === 'roster'
      ? [['1','Approved roster members can see this date'],['2','Volunteer chooses an open place'],['3','The commitment appears on both calendars']]
      : [['1','Anyone in the City Network can review it'],['2','Requirements and the current waiver are completed'],['3','One place is confirmed; roster membership is unchanged']];
  return `<button class="back-link" data-action="nav" data-page="work">← All work & activities</button>${pageHeader(e(a.program.toUpperCase()), e(a.title), e(a.description), orgMode() ? coordinatorCta : participantCta)}<div class="activity-detail-grid"><div>${programActivityContext(feedContext(), a)}<section class="panel detail-section activity-facts"><div>${icon('calendar')}<span><small>${a.type === 'project' ? 'DUE DATE' : 'WHEN'}</small><strong>${dateLabel(a.date)}</strong>${e(a.time)}</span></div><div>${icon('pin')}<span><small>WHERE</small><strong>${e(a.location)}</strong>${e(a.recurrence)}</span></div><div>${icon('people')}<span><small>YOUR CONTACT</small><strong>${e(a.contact)}</strong>Ask a question below</span></div></section>${!orgMode() && mine ? `<section class="panel commitment-banner"><div><h3>${mine.status === 'proposed' ? 'Would you like to join us?' : 'Your commitment'}</h3><p>${mine.status === 'proposed' ? 'Your place counts toward coverage after you accept.' : 'Your coordinator sees the same information.'}</p></div>${commitmentControls(mine, a)}</section>` : ''}${!orgMode() && verifiedMine ? `<section class="panel commitment-banner"><div><h3>Your contribution is verified.</h3><p>This activity now appears in your Volunteer Passport experience.</p></div>${badge('Verified','sage')}</section>` : ''}<section class="panel detail-section"><div class="section-heading"><div><span class="eyebrow">PICK UP WHERE THE TEAM LEFT OFF</span><h2>${a.type === 'project' ? 'Task handoff' : 'The handoff'}</h2></div>${orgMode() || mine?.status === 'confirmed' ? button('Update ' + icon('arrow'), 'handoff', `data-id="${e(a.id)}"`, 'text-button') : ''}</div><div class="handoff-box"><span class="handoff-label">DONE SO FAR</span><p>${e(a.progress)}</p><span class="handoff-label">WHAT COMES NEXT</span><p class="next-step">${e(a.next)}</p><div class="handoff-owner">${icon('people')} ${e(a.owner)} is carrying the next step ${a.projectStatus ? badge(a.projectStatus, 'lilac') : ''}</div></div><h3 class="prep-title">Before you arrive</h3><p class="muted">${e(a.bring)}</p></section><section class="panel detail-section"><div class="section-heading"><div><span class="eyebrow">KEEP THE CONVERSATION WITH THE WORK</span><h2>Team conversation</h2></div>${badge(`${state.messages.filter(m => m.activityId === a.id).length} messages`)}</div>${conversation(a.id)}</section></div><aside><section class="panel detail-section"><div class="section-heading"><h2>The team</h2>${badge(`${confirmedCount(state, a.id)} confirmed`, 'sage')}</div>${coverage(a)}<div class="team-list">${list.map(c => { const p = state.people.find(p => p.id === c.personId); const statusTone = ['confirmed','verified'].includes(c.status) ? 'sage' : 'sand'; return `<div class="team-member">${avatar(p, 'small')}<div><strong>${e(p.name)}</strong><small>${e(a.roles.find(r => r.id === c.roleId)?.name)}</small></div>${orgMode() && c.status === 'waitlisted' ? button('Offer place', 'offer', `data-id="${e(c.id)}"`, 'btn tiny secondary') : badge(c.status === 'verified' ? 'Verified' : c.status, statusTone)}${orgMode() && c.status === 'confirmed' ? button(c.attendance === 'present' ? icon('check') : icon('plus'), 'attendance', `data-id="${e(c.id)}" data-value="${c.attendance === 'present' ? 'unrecorded' : 'present'}" aria-label="${c.attendance === 'present' ? 'Undo check-in for' : 'Check in'} ${e(p.name)}" title="${c.attendance === 'present' ? 'Checked in' : 'Record check-in'}"`, `icon-button ${c.attendance === 'present' ? 'checked' : ''}`) : ''}${orgMode() && c.status === 'confirmed' && c.attendance === 'present' ? button('Verify contribution','verify',`data-id="${e(c.id)}"`,'btn tiny primary') : ''}</div>`; }).join('') || '<p class="muted">The first place is waiting for someone.</p>'}</div>${orgMode() && a.workStatus !== 'Complete' && mode === 'manual' ? button(icon('plus') + 'Invite someone', 'assign', `data-id="${e(a.id)}"`, 'btn secondary full-width') : ''}<p class="microcopy">${orgMode() ? mode === 'manual' ? 'Assignments count only after the volunteer accepts. Record attendance, then verify completed work.' : 'Volunteers choose their own place. Record attendance, then verify completed work.' : 'Every activity commitment is a separate choice.'}</p></section><section class="panel detail-section activity-pathway-card"><span class="eyebrow">${e(assignmentLabel(a).toUpperCase())}</span><h3>How this activity works</h3><div class="activity-pathway-steps">${pathway.map(([number,text])=>`<div><span>${number}</span><p>${e(text)}</p></div>`).join('')}</div>${mode === 'public' && a.waiverDocumentId ? `<button class="text-button" data-action="docOpen" data-id="${e(a.waiverDocumentId)}">View current liability waiver →</button>` : ''}</section></aside></div>`;
}
function conversation(activityId) {
  return `<div class="conversation">${state.messages.filter(m => m.activityId === activityId).map(m => `<div class="message">${avatar({ name: m.author, color: m.author === 'Maya' ? 'peach' : 'sage' }, 'small')}<div><strong>${e(m.author)} <small>${e(m.time)}</small></strong><p>${e(m.text)}</p></div></div>`).join('') || '<p class="muted">Start the conversation. A little context goes a long way.</p>'}</div><form data-form="message" data-activity="${e(activityId)}" class="message-form"><label class="sr-only" for="message-${e(activityId)}">Message the team</label><input id="message-${e(activityId)}" name="text" placeholder="Ask a question or share an update…" required maxlength="1500"><button class="btn primary" type="submit">Send ${icon('arrow')}</button></form><p class="microcopy">Shared with this activity’s team in the prototype. No external messages are sent.</p>`;
}
function organizationPage() {
  const p = currentPerson();
  const inviteLink=location.hash.replace(/^#\/?/,'').split('/')[0]==='join';
  return `${pageHeader('A RELATIONSHIP THAT LASTS', 'Berkeley Neighbors', 'Neighbors making everyday life a little better, together.')}<div class="activity-detail-grid"><section class="panel detail-section"><div class="section-heading"><h2>Your place on the team</h2>${badge(p.relationship === 'member' ? 'Team member' : p.relationship === 'event-only' ? 'Event participant' : p.relationship, p.relationship === 'member' ? 'sage' : 'sand')}</div><p class="muted">You can join an open event without becoming an ongoing member. Join the team when you’d like to stay involved.</p>${['interested', 'event-only', 'invited'].includes(p.relationship) ? `<div class="callout sage"><h3>${inviteLink?'You have been invited to connect.':'Want to keep helping?'}</h3><p>${inviteLink?'Respond through the organization’s General Volunteer pathway. You can discuss a specific role and complete onboarding together.':'Join the team to see recurring work and share your preferences. Maya will review your request.'}</p>${inviteLink?button('Respond to Volunteer Invite','join','','btn primary'):button('Explore roles & apply', 'rcOrg', 'data-id="berkeley-neighbors"', 'btn primary')}</div>` : p.relationship === 'joining' ? '<div class="callout sand"><strong>Maya has the next step</strong><p>Your membership request is awaiting review. We’ll show the decision here.</p></div>' : p.relationship === 'paused' ? `<div class="callout sand"><strong>You’re taking a break.</strong><p>Existing commitments remain visible. Resume when you’re ready to make new plans.</p>${button('Resume membership', 'resume', '', 'btn primary')}</div>` : '<div class="callout sage"><strong>You belong here, even between commitments.</strong><p>Your completed preparation stays with you when you return.</p></div>'}<h3 class="prep-title">Your preparation</h3><p>Already have relevant training? Share your passport for a local review.</p>${button('My passport →', 'nav', 'data-page="passport"', 'text-button')}${requirementRows(p, Object.keys(REQUIREMENTS), false)}</section><aside><section class="panel detail-section"><h3>Your preferences</h3><p>${e(p.availability)}</p><p class="muted">${e(p.preference || 'Tell us what kind of volunteering works for you.')}</p>${button('Update preferences', 'preferences', '', 'btn secondary')}</section><section class="panel detail-section"><h3>A person you can turn to</h3><div class="profile-banner">${avatar({ name: 'Maya Thompson', color: 'peach' })}<div><strong>Maya Thompson</strong><small>Volunteer coordinator</small></div></div><p class="muted">Questions about a commitment? Open its conversation so the team has the context.</p>${button('My conversations ' + icon('arrow'), 'nav', 'data-page="messages"', 'text-button')}${p.relationship === 'member' ? `<hr><h3>Need some breathing room?</h3><p class="muted">Pause new invitations and review any upcoming commitments.</p>${button('Pause membership', 'pauseMember', `data-id="${e(p.id)}"`, 'text-button')}` : ''}</section></aside></div>`;
}
function messagesPage() {
  return renderConversations(feedContext());
}
function render() {
  try { sessionStorage.setItem(storageKey + '-persona', ui.person); sessionStorage.setItem(storageKey + '-recruit-org', ui.recruitOrg); } catch {}
  state = ensureIssuerHome(ensureCommunications(ensureDocuments(ensureProfiles(ensurePrograms(ensureRecruitment(state))))));
  const allowed = orgMode() ? ['planning', 'documents', 'profile', 'programs', 'program', 'recruitment', 'discover', 'org-profile', 'position', 'application', 'home', 'calendar', 'passport', 'feed', 'people', 'messages', 'activity', ...(integratedPlatform ? ['settings'] : [])] : ['programs', 'program', 'discover', 'org-profile', 'position', 'application', 'applications', 'home', 'passport', 'resume', 'feed', 'work', 'organization', 'messages', 'activity'];
  if (!allowed.includes(ui.page)) ui.page = 'home';
  const content = ui.page === 'settings' && integratedPlatform ? renderConnectedSettings(connectedContext, connectedContextError, e) : ui.page === 'planning' ? renderPlanning(feedContext()) : ui.page === 'documents' ? renderDocuments(feedContext()) : ['profile','org-profile'].includes(ui.page) ? renderProfile(feedContext()) : ['programs','program'].includes(ui.page) ? renderPrograms(feedContext()) : ['discover','org-profile','position','applications','application','recruitment'].includes(ui.page) ? renderRecruitment(feedContext()) : ui.page === 'passport' ? renderPassport(feedContext()) : ui.page === 'resume' ? renderResume(feedContext()) : ui.page === 'feed' ? renderFeed(feedContext()) : ui.page === 'calendar' ? dashboard() : ui.page === 'home' ? renderFeed(feedContext()) : ui.page === 'people' ? peoplePage() : ui.page === 'work' ? workPage() : ui.page === 'activity' ? activityPage() : ui.page === 'organization' ? organizationPage() : messagesPage();
  const issuerOverview = orgMode() && ui.page === 'calendar';
  const issues = !issuerOverview && ['home', 'applications', 'activity'].includes(ui.page) ? readinessIssues(state).filter(c => (orgMode() || c.personId === ui.person) && (ui.page !== 'activity' || c.activityId === ui.item)) : [];
  const readinessAlert = issues.length ? `<div class="callout sand"><strong>Preparation needs another look</strong><p>These commitments are still confirmed, but required preparation is no longer valid through the activity date. Agree on the next step with ${orgMode() ? 'the volunteer' : 'your coordinator'}.</p>${issues.map(c => `<div class="button-row"><span>${orgMode() ? e(state.people.find(p => p.id === c.personId).name) + ' · ' : ''}${e(state.activities.find(a => a.id === c.activityId).title)}</span>${button('Review plan', 'activity', `data-id="${e(c.activityId)}"`, 'text-button')}</div>`).join('')}</div>` : '';
  app.classList.add('issuer-shell');
  app.classList.toggle('volunteer-shell',!orgMode());
  app.innerHTML = `<div class="workspace-main">${orgMode()?issuerNavigation({...feedContext(),contextOrg:recruitmentContextOrg(),coordinatorName:coordinatorName()}):volunteerNavigation(feedContext())}<main id="main-content" tabindex="-1">${readinessAlert}${content}<footer class="page-footer"><span>Built around people. Made for showing up.</span><span>MyCity · Coordination exploration</span></footer></main></div>`;
}

function openProfileDialog(type, field) {
  if(type==='Appearance') ui.profileImages={...state.recruitment.organizations.find(o=>o.id===ui.recruitOrg).profile};
  const result=profileDialog(feedContext(),type,field);
  if(result)showDialog(result.title,result.content,type==='Appearance');
}
function profileAction(action) {
  try {
    const result=transitionProfile(state,{...action,actor:ui.mode,editorOrgId:ui.recruitOrg});
    localStorage.setItem(storageKey,JSON.stringify(result.state));state=result.state;closeDialog();render();toast(result.notice);
  } catch(error) { const out=dialog.querySelector('.form-error'); if(out){out.textContent=error.name==='QuotaExceededError'?'Browser storage is full. Try smaller images; your edits are still here.':error.message;out.focus();}else toast(error.message); }
}
function communicationAction(action,{close=false,silent=false}={}) {
  try {
    const result=transitionCommunication(state,{...action,actor:orgMode()?'coordinator':ui.person});
    localStorage.setItem(storageKey,JSON.stringify(result.state));state=result.state;
    if(close)closeDialog();render();if(!silent)toast(result.notice);return true;
  } catch(error) {
    const output=dialog.open&&dialog.querySelector('.form-error');
    if(output){output.textContent=error.name==='QuotaExceededError'?'Browser storage is full. Your message was not saved.':error.message;output.focus();}else toast(error.message);
    return false;
  }
}
function profileAppearancePreview() {
  const form=dialog.querySelector('[data-form="pfAppearance"]');if(!form)return;
  dialog.querySelector('#profile-appearance-preview').innerHTML=appearancePreview(feedContext(),{...ui.profileImages,palette:form.elements.palette.value,banner:form.elements.banner.value});
}
async function profileImage(input) {
  const file=input.files?.[0];if(!file)return;
  const form=input.closest('form'),output=form.querySelector('.form-error'),submit=form.querySelector('[type="submit"]');
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>500000){output.textContent='Choose a PNG, JPEG, or WebP image under 500 KB.';input.value='';return;}
  const draft=ui.profileImages;ui.profileImageBusy=(ui.profileImageBusy||0)+1;submit.disabled=true;output.textContent='';
  try {
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('The image could not be read.'));reader.readAsDataURL(file);});
    const img=new Image();img.src=data;await img.decode();
    if(!form.isConnected||draft!==ui.profileImages||input.files?.[0]!==file)return;
    ui.profileImages[input.dataset.profileImage]=data;profileAppearancePreview();
  } catch { if(form.isConnected)output.textContent='This image could not be opened. Choose another file.'; }
  finally {ui.profileImageBusy--;if(form.isConnected)submit.disabled=ui.profileImageBusy>0;}
}
function openProgramDialog(type, data = {}) {
  const result = programDialog(feedContext(),type,data);
  if(result) showDialog(result.title,result.content,true);
}
function programAction(action, route) {
  try {
    const result = transitionProgram(state,{...action,actor:orgMode()?'coordinator':ui.person});
    localStorage.setItem(storageKey,JSON.stringify(result.state));
    state=result.state; closeDialog(); if(route) { ui.programTab='overview'; navigate('program',result.id); } else render(); toast(result.notice); return true;
  } catch(error) {
    const output=dialog.open&&dialog.querySelector('.form-error');
    if(output){output.textContent=error.message;output.focus();}else toast(error.message);
    return false;
  }
}
function documentAssignmentAction(id, assignment) {
  try {
    const result=assignDocument(state,id,assignment);
    localStorage.setItem(storageKey,JSON.stringify(result.state));
    state=result.state;closeDialog();render();toast(result.notice);return true;
  } catch(error) {
    const output=dialog.open&&dialog.querySelector('.form-error');
    if(output){output.textContent=error.message;output.focus();}else toast(error.message);
    return false;
  }
}
function openRecruitmentDialog(type, data = {}) {
  const result = recruitmentDialog(feedContext(), type, data);
  if (result) showDialog(result.title, result.content, ['Apply','Assist','Role','Requirement'].includes(type));
}
let discoverySwapTimer;
function refreshDiscoveryResults(animate = true) {
  const results = document.querySelector('#discovery-results');
  if (!results) return false;
  const update = () => {
    results.innerHTML = discoveryResults(feedContext());
    results.classList.remove('is-switching');
    discoverySwapTimer = undefined;
  };
  clearTimeout(discoverySwapTimer);
  if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    results.classList.add('is-switching');
    discoverySwapTimer = window.setTimeout(update, 120);
  } else update();
  return true;
}
function recruitmentAction(action, route, refresh = 'page') {
  try {
    const result = transitionRecruitment(state, { orgId: ui.recruitOrg, ...action, actor: orgMode() ? 'coordinator' : ui.person });
    localStorage.setItem(storageKey, JSON.stringify(result.state));
    state = result.state; closeDialog(); if (route) navigate(route, result.id); else if (refresh !== 'discovery' || !refreshDiscoveryResults()) render(); toast(result.notice); return true;
  } catch (error) {
    const output = dialog.open ? dialog.querySelector('.form-error') : document.querySelector('[data-form="rcMessage"] .form-error');
    const message = error.name === 'QuotaExceededError' ? 'Browser storage is full. Your change was not saved.' : error.message;
    if (output) { output.textContent = message; output.focus(); } else toast(message);
    return false;
  }
}
function openPassportDialog(type, data = {}) {
  const result = passportDialog(feedContext(), type, data);
  if (result) showDialog(result.title, result.content, ['Preview', 'Public', 'Add', 'Share'].includes(type));
  if (type === 'Add') updatePassportRecordForm();
}
function updatePassportRecordForm() {
  const form = dialog.querySelector('[data-form="ppAdd"]'); if (!form) return;
  const training = form.elements.kind.value === 'training';
  for (const [name, show] of [['expires', training], ['standard', training], ['hours', !training], ['issuer', form.elements.organizationId.value === 'external']]) {
    const input = form.elements[name]; input.disabled = !show; input.closest('label').hidden = !show;
    if (name === 'issuer') input.required = show;
  }
}
function passportAction(action) {
  try {
    const result = transitionPassport(state, { personId: ui.person, ...action, actor: orgMode() ? 'coordinator' : ui.person });
    localStorage.setItem(storageKey, JSON.stringify(result.state));
    state = result.state; closeDialog(); render(); toast(result.notice); return true;
  } catch (error) {
    const message = error.name === 'QuotaExceededError' ? 'Browser storage is full. Your change was not saved.' : error.message;
    const output = dialog.open && dialog.querySelector('.form-error');
    if (output) { output.textContent = message; output.focus(); } else toast(message);
    return false;
  }
}
function feedContext() {
  return { state, ui, e, icon, avatar, button, badge, dateLabel, confirmedCount, currentPerson, errorOutput, connectedPlatform: location.pathname.startsWith('/coordination') || location.pathname.startsWith('/mycity'), assetBase: location.pathname === '/' ? '' : location.pathname, integratedPlatform, platformContext: connectedContext, platformResume: connectedResume, platformResumeError: connectedResumeError, platformResumeLoading: connectedResumeLoading };
}
function feedComposer() {
  if (!orgMode()) return;
  ui.feedImage = null;
  showDialog('Share something good with your city', renderFeedComposer(feedContext()), true);
}
function feedAction(action) {
  try {
    const result = transitionFeed(state, { ...action, actor: feedActor(ui.mode, ui.person) });
    // Commit only after storage succeeds so a failed image save preserves the draft.
    localStorage.setItem(storageKey, JSON.stringify(result.state));
    state = result.state;
    if (action.type === 'publish') closeDialog();
    render(); toast(result.notice); return true;
  } catch (error) {
    const message = error.name === 'QuotaExceededError' ? 'This browser’s prototype storage is full. Remove the image or use a smaller one; your draft is still here.' : error.message;
    const output = dialog.open && dialog.querySelector('.form-error');
    if (output) { output.textContent = message; output.focus(); } else toast(message);
    return false;
  }
}
async function shareFeedPost(postId) {
  const url = `${location.origin}/#/${ui.mode}/feed/${encodeURIComponent(postId)}`;
  try { await navigator.clipboard.writeText(url); toast('Local post link copied. It opens this post in this browser’s sample data.'); }
  catch { showDialog('Link to this city update', `<div class="dialog-body"><label>Local post link<input readonly value="${e(url)}" id="share-link"></label><p class="microcopy">This opens the post in this browser’s local sample data.</p>${button('Copy link', 'copyLink', '', 'btn primary')}</div>`); }
}
async function attachFeedImage(input) {
  const file = input.files?.[0];
  if (!file) return;
  const publish = dialog.querySelector('#feed-publish-button');
  const output = dialog.querySelector('.form-error');
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 500000) {
    input.value = ''; output.textContent = 'Choose a PNG, JPEG, WebP, or GIF image under 500 KB.'; return;
  }
  publish.disabled = true; output.textContent = '';
  try {
    const url = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(Error('This image could not be read.')); reader.readAsDataURL(file); });
    if (dialog.querySelector('#feed-image') !== input || input.files?.[0] !== file) return;
    ui.feedImage = { url, name: file.name };
    dialog.querySelector('#feed-image-preview').innerHTML = `<div class="city-image-preview"><img src="${e(url)}" alt="Selected image preview"><div><span>${e(file.name)}</span>${button('Remove image', 'feedRemoveImage', '', 'text-button')}</div><label>Image description<input name="imageAlt" required maxlength="240" placeholder="Briefly describe the image for people who cannot see it"></label></div>`;
  } catch (error) { output.textContent = error.message; }
  finally { publish.disabled = false; }
}

function addPeopleDialog() {
  showDialog('Add Volunteers', `<div class="dialog-body"><div class="choice-list">${[['import', 'book', 'Import an existing roster', 'Upload a CSV, review duplicates, and add your current volunteers.'], ['share', 'arrow', 'Volunteer Invite Link', 'Copy a link volunteers can use to join your organization.']].map(([action, glyph, title, sub]) => `<button class="choice-row" data-action="${action}"><span class="action-symbol sage">${icon(glyph)}</span><span><strong>${title}</strong><small>${sub}</small></span>${icon('chevron')}</button>`).join('')}</div></div>`);
}
function addPersonForm(method) {
  showDialog(method === 'existing' ? 'Add an existing team member' : 'Invite a volunteer', `<form data-form="addPerson" data-method="${method}"><div class="dialog-body"><p class="dialog-intro">${method === 'existing' ? 'Use this for someone who has already agreed to join your organization. Their preparation can be recorded separately.' : 'The invitation starts a conversation. It does not book a shift or mark preparation as complete.'}</p><label>Full name<input name="name" required placeholder="e.g. Casey Nguyen" autocomplete="off"></label><label>Email address<input name="email" type="email" required placeholder="casey@example.org" autocomplete="off"></label><label>Team or interests <span class="optional">optional</span><input name="role" placeholder="e.g. Garden team"></label>${method === 'existing' ? '<label class="checkbox-label"><input type="checkbox" required> This person has already agreed to join the organization.</label>' : '<div class="callout sand">This creates a sample invitation only. No email will be sent.</div>'}${errorOutput()}</div><div class="dialog-footer">${button('Cancel', 'close', '', 'btn secondary')}<button class="btn primary" type="submit">${method === 'existing' ? 'Add team member' : 'Create invitation'}</button></div></form>`);
}
function importDialog() {
  ui.csv = [];
  showDialog('Bring your existing team', `<form data-form="import"><div class="dialog-body"><p class="dialog-intro">Upload a CSV with <strong>name,email,role</strong> columns. We’ll preview it before adding anyone. No invitations are sent.</p><label class="file-input">Choose CSV file<input type="file" id="csv-file" accept=".csv,text/csv"></label><label>Or paste CSV<textarea id="csv-text" rows="4" placeholder="name,email,role&#10;Casey Nguyen,casey@example.org,Garden team"></textarea></label>${button('Preview people', 'previewCSV', '', 'btn secondary')}<div id="csv-preview"></div><label class="checkbox-label"><input type="checkbox" name="existing" required> These people have already agreed to join our team.</label>${errorOutput()}</div><div class="dialog-footer">${button('Cancel', 'close', '', 'btn secondary')}<button type="submit" class="btn primary" id="import-submit" disabled>Add previewed people</button></div></form>`, true);
}
function previewCSV() {
  try {
    ui.csv = parseCSV(document.querySelector('#csv-text').value);
    const seen = new Set(state.people.map(p => p.email.toLowerCase()));
    let valid = 0;
    document.querySelector('#csv-preview').innerHTML = `<div class="import-preview">${ui.csv.map(p => { const duplicate = seen.has(p.email.toLowerCase()); const invalid = !p.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email); p.skip = duplicate || invalid; if (!p.skip) { valid++; seen.add(p.email.toLowerCase()); } return `<div class="simple-row"><span><strong>${e(p.name || 'Missing name')}</strong><small>${e(p.email)}</small></span>${badge(duplicate ? 'Already in roster · skip' : invalid ? 'Invalid · skip' : 'Ready to add', p.skip ? 'sand' : 'sage')}</div>`; }).join('')}</div><p class="microcopy">${valid} ${valid === 1 ? 'person' : 'people'} will be added. Duplicate and invalid rows will be skipped.</p>`;
    document.querySelector('#import-submit').disabled = valid === 0; dialog.querySelector('.form-error').textContent = '';
  } catch (err) { dialog.querySelector('.form-error').textContent = err.message; }
}
function requirementDialog(personId, key) {
  const p = state.people.find(p => p.id === personId); const r = volunteerRequirement(state,HOME_ORG,key)||REQUIREMENTS[key];if(!p||!r)return;
  const coordinatorStep=r.owner==='coordinator'||r.self===false;
  const specific=key === 'welcome' ? '<h3>Welcome to Berkeley Neighbors</h3><p>We work in small teams, make expectations clear, and help each other learn. Ask your team lead when you arrive. You can change your availability or ask for help at any time.</p><p>Your commitment page includes the location, contact person, and anything you need to bring.</p>' : key === 'waiver' ? '<h3>Participation Agreement</h3><p>Review the organization’s current agreement, including expectations, support, expenses, and how either side can raise concerns.</p><p>This prototype records a sample completion only.</p>' : key === 'food' ? '<h3>Your first packing session</h3><p>Meet the lead at the packing table. Wash your hands, check the packing list, and keep produce separate from cleaning supplies. Your teammate will walk through the first bag with you.</p><p>If anything is unfamiliar, ask. We make room for learning.</p>' : `<h3>${e(r.title)}</h3><p>${e(r.detail)}</p><p>${coordinatorStep?'The organization records this step after reviewing it with the volunteer.':'The volunteer can record this step after reviewing the instructions.'}</p>`;
  showDialog(r.title, `<form data-form="requirement" data-person="${e(personId)}" data-key="${e(key)}"><div class="dialog-body"><span class="badge sage">${e(p.name)}</span><p class="dialog-intro">${e(r.detail)}</p><div class="reading-box">${specific}</div><label class="checkbox-label"><input type="checkbox" required> ${coordinatorStep?'Record organization approval for this requirement.':'Mark this requirement as complete.'}</label>${errorOutput()}</div><div class="dialog-footer">${button('Cancel', 'close', '', 'btn secondary')}<button type="submit" class="btn primary">${coordinatorStep?'Approve Requirement':'Complete Requirement'}</button></div></form>`);
}
function assignmentDialog(activityId) {
  const a = state.activities.find(a => a.id === activityId); const eligible = state.people.filter(p => p.relationship === 'member' && !activeCommitment(state, p.id, a.id));
  showDialog('Invite someone to help', `<form data-form="assign" data-activity="${e(a.id)}"><div class="dialog-body"><p class="dialog-intro">${e(a.title)} · ${dateLabel(a.date)}<br>The volunteer accepts before this counts as confirmed coverage.</p><label>Role<select name="roleId" id="assign-role">${a.roles.map(r => `<option value="${e(r.id)}">${e(r.name)} · ${r.capacity - confirmedCount(state, a.id, r.id)} places open</option>`).join('')}</select></label><label>Volunteer<select name="personId" required>${eligible.map(p => `<option value="${e(p.id)}">${e(p.name)} · ${e(p.availability)}</option>`).join('')}</select></label><p class="microcopy">Any missing preparation must be completed before they accept. Availability is a preference, not a promise.</p>${!eligible.length ? '<div class="callout sand">Everyone on the team already has a commitment, invitation, or waitlist place for this activity.</div>' : ''}${errorOutput()}</div><div class="dialog-footer">${button('Cancel', 'close', '', 'btn secondary')}<button class="btn primary" type="submit" ${!eligible.length ? 'disabled' : ''}>Propose assignment</button></div></form>`);
}
function signupDialog(activityId, roleId) {
  const a = state.activities.find(a => a.id === activityId); const p = currentPerson(); const role = a.roles.find(r => r.id === roleId) || a.roles[0]; const mode = assignmentModeOf(a); const missing = missingRequirements(p, role, state, a.date > today() ? a.date : today(), a); const blocking = mode === 'public' ? missing.filter(key => key !== 'waiver') : missing; const full = confirmedCount(state, a.id, role.id) >= role.capacity;
  if (mode === 'manual') { toast('This activity is assigned by the organization. A volunteer must receive and accept an invitation.'); return; }
  if (mode === 'roster' && p.relationship !== 'member') { toast('This activity is open only to volunteers on the organization roster.'); return; }
  const waiver = mode === 'public' ? state.documentLibrary?.items?.find(document => document.id === a.waiverDocumentId && isLiabilityWaiver(document)) : null;
  const signed = activityWaiverConsent(state, p.id, a);
  const access = mode === 'public'
    ? '<div class="activity-pathway-note public"><strong>Public activity</strong><p>Anyone eligible can claim an open place. This does not add you to the organization roster.</p></div>'
    : '<div class="activity-pathway-note roster"><strong>Roster signup</strong><p>This date is available only to approved volunteers in this organization. Choosing it creates one commitment.</p></div>';
  const waiverStep = mode === 'public' && !full ? waiver
    ? signed
      ? `<div class="activity-waiver-receipt">${icon('check')}<div><strong>Current waiver already signed</strong><p>${e(signed.documentTitle)} · accepted ${e(new Date(signed.acceptedAt).toLocaleDateString())}</p></div></div>`
      : `<section class="activity-waiver-step"><div><span class="eyebrow">REQUIRED FOR THIS ACTIVITY</span><h3>Review and sign the liability waiver</h3><p>Your signature is tied to this document version and this activity.</p></div><div class="activity-waiver-document"><div>${icon('book')}<span><strong>${e(waiver.title)}</strong><small>Version updated ${e(waiver.updatedAt || 'current')}</small></span></div>${button('View Document','docOpen',`data-id="${e(waiver.id)}"`,'btn secondary small')}</div><label>Type your full name<input name="signerName" required autocomplete="name" value="${e(p.name)}"></label><label class="checkbox-label"><input type="checkbox" name="waiverAccepted" required> I have reviewed this waiver and agree to sign it electronically for this activity.</label></section>`
    : '<div class="callout sand"><strong>This activity cannot accept claims yet.</strong><p>The organization needs to attach a current liability waiver.</p></div>'
    : '';
  ui.dialog = { type: 'signup', id: activityId, roleId: role.id };
  showDialog(a.type === 'project' ? 'Contribute to this task' : mode === 'public' ? 'Claim an open place' : 'Join this roster activity', `<form data-form="signup" data-activity="${e(a.id)}" data-role="${e(role.id)}" data-full="${full}"><div class="dialog-body">${access}<h3>${e(a.title)}</h3><p class="muted">${dateLabel(a.date)} · ${e(a.time)}<br>${e(a.location)}</p><label>Your role<select id="signup-role" data-activity="${e(a.id)}">${a.roles.map(r => `<option value="${e(r.id)}" ${r.id === role.id ? 'selected' : ''}>${e(r.name)}</option>`).join('')}</select></label>${blocking.length ? `<h3>Before you confirm</h3><p class="muted">Complete these preparation steps before this place can be confirmed.</p>${requirementRows(p, blocking, false, a.date > today() ? a.date : today())}${button('Open my preparation', 'nav', 'data-page="organization"', 'text-button')}` : ''}${waiverStep}${!blocking.length && (mode !== 'public' || signed) ? '<div class="callout sage"><strong>You’re ready for this work.</strong><p>Your current preparation is already recognized.</p></div>' : ''}${full ? '<div class="callout sand">This role is full. Join the waitlist; you’ll choose whether to accept when a place opens.</div>' : ''}${mode === 'public' && p.relationship !== 'member' ? '<p class="microcopy">Claiming this activity creates one commitment. It does not place you on the organization’s ongoing volunteer roster.</p>' : ''}${errorOutput()}</div><div class="dialog-footer">${button('Not now', 'close', '', 'btn secondary')}<button class="btn primary" type="submit" ${blocking.length && !full || mode === 'public' && !full && !waiver ? 'disabled' : ''}>${full ? 'Join waitlist' : mode === 'public' ? signed ? 'Confirm my place' : 'Sign & Confirm Place' : 'Confirm my place'}</button></div></form>`);
}
function responseDialog(commitmentId) {
  const commitment=state.commitments.find(item=>item.id===commitmentId&&item.status==='proposed');
  if(!commitment)return toast('This invitation is no longer waiting for a response.');
  const a=state.activities.find(item=>item.id===commitment.activityId),p=currentPerson(),role=a?.roles.find(item=>item.id===commitment.roleId);
  if(!a||!role||commitment.personId!==p.id)return toast('This invitation is not available.');
  const mode=assignmentModeOf(a),missing=missingRequirements(p,role,state,a.date>today()?a.date:today(),a),blocking=mode==='public'?missing.filter(key=>key!=='waiver'):missing;
  const waiver=mode==='public'?state.documentLibrary?.items?.find(document=>document.id===a.waiverDocumentId&&isLiabilityWaiver(document)):null;
  const signed=activityWaiverConsent(state,p.id,a);
  const waiverStep=mode==='public'?waiver?signed
    ? `<div class="activity-waiver-receipt">${icon('check')}<div><strong>Current waiver already signed</strong><p>${e(signed.documentTitle)} · accepted ${e(new Date(signed.acceptedAt).toLocaleDateString())}</p></div></div>`
    : `<section class="activity-waiver-step"><div><span class="eyebrow">REQUIRED BEFORE ACCEPTANCE</span><h3>Review and sign the liability waiver</h3><p>Your signature is tied to this document version and this activity.</p></div><div class="activity-waiver-document"><div>${icon('book')}<span><strong>${e(waiver.title)}</strong><small>Version updated ${e(waiver.updatedAt||'current')}</small></span></div>${button('View Document','docOpen',`data-id="${e(waiver.id)}"`,'btn secondary small')}</div><label>Type your full name<input name="signerName" required autocomplete="name" value="${e(p.name)}"></label><label class="checkbox-label"><input type="checkbox" name="waiverAccepted" required> I have reviewed this waiver and agree to sign it electronically for this activity.</label></section>`
    : '<div class="callout sand"><strong>The organization must attach a current liability waiver before you can accept.</strong></div>':'';
  ui.dialog={type:'response',id:commitmentId};
  showDialog('Review Activity Invitation',`<form data-form="respondActivity" data-id="${e(commitment.id)}"><div class="dialog-body"><div class="profile-banner">${avatar(p)}<div><strong>${e(a.title)}</strong><small>${dateLabel(a.date)} · ${e(a.time)} · ${e(a.location)}</small></div></div><div class="activity-pathway-note"><strong>Your choice</strong><p>The organization proposed this activity. It counts toward staffing only after you accept.</p></div>${blocking.length?`<h3 class="prep-title">Complete before accepting</h3>${requirementRows(p,blocking,false,a.date>today()?a.date:today())}`:''}${waiverStep}${errorOutput()}</div><div class="dialog-footer">${button('Decline Invitation','respond',`data-id="${e(commitment.id)}" data-accept="no"`,'btn secondary')}<button class="btn primary" type="submit" ${blocking.length||mode==='public'&&!waiver?'disabled':''}>Accept Activity</button></div></form>`);
}
function cancellationDialog(commitmentId) {
  const c = state.commitments.find(c => c.id === commitmentId); const a = state.activities.find(a => a.id === c.activityId);
  showDialog('Thanks for letting the team know', `<form data-form="cancel" data-id="${e(c.id)}"><div class="dialog-body"><h3>${e(a.title)}</h3><p class="dialog-intro">You can update your plans at any time, including at short notice. Your coordinator will see the change and can find a replacement.</p><label>Anything you’d like to share? <span class="optional">optional</span><textarea name="note" placeholder="A short note for the coordinator" rows="3" maxlength="600"></textarea></label>${errorOutput()}</div><div class="dialog-footer">${button('Keep my place', 'close', '', 'btn secondary')}<button class="btn danger-btn" type="submit">${c.status === 'waitlisted' ? 'Leave waitlist' : 'Cancel commitment'}</button></div></form>`);
}
function handoffDialog(activityId) {
  const a = state.activities.find(a => a.id === activityId);
  showDialog('Leave the next person a clear start', `<form data-form="handoff" data-id="${e(a.id)}"><div class="dialog-body"><p class="dialog-intro">${e(a.title)}<br>A few useful sentences are enough.</p><label>What is done so far?<textarea name="progress" required rows="3">${e(a.progress)}</textarea></label><label>What should happen next?<textarea name="next" required rows="3">${e(a.next)}</textarea></label><label>Who is carrying the next step?<input name="owner" value="${e(a.owner)}" required></label><p class="microcopy">Use the Program Activities card to submit results and record completion reviews.</p>${errorOutput()}</div><div class="dialog-footer">${button('Cancel', 'close', '', 'btn secondary')}<button class="btn primary" type="submit">Save handoff</button></div></form>`);
}
function preferencesDialog() {
  const p = currentPerson();
  showDialog('Make volunteering fit your life', `<form data-form="preferences"><div class="dialog-body"><p class="dialog-intro">These help your coordinator make better invitations. They do not book you into any work.</p><label>When are you usually available?<textarea name="availability" rows="2" required placeholder="Saturday mornings; unavailable Oct 3">${e(p.availability)}</textarea></label><label>What works well for you?<textarea name="preference" rows="3" placeholder="Interests, frequency, accessibility needs, or things to keep in mind">${e(p.preference)}</textarea></label>${errorOutput()}</div><div class="dialog-footer">${button('Cancel', 'close', '', 'btn secondary')}<button type="submit" class="btn primary">Share preferences</button></div></form>`);
}
const templates = [['event', 'leaf', 'One-Time Activity', 'One scheduled occasion, with its own team and handoff.'], ['shift', 'calendar', 'Recurring Activity', 'Repeat the activity on dated occasions people choose individually.'], ['project', 'book', 'Program Task', 'A scoped deliverable within a program, with dependencies and a reviewer.']];
const programTemplates = [['event', 'leaf', 'One-Time Program Activity', 'One scheduled occasion that belongs to this program.'], ['shift', 'calendar', 'Recurring Program Activity', 'Repeat on dated occasions within this program; volunteers choose each date.']];
function createDialog(type, programId = '') {
  if (!orgMode()) return;
  const selectedProgram = programId ? state.programWorkspace.programs.find(p => p.id === programId && p.status !== 'complete') : null;
  if (programId && !selectedProgram) return toast('This program is not available for new activities.');
  const program = selectedProgram || { id: '' };
  const scoped = Boolean(selectedProgram);
  if (!type) {
    const choices = scoped ? programTemplates : templates;
    return showDialog(scoped ? 'Choose a Program Activity' : 'What are you organizing?', `<div class="dialog-body"><p class="dialog-intro">${scoped ? `Activities created here stay in <strong>${e(program.name)}</strong>.` : 'Choose how this work happens. Any activity can be in person, remote, or hybrid.'}</p><div class="template-grid">${choices.map(([key, glyph, title, sub]) => `<button class="template-card" data-action="template" data-type="${key}" ${scoped ? `data-program="${e(program.id)}"` : ''}><span class="action-symbol sage">${icon(glyph)}</span><strong>${title}</strong><p>${sub}</p>${icon('arrow')}</button>`).join('')}</div></div>`, true);
  }
  if (scoped && !['event', 'shift'].includes(type)) return toast('Choose a one-time or recurring program activity.');
  const programs = state.programWorkspace.programs.filter(p => p.status !== 'complete');
  const title = scoped ? type === 'shift' ? 'Recurring Program Activity' : 'One-Time Program Activity' : titleForType(type);
  if (['event', 'shift'].includes(type)) {
    const organization = state.recruitment?.organizations?.find(item => item.id === HOME_ORG);
    const locationDefault = organization?.location || 'Organization location';
    const waiverDocuments = liabilityWaiversForActivity(state,program.id);
    const waiverOptions = waiverDocuments.length
      ? waiverDocuments.map(document => `<option value="${e(document.id)}">${e(document.title)} · ${e(document.updatedAt || 'Current')}</option>`).join('')
      : '<option value="" disabled>No liability waiver is available in Documents</option>';
    const preparation = Object.entries(REQUIREMENTS).map(([key, r]) => `<label class="checkbox-label"><input type="checkbox" name="requires" value="${key}" ${['welcome', 'waiver'].includes(key) ? 'checked' : ''}>${e(r.title)}</label>`).join('');
    showDialog(type === 'shift' ? 'Create Recurring Program Activity' : 'Create One-Time Program Activity', `<form data-form="createActivity" data-work-type="${type}" data-program="${e(program.id)}" data-program-activity="true"><div class="dialog-body"><div class="form-grid"><label class="span-2">Activity Title<input name="title" required placeholder="e.g. Saturday food distribution" maxlength="120"></label><label class="span-2">Activity Description<textarea name="description" rows="2" required placeholder="What will people do, and what should they expect?"></textarea></label><label>First Date<input type="date" name="date" value="${e(ui.page === 'calendar' && ui.home.day ? ui.home.day : today())}" required></label>${type === 'shift' ? "<label>Repeat<select name=\"interval\"><option value=\"7\">Weekly</option><option value=\"14\">Every two weeks</option></select></label>" : ''}<label>Activity Time<input type="time" name="activityTime" required></label><label>Duration<select name="duration" required><option value="30 minutes">30 minutes</option><option value="45 minutes">45 minutes</option><option value="1 hour">1 hour</option><option value="1.5 hours">1.5 hours</option><option value="2 hours">2 hours</option><option value="4 hours">4 hours</option></select></label><label class="span-2">Location<input name="location" value="${e(locationDefault)}" required placeholder="Organization location"></label><label class="span-2">Shift Assignment<select name="assignmentMode" id="assignment-mode" required><option value="manual">Assign Volunteers Manually</option><option value="roster">Open to Volunteer Roster</option><option value="public">Open to the Public</option></select></label></div><div id="public-shift-fields" hidden><div class="callout sage"><strong>Public opportunities need a current liability waiver.</strong><p>Select the version volunteers will review before confirming a place.</p></div><label>Liability Waiver from Organizational Resources<select name="waiverDocumentId" id="shift-waiver-document"><option value="">Choose a liability waiver</option>${waiverOptions}</select></label><fieldset><legend>Preparation required before confirmation</legend>${preparation}</fieldset></div>${errorOutput()}</div><div class="dialog-footer">${button('Cancel', 'close', '', 'btn secondary')}<button class="btn primary" type="submit">Create Program Activity</button></div></form>`, true);
    if (!scoped) {
      dialog.querySelector('#dialog-title').textContent = type === 'shift' ? 'Create Recurring Activity' : 'Create One-Time Activity';
      const form = dialog.querySelector('[data-form="createActivity"]');
      form.dataset.programActivity = 'false';
      delete form.dataset.program;
      form.querySelector('button[type="submit"]').textContent = 'Create Activity';
    }
    return;
  }
  const programField = scoped ? `<p class="dialog-intro">Part of <strong>${e(program.name)}</strong>. This activity will stay with this program.</p>` : type === 'project' ? `<label>Program<select name="programId" required><option value="">Choose a program</option>${programs.map(p => `<option value="${e(p.id)}">${e(p.name)}</option>`).join('')}</select></label>` : '';
  const repeatFields = type === 'shift' ? '<label>Repeat<select name="interval"><option value="7">Weekly</option><option value="14">Every two weeks</option></select></label><label>Number of occurrences<input name="occurrences" type="number" min="1" max="12" value="4" required></label>' : '';
  const preparation = Object.entries(REQUIREMENTS).map(([key, r]) => `<label class="checkbox-label"><input type="checkbox" name="requires" value="${key}" ${['welcome', 'waiver'].includes(key) ? 'checked' : ''}>${e(r.title)}</label>`).join('');
  showDialog(`Create ${title}`, `<form data-form="createActivity" data-work-type="${type}" ${scoped ? `data-program="${e(program.id)}"` : ''}><div class="dialog-body">${scoped ? programField : ''}<div class="form-grid"><label class="span-2">What are we doing?<input name="title" required placeholder="e.g. Test the garden irrigation" maxlength="120"></label><label class="span-2">A little context<textarea name="description" rows="2" required placeholder="What will people do, and what should they expect?"></textarea></label><label>${type === 'project' ? 'Due date' : type === 'shift' ? 'First date' : 'Activity date'}<input type="date" name="date" value="${e(ui.page === 'calendar' && ui.home.day ? ui.home.day : today())}" required></label><label>Time or expected effort<input name="time" required placeholder="10am–12pm, or 2 flexible hours"></label>${repeatFields}<label>Location / work mode<input name="location" required placeholder="A place, Remote, or Hybrid"></label>${scoped ? '' : programField}<label>Work area / milestone<input name="milestone" placeholder="e.g. Prepare the site"></label><label>Next-step owner<input name="owner" required placeholder="Who coordinates this work?"></label><label>Reviewer<input name="reviewer" required placeholder="Who checks the result?"></label><label>Role or contribution<input name="roleName" required placeholder="e.g. Garden team"></label><label>Places<input type="number" min="1" max="500" step="1" name="capacity" value="6" required></label><label>Who can see it?<select name="visibility"><option value="public" ${type === 'event' ? 'selected' : ''}>Everyone, including newcomers</option><option value="members" ${type !== 'event' ? 'selected' : ''}>Organization members</option></select></label><label>How do people join?<select name="enrollment"><option value="both">Self-signup or coordinator invitation</option><option value="self">Self-signup</option><option value="managed">Coordinator invitation</option></select></label><label class="span-2">Done means · acceptance criteria<textarea name="acceptance" required rows="2" placeholder="What result should the reviewer be able to verify?"></textarea></label></div><fieldset><legend>Preparation required before confirmation</legend>${preparation}</fieldset><p class="microcopy">${type === 'shift' ? 'Each date gets its own roster. No volunteer is automatically booked into the series. ' : ''}${scoped || type === 'project' ? 'After creation, use Edit plan in Program Activities to link prerequisites and record blockers.' : 'This standalone activity appears in general Planning.'}</p>${type === 'project' && !programs.length ? '<div class="callout sand">Create a program first from Volunteer programs.</div>' : ''}${errorOutput()}</div><div class="dialog-footer">${button('Back to types', scoped ? 'pgAddActivity' : 'create', scoped ? `data-id="${e(program.id)}"` : '', 'btn secondary')}<button class="btn primary" type="submit">Create ${scoped ? 'Program Activity' : type === 'shift' ? 'occurrences' : 'activity'}</button></div></form>`, true);
}

function editProgramActivityDialog(activityId,programId) {
  const activity=state.activities.find(item=>item.id===activityId&&item.programId===programId&&['event','shift'].includes(item.type));
  const program=state.programWorkspace.programs.find(item=>item.id===programId&&!['complete','archived'].includes(item.status));
  if(!activity||!program)return toast('This program activity is not available for editing.');
  const assignmentMode=activity.assignmentMode||(activity.visibility==='public'?'public':activity.enrollment==='self'?'roster':'manual');
  const durations=['30 minutes','45 minutes','1 hour','1.5 hours','2 hours','4 hours'];
  const timeText=activity.time||'';
  const range=timeText.match(/^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const clock=timeText.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const to24=(hour,period)=>String((Number(hour)%12)+(period.toUpperCase()==='PM'?12:0)).padStart(2,'0');
  const timeValue=/^\d{2}:\d{2}$/.test(timeText)?timeText:range?`${to24(range[1],range[5])}:${range[2]}`:clock?`${to24(clock[1],clock[3])}:${clock[2]}`:'';
  const rangeMinutes=range?((Number(range[3])%12+(range[5].toUpperCase()==='PM'?12:0))*60+Number(range[4]))-((Number(range[1])%12+(range[5].toUpperCase()==='PM'?12:0))*60+Number(range[2])):0;
  const inferredDuration=({30:'30 minutes',45:'45 minutes',60:'1 hour',90:'1.5 hours',120:'2 hours',240:'4 hours'})[rangeMinutes];
  const currentDuration=durations.includes(activity.duration)?activity.duration:inferredDuration||'1 hour';
  const waiverDocuments=liabilityWaiversForActivity(state,program.id,activity.waiverDocumentId);
  const waiverOptions=waiverDocuments.length?waiverDocuments.map(document=>`<option value="${e(document.id)}" ${document.id===activity.waiverDocumentId?'selected':''}>${e(document.title)} · ${e(document.updatedAt||'Current')}</option>`).join(''):'<option value="" disabled>No liability waiver is available in Documents</option>';
  const required=new Set(activity.roles.flatMap(role=>role.requires||[]));
  const preparation=Object.entries(REQUIREMENTS).map(([key,requirement])=>`<label class="checkbox-label"><input type="checkbox" name="requires" value="${key}" ${required.has(key)?'checked':''}>${e(requirement.title)}</label>`).join('');
  const repeat=activity.type==='shift'?`<label>Repeat<select name="interval"><option value="7" ${activity.recurrence?.includes('two weeks')?'':'selected'}>Weekly</option><option value="14" ${activity.recurrence?.includes('two weeks')?'selected':''}>Every two weeks</option></select></label>`:'';
  showDialog(`Edit ${activity.type==='shift'?'Recurring':'One-Time'} Program Activity`,`<form data-form="editProgramActivity" data-id="${e(activity.id)}" data-program="${e(program.id)}"><div class="dialog-body"><div class="form-grid"><label class="span-2">Activity Title<input name="title" value="${e(activity.title)}" required maxlength="120"></label><label class="span-2">Activity Description<textarea name="description" rows="2" required>${e(activity.description)}</textarea></label><label>First Date<input type="date" name="date" value="${e(activity.date)}" required></label>${repeat}<label>Activity Time<input type="time" name="activityTime" value="${e(timeValue)}" required></label><label>Duration<select name="duration" required>${durations.map(duration=>`<option value="${duration}" ${duration===currentDuration?'selected':''}>${duration}</option>`).join('')}</select></label><label class="span-2">Location<input name="location" value="${e(activity.location)}" required></label><label class="span-2">Shift Assignment<select name="assignmentMode" id="assignment-mode" required><option value="manual" ${assignmentMode==='manual'?'selected':''}>Assign Volunteers Manually</option><option value="roster" ${assignmentMode==='roster'?'selected':''}>Open to Volunteer Roster</option><option value="public" ${assignmentMode==='public'?'selected':''}>Open to the Public</option></select></label></div><div id="public-shift-fields" ${assignmentMode==='public'?'':'hidden'}><div class="callout sage"><strong>Public opportunities need a current liability waiver.</strong><p>Select the version volunteers will review before confirming a place.</p></div><label>Liability Waiver from Organizational Resources<select name="waiverDocumentId" id="shift-waiver-document" ${assignmentMode==='public'?'required':''}><option value="">Choose a liability waiver</option>${waiverOptions}</select></label><fieldset><legend>Preparation required before confirmation</legend>${preparation}</fieldset></div>${errorOutput()}</div><div class="dialog-footer">${button('Cancel','close','','btn secondary')}<button class="btn primary" type="submit">Save Activity</button></div></form>`,true);
}

document.addEventListener('keydown', event => {
  const profile = document.querySelector('.header-profile[open]');
  if (event.key === 'Escape' && profile && !dialog.open) {
    profile.open = false; profile.querySelector('summary').focus(); event.preventDefault();
  }
});
document.addEventListener('focusin', event => {
  const profile = document.querySelector('.header-profile[open]');
  if (profile && !profile.contains(event.target)) profile.open = false;
});
document.addEventListener('click', async event => {
  const profile = document.querySelector('.header-profile[open]');
  if (profile && !profile.contains(event.target)) profile.open = false;
  document.querySelectorAll('.program-row-menu[open],.documents-row-menu[open]').forEach(menu=>{if(!menu.contains(event.target))menu.open=false;});
  if (profile && event.target.closest('.header-profile-dropdown a')) { profile.open = false; profile.querySelector('summary').focus(); }
  const b = event.target.closest('[data-action]'); if (!b || b.disabled) return;
  const rowMenu=b.closest('.program-row-menu');if(rowMenu)rowMenu.open=false;
  if (profile && profile.contains(b)) { profile.open = false; profile.querySelector('summary').focus(); }
  const d = b.dataset;
  switch (d.action) {
    case 'connectedIdentity': {
      try {
        await switchMyCityIdentity(d.identityId);
        connectedContext = await loadMyCityContext();
        connectedContextError = '';
        applyConnectedContext(connectedContext);
        connectedResume = null;
        connectedResumeError = '';
        ui.mode = connectedContext.role === 'issuer' ? 'coordinator' : 'volunteer';
        navigate(ui.mode === 'coordinator' && ui.page === 'settings' ? 'settings' : ui.mode === 'coordinator' ? 'feed' : 'home');
      } catch (error) { toast(error.message); }
      break;
    }
    case 'issuerSkip': event.preventDefault(); document.querySelector('#main-content').focus(); document.querySelector('#main-content').scrollIntoView({block:'start'}); break;
    case 'pfField': openProfileDialog('Field',d.field); break;
    case 'pfAppearance': openProfileDialog('Appearance'); break;
    case 'pfLinks': openProfileDialog('Links'); break;
    case 'pfFeatured': openProfileDialog('Featured'); break;
    case 'pfRemoveImage': ui.profileImages[d.kind]=''; dialog.querySelector(`[data-profile-image="${d.kind}"]`).value=''; profileAppearancePreview(); break;
    case 'pfViewPublic': navigate('profile'); break;
    case 'pfEditor': ui.recruitOrg=d.id; navigate('profile','edit'); break;
    case 'pfRecruit': navigate('recruitment'); break;
    case 'pfWays': document.querySelector('#profile-ways')?.scrollIntoView({behavior:'smooth',block:'start'}); document.querySelector('#profile-ways')?.focus({preventScroll:true}); break;
    case 'pfCopy': { const text=document.querySelector(d.kind==='code'?'#profile-button-code':'#profile-link').value; try {await navigator.clipboard.writeText(text);toast('Copied. This is a local preview link.');}catch{showDialog('Copy your local profile link',`<div class="dialog-body"><label>Copy this text<textarea readonly>${e(text)}</textarea></label></div>`);} break; }
    case 'pfCode': {const base=location.pathname==='/'?'':location.pathname;const link=`${location.origin}${base}/#/volunteer/org-profile/${encodeURIComponent(ui.recruitOrg)}`;const code=`<a href="${link}" target="_blank" rel="noopener noreferrer">Volunteer with us</a>`;showDialog('Volunteer button for this local preview',`<div class="dialog-body"><label>HTML link code<textarea id="profile-button-code" readonly rows="4">${e(code)}</textarea></label><p class="microcopy">For local exploration only. Replace this localhost address with a hosted profile URL before using it on a public website.</p></div><div class="dialog-footer">${button('Close','close','','btn secondary')}${button('Copy button code','pfCopy','data-kind="code"','btn primary')}</div>`);break;}
    case 'pgOpen': ui.programTab=d.tab||'overview'; ui.programFilter='all'; navigate('program',d.id); break;
    case 'pgTab': ui.programTab=d.tab; render(); break;
    case 'pgFilter': ui.programFilter=d.filter; render(); break;
    case 'pgNew': openProgramDialog('New'); break;
    case 'pgEdit': openProgramDialog('Edit',d); break;
    case 'pgArchive': showDialog('Archive this program?', `<form data-form="pgArchive" data-id="${e(d.id)}"><div class="dialog-body"><p class="dialog-intro">The program will remain available as a record, but its workspace will become read-only.</p>${errorOutput()}</div><div class="dialog-footer">${button('Cancel','close','','btn secondary')}<button type="submit" class="btn danger-btn">Archive Program</button></div></form>`); break;
    case 'pgEditActivity': editProgramActivityDialog(d.id,d.program); break;
    case 'pgResource': showDialog('Add a Program Resource',renderDocumentForm(feedContext(),'program',d.id),true); break;
    case 'pgUpdate': openProgramDialog('Update',d); break;
    case 'pgStatus': programAction({type:'programStatus',programId:d.id,status:d.status}); break;
    case 'pgAddActivity': createDialog(undefined,d.id); break;
    case 'pgCreateRole': ui.recruitOrg=HOME_ORG; openRecruitmentDialog('Role',{program:d.id}); break;
    case 'pgRole': ui.recruitOrg=HOME_ORG; navigate('position',d.id); break;
    case 'docAdd': if(orgMode())showDialog('Add a document',renderDocumentForm(feedContext())); break;
    case 'docWaiver': if(orgMode())showDialog('Add a liability waiver',renderDocumentForm(feedContext(),'liability-waiver')); break;
    case 'docOpen': {
      releaseDocumentFileUrl();
      const documentItem=state.documentLibrary.items.find(item=>item.id===d.id);
      if(documentItem?.fileName) {
        try { const file=await loadDocumentFile(d.id); if(file)ui.documentFileUrl=URL.createObjectURL(file); }
        catch { toast('The uploaded file could not be opened in this browser.'); }
      }
      const detail=renderDocumentDetail(feedContext(),d.id,ui.documentFileUrl);
      if(detail)showDialog(detail.title,detail.content,true);
      break;
    }
    case 'docDelete': {
      const documentItem=state.documentLibrary.items.find(item=>item.id===d.id);
      if(!documentItem)break;
      releaseDocumentFileUrl();
      showDialog('Delete this resource?',`<form data-form="docDelete" data-id="${e(documentItem.id)}"><div class="dialog-body"><p>Delete <strong>${e(documentItem.title)}</strong> from Documents &amp; Resources${documentItem.programId?' and its program':''}?</p><p class="microcopy">This removes the document record and its locally uploaded file.</p>${errorOutput()}</div><div class="dialog-footer">${button('Cancel','close','','btn secondary')}<button class="btn danger-btn" type="submit">Delete Resource</button></div></form>`);
      break;
    }
    case 'docAssign': {
      const assignment=renderDocumentAssignment(feedContext(),d.id);
      if(assignment)showDialog(assignment.title,assignment.content);
      break;
    }
    case 'docAssignAll': documentAssignmentAction(d.id,{allVolunteerActivities:true}); break;
    case 'docFilter': ui.documentsCategory=d.category; render(); break;
    case 'rcHome': if (orgMode()) ui.recruitOrg = HOME_ORG; navigate(orgMode() ? 'recruitment' : 'applications'); break;
    case 'rcOrg': navigate('org-profile', d.id); break;
    case 'rcPosition': navigate('position', d.id); break;
    case 'rcApplication': if(orgMode()&&ui.page==='home')ui.recruitOrg=HOME_ORG; navigate('application', d.id); break;
    case 'rcBookmark': recruitmentAction({ type: 'bookmark', orgId: d.id }, undefined, 'discovery'); break;
    case 'rcSaved':
      ui.discoverySaved = !ui.discoverySaved;
      b.setAttribute('aria-pressed', String(ui.discoverySaved));
      b.setAttribute('aria-label', ui.discoverySaved ? 'Show all organizations' : 'Show Watchlist');
      b.classList.toggle('primary', ui.discoverySaved);
      b.classList.toggle('secondary', !ui.discoverySaved);
      b.classList.toggle('is-active', ui.discoverySaved);
      refreshDiscoveryResults();
      break;
    case 'rcTry': ui.mode = 'volunteer'; ui.person = 'robin'; navigate('discover'); break;
    case 'rcApply': openRecruitmentDialog('Apply', d); break;
    case 'rcAssist': openRecruitmentDialog('Assist', d); break;
    case 'rcCreateRole': openRecruitmentDialog('Role'); break;
    case 'rcRequirement': openRecruitmentDialog('Requirement', d); break;
    case 'rcEditRole': openRecruitmentDialog('Role', d); break;
    case 'rcDeleteRole': {
      const role=state.recruitment.positions.find(position=>position.id===d.id);
      if(!role)return;
      showDialog('Delete Program Role',`<form data-form="rcDeleteRole" data-id="${e(role.id)}"><div class="dialog-body"><p>Delete <strong>${e(role.title)}</strong> from this program?</p><p class="microcopy">A role with an active application cannot be deleted.</p>${errorOutput()}</div><div class="dialog-footer">${button('Cancel','close','','btn secondary')}<button type="submit" class="btn danger-btn">Delete Role</button></div></form>`);
      break;
    }
    case 'rcWelcome': openRecruitmentDialog('Welcome'); break;
    case 'rcRoleStatus': recruitmentAction({ type: 'positionStatus', positionId: d.id, status: d.status }); break;
    case 'rcDecision': openRecruitmentDialog('Decision', d); break;
    case 'rcAcceptOffer': recruitmentAction({ type: 'acceptOffer', applicationId: d.id }); break;
    case 'rcActivate': recruitmentAction({ type: 'activate', applicationId: d.id }); break;
    case 'rcStep': openRecruitmentDialog('Step', d); break;
    case 'rcTab': ui.recruitmentTab = d.tab; render(); break;
    case 'rcPassport': if (orgMode()) { if (sharedPassport(state, d.person)) navigate('passport', d.person); else toast('This volunteer has not shared a passport with Berkeley Neighbors.'); } else navigate('passport'); break;
    case 'ppDemo': ui.person = 'elena'; ui.mode = 'volunteer'; navigate('passport'); break;
    case 'ppOpen': if (sharedPassport(state, d.person)) { passportAction({ type: 'view', personId: d.person }); navigate('passport', d.person); } else { closeDialog(); toast('This volunteer has not shared a passport with Berkeley Neighbors.'); } break;
    case 'ppPublic': openPassportDialog('Public', d); break;
    case 'ppInvite': openPassportDialog('Invite', d); break;
    case 'ppSort': ui.passportSort = d.sort; render(); break;
    case 'ppOpenToggle': passportAction({ type: 'openness', open: d.open }); break;
    case 'ppShare': openPassportDialog('Share'); break;
    case 'ppProfile': openPassportDialog('Profile'); break;
    case 'ppAdd': openPassportDialog('Add'); break;
    case 'ppPreview': openPassportDialog('Preview', d); break;
    case 'ppRevoke': openPassportDialog('Revoke', d); break;
    case 'ppCorrect': openPassportDialog('Correct', d); break;
    case 'ppAttest': openPassportDialog('Attest', d); break;
    case 'ppAccept': openPassportDialog('Accept', d); break;
    case 'ppFollowup': openPassportDialog('Followup', d); break;
    case 'ppWithdraw': openPassportDialog('Withdraw', d); break;
    case 'ppPrint': openPassportDialog('Print'); break;
    case 'resumeVisibility': {
      b.disabled = true;
      try {
        connectedResume = await setMyCityResumeVisibility(d.public === 'true');
        connectedResumeError = '';
        render();
        toast(connectedResume.isPublic ? 'Your résumé now has a shareable external page.' : 'Your résumé is private.');
      } catch (error) {
        b.disabled = false;
        toast(error.message);
      }
      break;
    }
    case 'resumeCopyLink': {
      const url = `${location.origin}${d.path}`;
      try {
        await navigator.clipboard.writeText(url);
        toast('Résumé link copied.');
      } catch {
        showDialog('Copy your résumé link', `<div class="dialog-body"><label>Shareable link<input readonly value="${e(url)}"></label></div><div class="dialog-footer">${button('Done','close','','btn primary')}</div>`);
      }
      break;
    }
    case 'resumeReload': connectedResume = null; connectedResumeError = ''; void refreshConnectedResume(true); break;
    case 'resumePreview': if (!orgMode()) showDialog('Your volunteer résumé', `<div class="dialog-body">${resumeSheet(feedContext(), true)}</div><div class="dialog-footer">${button('Close','close','','btn secondary')}${button('Print / Save PDF','ppPrintNow','','btn primary')}</div>`,true); break;
    case 'ppPrintNow': window.print(); break;
    case 'ppExport': { if (orgMode()) break; const json = JSON.stringify(passportExport(state, ui.person), null, 2); ui.passportExportUrl = URL.createObjectURL(new Blob([json], { type: 'application/json' })); showDialog('Your portable copy', `<div class="dialog-body"><p>This full export includes your contact details, records and sharing history. Keep it private.</p><label>Passport JSON<textarea readonly id="passport-export" rows="10">${e(json)}</textarea></label><p class="microcopy">If your browser does not save the file, copy this JSON into a text file named my-volunteer-passport.json.</p></div><div class="dialog-footer">${button('Copy JSON', 'ppCopyExport', '', 'btn secondary')}<a class="btn primary" href="${e(ui.passportExportUrl)}" download="my-volunteer-passport.json">Save JSON file</a></div>`, true); break; }
    case 'ppCopyExport': { const input = document.querySelector('#passport-export'); try { await navigator.clipboard.writeText(input.value); toast('Passport JSON copied. Keep your copy private.'); } catch { input.select(); toast('Select and copy your passport JSON.'); } break; }
    case 'close': closeDialog(); break;
    case 'nav': if(d.page==='feed')ui.feedPublicProfile=false; navigate(d.page); break;
    case 'mode': { if(ui.page==='profile'&&d.mode==='volunteer'){ui.mode='volunteer';navigate('org-profile',ui.recruitOrg);break;} const page = ['program','programs','feed', 'passport','discover','org-profile','position','application'].includes(ui.page) ? ui.page : 'home'; const item = ['program','feed','org-profile','position','application'].includes(page) ? ui.item : d.mode === 'coordinator' && page === 'passport' ? ui.person : undefined; ui.mode = d.mode; if (page === 'application' && orgMode()) ui.recruitOrg = state.recruitment.applications.find(a => a.id === item)?.orgId || HOME_ORG; if (page === 'position' && orgMode()) ui.recruitOrg = state.recruitment.positions.find(p => p.id === item)?.orgId || HOME_ORG; if (page === 'passport' && orgMode() && sharedPassport(state, ui.person)) passportAction({ type: 'view', personId: ui.person }); navigate(page, item); break; }
    case 'feedCompose': feedComposer(); break;
    case 'feedPublicProfile': ui.feedPublicProfile=d.view==='profile';render();window.scrollTo({top:0,behavior:'smooth'});break;
    case 'feedFilter': ui.feedPublicProfile=false; ui.feedFilter = d.filter; ui.feedSaved = false; navigate(orgMode() ? 'feed' : 'home'); break;
    case 'feedQueueToggle': ui.feedQueueCollapsed = !ui.feedQueueCollapsed; render(); document.querySelector('[data-action="feedQueueToggle"]')?.focus(); break;
    case 'feedQueueAcknowledge': if (feedAction({ type: 'acknowledgeQueue', key: d.key })) document.querySelector('#participant-queue-title')?.focus(); break;
    case 'feedQueueHistory': showDialog('Action history', renderVolunteerActionHistory(feedContext()), true); break;
    case 'feedQueueRestore': if (feedAction({ type: 'restoreQueue', key: d.key })) showDialog('Action history', renderVolunteerActionHistory(feedContext()), true); break;
    case 'feedSaved': ui.feedPublicProfile=false; ui.feedSaved = !ui.feedSaved; navigate(orgMode() ? 'feed' : 'home'); break;
    case 'feedAll': ui.feedPublicProfile=false; ui.feedSaved = false; ui.feedFilter = 'all'; ui.feedQuery = ''; navigate(orgMode() ? 'feed' : 'home'); break;
    case 'feedLike': feedAction({ type: 'like', postId: d.id }); break;
    case 'feedBookmark': feedAction({ type: 'bookmark', postId: d.id }); break;
    case 'feedShare': await shareFeedPost(d.id); break;
    case 'feedRemoveImage': ui.feedImage = null; document.querySelector('#feed-image').value = ''; document.querySelector('#feed-image-preview').innerHTML = ''; break;
    case 'peopleFilter': ui.filter = d.filter; render(); break;
    case 'person': personDialog(d.id); break;
    case 'activity': navigate('activity', d.id); break;
    case 'addPeople': addPeopleDialog(); break;
    case 'invite': addPersonForm('invite'); break;
    case 'existing': addPersonForm('existing'); break;
    case 'import': importDialog(); break;
    case 'previewCSV': previewCSV(); break;
    case 'share': showDialog('Volunteer Invite Link', `<div class="dialog-body"><p>Share this link with people you would like to invite to your volunteer roster.</p><label>Volunteer Invite Link<input readonly value="${e(location.origin + '/#join')}" id="share-link"></label>${button('Copy link', 'copyLink', '', 'btn primary')}<p class="microcopy">Anyone with the link can begin the volunteer joining process.</p></div>`); break;
    case 'copyLink': try { await navigator.clipboard.writeText(document.querySelector('#share-link').value); toast('Volunteer invite link copied'); } catch { document.querySelector('#share-link').select(); toast('Select and copy the volunteer invite link'); } break;
    case 'approveMember': act({ type: 'membership', personId: d.id, relationship: 'member' }); break;
    case 'pauseMember': { const p = state.people.find(p => p.id === d.id); const n = state.commitments.filter(c => c.personId === p.id && ['confirmed', 'proposed'].includes(c.status)).length; showDialog('Take a little breathing room', `<div class="dialog-body"><p>Pause new commitments for ${e(p.name)}. Completed preparation stays on record.</p><div class="callout sand"><strong>${n} existing ${n === 1 ? 'plan needs' : 'plans need'} attention</strong><p>Pausing does not cancel or decline existing commitments. Review them in the schedule.</p></div></div><div class="dialog-footer">${button('Keep membership active', 'close', '', 'btn secondary')}${button('Pause membership', 'confirmPause', `data-id="${e(p.id)}"`, 'btn primary')}</div>`); break; }
    case 'confirmPause': if (act({ type: 'membership', personId: d.id, relationship: 'paused' })) navigate('schedule'); break;
    case 'resume': act({ type: 'membership', personId: ui.person, relationship: 'member' }); break;
    case 'join': recruitmentAction({ type: 'startInviteLink', personId: ui.person }, 'application'); break;
    case 'requirement': requirementDialog(d.person, d.key); break;
    case 'assign': assignmentDialog(d.id); break;
    case 'signup': signupDialog(d.id); break;
    case 'respond': if (d.accept === 'yes') responseDialog(d.id); else act({ type: 'respond', commitmentId: d.id, accept: false }); break;
    case 'cancel': cancellationDialog(d.id); break;
    case 'offer': act({ type: 'offerWaitlist', commitmentId: d.id }); break;
    case 'attendance': act({ type: 'attendance', commitmentId: d.id, attendance: d.value }); break;
    case 'verify': act({ type: 'verifyContribution', commitmentId: d.id, actor: 'coordinator' }); break;
    case 'handoff': handoffDialog(d.id); break;
    case 'preferences': preferencesDialog(); break;
    case 'commPane': ui.communicationPane=d.pane;ui.communicationSelection='';ui.communicationQuery='';if(!orgMode())ui.communicationChatView=d.pane==='archive'?'archive':'active';render();break;
    case 'commChatView': ui.communicationChatView=d.view;ui.communicationSelection='';ui.communicationQuery='';render();break;
    case 'commSelect': {
      ui.communicationSelection=d.id;
      if(d.kind==='notice'&&!state.communications.readNoticeIds.includes(d.id))communicationAction({type:'readNotice',noticeId:d.id},{silent:true});
      else if(d.kind==='inbox'&&state.communications.outbound.some(message=>message.id===d.id&&message.recipientIds.includes(ui.person))&&!(state.communications.readBy[ui.person]||[]).includes(d.id))communicationAction({type:'readMessage',messageId:d.id},{silent:true});
      else render();
      break;
    }
    case 'commNew': if(orgMode())showDialog('New Message',renderCommunicationComposer(feedContext()),true);break;
    case 'conversation': ui.communicationPane='events';ui.communicationChatView='active';ui.communicationSelection=d.id;navigate('messages');break;
    case 'create': createDialog(); break;
    case 'template': createDialog(d.type,d.program); break;
  }
});
document.addEventListener('change', async event => {
  if(event.target.matches('[data-profile-image]'))await profileImage(event.target);
  if(event.target.closest('[data-form="pfAppearance"]')&&['palette','banner'].includes(event.target.name))profileAppearancePreview();
  if (event.target.id === 'discovery-cause') { ui.discoveryCause = event.target.value; refreshDiscoveryResults(); }
  if (event.target.id === 'assignment-mode') {
    const publicFields = document.querySelector('#public-shift-fields');
    const publicOffering = event.target.value === 'public';
    if (publicFields) publicFields.hidden = !publicOffering;
    const waiver = document.querySelector('#shift-waiver-document');
    if (waiver) waiver.required = publicOffering;
  }
  if (event.target.id === 'passport-invitation-type') {
    const form=event.target.closest('form'),type=event.target.value;
    form?.querySelectorAll('[data-passport-invite-field]').forEach(field=>{
      const active=field.dataset.passportInviteField===type;field.hidden=!active;
      const select=field.querySelector('select');if(select)select.required=active;
    });
    const message=form?.elements.message;if(message)message.required=type==='conversation';
  }
  if (event.target.id === 'assisted-person') openRecruitmentDialog('Assist', { id: event.target.dataset.position, person: event.target.value });
  if (event.target.closest('[data-form="ppAdd"]')) updatePassportRecordForm();
  if (event.target.id === 'feed-image') await attachFeedImage(event.target);
  if (event.target.closest('[data-form="resumeSave"]')) { const preview = document.querySelector('[data-action="resumePreview"]'); preview.disabled = true; preview.title = 'Save your selection before printing'; }
  if (event.target.id === 'persona') { ui.person = event.target.value; render(); }
  if (event.target.id === 'signup-role') signupDialog(event.target.dataset.activity, event.target.value);
  if (event.target.id === 'csv-file' && event.target.files[0]) {
    if (event.target.files[0].size > 1000000) return toast('Choose a CSV smaller than 1 MB for this prototype.');
    document.querySelector('#csv-text').value = await event.target.files[0].text(); previewCSV();
  }
});
document.addEventListener('input', event => {
  if(event.target.id==='communication-search') {ui.communicationQuery=event.target.value;render();requestAnimationFrame(()=>{const input=document.querySelector('#communication-search');if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}});}
  if (event.target.id === 'documents-search') { ui.documentsQuery = event.target.value; document.querySelector('#documents-results').innerHTML = renderDocumentList(feedContext()); }
  if (event.target.id === 'discovery-search') { ui.discoveryQuery = event.target.value; document.querySelector('#discovery-results').innerHTML = discoveryResults(feedContext()); }
  if (event.target.id === 'feed-body') document.querySelector('#feed-char-count').textContent = `${event.target.value.length} / 1,000`;
  if (event.target.id === 'feed-search') { ui.feedQuery = event.target.value; const results = renderFeedResults(feedContext()); document.querySelector('#feed-posts').innerHTML = results.html; const count = document.querySelector('#feed-result-count'); if (count) count.textContent = `${results.count} ${results.count === 1 ? 'update' : 'updates'}${ui.feedSaved ? ' saved' : ''}`; }
  if (event.target.id === 'people-search') { ui.query = event.target.value; document.querySelector('#people-rows').innerHTML = peopleRows(); }
  if (event.target.id === 'csv-text') { ui.csv = []; document.querySelector('#import-submit').disabled = true; document.querySelector('#csv-preview').innerHTML = ''; }
});
document.addEventListener('submit', async event => {
  const form = event.target.closest('[data-form]'); if (!form) return; event.preventDefault();
  const fields = new FormData(form); const values = Object.fromEntries(fields); const d = form.dataset;
  switch (d.form) {
    case 'organizationSettings': {
      const submit = form.querySelector('button[type="submit"]');
      const output = form.querySelector('.form-error');
      submit.disabled = true; output.textContent = '';
      try {
        await saveOrganizationSettings(values);
        connectedContext = await loadMyCityContext();
        render(); toast('Organization settings saved.');
      } catch (error) {
        output.textContent = error.message;
        output.focus();
        submit.disabled = false;
      }
      break;
    }
    case 'docAdd': {
      let storedFileId='';
      try {
        const fileInput=form.elements.waiverFile||form.elements.documentFile;
        const file=fileInput?.files?.[0]||null;
        const summary=String(values.summary||'').trim()||String(values.content||'').trim().slice(0,240);
        const result=saveDocument(state,{...values,summary,fileName:file?.name,fileSize:file?.size,fileType:file?.type});
        if(file) { await saveDocumentFile(result.id,file); storedFileId=result.id; }
        localStorage.setItem(storageKey,JSON.stringify(result.state));
        state=result.state; closeDialog(); render(); toast(result.notice);
      } catch(error) {
        if(storedFileId) await removeDocumentFile(storedFileId).catch(()=>{});
        const output=form.querySelector('.form-error');
        output.textContent=error.name==='QuotaExceededError'?'Browser storage is full. Your document draft is still here.':error.message;
        output.focus();
      }
      break;
    }
    case 'docEdit': {
      const current=state.documentLibrary.items.find(item=>item.id===d.id);
      if(!current)break;
      const replacement=form.elements.documentFile?.files?.[0]||null;
      let previousFile=null;
      let replaced=false;
      try {
        const result=updateDocument(state,d.id,{...values,fileName:replacement?.name||current.fileName,fileSize:replacement?.size??current.fileSize,fileType:replacement?.type||current.fileType});
        if(replacement) {
          previousFile=await loadDocumentFile(d.id).catch(()=>null);
          await saveDocumentFile(d.id,replacement);
          replaced=true;
        }
        localStorage.setItem(storageKey,JSON.stringify(result.state));
        state=result.state; closeDialog(); render(); toast(result.notice);
      } catch(error) {
        if(replaced) {
          if(previousFile)await saveDocumentFile(d.id,previousFile).catch(()=>{});
          else await removeDocumentFile(d.id).catch(()=>{});
        }
        const output=form.querySelector('.form-error');
        output.textContent=error.name==='QuotaExceededError'?'Browser storage is full. Your changes were not saved.':error.message;
        output.focus();
      }
      break;
    }
    case 'docDelete': {
      try {
        const result=deleteDocument(state,d.id);
        localStorage.setItem(storageKey,JSON.stringify(result.state));
        state=result.state;
        await removeDocumentFile(d.id).catch(()=>{});
        closeDialog(); render(); toast(result.notice);
      } catch(error) {
        const output=form.querySelector('.form-error');
        output.textContent=error.message;
        output.focus();
      }
      break;
    }
    case 'docAssign': documentAssignmentAction(d.id,d.waiver==='true'?{programIds:fields.getAll('programIds'),allVolunteerActivities:false}:{programId:values.programId}); break;
    case 'pfField': profileAction({type:'field',orgId:d.org,field:d.field,value:values.value}); break;
    case 'pfLinks': profileAction({type:'links',orgId:d.org,...values}); break;
    case 'pfFeatured': profileAction({type:'featured',orgId:d.org,...values}); break;
    case 'pfAppearance': if(!ui.profileImageBusy)profileAction({type:'appearance',orgId:d.org,...values,logo:ui.profileImages.logo,cover:ui.profileImages.cover}); break;
    case 'pgProgram': programAction({type:'saveProgram',programId:d.id,...values},true); break;
    case 'pgUpdate': programAction({type:'update',programId:d.id,...values}); break;
    case 'pgArchive': programAction({type:'programStatus',programId:d.id,status:'archived',note:'Program archived'}); break;
    case 'rcSearch': break;
    case 'rcApply': case 'rcAssist': recruitmentAction({ type: 'saveApplication', positionId: d.position, personId: d.person, ...values, assisted: d.form === 'rcAssist', consent: fields.has('consent'), submit: event.submitter?.value !== 'draft' }, 'application'); break;
    case 'rcRole': recruitmentAction({ type: 'savePosition', positionId: d.id || undefined, ...values, requirements: fields.getAll('requirements') }, d.program ? null : 'position'); break;
    case 'rcRequirement': recruitmentAction({ type: 'saveRequirement', requirementId: d.id || undefined, ...values, positionIds: fields.getAll('positionIds') }); break;
    case 'rcWelcome': recruitmentAction({ type: 'saveWelcome', ...values }); break;
    case 'rcDeleteRole': recruitmentAction({ type: 'deletePosition', positionId: d.id }); break;
    case 'rcOrg': recruitmentAction({ type: 'saveOrganization', ...values }); break;
    case 'rcDecision': recruitmentAction({ type: ['withdraw','declineOffer'].includes(d.decision) ? d.decision : 'review', applicationId: d.id, status: d.decision, ...values }); break;
    case 'rcStep': recruitmentAction({ type: 'completeStep', applicationId: d.id, key: d.key, ...values, documentAccepted: fields.has('documentAccepted') }); break;
    case 'rcMessage': recruitmentAction({ type: 'message', applicationId: d.id, ...values }); break;
    case 'resumeSave': passportAction({type:'resume', sections:fields.getAll('sections'),recordIds:fields.getAll('recordIds')}); break;
    case 'ppProfile': passportAction({ type: 'profile', ...values }); break;
    case 'ppInvite': {
      const invitationType=values.invitationType||'role';
      if(invitationType==='activity')recruitmentAction({type:'inviteToActivity',personId:d.person,activityId:values.activityId,message:values.message});
      else if(invitationType==='conversation')recruitmentAction({type:'startPassportConversation',personId:d.person,message:values.message});
      else recruitmentAction({type:'inviteToPosition',personId:d.person,positionId:values.positionId,message:values.message});
      break;
    }
    case 'ppAdd': passportAction({ type: 'addRecord', ...values }); break;
    case 'ppShare': passportAction({ type: 'share', ...values, sections: fields.getAll('sections'), recordIds: fields.getAll('recordIds') }); break;
    case 'ppRevoke': passportAction({ type: 'revokeShare', grantId: d.id }); break;
    case 'ppCorrect': passportAction({ type: 'dispute', recordId: d.id, ...values }); break;
    case 'ppAttest': passportAction({ type: 'attest', personId: d.person, recordId: d.id, ...values }); break;
    case 'ppAccept': passportAction({ type: 'decide', outcome: 'accepted', personId: d.person, recordId: d.id, ...values }); break;
    case 'ppFollowup': passportAction({ type: 'decide', outcome: 'needs-follow-up', personId: d.person, recordId: d.id, ...values }); break;
    case 'ppWithdraw': passportAction({ type: 'withdraw', personId: d.person, recordId: d.id, ...values }); break;
    case 'ppPrint': { const shared = sharedPassport(state, ui.person, values.orgId); if (!shared) { toast('Create an active share first to choose the information for your summary.'); break; } showDialog('Your printable summary', `<div class="dialog-body">${printablePassport(feedContext(), shared)}</div><div class="dialog-footer">${button('Close', 'close', '', 'btn secondary')}${button('Print selected summary', 'ppPrintNow', '', 'btn primary')}</div>`, true); break; }
    case 'feedPublish': if (feedAction({ type: 'publish', ...values, imageUrl: ui.feedImage?.url, imageAlt: values.imageAlt || '' })) { ui.feedSaved = false; ui.feedFilter = 'all'; ui.feedQuery = ''; ui.feedImage = null; navigate('feed'); } break;
    case 'addPerson': act({ type: 'addPerson', ...values, method: d.method }); break;
    case 'import': {
      try { let next = state; let count = 0; for (const p of ui.csv.filter(p => !p.skip)) { next = transition(next, { type: 'addPerson', ...p, method: 'existing' }).state; count++; } if (!count) throw Error('Preview at least one valid person first.'); state = next; save(); closeDialog(); render(); toast(`${count} existing team ${count === 1 ? 'member' : 'members'} added. No invitations sent.`); } catch (err) { dialog.querySelector('.form-error').textContent = err.message; } break;
    }
    case 'requirement': { const previous = ui.dialog; if (act({ type: 'requirement', personId: d.person, key: d.key, actor: ui.mode })) { if (previous?.type === 'signup') signupDialog(previous.id, previous.roleId); else if (previous?.type === 'response') responseDialog(previous.id); else if (previous?.type === 'person') personDialog(previous.id); } break; }
    case 'assign': act({ type: 'commit', activityId: d.activity, ...values, status: 'proposed', actor: ui.mode }); break;
    case 'signup': act({ type: 'commit', activityId: d.activity, roleId: d.role, personId: ui.person, status: d.full === 'true' ? 'waitlisted' : 'confirmed', actor: ui.mode, signerName: values.signerName, waiverAccepted: fields.has('waiverAccepted') }); break;
    case 'respondActivity': act({ type: 'respond', commitmentId: d.id, accept: true, signerName: values.signerName, waiverAccepted: fields.has('waiverAccepted') }); break;
    case 'cancel': act({ type: 'cancel', commitmentId: d.id, note: values.note }); break;
    case 'handoff': act({ type: 'handoff', activityId: d.id, ...values }); break;
    case 'preferences': act({ type: 'preferences', personId: ui.person, ...values }); break;
    case 'message': act({ type: 'message', activityId: d.activity, author: orgMode() ? 'Maya' : currentPerson().name.split(' ')[0], text: values.text }); break;
    case 'commSend': {
      const sent=communicationAction({type:'send',audienceType:values.audienceType,recipientIds:fields.getAll('recipientIds'),groupId:values.groupId,subject:values.subject,body:values.body},{close:true});
      if(sent){ui.communicationPane='messages';ui.communicationSelection=state.communications.outbound[0]?.id||'';render();}
      break;
    }
    case 'createActivity': {
      const programId=d.program||values.programId||'';
      if(d.program&&!['event','shift'].includes(d.workType)) { toast('Choose a one-time or recurring program activity.'); break; }
      const programActivity = d.programActivity === 'true';
      const assignmentMode = values.assignmentMode || '';
      const coordinatedActivity = ['event','shift'].includes(d.workType) && Boolean(assignmentMode);
      const requirements = fields.getAll('requires');
      const action = {
        type: 'createActivity', ...values, programId, workType: d.workType,
        programActivity, requires: requirements,
        time: values.activityTime || values.time,
        assignmentMode,
        visibility: coordinatedActivity ? (assignmentMode === 'public' ? 'public' : 'members') : values.visibility,
        enrollment: coordinatedActivity ? (assignmentMode === 'manual' ? 'managed' : 'self') : values.enrollment,
        roleName: values.roleName || (coordinatedActivity ? 'Volunteer team' : ''),
        capacity: values.capacity || (coordinatedActivity ? '10' : ''),
        owner: values.owner || (coordinatedActivity ? (programActivity ? 'Program lead' : 'Organization coordinator') : ''),
        reviewer: values.reviewer || (coordinatedActivity ? (programActivity ? 'Program lead' : 'Organization coordinator') : ''),
        acceptance: values.acceptance || (coordinatedActivity ? 'Activity completed and handoff recorded.' : ''),
      };
      if(act(action)) {
        if(programId) { ui.programTab='overview'; navigate('program',programId); }
        else navigate('activity',state.activities.at(-1).id);
      }
      break;
    }
    case 'editProgramActivity': {
      const action={type:'updateProgramActivity',activityId:d.id,programId:d.program,...values,time:values.activityTime,requires:fields.getAll('requires'),actor:'coordinator'};
      if(act(action))navigate('program',d.program);
      break;
    }
  }
});
dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(); } });
dialog.addEventListener('close', () => { if (!dialog.open) { releaseDocumentFileUrl(); ui.dialog = null; } });
window.addEventListener('hashchange', readRoute);
window.addEventListener('storage', event => { if (event.key === storageKey && event.newValue) { try { const incoming = JSON.parse(event.newValue); if (incoming.version === 1) { state = ensureCommunications(ensureDocuments(ensureProfiles(ensurePrograms(ensureRecruitment(ensurePassport(ensureFeed(incoming))))))); render(); } } catch {} } });
readRoute();
if (integratedPlatform) loadMyCityContext().then(context => { connectedContext = context; connectedContextError = ''; applyConnectedContext(context); render(); }).catch(error => { connectedContextError = error.message; render(); });

bindPlanning({context:feedContext, render, commit:result=>{state=result.state;save();render();toast(result.notice);}, showDialog, closeDialog, toast, create:(type,programId)=>createDialog(type,programId)});

bindIssuerHome({context:feedContext,render,commit:result=>{state=result.state;save();render();toast(result.notice);},showDialog,closeDialog,navigate,toast});
