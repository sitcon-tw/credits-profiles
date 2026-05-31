import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CONTENT_SAFETY_ACKNOWLEDGEMENT,
  PUBLIC_EMAIL_ACKNOWLEDGEMENT,
  checkTrustedProfileChecklist,
  formatTrustedProfileChecklistComment,
  formatTrustedProfileScopeComment,
  formatTrustedProfileValidationComment,
  hasCheckedCheckbox,
  hasNonEmptyPublicEmail,
} from './trusted-pr-check.mjs';

function pullRequest(body) {
  return { body };
}

function profile(publicEmail = '') {
  return { public_email: publicEmail };
}

function checked(label) {
  return `- [x] ${label}`;
}

test('hasCheckedCheckbox accepts checked GitHub markdown task list items', () => {
  assert.equal(hasCheckedCheckbox(`- [X] ${PUBLIC_EMAIL_ACKNOWLEDGEMENT}`, PUBLIC_EMAIL_ACKNOWLEDGEMENT), true);
  assert.equal(hasCheckedCheckbox(`- [ ] ${PUBLIC_EMAIL_ACKNOWLEDGEMENT}`, PUBLIC_EMAIL_ACKNOWLEDGEMENT), false);
});

test('hasNonEmptyPublicEmail only requires acknowledgement for non-empty public email', () => {
  assert.equal(hasNonEmptyPublicEmail(profile('')), false);
  assert.equal(hasNonEmptyPublicEmail(profile('octocat@example.com')), true);
});

test('trusted checklist accepts empty public_email when safety acknowledgement is checked', () => {
  const issues = checkTrustedProfileChecklist({
    pullRequest: pullRequest(checked(CONTENT_SAFETY_ACKNOWLEDGEMENT)),
    profile: profile(''),
  });

  assert.deepEqual(issues, []);
});

test('trusted checklist requires public_email acknowledgement when public_email is present', () => {
  const issues = checkTrustedProfileChecklist({
    pullRequest: pullRequest(checked(CONTENT_SAFETY_ACKNOWLEDGEMENT)),
    profile: profile('octocat@example.com'),
  });

  assert.deepEqual(issues.map((issue) => issue.code), ['public-email-acknowledgement']);
});

test('trusted checklist requires content safety acknowledgement', () => {
  const issues = checkTrustedProfileChecklist({
    pullRequest: pullRequest(checked(PUBLIC_EMAIL_ACKNOWLEDGEMENT)),
    profile: profile('octocat@example.com'),
  });

  assert.deepEqual(issues.map((issue) => issue.code), ['content-safety-acknowledgement']);
});

test('trusted checklist comment includes a stable marker and issue messages', () => {
  const issues = checkTrustedProfileChecklist({
    pullRequest: pullRequest(''),
    profile: profile('octocat@example.com'),
  });
  const comment = formatTrustedProfileChecklistComment(issues);

  assert.match(comment, /sitcon-credits-profile-trusted-checklist/);
  assert.match(comment, /public_email/);
  assert.match(comment, /惡意 HTML/);
});

test('trusted validation comment explains profile JSON fixes', () => {
  const comment = formatTrustedProfileValidationComment([
    { fileName: 'octocat.json', field: 'avatar_url', message: 'must use https:' },
    { fileName: 'octocat.json', field: 'links[0].label', message: 'must be omitted unless link type is custom' },
  ]);

  assert.match(comment, /sitcon-credits-profile-trusted-checklist/);
  assert.match(comment, /profile JSON/);
  assert.match(comment, /`octocat\.json` 的 `avatar_url`/);
  assert.match(comment, /https:\/\//);
  assert.match(comment, /移除 `label`/);
});

test('trusted scope comment uses contributor-facing issue text', () => {
  const comment = formatTrustedProfileScopeComment({
    issues: ['profiles/hubot.json: filename username must match PR author octocat.'],
  });

  assert.match(comment, /sitcon-credits-profile-trusted-checklist/);
  assert.match(comment, /`profiles\/hubot\.json`/);
  assert.match(comment, /PR 作者 `octocat`/);
});
