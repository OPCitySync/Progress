// Prototype policy and attestations are fictional. This module does not authenticate users.
export const PASSPORT_ORG = 'berkeley-neighbors';
export const PASSPORT_ORGS = { 'berkeley-neighbors': 'Berkeley Neighbors', 'tool-library': 'Berkeley Tool Library', 'east-bay-learning': 'East Bay Volunteer Learning' };
export const SHARE_SECTIONS = { about: 'About me & self-described skills', contact: 'Email address', preferences: 'Availability & volunteering preferences' };
export const today = () => new Date().toLocaleDateString('en-CA');
export const daysFromNow = days => { const d = new Date(); d.setDate(d.getDate() + days); return d.toLocaleDateString('en-CA'); };
const uid = () => globalThis.crypto.randomUUID();
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
const clean = (value, max = 1000) => String(value || '').trim().slice(0, max);
const assertion = (condition, message) => { if (!condition) throw Error(message); };

export function ensurePassport(state) {
  if (!state.passports) state.passports = { version: 1, profiles: {}, records: [], grants: [], decisions: [], audit: [] };
  state.passports.resumes ||= {};
  for (const p of state.people) {
    if (!state.passports.profiles[p.id]) {
      state.passports.profiles[p.id] = { city: '', languages: '', skills: '', bio: '' };
      // Explicit sample records, never inferred from readiness flags or scheduled commitments.
      if (state.allowSampleData !== false && p.id === 'elena') {
        state.passports.profiles[p.id] = { city: 'Berkeley', languages: 'English, Spanish', skills: 'Food packing, welcoming newcomers', bio: 'I enjoy practical work with a regular neighborhood team.' };
        state.passports.records.push({ id: 'elena-food', personId: p.id, kind: 'training', title: 'Community food packing foundations', organizationId: 'east-bay-learning', issuer: PASSPORT_ORGS['east-bay-learning'], standard: 'food-packing/1', date: '2026-08-20', expires: '2027-08-20', summary: 'Safe packing, hygiene and allergen awareness. Local arrival and equipment guidance still apply.', status: 'attested', attestation: { by: 'Rosa Martinez', organizationId: 'east-bay-learning', date: '2026-08-20', basis: 'Sample course completion register EB-1042' }, demo: true });
      }
      if (state.allowSampleData !== false && p.id === 'alex') {
        state.passports.profiles[p.id] = { city: 'Berkeley', languages: 'English', skills: 'Food packing, gardening', bio: 'Happiest doing something useful with my neighbors.' };
        state.passports.records.push({ id: 'alex-service', personId: p.id, kind: 'service', title: 'Neighborhood pantry team', organizationId: PASSPORT_ORG, issuer: PASSPORT_ORGS[PASSPORT_ORG], standard: '', date: '2026-09-12', expires: '', hours: 2, summary: 'Packed produce bags and welcomed neighbors at the distribution table.', status: 'attested', attestation: { by: 'Maya Thompson', organizationId: PASSPORT_ORG, date: '2026-09-13', basis: 'Sample shift lead completion record' }, demo: true });
      }
    }
    if (typeof state.passports.profiles[p.id].openForVolunteering !== 'boolean') state.passports.profiles[p.id].openForVolunteering = state.allowSampleData !== false && ['elena', 'jules', 'robin'].includes(p.id);
  }
  return state;
}

export function recordStatus(record, date = today()) {
  if (['disputed', 'withdrawn'].includes(record.status)) return record.status;
  if (record.date > date) return 'not yet valid';
  if (record.expires && record.expires < date) return 'expired';
  return record.status;
}
export const grantActive = (grant, date = today()) => !!grant && !grant.revokedAt && grant.expires >= date;
export function sharedPassport(state, personId, orgId = PASSPORT_ORG, date = today()) {
  const p = state.people.find(p => p.id === personId);
  const grant = state.passports?.grants.find(g => g.personId === personId && g.orgId === orgId && grantActive(g, date));
  if (!p || !grant) return null;
  // Explicit projection: no emails, preferences, records or audit events leak by spreading a person.
  return { name: p.name, personId, grant: { id: grant.id, orgId: grant.orgId, expires: grant.expires, purpose: grant.purpose },
    ...(grant.sections.includes('about') ? { about: { ...state.passports.profiles[personId] } } : {}),
    ...(grant.sections.includes('contact') ? { email: p.email } : {}),
    ...(grant.sections.includes('preferences') ? { availability: p.availability, preference: p.preference } : {}),
    records: state.passports.records.filter(r => r.personId === personId && grant.recordIds.includes(r.id)).map(r => structuredClone(r)) };
}
export function publicVolunteerPassport(state, personId) {
  const person = state.people.find(p => p.id === personId);
  const profile = state.passports?.profiles?.[personId];
  if (!person || !profile?.openForVolunteering) return null;
  return {
    personId,
    name: person.name,
    color: person.color,
    city: profile.city,
    languages: profile.languages,
    skills: profile.skills,
    bio: profile.bio,
    availability: person.availability,
    preference: person.preference,
    records: state.passports.records.filter(r => r.personId === personId && r.status !== 'withdrawn').sort((a,b) => b.date.localeCompare(a.date)).map(r => ({ id: r.id, kind: r.kind, title: r.title, issuer: r.issuer, date: r.date, expires: r.expires, summary: r.summary, status: recordStatus(r) }))
  };
}
export function portableFoodEligible(record, date = today()) {
  return record?.kind === 'training' && record.standard === 'food-packing/1' && recordStatus(record, date) === 'attested'
    && [PASSPORT_ORG, 'east-bay-learning'].includes(record.organizationId)
    && record.attestation?.organizationId === record.organizationId && !!record.attestation.by && !!record.attestation.basis;
}
export function acceptedEvidence(state, personId, requirement, date = today()) {
  if (requirement !== 'food') return null;
  const shared = sharedPassport(state, personId, PASSPORT_ORG, date);
  if (!shared) return null;
  return shared.records.find(r => portableFoodEligible(r, date) && state.passports.decisions.find(d => d.grantId === shared.grant.id && d.recordId === r.id)?.outcome === 'accepted') || null;
}
export function decisionActive(state, decision, date = today()) {
  const shared = sharedPassport(state, decision.personId, PASSPORT_ORG, date);
  return !!shared && decision.grantId === shared.grant.id && decision.outcome === 'accepted'
    && state.passports.decisions.find(d => d.grantId === decision.grantId && d.recordId === decision.recordId)?.id === decision.id
    && shared.records.some(r => r.id === decision.recordId && portableFoodEligible(r, date));
}
export const requirementReady = (state, person, key, date = today()) => !!person.requirements[key] || !!acceptedEvidence(state, person.id, key, date);
export function readinessIssues(state, date = today()) {
  return state.commitments.filter(c => {
    if (c.status !== 'confirmed') return false;
    const person = state.people.find(p => p.id === c.personId);
    const activity = state.activities.find(a => a.id === c.activityId);
    const role = activity?.roles.find(r => r.id === c.roleId);
    return person && role && (!activity.date || activity.date >= date) && role.requires.some(key => !requirementReady(state, person, key, activity.date || date));
  });
}
export function passportExport(state, personId) {
  const p = state.people.find(p => p.id === personId);
  return { schema: 'citysync.volunteer-passport', schemaVersion: 1, exportedAt: new Date().toISOString(), prototype: true,
    owner: { name: p.name, email: p.email, ...state.passports.profiles[personId], availability: p.availability, preference: p.preference },
    records: structuredClone(state.passports.records.filter(r => r.personId === personId)),
    resume: structuredClone(state.passports.resumes?.[personId] || { sections: [], recordIds: [] }),
    sharing: structuredClone(state.passports.grants.filter(g => g.personId === personId)),
    decisions: structuredClone(state.passports.decisions.filter(d => d.personId === personId)),
    history: structuredClone(state.passports.audit.filter(a => a.personId === personId)) };
}

export function transitionPassport(current, action, date = today()) {
  const state = ensurePassport(structuredClone(current));
  const store = state.passports;
  const homeOrganization = state.recruitment?.organizations?.find(organization => organization.id === PASSPORT_ORG);
  const organizationName = homeOrganization?.name || PASSPORT_ORGS[PASSPORT_ORG];
  const coordinatorName = state.programWorkspace?.organizationMembers?.find(member=>member.connectedAccount)?.name || homeOrganization?.contact || 'Maya Thompson';
  const recipientName = orgId => state.recruitment?.organizations?.find(organization => organization.id === orgId)?.name || PASSPORT_ORGS[orgId] || 'Organization';
  const p = state.people.find(p => p.id === action.personId);
  assertion(p, 'Volunteer not found.');
  const owner = action.actor === p.id;
  const coordinator = action.actor === 'coordinator';
  const own = () => assertion(owner, 'Only the volunteer can change their passport or sharing choices.');
  const review = () => assertion(coordinator, 'A coordinator must review this evidence.');
  const record = () => { const r = store.records.find(r => r.id === action.recordId && r.personId === p.id); assertion(r, 'Record not found.'); return r; };
  const sharedRecord = () => { review(); const shared = sharedPassport(state, p.id, PASSPORT_ORG, date); assertion(shared?.records.some(r => r.id === action.recordId), 'This record is not currently shared with your organization.'); return { r: record(), shared }; };
  let notice = 'Passport saved';
  let detail = '';
  if (action.type === 'profile') {
    own(); store.profiles[p.id] = { ...store.profiles[p.id], city: clean(action.city, 100), languages: clean(action.languages, 200), skills: clean(action.skills, 400), bio: clean(action.bio, 600) };
    detail = 'Updated optional profile';
  } else if (action.type === 'openness') {
    own(); store.profiles[p.id].openForVolunteering = action.open === true || action.open === 'true';
    detail = store.profiles[p.id].openForVolunteering ? 'Shared public passport with volunteer organizations in the City Network' : 'Removed public passport from City Network discovery';
    notice = store.profiles[p.id].openForVolunteering ? 'Your Passport is now visible to volunteer organizations in your City Network.' : 'Your Passport is no longer visible in the City Network directory.';
  } else if (action.type === 'resume') {
    own(); const sections = [...new Set(action.sections || [])], recordIds = [...new Set(action.recordIds || [])];
    assertion(sections.every(key => Object.hasOwn(RESUME_SECTIONS, key)), 'Unknown résumé section.');
    assertion(recordIds.every(id => store.records.some(r => r.id === id && r.personId === p.id)), 'You can only include your own records.');
    store.resumes[p.id] = { sections, recordIds };
    detail = 'Updated private résumé selection'; notice = 'Résumé selection saved. Preview updated.';
  } else if (action.type === 'addRecord') {
    own(); assertion(['training', 'service'].includes(action.kind), 'Choose training or experience.');
    assertion(clean(action.title), 'Give this record a title.');
    assertion(validDate(action.date) && action.date <= date, 'Use a valid completion date, today or earlier.');
    assertion(!action.expires || (validDate(action.expires) && action.expires >= action.date), 'Expiry must be on or after completion.');
    assertion(['external', PASSPORT_ORG].includes(action.organizationId), 'Choose the organization that issued or supervised this record.');
    assertion(action.organizationId !== 'external' || clean(action.issuer), 'Name the issuing organization.');
    const hours = action.hours === '' || action.hours == null ? null : Number(action.hours);
    assertion(action.kind !== 'service' || hours === null || (Number.isFinite(hours) && hours > 0 && hours <= 24), 'Hours for one contribution must be between 0 and 24, or left blank.');
    store.records.push({ id: uid(), personId: p.id, kind: action.kind, title: clean(action.title, 120), organizationId: action.organizationId, issuer: action.organizationId === PASSPORT_ORG ? organizationName : clean(action.issuer, 120), standard: action.kind === 'training' && action.standard === 'food-packing/1' ? action.standard : '', date: action.date, expires: action.kind === 'training' ? action.expires || '' : '', ...(action.kind === 'service' ? { hours } : {}), summary: clean(action.summary), status: 'self-reported' });
    detail = 'Added a self-reported record'; notice = 'Record added privately. Share it when you are ready.';
  } else if (action.type === 'share') {
    own(); assertion(state.recruitment?.organizations?.some(organization => organization.id === action.orgId) || [PASSPORT_ORG, 'tool-library'].includes(action.orgId), 'Choose a receiving organization.');
    assertion(validDate(action.expires) && action.expires > date && action.expires <= daysFromDate(date, 365), 'Choose a sharing end date within the next year.');
    const sections = [...new Set(action.sections || [])]; const recordIds = [...new Set(action.recordIds || [])];
    assertion(sections.every(s => Object.hasOwn(SHARE_SECTIONS, s)), 'Unknown profile section.');
    assertion(recordIds.every(id => store.records.some(r => r.id === id && r.personId === p.id)), 'You can only share your own records.');
    assertion(sections.length + recordIds.length > 0, 'Choose at least one section or record to share.');
    assertion(clean(action.purpose), 'Say why you are sharing.');
    for (const g of store.grants.filter(g => g.personId === p.id && g.orgId === action.orgId && !g.revokedAt)) g.revokedAt = new Date().toISOString();
    store.grants.unshift({ id: uid(), personId: p.id, orgId: action.orgId, sections, recordIds, purpose: clean(action.purpose, 200), expires: action.expires, createdAt: new Date().toISOString() });
    detail = `Shared selected information with ${recipientName(action.orgId)}`; notice = 'Sharing saved. New records stay private until you select them.';
  } else if (action.type === 'revokeShare') {
    own(); const g = store.grants.find(g => g.id === action.grantId && g.personId === p.id);
    assertion(g && !g.revokedAt, 'This sharing permission has already ended.'); g.revokedAt = new Date().toISOString();
    detail = `Ended access for ${recipientName(g.orgId)}`; notice = 'Access ended. Preparation relying on this share now needs review.';
  } else if (action.type === 'view') {
    review(); assertion(sharedPassport(state, p.id, PASSPORT_ORG, date), 'No active sharing permission.');
    detail = `${coordinatorName} opened the shared passport at ${organizationName}`; notice = 'Shared passport opened';
  } else if (action.type === 'attest') {
    const { r } = sharedRecord();
    assertion(r.organizationId === PASSPORT_ORG, 'Only the issuing organization can confirm its own record.');
    assertion(r.status === 'self-reported', 'Only an unconfirmed record can be confirmed.');
    assertion(clean(action.basis), 'Record what you checked, such as a course or shift register.');
    assertion(!r.expires || r.expires >= date, 'This record has expired. Add a replacement record.');
    r.status = 'attested'; r.attestation = { by: coordinatorName, organizationId: PASSPORT_ORG, date, basis: clean(action.basis, 400) };
    detail = `${organizationName} confirmed: ${r.title}`; notice = 'Organization confirmation recorded. Acceptance for a role is a separate decision.';
  } else if (action.type === 'decide') {
    const { r, shared } = sharedRecord();
    assertion(['accepted', 'needs-follow-up'].includes(action.outcome), 'Choose a review outcome.');
    assertion(clean(action.basis), 'Explain your decision for the volunteer.');
    if (action.outcome === 'accepted') assertion(portableFoodEligible(r, date), 'This record does not meet the food packing standard and trusted issuer policy.');
    // Keep previous decisions and their reasons; only the newest decision governs reuse.
    store.decisions.unshift({ id: uid(), personId: p.id, grantId: shared.grant.id, recordId: r.id, outcome: action.outcome, requirement: action.outcome === 'accepted' ? 'food' : null, by: coordinatorName, organizationId: PASSPORT_ORG, date, basis: clean(action.basis, 400) });
    detail = `${action.outcome === 'accepted' ? 'Accepted for food packing introduction' : 'Requested follow-up'}: ${r.title}`;
    notice = action.outcome === 'accepted' ? 'Food packing evidence accepted. Membership, local welcome and agreement stay separate.' : 'Follow-up reason is visible to the volunteer.';
  } else if (action.type === 'dispute') {
    own(); const r = record(); assertion(!['withdrawn', 'disputed'].includes(r.status), 'This record is already withdrawn or under correction.');
    assertion(clean(action.basis), 'Describe what needs correcting.'); r.status = 'disputed'; r.correction = clean(action.basis, 400);
    detail = `Correction requested: ${r.title}`; notice = 'Correction recorded. This record cannot satisfy preparation while disputed. Add a corrected record for a fresh review.';
  } else if (action.type === 'withdraw') {
    const { r } = sharedRecord(); assertion(r.organizationId === PASSPORT_ORG && r.attestation, 'Only the issuing organization can withdraw its confirmation.');
    assertion(clean(action.basis), 'Explain why this confirmation is being withdrawn.'); r.status = 'withdrawn'; r.withdrawalReason = clean(action.basis, 400);
    detail = `Issuer withdrew confirmation: ${r.title}`; notice = 'Confirmation withdrawn; dependent preparation must be reviewed.';
  } else throw Error('Unknown passport action.');
  store.audit.unshift({ id: uid(), personId: p.id, actor: action.actor, type: action.type, detail, at: new Date().toISOString() });
  return { state, notice };
}
function daysFromDate(date, days) { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }

// A private, explicit projection. Building a résumé never creates a sharing grant.
export const RESUME_SECTIONS = { about: 'About me, skills & languages', contact: 'Email address', preferences: 'Availability & preferences' };
export function volunteerResume(state, personId) {
  const person = state.people.find(p => p.id === personId);
  if (!person) throw Error('Volunteer not found.');
  const selection = state.passports.resumes?.[personId] || { sections: [], recordIds: [] };
  return { name: person.name,
    ...(selection.sections.includes('about') ? { about: { ...state.passports.profiles[personId] } } : {}),
    ...(selection.sections.includes('contact') ? { email: person.email } : {}),
    ...(selection.sections.includes('preferences') ? { availability: person.availability, preference: person.preference } : {}),
    records: state.passports.records.filter(r => r.personId === personId && selection.recordIds.includes(r.id)).sort((a,b) => b.date.localeCompare(a.date)).map(r => structuredClone(r)) };
}
