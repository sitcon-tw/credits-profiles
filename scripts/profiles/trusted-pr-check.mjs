import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  checkProfilePullRequestScope,
  formatScopeIssueForContributor,
} from './self-service-guard.mjs';
import {
  formatIssue,
  validateProfileJsonText,
} from './validate.mjs';

export const TRUSTED_PROFILE_CHECKLIST_COMMENT_MARKER = '<!-- sitcon-credits-profile-trusted-checklist -->';
export const PUBLIC_EMAIL_ACKNOWLEDGEMENT =
  '我理解 public_email 會公開顯示在網路上，可能被搜尋引擎、爬蟲或第三方保存。';
export const CONTENT_SAFETY_ACKNOWLEDGEMENT =
  '我確認這份 profile 沒有放入會破壞頁面或造成 SITCON 夥伴困擾的內容；若有疑慮，維護者可以改由人工審查。';

async function runCli(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv);
  const token = env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN is required.');
  }

  const event = JSON.parse(await readFile(options.eventPath, 'utf8'));
  const files = JSON.parse(await readFile(options.filesPath, 'utf8'));
  const sourceIssue = options.sourceIssuePath
    ? JSON.parse(await readFile(options.sourceIssuePath, 'utf8'))
    : null;
  const pullRequest = event.pull_request;

  const scope = checkProfilePullRequestScope({ pullRequest, files, sourceIssue });
  if (!scope.selfService) {
    await writeTrustedProfileComment(options, formatTrustedProfileScopeComment(scope));
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
    await writeTrustedProfileComment(options, formatTrustedProfileValidationComment(issues));
    throw new Error(issues.map(formatIssue).join('\n'));
  }

  const profile = JSON.parse(profileText);
  const checklistIssues = checkTrustedProfileChecklist({
    pullRequest,
    profile,
  });
  if (checklistIssues.length > 0) {
    const commentBody = formatTrustedProfileChecklistComment(checklistIssues);
    await writeTrustedProfileComment(options, commentBody);
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
    if (arg === '--source-issue') {
      options.sourceIssuePath = readNextArg(argv, index, arg);
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
    '這個 PR 還需要補勾 profile 自助提交確認事項，可信任 profile 檢查才會通過：',
    '',
    ...issues.map((issue) => `- ${issue.message}`),
    '',
    '請更新 PR 說明中的 checkbox 後重新觸發檢查。這些確認事項是為了保護提交者本人、其他 SITCON 夥伴，以及未來公開呈現 profile 的讀者。',
  ].join('\n');
}

export function formatTrustedProfileValidationComment(issues) {
  return [
    TRUSTED_PROFILE_CHECKLIST_COMMENT_MARKER,
    '這個 PR 的 profile JSON 還有格式問題，所以 `Check trusted profile PR` 沒有通過。',
    '',
    '請依照下面項目修正後重新 push：',
    ...issues.map((issue) => `- ${formatValidationIssueForContributor(issue)}`),
    '',
    '欄位格式可以參考 `profiles/README.md` 和 `profiles/_template.json`。',
  ].join('\n');
}

function formatValidationIssueForContributor(issue) {
  const location = issue.field ? `\`${issue.fileName}\` 的 \`${issue.field}\`` : `\`${issue.fileName}\``;
  return `${location}：${translateValidationIssueMessage(issue.message)}`;
}

export function translateValidationIssueMessage(message) {
  const translations = new Map([
    ['field is not allowed in profile files', '這個欄位不在 profile 允許清單內，請移除。'],
    ['required field is missing', '這個必要欄位缺少了，請補上。'],
    ['must be a string when present', '如果要填寫，值必須是字串。'],
    ['must be a string', '值必須是字串。'],
    ['must not contain line breaks', '不能包含換行。'],
    ['must not contain email addresses or phone numbers', '不能放 email 或電話等私人聯絡資訊；公開 email 請只放在 `public_email`。'],
    ['must be 2048 characters or fewer', '長度最多 2048 個字元。'],
    ['must be a valid URL', '必須是有效網址。'],
    ['must use https:', '網址必須使用 `https://`。'],
    ['must be 254 characters or fewer', '長度最多 254 個字元。'],
    ['must be a valid email address', '`public_email` 必須是有效 email 格式。'],
    ['must be an array', '必須是陣列。'],
    ['must contain 8 links or fewer', '最多只能放 8 個連結。'],
    ['must be an object', '必須是物件。'],
    ['field is not allowed in profile links', '這個欄位不在 link 允許清單內，請移除。'],
    ['must not be blank', '不能是空字串。'],
    ['must be omitted unless link type is custom', '只有 `type` 是 `custom` 時才能填 `label`，其他類型請移除 `label`。'],
    ['profile must be a JSON object', 'profile 檔案最外層必須是 JSON object。'],
    ['filename must be a valid GitHub username followed by .json', '檔名必須是有效 GitHub username 加上 `.json`。'],
  ]);
  if (translations.has(message)) {
    return translations.get(message);
  }
  if (message.startsWith('must contain valid JSON:')) {
    return `JSON 語法無效，請檢查逗號、引號或括號。原始錯誤：${message.slice('must contain valid JSON:'.length).trim()}`;
  }
  if (message.startsWith('profile should reference ') || message.startsWith('template should reference ')) {
    return '`$schema` 應該指向 `../schemas/profile.schema.json`。';
  }
  const maxLengthMatch = /^must be (\d+) characters or fewer$/.exec(message);
  if (maxLengthMatch) {
    return `長度最多 ${maxLengthMatch[1]} 個字元。`;
  }
  if (message.startsWith('must be one of:')) {
    return `只能使用允許的 link type：\`${message.slice('must be one of:'.length).trim()}\`。`;
  }
  if (message.startsWith('duplicates GitHub username from ')) {
    return `這個 GitHub username 已經有另一個大小寫相同的 profile：\`${message.slice('duplicates GitHub username from '.length)}\`。`;
  }
  return message;
}

export function formatTrustedProfileScopeComment(scope) {
  return [
    TRUSTED_PROFILE_CHECKLIST_COMMENT_MARKER,
    '這個 PR 目前不是可信任的單一 profile 自助更新，所以 `Check trusted profile PR` 沒有通過。',
    '',
    '自助 profile PR 需要只修改 PR 作者自己的單一 `profiles/<github_username>.json` 檔案。',
    '如果這次變更需要維護者審查，請等待維護者處理；這個可信任檢查只負責低風險自助 profile 更新。',
    '',
    '目前檢查到的問題：',
    ...scope.issues.map((issue) => `- ${formatScopeIssueForContributor(issue)}`),
  ].join('\n');
}

async function writeTrustedProfileComment(options, body) {
  if (options.commentOutputPath) {
    await writeFile(options.commentOutputPath, `${body}\n`);
  }
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
