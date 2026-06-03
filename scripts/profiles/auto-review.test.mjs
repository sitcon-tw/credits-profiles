import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  collectAppearanceUsernames,
  decideProfileAutoReview,
  extractLinkedIssueNumber,
  findAssistantMissingAppearanceComment,
  formatApprovalReviewBody,
  formatGraphqlMergeMethod,
  formatMergeTitle,
  formatMissingAppearanceComment,
  hasProfileRequestLabel,
  isAssistantMissingAppearanceComment,
  isAssistantAuthoredPullRequest,
  isPullRequestNotReadyToMergeGraphqlError,
  profilePullRequestHeadMatches,
  summarizeRequiredChecks,
} from './auto-review.mjs';

function pullRequest(login = 'octocat') {
  return {
    user: { login },
    labels: [],
  };
}

function profileRequestIssue(login = 'octocat') {
  return {
    user: { login },
    labels: [{ name: 'profile-request' }],
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

test('decideProfileAutoReview ignores site profile references in appearances', () => {
  const decision = decideProfileAutoReview({
    pullRequest: pullRequest(),
    files: [profileFile('octocat')],
    exportPayload: exportPayload(['site:octocat']),
    checkRuns: successfulChecks(),
  });

  assert.equal(decision.action, 'comment');
  assert.equal(decision.reason, 'profile-username-not-in-appearances');
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

test('decideProfileAutoReview accepts assistant PR linked to profile request issue author', () => {
  const decision = decideProfileAutoReview({
    pullRequest: pullRequest('sitcon-credits[bot]'),
    files: [profileFile('octocat')],
    sourceIssue: profileRequestIssue('octocat'),
    exportPayload: exportPayload(['hubot']),
    checkRuns: successfulChecks(),
  });

  assert.equal(decision.action, 'comment');
  assert.equal(decision.reason, 'profile-username-not-in-appearances');
  assert.equal(decision.username, 'octocat');
});

test('decideProfileAutoReview rejects assistant PR when linked issue author does not match profile', () => {
  const decision = decideProfileAutoReview({
    pullRequest: pullRequest('sitcon-credits[bot]'),
    files: [profileFile('hubot')],
    sourceIssue: profileRequestIssue('octocat'),
    exportPayload: exportPayload(['hubot']),
    checkRuns: successfulChecks(),
  });

  assert.equal(decision.action, 'skip');
  assert.equal(decision.reason, 'not-self-service-profile-pr');
});

test('extractLinkedIssueNumber reads closing keywords from PR body', () => {
  assert.equal(extractLinkedIssueNumber('Closes #21'), 21);
  assert.equal(extractLinkedIssueNumber('fixes #22'), 22);
  assert.equal(extractLinkedIssueNumber('No linked issue'), null);
});

test('hasProfileRequestLabel accepts profile request label objects and strings', () => {
  assert.equal(hasProfileRequestLabel({ labels: [{ name: 'profile-request' }] }), true);
  assert.equal(hasProfileRequestLabel({ labels: ['profile-request'] }), true);
  assert.equal(hasProfileRequestLabel({ labels: [{ name: 'bug' }] }), false);
});

test('formatMissingAppearanceComment includes stable marker and maintainer instruction', () => {
  const comment = formatMissingAppearanceComment('octocat');

  assert.match(comment, /sitcon-credits-profile-appearance-check/);
  assert.match(comment, /維護者/);
  assert.match(comment, /appearances/);
  assert.doesNotMatch(comment, /Automated approval|historical appearance|auto approve/);
});

test('formatApprovalReviewBody uses Traditional Chinese reader-facing text', () => {
  const body = formatApprovalReviewBody('octocat');

  assert.match(body, /自動核准/);
  assert.match(body, /profile 檢查已通過/);
  assert.doesNotMatch(body, /Automated approval|checks passed|already referenced/);
});

test('profilePullRequestHeadMatches rejects stale dispatch payloads', () => {
  assert.equal(profilePullRequestHeadMatches({ head: { sha: 'new-head' } }, 'old-head'), false);
  assert.equal(profilePullRequestHeadMatches({ head: { sha: 'same-head' } }, 'same-head'), true);
});

test('isAssistantAuthoredPullRequest detects app-authored pull requests', () => {
  assert.equal(isAssistantAuthoredPullRequest({ user: { login: 'sitcon-credits[bot]' } }, 'sitcon-credits'), true);
  assert.equal(isAssistantAuthoredPullRequest({ user: { login: 'app/sitcon-credits' } }, 'sitcon-credits'), true);
  assert.equal(isAssistantAuthoredPullRequest({ user: { login: 'octocat' } }, 'sitcon-credits'), false);
});

test('formatMergeTitle names the profile update', () => {
  assert.equal(formatMergeTitle('octocat'), 'chore: update octocat profile');
});

test('formatGraphqlMergeMethod converts merge method to enum value', () => {
  assert.equal(formatGraphqlMergeMethod('squash'), 'SQUASH');
  assert.equal(formatGraphqlMergeMethod('merge'), 'MERGE');
});

test('isPullRequestNotReadyToMergeGraphqlError detects merge-state errors only', () => {
  assert.equal(
    isPullRequestNotReadyToMergeGraphqlError(new Error('GitHub GraphQL request failed: [{"message":"Pull request is not mergeable"}]')),
    true,
  );
  assert.equal(
    isPullRequestNotReadyToMergeGraphqlError(new Error('GitHub GraphQL request failed: [{"message":"Pull request Pull request is in unstable status"}]')),
    true,
  );
  assert.equal(
    isPullRequestNotReadyToMergeGraphqlError(new Error('GitHub GraphQL request failed: [{"message":"Resource not accessible by integration"}]')),
    false,
  );
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
