import test from 'node:test';
import assert from 'node:assert/strict';
import { retainReferencedConnectedParticipants } from './connected-state.js';
import { createEmptyState } from './model.js';
import { ensureRecruitment } from './recruitment-model.js';
import { ensurePrograms } from './program-model.js';
import { ensureIssuerHome } from './issuer-home-model.js';
import { homeCommandCenter } from './issuer-home-view.js';

const renderContext = state => ({
  state,
  ui: { home: { dashboardModule: 'recruitment', recruitmentRoleId: 'food-team' } },
  platformContext: null,
  e: value => String(value ?? ''),
  icon: name => `<i data-icon="${name}"></i>`,
  button: (label, action, attrs = '', cls = '') => `<button class="${cls}" data-action="${action}" ${attrs}>${label}</button>`,
  avatar: person => `<span class="avatar">${person.name}</span>`,
  badge: label => `<span class="badge">${label}</span>`,
  dateLabel: value => value,
  confirmedCount: () => 0,
});

test('issuer identity switch retains a connected participant who signaled role interest', () => {
  const state = ensureIssuerHome(ensurePrograms(ensureRecruitment(createEmptyState({ participant: true }))));
  const person = state.people[0];
  Object.assign(person, { name: 'Jordan Lee', email: 'jordan@example.org' });
  state.recruitment.positions.push({
    id: 'food-team', orgId: 'berkeley-neighbors', title: 'Food Team', status: 'open', pathway: 'conversation',
    mode: 'In person', impact: '', tasks: '', commitment: '', experience: '', support: '', capacity: 4,
    responseDays: 5, requirements: [], question: '', createdAt: '2026-10-09T12:00:00.000Z',
  });
  state.recruitment.roleInterests.push({
    id: 'interest-1', personId: person.id, orgId: 'berkeley-neighbors', positionId: 'food-team', status: 'active',
    createdAt: '2026-10-09T12:00:00.000Z',
  });
  state.passports.grants.push({
    id: 'grant-1', personId: person.id, orgId: 'berkeley-neighbors', sections: ['about'], recordIds: [],
    purpose: 'Interest in Food Team', expires: '2027-10-09', createdAt: '2026-10-09T12:00:00.000Z',
  });

  retainReferencedConnectedParticipants(state);

  assert.equal(state.people.length, 1);
  assert.equal(state.people[0].relationship, 'interested');
  const html = homeCommandCenter(renderContext(state), { organizationName: 'Riverside Food Bank' });
  assert.match(html, /Jordan Lee/);
  assert.match(html, /1 interested/);
  assert.match(html, /View Passport/);
});

test('issuer identity switch removes an otherwise unreferenced connected participant', () => {
  const state = createEmptyState({ participant: true });
  retainReferencedConnectedParticipants(state);
  assert.deepEqual(state.people, []);
});
