import { readFile, writeFile } from 'node:fs/promises';

import {
  CONTENT_SAFETY_ACKNOWLEDGEMENT,
  PUBLIC_EMAIL_ACKNOWLEDGEMENT,
  hasCheckedCheckbox,
} from './trusted-pr-check.mjs';
import {
  formatIssue,
  validateProfileJsonText,
} from './validate.mjs';

export const PROFILE_REQUEST_COMMENT_MARKER = '<!-- sitcon-credits-profile-request -->';

const NO_RESPONSE = '_No response_';
const GITHUB_USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const GRAVATAR_SHA256_PATTERN = /^[a-f0-9]{64}$/;

export const FORM_LABELS = {
  displayName: '公開顯示名稱',
  bio: '公開簡介',
  gravatarSha256: 'Gravatar SHA-256 hash',
  avatarUrl: '進階：公開頭像圖片 URL',
  publicEmail: '公開 email',
  acknowledgements: '公開資料確認',
  historicalHints: '我有跳坑過，需要把貢獻紀錄和個人公開資料建立連結（選填）',
};

export const LINK_FORM_FIELDS = [
  ['github', 'GitHub'],
  ['website', '個人網站'],
  ['blog', 'Blog'],
  ['instagram', 'Instagram'],
  ['telegram', 'Telegram'],
  ['linkedin', 'LinkedIn'],
  ['facebook', 'Facebook'],
  ['youtube', 'YouTube'],
  ['slides', 'Slides'],
  ['gitlab', 'GitLab'],
  ['discord', 'Discord'],
  ['mastodon', 'Mastodon'],
  ['threads', 'Threads'],
  ['x', 'X'],
];

export const CUSTOM_LINK_LABEL_FIELD = '自訂連結名稱';
export const CUSTOM_LINK_URL_FIELD = '自訂連結 URL';
export const ISSUE_FORM_CONTENT_SAFETY_ACKNOWLEDGEMENT =
  '我確認這份個人公開資料沒有放入惡意 HTML、JavaScript、刻意破壞頁面顯示的內容，或任何可能造成 SITCON 夥伴困擾的資料；我理解若發生這類行為，維護者可以拒絕信任這次自助提交並改由人工審查。';

const REQUIRED_ACKNOWLEDGEMENTS = [
  '我確認這是我自願公開的個人資料。',
  '我沒有放入私人 email、電話、地址、證件資料或內部聯絡資訊。',
  '我沒有放入未經本人或他人同意公開的 email 或社群帳號。',
  PUBLIC_EMAIL_ACKNOWLEDGEMENT,
  ISSUE_FORM_CONTENT_SAFETY_ACKNOWLEDGEMENT,
  '我理解這個 PR 不會自動修改 SITCON Credits 的歷史貢獻紀錄，也不會自動完成身份合併。',
];

export function buildProfileRequestPullRequest({ issue, profileExists = false }) {
  if (!issue?.number || !issue?.user?.login || typeof issue?.body !== 'string') {
    throw new Error('issue number, author, and body are required');
  }

  const fields = parseIssueFormBody(issue.body);
  checkRequiredAcknowledgements(fields);
  const username = issue.user.login;
  if (!GITHUB_USERNAME_PATTERN.test(username)) {
    throw new Error('GitHub username 格式不正確。請使用 GitHub 支援的 username 格式。');
  }
  const displayName = readRequiredField(fields, FORM_LABELS.displayName);
  const avatarUrl = buildAvatarUrl({ fields, username });

  const profile = {
    $schema: '../schemas/profile.schema.json',
    display_name: displayName,
    bio: readOptionalField(fields, FORM_LABELS.bio),
    avatar_url: avatarUrl,
    public_email: readOptionalField(fields, FORM_LABELS.publicEmail),
    links: collectLinks(fields),
  };
  const profileText = `${JSON.stringify(profile, null, 2)}\n`;
  const validationIssues = validateProfileJsonText(`${username}.json`, profileText, { template: false });
  if (validationIssues.length > 0) {
    throw new Error([
      '表單內容還不能轉成有效的 profile JSON：',
      ...validationIssues.map((issue) => `- ${formatIssue(issue)}`),
    ].join('\n'));
  }

  const updateType = profileExists ? '更新我的 profile' : '新增我的 profile';
  const historicalHints = readOptionalField(fields, FORM_LABELS.historicalHints);

  return {
    username,
    branchName: `profile-request/issue-${issue.number}-${username}`,
    profilePath: `profiles/${username}.json`,
    profileText,
    prTitle: `${updateType}: ${username}`,
    prBody: formatPullRequestBody({ issue, updateType, profile, historicalHints }),
  };
}

export function buildAvatarUrl({ fields, username }) {
  const explicitAvatarUrl = readOptionalField(fields, FORM_LABELS.avatarUrl);
  if (explicitAvatarUrl) {
    return explicitAvatarUrl;
  }

  const gravatarHash = readOptionalField(fields, FORM_LABELS.gravatarSha256).toLowerCase();
  if (gravatarHash) {
    if (!GRAVATAR_SHA256_PATTERN.test(gravatarHash)) {
      throw new Error('Gravatar SHA-256 hash 必須是 64 個小寫十六進位字元；請不要填 email。');
    }
    return `https://gravatar.com/avatar/${gravatarHash}?s=512&r=g`;
  }

  return `https://github.com/${username}.png?size=512`;
}

export function parseIssueFormBody(body) {
  const fields = new Map();
  const headingPattern = /^### (.+)$/gm;
  const headings = [...body.matchAll(headingPattern)];

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const label = heading[1].trim();
    const start = heading.index + heading[0].length;
    const end = headings[index + 1]?.index ?? body.length;
    fields.set(label, body.slice(start, end).trim());
  }

  return fields;
}

export function collectLinks(fields) {
  const links = [];

  for (const [type, label] of LINK_FORM_FIELDS) {
    const url = readOptionalField(fields, label);
    if (url) {
      links.push({ type, url });
    }
  }

  const customUrl = readOptionalField(fields, CUSTOM_LINK_URL_FIELD);
  if (customUrl) {
    links.push({
      type: 'custom',
      label: readOptionalField(fields, CUSTOM_LINK_LABEL_FIELD) || '公開連結',
      url: customUrl,
    });
  }

  return links;
}

function formatPullRequestBody({ issue, updateType, profile, historicalHints }) {
  return [
    '## Profile 更新類型',
    '',
    checkbox('新增我的 profile', updateType.includes('新增')),
    checkbox('更新我的 profile', updateType.includes('更新')),
    checkbox('移除我的 profile 內容', false),
    checkbox('其他，需要維護者協助', false),
    '',
    '## 確認事項',
    '',
    checkbox('我確認這是我自願公開的個人資料。', true),
    checkbox('我沒有放入私人 email、電話、地址、證件資料或內部聯絡資訊。', true),
    checkbox('我沒有放入未經本人或他人同意公開的 email 或社群帳號。', true),
    checkbox(PUBLIC_EMAIL_ACKNOWLEDGEMENT, true),
    checkbox(CONTENT_SAFETY_ACKNOWLEDGEMENT, true),
    checkbox('我理解這個 PR 不會自動修改 SITCON Credits 的歷史貢獻紀錄，也不會自動完成身份合併。', true),
    '',
    '## 我以前跳坑過，幫我把紀錄和 profile 建立關聯（選填）',
    '',
    historicalHints || '（未填寫）',
    '',
    '## Issue form',
    '',
    `Closes #${issue.number}`,
    '',
    '這個 PR 是由 SITCON Credits Assistant 依照 profile request issue 建立。自動流程仍會檢查 profile JSON、PR 範圍與 canonical appearances；這不代表身份合併已核准。',
  ].join('\n');
}

function checkRequiredAcknowledgements(fields) {
  const body = fields.get(FORM_LABELS.acknowledgements) ?? '';
  const missing = REQUIRED_ACKNOWLEDGEMENTS.filter((label) => !hasCheckedCheckbox(body, label));
  if (missing.length > 0) {
    throw new Error([
      '請保留並勾選所有公開資料確認事項：',
      ...missing.map((label) => `- ${label}`),
    ].join('\n'));
  }
}

function checkbox(label, checked) {
  return `- [${checked ? 'x' : ' '}] ${label}`;
}

function readRequiredField(fields, label) {
  const value = readOptionalField(fields, label);
  if (!value) {
    throw new Error(`表單缺少必要欄位：${label}`);
  }
  return value;
}

function readOptionalField(fields, label) {
  const value = fields.get(label)?.trim() ?? '';
  if (!value || value === NO_RESPONSE) {
    return '';
  }
  return value;
}

async function runCli(argv = process.argv.slice(2)) {
  const eventPath = getArgValue(argv, '--event');
  const metadataOutputPath = getArgValue(argv, '--metadata-output');
  const profileOutputPath = getArgValue(argv, '--profile-output');
  const prBodyOutputPath = getArgValue(argv, '--pr-body-output');
  const commentOutputPath = getArgValue(argv, '--comment-output');

  if (!eventPath || !metadataOutputPath || !profileOutputPath || !prBodyOutputPath) {
    throw new Error('usage: node scripts/profiles/issue-form-to-profile-pr.mjs --event=<event.json> --metadata-output=<metadata.json> --profile-output=<profile.json> --pr-body-output=<body.md> [--comment-output=<comment.md>]');
  }

  try {
    const event = JSON.parse(await readFile(eventPath, 'utf8'));
    const username = event.issue?.user?.login ?? '';
    const profileExists = GITHUB_USERNAME_PATTERN.test(username)
      ? await fileExists(`profiles/${username}.json`)
      : false;
    const result = buildProfileRequestPullRequest({
      issue: event.issue,
      profileExists,
    });
    await writeFile(metadataOutputPath, `${JSON.stringify({
      username: result.username,
      branchName: result.branchName,
      profilePath: result.profilePath,
      prTitle: result.prTitle,
    }, null, 2)}\n`);
    await writeFile(profileOutputPath, result.profileText);
    await writeFile(prBodyOutputPath, `${result.prBody}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (commentOutputPath) {
      await writeFile(commentOutputPath, formatFailureComment(message));
    }
    throw error;
  }
}

async function fileExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

export function formatFailureComment(message) {
  return [
    PROFILE_REQUEST_COMMENT_MARKER,
    '表單內容目前還不能建立 profile PR，請更新這個 issue 後讓系統重試。',
    '',
    '需要處理的項目：',
    '',
    message,
    '',
  ].join('\n');
}

function getArgValue(argv, name) {
  const prefix = `${name}=`;
  const withEquals = argv.find((arg) => arg.startsWith(prefix));
  if (withEquals) {
    return withEquals.slice(prefix.length);
  }

  const index = argv.indexOf(name);
  if (index !== -1) {
    return argv[index + 1];
  }
  return undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
