import { readFile } from 'node:fs/promises';

export const PROFILE_SCOPE_REVIEW_LABEL = 'profile-scope-reviewed';

export function checkProfilePullRequestScope({ pullRequest, files }) {
  if (!pullRequest?.user?.login) {
    throw new Error('pull request user login is required');
  }
  if (!Array.isArray(files)) {
    throw new Error('pull request files must be an array');
  }

  const author = pullRequest.user.login.toLowerCase();
  const labels = new Set((pullRequest.labels ?? []).map((label) => label.name?.toLowerCase()).filter(Boolean));
  const hasScopeReview = labels.has(PROFILE_SCOPE_REVIEW_LABEL);
  const issues = [];
  const hardBlockIssues = [];
  const profileUsernames = new Set();

  for (const file of files) {
    const name = file.filename;

    if (name === 'site-profiles' || name.startsWith('site-profiles/')) {
      hardBlockIssues.push(`${name}: site profiles are maintained only by direct maintainer commits, not pull requests.`);
      continue;
    }

    if (file.status === 'removed') {
      issues.push(`${name}: profile removal requests require maintainer review.`);
      continue;
    }

    if (file.status === 'renamed') {
      issues.push(`${name}: profile renames require maintainer review.`);
      continue;
    }

    const match = /^profiles\/([^/]+)\.json$/.exec(name);
    if (!match) {
      issues.push(`${name}: self-service PRs may only change profiles/<github_username>.json.`);
      continue;
    }

    const username = match[1];
    if (username.startsWith('_')) {
      issues.push(`${name}: support/template files require maintainer review.`);
      continue;
    }

    profileUsernames.add(username.toLowerCase());
    if (username.toLowerCase() !== author) {
      issues.push(`${name}: filename username must match PR author ${pullRequest.user.login}.`);
    }
  }

  if (files.length === 0) {
    issues.push('No changed files were found.');
  }

  if (profileUsernames.size === 0) {
    issues.push('Self-service PRs must change exactly one owned profile file.');
  }

  if (profileUsernames.size > 1) {
    issues.push('Self-service PRs may not change more than one GitHub username profile.');
  }

  return {
    passed: hardBlockIssues.length === 0 && (issues.length === 0 || hasScopeReview),
    selfService: hardBlockIssues.length === 0 && issues.length === 0,
    hasScopeReview,
    issues: [...hardBlockIssues, ...issues],
  };
}

export function formatProfilePullRequestScopeResult(result) {
  if (result.selfService) {
    return 'Profile self-service scope passed.';
  }

  const lines = [
    `This PR is outside the self-service profile path and needs maintainer scope review.`,
    `After review, add the ${PROFILE_SCOPE_REVIEW_LABEL} label to acknowledge the wider profile scope.`,
    ...result.issues.map((issue) => `- ${issue}`),
  ];

  if (result.hasScopeReview) {
    lines.unshift(`Maintainer scope review label ${PROFILE_SCOPE_REVIEW_LABEL} is present.`);
  }

  return lines.join('\n');
}

async function runCli() {
  const eventPath = getArgValue('--event');
  const filesPath = getArgValue('--files');

  if (!eventPath || !filesPath) {
    throw new Error('usage: node scripts/profiles/self-service-guard.mjs --event=<event.json> --files=<files.json>');
  }

  const event = JSON.parse(await readFile(eventPath, 'utf8'));
  const files = JSON.parse(await readFile(filesPath, 'utf8'));
  const result = checkProfilePullRequestScope({
    pullRequest: event.pull_request,
    files,
  });

  const message = formatProfilePullRequestScopeResult(result);
  if (!result.passed) {
    console.error(message);
    process.exitCode = 1;
    return;
  }

  console.log(message);
}

function getArgValue(name) {
  const prefix = `${name}=`;
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return value?.slice(prefix.length);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
