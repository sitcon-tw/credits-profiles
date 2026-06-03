import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PROFILE_SCOPE_REVIEW_LABEL,
  checkProfilePullRequestScope,
  formatProfilePullRequestScopeComment,
} from './self-service-guard.mjs';

function check({ author = 'octocat', labels = [], files }) {
  return checkProfilePullRequestScope({
    pullRequest: {
      user: { login: author },
      labels: labels.map((name) => ({ name })),
    },
    files,
  });
}

function checkFromProfileRequestIssue({ issueAuthor = 'octocat', files }) {
  return checkProfilePullRequestScope({
    pullRequest: {
      user: { login: 'sitcon-credits[bot]' },
      labels: [],
    },
    files,
    sourceIssue: {
      user: { login: issueAuthor },
      labels: [{ name: 'profile-request' }],
    },
  });
}

test('profile self-service guard accepts one owned profile file', () => {
  const result = check({
    author: 'octocat',
    files: [
      { filename: 'profiles/octocat.json', status: 'modified' },
    ],
  });

  assert.equal(result.passed, true);
  assert.equal(result.selfService, true);
  assert.deepEqual(result.issues, []);
});

test('profile self-service guard rejects editing another profile without review label', () => {
  const result = check({
    author: 'octocat',
    files: [
      { filename: 'profiles/hubot.json', status: 'modified' },
    ],
  });

  assert.equal(result.passed, false);
  assert.equal(result.selfService, false);
  assert.match(result.issues.join('\n'), /filename username must match PR author octocat/);
});

test('profile self-service guard accepts app PR linked to profile request issue author', () => {
  const result = checkFromProfileRequestIssue({
    issueAuthor: 'octocat',
    files: [
      { filename: 'profiles/octocat.json', status: 'modified' },
    ],
  });

  assert.equal(result.passed, true);
  assert.equal(result.selfService, true);
  assert.deepEqual(result.issues, []);
});

test('profile self-service guard rejects app PR when profile request issue author does not match filename', () => {
  const result = checkFromProfileRequestIssue({
    issueAuthor: 'octocat',
    files: [
      { filename: 'profiles/hubot.json', status: 'modified' },
    ],
  });

  assert.equal(result.passed, false);
  assert.match(result.issues.join('\n'), /filename username must match profile request issue author octocat/);
});

test('profile self-service guard rejects multiple profile usernames without review label', () => {
  const result = check({
    author: 'octocat',
    files: [
      { filename: 'profiles/octocat.json', status: 'modified' },
      { filename: 'profiles/hubot.json', status: 'modified' },
    ],
  });

  assert.equal(result.passed, false);
  assert.match(result.issues.join('\n'), /may not change more than one GitHub username profile/);
});

test('profile self-service guard accepts wider scope with maintainer review label', () => {
  const result = check({
    author: 'octocat',
    labels: [PROFILE_SCOPE_REVIEW_LABEL],
    files: [
      { filename: 'profiles/hubot.json', status: 'modified' },
    ],
  });

  assert.equal(result.passed, true);
  assert.equal(result.selfService, false);
  assert.equal(result.hasScopeReview, true);
});

test('profile self-service guard rejects site profiles even with review label', () => {
  const result = check({
    author: 'octocat',
    labels: [PROFILE_SCOPE_REVIEW_LABEL],
    files: [
      { filename: 'site-profiles/SITCON-2026/speaker-1.json', status: 'modified' },
    ],
  });

  assert.equal(result.passed, false);
  assert.equal(result.selfService, false);
  assert.equal(result.hasScopeReview, true);
  assert.match(result.issues.join('\n'), /direct maintainer commits/);
});

test('profile self-service guard requires review for docs and support files', () => {
  const result = check({
    author: 'octocat',
    files: [
      { filename: 'profiles/_template.json', status: 'modified' },
      { filename: 'README.md', status: 'modified' },
    ],
  });

  assert.equal(result.passed, false);
  assert.match(result.issues.join('\n'), /support\/template files require maintainer review/);
  assert.match(result.issues.join('\n'), /self-service PRs may only change profiles/);
});

test('profile self-service scope comment explains missing json filename extension', () => {
  const result = check({
    author: 'joeangel',
    files: [
      { filename: 'profiles/joeangel', status: 'added' },
    ],
  });
  const comment = formatProfilePullRequestScopeComment(result);

  assert.equal(result.passed, false);
  assert.match(result.issues.join('\n'), /profile filename must end with \.json/);
  assert.match(comment, /`profiles\/joeangel`/);
  assert.match(comment, /請把檔案改名成 `profiles\/joeangel\.json`/);
});

test('profile self-service guard requires review for removals and renames', () => {
  const result = check({
    author: 'octocat',
    files: [
      { filename: 'profiles/octocat.json', status: 'removed' },
      { filename: 'profiles/new-octocat.json', status: 'renamed' },
    ],
  });

  assert.equal(result.passed, false);
  assert.match(result.issues.join('\n'), /profile removal requests require maintainer review/);
  assert.match(result.issues.join('\n'), /profile renames require maintainer review/);
});

test('profile self-service scope comment explains how to fix the PR', () => {
  const result = check({
    author: 'octocat',
    files: [
      { filename: 'profiles/hubot.json', status: 'modified' },
    ],
  });
  const comment = formatProfilePullRequestScopeComment(result);

  assert.match(comment, /sitcon-credits-profile-scope-check/);
  assert.match(comment, /`profiles\/hubot\.json`/);
  assert.match(comment, /PR 作者 `octocat`/);
  assert.match(comment, /profile-scope-reviewed/);
});
