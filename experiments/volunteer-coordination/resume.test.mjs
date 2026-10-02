import assert from 'node:assert/strict';
import test from 'node:test';
import { renderResume } from './resume-view.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

const button = (label, action, attrs = '', className = 'btn') =>
  `<button class="${className}" data-action="${action}" ${attrs}>${label}</button>`;
const badge = (label, tone = 'neutral') => `<span class="badge ${tone}">${escapeHtml(label)}</span>`;

function context(resume) {
  return {
    integratedPlatform: true,
    platformContext: { role: 'participant' },
    platformResume: resume,
    platformResumeError: '',
    platformResumeLoading: false,
    e: escapeHtml,
    button,
    badge,
  };
}

const privateResume = {
  name: 'Alex Chen',
  joinedAt: Date.UTC(2025, 0, 15),
  totals: { contributions: 1, hours: 2, credits: 9, organizations: 1 },
  contributions: [{
    claimId: 'claim-1',
    org: 'Berkeley Neighbors',
    orgSlug: 'berkeley-neighbors',
    opportunity: 'Community Pantry Shift',
    when: Date.UTC(2026, 8, 14),
    whenLabel: null,
    hours: 2,
    credits: 9,
    verifiedAt: Date.UTC(2026, 8, 15),
    hasReflection: false,
  }],
  isPublic: false,
  token: null,
};

test('connected résumé offers a private volunteer a shareable digital page', () => {
  const html = renderResume(context(privateResume));
  assert.match(html, /Create Shareable Page/);
  assert.match(html, /Community Pantry Shift/);
  assert.match(html, /Organization verified/);
  assert.doesNotMatch(html, /Choose what to include/);
  assert.doesNotMatch(html, /Civic credits|public ledger/i);
});

test('connected résumé exposes its external page controls when public', () => {
  const html = renderResume(context({ ...privateResume, isPublic: true, token: 'token-123' }));
  assert.match(html, /Make Resume Private/);
  assert.match(html, /View External Page/);
  assert.match(html, /Copy Link/);
  assert.match(html, /\/resume\/token-123/);
});
