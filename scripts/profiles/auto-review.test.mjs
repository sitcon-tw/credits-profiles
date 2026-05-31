import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  collectAppearanceUsernames,
  decideProfileAutoReview,
  findAssistantMissingAppearanceComment,
  formatGraphqlMergeMethod,
  formatMergeTitle,
  formatMissingAppearanceComment,
  isAssistantMissingAppearanceComment,
  profilePullRequestHeadMatches,
  summarizeRequiredChecks,
} from './auto-review.mjs';

function pullRequest(login = 'octocat') {
  return {
    user: { login },
    labels: [],
  };
}

function profileFile(username, status = 'modified') {
  return {
    filename: `profiles/${username}.json`,
    status,
  };
}

function exportPayload(usernames) {
  return {
    sheets: {
      appearances: {
        rows: usernames.map((github_username) => ({ github_username })),
      },
    },
  };
}

function successfulChecks() {
  return [
    { name: 'Check trusted profile PR', status: 'completed', conclusion: 'success', completed_at: '2026-05-31T00:00:01Z' },
    { name: 'Check profile PR scope', status: 'completed', conclusion: 'success', completed_at: '2026-05-31T00:00:02Z' },
  ];
}

test('summarizeRequiredChecks waits for missing required checks', () => {
  const summary = summarizeRequiredChecks([
    { name: 'Check trusted profile PR', status: 'completed', conclusion: 'success' },
  ], ['Check trusted profile PR', 'Check profile PR scope']);

  assert.equal(summary.ready, false);
  assert.equal(summary.success, false);
  assert.equal(summary.checks[1].status, 'missing');
});

test('summarizeRequiredChecks requires successful conclusions', () => {
  const summary = summarizeRequiredChecks([
    { name: 'Check trusted profile PR', status: 'completed', conclusion: 'success' },
    { name: 'Check profile PR scope', status: 'completed', conclusion: 'failure' },
  ], ['Check trusted profile PR', 'Check profile PR scope']);

  assert.equal(summary.ready, true);
  assert.equal(summary.success, false);
});

test('collectAppearanceUsernames normalizes non-empty usernames', () => {
  assert.deepEqual(
    collectAppearanceUsernames(exportPayload(['Octocat', '', ' hubot '])) ,
    new Set(['octocat', 'hubot']),
  );
});

test('decideProfileAutoReview approves self-service profile already used in appearances', () => {
  const decision = decideProfileAutoReview({
    pullRequest: pullRequest('octocat'),
    files: [profileFile('octocat')],
    exportPayload: exportPayload(['Octocat']),
    checkRuns: successfulChecks(),
  });

  assert.equal(decision.action, 'approve');
  assert.equal(decision.username, 'octocat');
});

test('decideProfileAutoReview comments when profile username is not used in appearances', () => {
  const decision = decideProfileAutoReview({
    pullRequest: pullRequest('octocat'),
    files: [profileFile('octocat')],
    exportPayload: exportPayload(['hubot']),
    checkRuns: successfulChecks(),
  });

  assert.equal(decision.action, 'comment');
  assert.equal(decision.username, 'octocat');
  assert.match(decision.commentBody, /appearances\.github_username/);
});

test('decideProfileAutoReview skips PRs outside self-service profile scope', () => {
  const decision = decideProfileAutoReview({
    pullRequest: pullRequest('octocat'),
    files: [profileFile('hubot')],
    exportPayload: exportPayload(['hubot']),
    checkRuns: successfulChecks(),
  });

  assert.equal(decision.action, 'skip');
  assert.equal(decision.reason, 'not-self-service-profile-pr');
});

test('formatMissingAppearanceComment includes stable marker and maintainer instruction', () => {
  const comment = formatMissingAppearanceComment('octocat');

  assert.match(comment, /sitcon-credits-profile-appearance-check/);
  assert.match(comment, /維護者/);
  assert.match(comment, /appearances/);
});

test('profilePullRequestHeadMatches rejects stale dispatch payloads', () => {
  assert.equal(profilePullRequestHeadMatches({ head: { sha: 'new-head' } }, 'old-head'), false);
  assert.equal(profilePullRequestHeadMatches({ head: { sha: 'same-head' } }, 'same-head'), true);
});

test('formatMergeTitle names the profile update', () => {
  assert.equal(formatMergeTitle('octocat'), 'Update octocat profile');
});

test('formatGraphqlMergeMethod converts merge method to enum value', () => {
  assert.equal(formatGraphqlMergeMethod('squash'), 'SQUASH');
  assert.equal(formatGraphqlMergeMethod('merge'), 'MERGE');
});

test('assistant missing appearance comment matching ignores legacy user comments', () => {
  const assistantComment = {
    id: 2,
    user: { login: 'sitcon-credits-assistant[bot]' },
    body: formatMissingAppearanceComment('octocat'),
  };
  const comments = [
    {
      id: 1,
      user: { login: 'denny0223' },
      body: formatMissingAppearanceComment('octocat'),
    },
    assistantComment,
  ];

  assert.equal(isAssistantMissingAppearanceComment(comments[0]), false);
  assert.equal(isAssistantMissingAppearanceComment(assistantComment), true);
  assert.equal(findAssistantMissingAppearanceComment(comments), assistantComment);
});

test('assistant missing appearance comment matching supports configured app login', () => {
  const assistantComment = {
    id: 3,
    user: { login: 'sitcon-credits' },
    body: formatMissingAppearanceComment('octocat'),
  };

  assert.equal(isAssistantMissingAppearanceComment(assistantComment), false);
  assert.equal(isAssistantMissingAppearanceComment(assistantComment, 'sitcon-credits'), true);
  assert.equal(findAssistantMissingAppearanceComment([assistantComment], 'sitcon-credits'), assistantComment);
});
