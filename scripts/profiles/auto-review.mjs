import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

import {
  PROFILE_REQUEST_LABEL,
  checkProfilePullRequestScope,
} from './self-service-guard.mjs';

export const REQUIRED_CHECK_NAMES = ['Check trusted profile PR', 'Check profile PR scope'];
export const MISSING_APPEARANCE_COMMENT_MARKER = '<!-- sitcon-credits-profile-appearance-check -->';
export const CREDITS_ASSISTANT_BOT_LOGIN = 'sitcon-credits-assistant[bot]';
const GITHUB_USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

export function decideProfileAutoReview({ pullRequest, files, exportPayload, checkRuns, sourceIssue = null }) {
  const checkSummary = summarizeRequiredChecks(checkRuns, REQUIRED_CHECK_NAMES);
  if (!checkSummary.ready) {
    return { action: 'wait', reason: 'required-checks-pending', checkSummary };
  }
  if (!checkSummary.success) {
    return { action: 'skip', reason: 'required-checks-not-successful', checkSummary };
  }

  const scope = checkProfilePullRequestScope({ pullRequest, files, sourceIssue });
  if (!scope.selfService) {
    return { action: 'skip', reason: 'not-self-service-profile-pr', scope };
  }

  const profileUsernames = collectChangedProfileUsernames(files);
  if (profileUsernames.length !== 1) {
    return {
      action: 'skip',
      reason: 'expected-one-profile-username',
      profileUsernames,
    };
  }

  const username = profileUsernames[0];
  const appearanceUsernames = collectAppearanceUsernames(exportPayload);
  if (!appearanceUsernames.has(username.toLowerCase())) {
    return {
      action: 'comment',
      reason: 'profile-username-not-in-appearances',
      username,
      commentBody: formatMissingAppearanceComment(username),
    };
  }

  return {
    action: 'approve',
    reason: 'profile-username-present-in-appearances',
    username,
    reviewBody: formatApprovalReviewBody(username),
    mergeTitle: formatMergeTitle(username),
  };
}

export function profilePullRequestHeadMatches(pullRequest, expectedHeadSha) {
  return pullRequest?.head?.sha === expectedHeadSha;
}

export function isAssistantAuthoredPullRequest(pullRequest, assistantLogin = CREDITS_ASSISTANT_BOT_LOGIN) {
  const authorLogin = pullRequest?.user?.login;
  return authorLogin === assistantLogin ||
    authorLogin === `${assistantLogin}[bot]` ||
    authorLogin === `app/${assistantLogin}`;
}

export function getDeletableProfileRequestBranch(pullRequest, options) {
  const branchName = pullRequest?.head?.ref;
  const headRepo = pullRequest?.head?.repo?.full_name;
  const expectedRepo = `${options.owner}/${options.repo}`;
  if (headRepo !== expectedRepo || !branchName?.startsWith('profile-request/')) {
    return null;
  }
  return branchName;
}

export function summarizeRequiredChecks(checkRuns, requiredNames) {
  const latestByName = new Map();
  for (const checkRun of checkRuns ?? []) {
    if (!requiredNames.includes(checkRun.name)) {
      continue;
    }
    const existing = latestByName.get(checkRun.name);
    if (!existing || checkRunTimestamp(checkRun) > checkRunTimestamp(existing)) {
      latestByName.set(checkRun.name, checkRun);
    }
  }

  const checks = requiredNames.map((name) => {
    const checkRun = latestByName.get(name);
    if (!checkRun) {
      return { name, status: 'missing', conclusion: null };
    }
    return {
      name,
      status: checkRun.status,
      conclusion: checkRun.conclusion ?? null,
    };
  });

  const ready = checks.every((check) => check.status === 'completed');
  const success = ready && checks.every((check) => check.conclusion === 'success');

  return { ready, success, checks };
}

export function collectChangedProfileUsernames(files) {
  const usernames = new Set();
  for (const file of files ?? []) {
    if (file.status === 'removed' || file.status === 'renamed') {
      continue;
    }
    const match = /^profiles\/([^/_][^/]*)\.json$/.exec(file.filename);
    if (match) {
      usernames.add(match[1]);
    }
  }
  return [...usernames].sort((a, b) => a.localeCompare(b));
}

export function collectAppearanceUsernames(exportPayload) {
  const rows = exportPayload?.sheets?.appearances?.rows;
  if (!Array.isArray(rows)) {
    throw new Error('export payload must include sheets.appearances.rows.');
  }

  const usernames = new Set();
  for (const row of rows) {
    const username = String(row.github_username ?? '').trim();
    if (GITHUB_USERNAME_PATTERN.test(username)) {
      usernames.add(username.toLowerCase());
    }
  }
  return usernames;
}

export function formatMissingAppearanceComment(username) {
  return [
    MISSING_APPEARANCE_COMMENT_MARKER,
    `這個 PR 的 profile username \`${username}\` 目前沒有出現在 SITCON Credits canonical Google Sheets 的 \`appearances.github_username\` 欄位。`,
    '',
    '因此這個 PR 不會自動核准。請維護者先確認是否需要在 `sitcon-tw/credits` 的 Google Sheets `appearances` 中補上或修正對應資料；如果這是刻意建立尚未連到歷史貢獻紀錄的 profile，請由維護者人工審查。',
  ].join('\n');
}

export function formatApprovalReviewBody(username) {
  return [
    `自動核准：\`${username}\` 的 profile 檢查已通過。`,
    '',
    '這個 username 已經出現在 SITCON Credits canonical `appearances.github_username` 欄位中。',
  ].join('\n');
}

export function formatMergeTitle(username) {
  return `chore: update ${username} profile`;
}

async function runCli(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv);
  const apiToken = env.GITHUB_TOKEN;
  const reviewToken = env.PROFILE_REVIEW_TOKEN;
  const assistantLogin = env.CREDITS_ASSISTANT_BOT_LOGIN || CREDITS_ASSISTANT_BOT_LOGIN;

  if (!apiToken) {
    throw new Error('GITHUB_TOKEN is required.');
  }

  const pullRequest = await githubRequest(apiToken, `GET /repos/${options.owner}/${options.repo}/pulls/${options.pullNumber}`);
  const files = await githubPaginate(apiToken, `GET /repos/${options.owner}/${options.repo}/pulls/${options.pullNumber}/files`);
  const sourceIssue = await fetchLinkedProfileRequestIssue(apiToken, options, pullRequest);
  const exportPayload = JSON.parse(await readFile(options.exportPath, 'utf8'));

  const deadline = Date.now() + options.waitMs;
  let decision;
  do {
    const checks = await githubRequest(
      apiToken,
      `GET /repos/${options.owner}/${options.repo}/commits/${options.headSha}/check-runs?per_page=100`,
    );
    decision = decideProfileAutoReview({
      pullRequest,
      files,
      exportPayload,
      checkRuns: checks.check_runs ?? [],
      sourceIssue,
    });

    if (decision.action !== 'wait' || Date.now() >= deadline) {
      break;
    }
    await sleep(options.intervalMs);
  } while (true);

  if (decision.action === 'wait' || decision.action === 'skip') {
    console.log(`Profile auto review skipped: ${decision.reason}`);
    return;
  }

  const currentPullRequest = await githubRequest(apiToken, `GET /repos/${options.owner}/${options.repo}/pulls/${options.pullNumber}`);
  if (!profilePullRequestHeadMatches(currentPullRequest, options.headSha)) {
    console.log(`Profile auto review skipped: stale-pr-head`);
    return;
  }

  if (decision.action === 'comment') {
    await upsertMissingAppearanceComment(apiToken, options, decision.commentBody, assistantLogin);
    console.log(`Profile auto review commented: ${decision.reason}`);
    return;
  }

  if (decision.action === 'approve') {
    if (!reviewToken) {
      throw new Error('PROFILE_REVIEW_TOKEN is required to approve profile pull requests.');
    }
    await deleteMissingAppearanceComments(apiToken, options, assistantLogin);
    if (isAssistantAuthoredPullRequest(currentPullRequest, assistantLogin)) {
      console.log(`Profile auto review skipped approval for assistant-authored PR: ${decision.username}`);
    } else {
      await approvePullRequest(reviewToken, options, decision.reviewBody);
      console.log(`Profile auto review approved: ${decision.username}`);
    }
    if (options.autoMerge) {
      const mergeResult = await mergePullRequestOrEnableAutoMerge(reviewToken, options, currentPullRequest, decision.mergeTitle);
      if (mergeResult.merged) {
        console.log(`Profile auto review merged: ${decision.username}`);
        await deleteProfileRequestBranch(reviewToken, options, currentPullRequest);
      } else {
        console.log(`Profile auto review enabled auto-merge: ${decision.username}`);
      }
    }
  }
}

export async function fetchLinkedProfileRequestIssue(token, options, pullRequest) {
  const issueNumber = extractLinkedIssueNumber(pullRequest?.body ?? '');
  if (!issueNumber) {
    return null;
  }

  const issue = await githubRequest(token, `GET /repos/${options.owner}/${options.repo}/issues/${issueNumber}`);
  if (!hasProfileRequestLabel(issue)) {
    return null;
  }

  return issue;
}

export function extractLinkedIssueNumber(body) {
  const match = body?.match(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

export function hasProfileRequestLabel(issue) {
  return (issue?.labels ?? []).some((label) => {
    const name = typeof label === 'string' ? label : label?.name;
    return name === PROFILE_REQUEST_LABEL;
  });
}

function parseArgs(argv) {
  const options = {
    waitMs: 300000,
    intervalMs: 10000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--owner') {
      options.owner = readNextArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--repo') {
      options.repo = readNextArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--pull-number') {
      options.pullNumber = readNextArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--head-sha') {
      options.headSha = readNextArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--export') {
      options.exportPath = readNextArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--auto-merge') {
      options.autoMerge = true;
      continue;
    }
    if (arg === '--merge-method') {
      options.mergeMethod = readNextArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--wait-ms') {
      options.waitMs = Number(readNextArg(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === '--interval-ms') {
      options.intervalMs = Number(readNextArg(argv, index, arg));
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  for (const key of ['owner', 'repo', 'pullNumber', 'headSha', 'exportPath']) {
    if (!options[key]) {
      throw new Error(`Missing required option: ${key}`);
    }
  }
  if (!Number.isFinite(options.waitMs) || options.waitMs < 0) {
    throw new Error('--wait-ms must be a non-negative number.');
  }
  if (!Number.isFinite(options.intervalMs) || options.intervalMs <= 0) {
    throw new Error('--interval-ms must be a positive number.');
  }
  if (options.mergeMethod && !['merge', 'squash', 'rebase'].includes(options.mergeMethod)) {
    throw new Error('--merge-method must be one of: merge, squash, rebase.');
  }

  return options;
}

function readNextArg(argv, index, name) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

async function upsertMissingAppearanceComment(token, options, body, assistantLogin) {
  const comments = await githubPaginate(token, `GET /repos/${options.owner}/${options.repo}/issues/${options.pullNumber}/comments`);
  const existing = findAssistantMissingAppearanceComment(comments, assistantLogin);
  if (existing) {
    await githubRequest(token, `PATCH /repos/${options.owner}/${options.repo}/issues/comments/${existing.id}`, { body });
    return;
  }
  await githubRequest(token, `POST /repos/${options.owner}/${options.repo}/issues/${options.pullNumber}/comments`, { body });
}

async function deleteMissingAppearanceComments(token, options, assistantLogin) {
  const comments = await githubPaginate(token, `GET /repos/${options.owner}/${options.repo}/issues/${options.pullNumber}/comments`);
  for (const comment of comments) {
    if (isAssistantMissingAppearanceComment(comment, assistantLogin)) {
      await githubRequest(token, `DELETE /repos/${options.owner}/${options.repo}/issues/comments/${comment.id}`);
    }
  }
}

export function findAssistantMissingAppearanceComment(comments, assistantLogin = CREDITS_ASSISTANT_BOT_LOGIN) {
  return comments.find((comment) => isAssistantMissingAppearanceComment(comment, assistantLogin));
}

export function isAssistantMissingAppearanceComment(comment, assistantLogin = CREDITS_ASSISTANT_BOT_LOGIN) {
  return comment.body?.includes(MISSING_APPEARANCE_COMMENT_MARKER) &&
    comment.user?.login === assistantLogin;
}

async function approvePullRequest(token, options, body) {
  await githubRequest(token, `POST /repos/${options.owner}/${options.repo}/pulls/${options.pullNumber}/reviews`, {
    event: 'APPROVE',
    body,
  });
}

async function mergePullRequestOrEnableAutoMerge(token, options, pullRequest, commitTitle) {
  try {
    await mergePullRequest(token, options, commitTitle);
    return { merged: true };
  } catch (error) {
    if (!isIntegrationAccessError(error)) {
      throw error;
    }
    try {
      await mergePullRequestGraphql(token, pullRequest.node_id, {
        commitTitle,
        mergeMethod: options.mergeMethod ?? 'squash',
      });
      return { merged: true };
    } catch (graphqlMergeError) {
      if (!isPullRequestNotReadyToMergeGraphqlError(graphqlMergeError)) {
        throw graphqlMergeError;
      }
    }
    await enablePullRequestAutoMerge(token, pullRequest.node_id, {
      commitTitle,
      mergeMethod: options.mergeMethod ?? 'squash',
    });
    return { merged: false };
  }
}

async function deleteProfileRequestBranch(token, options, pullRequest) {
  const branchName = getDeletableProfileRequestBranch(pullRequest, options);
  if (!branchName) {
    return;
  }
  await githubRequest(token, `DELETE /repos/${options.owner}/${options.repo}/git/refs/heads/${branchName}`);
  console.log(`Profile auto review deleted branch: ${branchName}`);
}

async function mergePullRequest(token, options, commitTitle) {
  return githubRequest(token, `PUT /repos/${options.owner}/${options.repo}/pulls/${options.pullNumber}/merge`, {
    commit_title: commitTitle,
    merge_method: options.mergeMethod ?? 'squash',
    sha: options.headSha,
  });
}

async function mergePullRequestGraphql(token, pullRequestId, options) {
  if (!pullRequestId) {
    throw new Error('pull request GraphQL node id is required to merge.');
  }
  await githubGraphqlRequest(token, `
    mutation MergePullRequest($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod!, $commitHeadline: String!) {
      mergePullRequest(input: {
        pullRequestId: $pullRequestId,
        mergeMethod: $mergeMethod,
        commitHeadline: $commitHeadline
      }) {
        pullRequest {
          number
        }
      }
    }
  `, {
    pullRequestId,
    mergeMethod: formatGraphqlMergeMethod(options.mergeMethod),
    commitHeadline: options.commitTitle,
  });
}

async function enablePullRequestAutoMerge(token, pullRequestId, options) {
  if (!pullRequestId) {
    throw new Error('pull request GraphQL node id is required to enable auto-merge.');
  }
  await githubGraphqlRequest(token, `
    mutation EnablePullRequestAutoMerge($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod!, $commitHeadline: String!) {
      enablePullRequestAutoMerge(input: {
        pullRequestId: $pullRequestId,
        mergeMethod: $mergeMethod,
        commitHeadline: $commitHeadline
      }) {
        pullRequest {
          number
        }
      }
    }
  `, {
    pullRequestId,
    mergeMethod: formatGraphqlMergeMethod(options.mergeMethod),
    commitHeadline: options.commitTitle,
  });
}

export function formatGraphqlMergeMethod(method) {
  return String(method).toUpperCase();
}

function isIntegrationAccessError(error) {
  return error instanceof Error &&
    error.message.includes('GitHub API request failed 403') &&
    error.message.includes('Resource not accessible by integration');
}

export function isPullRequestNotReadyToMergeGraphqlError(error) {
  return error instanceof Error &&
    error.message.includes('GitHub GraphQL request failed') &&
    /not mergeable|not ready|unstable|blocked|behind|pending/i.test(error.message);
}

async function githubPaginate(token, route) {
  const results = [];
  let request = routeToRequest(route);
  while (request) {
    const { data, next } = await githubFetch(token, request.method, request.url);
    if (!Array.isArray(data)) {
      throw new Error(`Expected paginated GitHub response to be an array for ${route}`);
    }
    results.push(...data);
    request = next ? { method: 'GET', url: next } : null;
  }
  return results;
}

async function githubRequest(token, route, body) {
  const request = routeToRequest(route);
  const { data } = await githubFetch(token, request.method, request.url, body);
  return data;
}

async function githubGraphqlRequest(token, query, variables) {
  const { data } = await githubFetch(token, 'POST', 'https://api.github.com/graphql', { query, variables });
  if (data.errors?.length > 0) {
    throw new Error(`GitHub GraphQL request failed: ${JSON.stringify(data.errors)}`);
  }
  return data.data;
}

async function githubFetch(token, method, url, body) {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API request failed ${response.status}: ${text}`);
  }
  const text = await response.text();
  return {
    data: text ? JSON.parse(text) : null,
    next: parseNextLink(response.headers.get('link')),
  };
}

function routeToRequest(route) {
  const [, method, path] = /^(GET|POST|PUT|PATCH|DELETE) (\/.*)$/.exec(route) ?? [];
  if (!method || !path) {
    throw new Error(`Invalid GitHub route: ${route}`);
  }
  return {
    method,
    url: `https://api.github.com${path}`,
  };
}

function parseNextLink(linkHeader) {
  if (!linkHeader) {
    return null;
  }
  const next = linkHeader
    .split(',')
    .map((part) => /<([^>]+)>;\s*rel="([^"]+)"/.exec(part.trim()))
    .find((match) => match?.[2] === 'next');
  return next?.[1] ?? null;
}

function checkRunTimestamp(checkRun) {
  return Date.parse(checkRun.completed_at ?? checkRun.started_at ?? checkRun.created_at ?? 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
