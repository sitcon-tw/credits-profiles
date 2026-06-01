import { readFile, writeFile } from 'node:fs/promises';

export const PROFILE_SCOPE_REVIEW_LABEL = 'profile-scope-reviewed';
export const PROFILE_SCOPE_COMMENT_MARKER = '<!-- sitcon-credits-profile-scope-check -->';

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

    if (/^profiles\/[^/]+$/.test(name) && !name.endsWith('.json')) {
      issues.push(`${name}: profile filename must end with .json; expected profiles/${pullRequest.user.login}.json for this PR author.`);
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

export function formatProfilePullRequestScopeComment(result) {
  return [
    PROFILE_SCOPE_COMMENT_MARKER,
    '這個 PR 目前不符合 profile 自助更新的範圍，所以 `Check profile PR scope` 沒有通過。',
    '',
    '請依照下面項目調整：',
    ...result.issues.map((issue) => `- ${formatScopeIssueForContributor(issue)}`),
    '',
    `如果這次變更確實需要維護者審查，請等待維護者確認後加上 \`${PROFILE_SCOPE_REVIEW_LABEL}\` label。`,
    '`site-profiles/` 是維護者直接 commit 的資料，不接受一般 PR 修改。',
  ].join('\n');
}

export function formatScopeIssueForContributor(issue) {
  const [target, detail] = issue.split(/: (.*)/s);
  if (!detail) {
    return issue;
  }
  return `\`${target}\`：${translateScopeIssueDetail(detail)}`;
}

function translateScopeIssueDetail(detail) {
  const translations = new Map([
    ['site profiles are maintained only by direct maintainer commits, not pull requests.', 'site profile 只能由維護者直接 commit，請不要在 PR 中修改。'],
    ['profile removal requests require maintainer review.', '刪除 profile 需要維護者人工審查，不能走自助更新。'],
    ['profile renames require maintainer review.', '重新命名 profile 需要維護者人工審查，不能走自助更新。'],
    ['self-service PRs may only change profiles/<github_username>.json.', '自助更新只能修改 `profiles/<github_username>.json`。'],
    ['support/template files require maintainer review.', 'template 或支援檔需要維護者人工審查，不能走自助更新。'],
  ]);
  if (translations.has(detail)) {
    return translations.get(detail);
  }
  const authorMatch = /^filename username must match PR author (.+)\.$/.exec(detail);
  if (authorMatch) {
    return `檔名中的 GitHub username 必須和 PR 作者 \`${authorMatch[1]}\` 一致。`;
  }
  const missingJsonMatch = /^profile filename must end with \.json; expected (profiles\/[^/]+\.json) for this PR author\.$/.exec(detail);
  if (missingJsonMatch) {
    return `profile 檔名需要以 \`.json\` 結尾。請把檔案改名成 \`${missingJsonMatch[1]}\`。`;
  }
  return detail;
}

async function runCli(argv = process.argv.slice(2)) {
  const eventPath = getArgValue(argv, '--event');
  const filesPath = getArgValue(argv, '--files');
  const commentOutputPath = getArgValue(argv, '--comment-output');

  if (!eventPath || !filesPath) {
    throw new Error('usage: node scripts/profiles/self-service-guard.mjs --event=<event.json> --files=<files.json> [--comment-output=<comment.md>]');
  }

  const event = JSON.parse(await readFile(eventPath, 'utf8'));
  const files = JSON.parse(await readFile(filesPath, 'utf8'));
  const result = checkProfilePullRequestScope({
    pullRequest: event.pull_request,
    files,
  });

  const message = formatProfilePullRequestScopeResult(result);
  if (!result.passed) {
    if (commentOutputPath) {
      await writeFile(commentOutputPath, `${formatProfilePullRequestScopeComment(result)}\n`);
    }
    console.error(message);
    process.exitCode = 1;
    return;
  }

  console.log(message);
}

function getArgValue(argv, name) {
  const prefix = `${name}=`;
  const value = argv.find((arg) => arg.startsWith(prefix));
  return value?.slice(prefix.length);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
