import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { checkProfilePullRequestScope } from './self-service-guard.mjs';
import {
  formatIssue,
  validateProfileJsonText,
} from './validate.mjs';

export const TRUSTED_PROFILE_CHECKLIST_COMMENT_MARKER = '<!-- sitcon-credits-profile-trusted-checklist -->';
export const PUBLIC_EMAIL_ACKNOWLEDGEMENT =
  '我理解 public_email 會公開顯示在網路上，可能被搜尋引擎、爬蟲或第三方保存。';
export const CONTENT_SAFETY_ACKNOWLEDGEMENT =
  '我確認這份 profile 沒有放入惡意 HTML、JavaScript、刻意破壞頁面顯示的內容，或任何可能造成 SITCON 夥伴困擾的資料；我理解若發生這類行為，維護者可以拒絕信任這次自助提交並改由人工審查。';

async function runCli(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv);
  const token = env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN is required.');
  }

  const event = JSON.parse(await readFile(options.eventPath, 'utf8'));
  const files = JSON.parse(await readFile(options.filesPath, 'utf8'));
  const pullRequest = event.pull_request;

  const scope = checkProfilePullRequestScope({ pullRequest, files });
  if (!scope.selfService) {
    throw new Error(formatScopeFailure(scope));
  }

  const profileFile = getSingleChangedProfileFile(files);
  const profileText = await fetchPullRequestFileText({
    token,
    pullRequest,
    filePath: profileFile.filename,
  });
  const issues = validateProfileJsonText(path.basename(profileFile.filename), profileText, { template: false });
  if (issues.length > 0) {
    throw new Error(issues.map(formatIssue).join('\n'));
  }

  const profile = JSON.parse(profileText);
  const checklistIssues = checkTrustedProfileChecklist({
    pullRequest,
    profile,
  });
  if (checklistIssues.length > 0) {
    const commentBody = formatTrustedProfileChecklistComment(checklistIssues);
    if (options.commentOutputPath) {
      await writeFile(options.commentOutputPath, `${commentBody}\n`);
    }
    throw new Error(formatTrustedProfileChecklistFailure(checklistIssues));
  }

  console.log(`Trusted profile PR check passed for ${profileFile.filename}.`);
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--event') {
      options.eventPath = readNextArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--files') {
      options.filesPath = readNextArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--comment-output') {
      options.commentOutputPath = readNextArg(argv, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  for (const key of ['eventPath', 'filesPath']) {
    if (!options[key]) {
      throw new Error(`Missing required option: ${key}`);
    }
  }

  return options;
}

export function checkTrustedProfileChecklist({ pullRequest, profile }) {
  const body = pullRequest?.body ?? '';
  const issues = [];

  if (hasNonEmptyPublicEmail(profile) && !hasCheckedCheckbox(body, PUBLIC_EMAIL_ACKNOWLEDGEMENT)) {
    issues.push({
      code: 'public-email-acknowledgement',
      message: `請勾選「${PUBLIC_EMAIL_ACKNOWLEDGEMENT}」`,
    });
  }

  if (!hasCheckedCheckbox(body, CONTENT_SAFETY_ACKNOWLEDGEMENT)) {
    issues.push({
      code: 'content-safety-acknowledgement',
      message: `請勾選「${CONTENT_SAFETY_ACKNOWLEDGEMENT}」`,
    });
  }

  return issues;
}

export function hasNonEmptyPublicEmail(profile) {
  return typeof profile?.public_email === 'string' && profile.public_email.trim() !== '';
}

export function hasCheckedCheckbox(markdown, label) {
  const escapedLabel = escapeRegExp(label).replaceAll('\\ ', '\\s+');
  const pattern = new RegExp(`^\\s*[-*]\\s+\\[[xX]\\]\\s+${escapedLabel}\\s*$`, 'm');
  return pattern.test(markdown ?? '');
}

export function formatTrustedProfileChecklistComment(issues) {
  return [
    TRUSTED_PROFILE_CHECKLIST_COMMENT_MARKER,
    '這個 PR 還需要補勾 profile 自助提交確認事項，trusted profile check 才會通過：',
    '',
    ...issues.map((issue) => `- ${issue.message}`),
    '',
    '請更新 PR 說明中的 checkbox 後重新觸發檢查。這些確認事項是為了保護提交者本人、其他 SITCON 夥伴，以及未來公開呈現 profile 的讀者。',
  ].join('\n');
}

function formatTrustedProfileChecklistFailure(issues) {
  return [
    'Trusted profile PR check requires the PR template acknowledgements below:',
    ...issues.map((issue) => `- ${issue.message}`),
  ].join('\n');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readNextArg(argv, index, name) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function formatScopeFailure(scope) {
  return [
    'Trusted profile PR check requires a self-service profile PR.',
    ...scope.issues.map((issue) => `- ${issue}`),
  ].join('\n');
}

function getSingleChangedProfileFile(files) {
  const profileFiles = files.filter((file) => /^profiles\/[^/_][^/]*\.json$/.test(file.filename));
  if (profileFiles.length !== 1) {
    throw new Error(`Trusted profile PR check expected exactly one profile JSON file, found ${profileFiles.length}.`);
  }
  return profileFiles[0];
}

async function fetchPullRequestFileText({ token, pullRequest, filePath }) {
  const repo = pullRequest?.head?.repo;
  const headSha = pullRequest?.head?.sha;
  if (!repo?.owner?.login || !repo?.name || !headSha) {
    throw new Error('pull request head repository and SHA are required.');
  }

  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const url = new URL(`https://api.github.com/repos/${repo.owner.login}/${repo.name}/contents/${encodedPath}`);
  url.searchParams.set('ref', headSha);
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.raw',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API request failed ${response.status}: ${text}`);
  }
  return response.text();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
