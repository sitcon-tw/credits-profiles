import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CONTENT_SAFETY_ACKNOWLEDGEMENT,
  PUBLIC_EMAIL_ACKNOWLEDGEMENT,
} from './trusted-pr-check.mjs';
import {
  CUSTOM_LINK_LABEL_FIELD,
  CUSTOM_LINK_URL_FIELD,
  FORM_LABELS,
  HISTORY_LINK_REVIEW_ACKNOWLEDGEMENT,
  ISSUE_FORM_CONTENT_SAFETY_ACKNOWLEDGEMENT,
  VOLUNTARY_PUBLIC_PROFILE_ACKNOWLEDGEMENT,
  buildAvatarUrl,
  collectLinks,
  buildProfileRequestPullRequest,
  formatFailureComment,
  parseIssueFormBody,
} from './issue-form-to-profile-pr.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function formBody(overrides = {}) {
  const values = {
    [FORM_LABELS.displayName]: 'Octocat',
    [FORM_LABELS.bio]: '曾參與 SITCON 相關活動。',
    [FORM_LABELS.avatarUrl]: '',
    [FORM_LABELS.publicEmail]: '',
    GitHub: 'https://github.com/octocat',
    GitLab: '',
    個人網站: '',
    Blog: '',
    LinkedIn: '',
    Facebook: '',
    Instagram: '',
    Threads: '',
    X: '',
    Discord: '',
    Telegram: '',
    Mastodon: '',
    YouTube: '',
    Slides: '',
    [CUSTOM_LINK_LABEL_FIELD]: '個人網站',
    [CUSTOM_LINK_URL_FIELD]: 'https://example.com',
    [FORM_LABELS.historicalHints]: '',
    [FORM_LABELS.acknowledgements]: [
      `- [x] ${VOLUNTARY_PUBLIC_PROFILE_ACKNOWLEDGEMENT}`,
      `- [x] ${PUBLIC_EMAIL_ACKNOWLEDGEMENT}`,
      `- [x] ${ISSUE_FORM_CONTENT_SAFETY_ACKNOWLEDGEMENT}`,
      `- [x] ${HISTORY_LINK_REVIEW_ACKNOWLEDGEMENT}`,
    ].join('\n'),
    ...overrides,
  };

  return Object.entries(values)
    .map(([label, value]) => `### ${label}\n\n${value || '_No response_'}`)
    .join('\n\n');
}

function issue(body = formBody(), login = 'octocat') {
  return {
    number: 123,
    user: { login },
    body,
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('parseIssueFormBody reads GitHub issue form markdown headings', () => {
  const fields = parseIssueFormBody(formBody());

  assert.equal(fields.get(FORM_LABELS.displayName), 'Octocat');
  assert.match(fields.get(FORM_LABELS.bio), /SITCON/);
});

test('issue form labels stay aligned with parser labels', () => {
  const formText = readFileSync(path.join(repoRoot, '.github/ISSUE_TEMPLATE/profile-request.yml'), 'utf8');
  const expectedLabels = [
    FORM_LABELS.displayName,
    FORM_LABELS.bio,
    FORM_LABELS.avatarUrl,
    FORM_LABELS.publicEmail,
    ...[
      'GitHub',
      '個人網站',
      'Blog',
      'Instagram',
      'Telegram',
      'LinkedIn',
      'Facebook',
      'YouTube',
      'Slides',
      'GitLab',
      'Discord',
      'Mastodon',
      'Threads',
      'X',
    ],
    CUSTOM_LINK_LABEL_FIELD,
    CUSTOM_LINK_URL_FIELD,
    FORM_LABELS.historicalHints,
    FORM_LABELS.acknowledgements,
  ];

  for (const label of expectedLabels) {
    assert.match(formText, new RegExp(`label: ${escapeRegExp(label)}(?:\\n|$)`));
  }
});

test('profile issue request workflow only processes meaningful issue events', () => {
  const workflowText = readFileSync(path.join(repoRoot, '.github/workflows/profile-issue-request.yml'), 'utf8');

  assert.match(workflowText, /types:\n\s+- opened\n\s+- edited\n\s+- reopened/u);
  assert.match(workflowText, /concurrency:\n\s+group: profile-issue-request-\$\{\{ github\.event\.issue\.number \}\}\n\s+cancel-in-progress: true/u);
  assert.doesNotMatch(workflowText, /^\s+- labeled$/mu);
  assert.match(workflowText, /contains\(github\.event\.issue\.labels\.\*\.name, 'profile-request'\)/u);
  assert.match(workflowText, /github\.event\.action != 'edited'/u);
  assert.match(workflowText, /contains\(toJSON\(github\.event\.changes\), '"body"'\)/u);
});

test('profile issue request workflow avoids metadata-only duplicate updates', () => {
  const workflowText = readFileSync(path.join(repoRoot, '.github/workflows/profile-issue-request.yml'), 'utf8');

  assert.match(workflowText, /if \(context\.payload\.issue\.title !== title\)/u);
  assert.match(workflowText, /Profile request issue title is already/u);
  assert.match(workflowText, /existingProfileText === profileText/u);
  assert.match(workflowText, /is already up to date on/u);
  assert.match(workflowText, /compareCommitsWithBasehead/u);
  assert.match(workflowText, /comparison\.data\.ahead_by === 0/u);
  assert.match(workflowText, /metadata\.hasSiteClaims/u);
  assert.match(workflowText, /event_type: 'review-profile-claim-issue'/u);
  assert.match(workflowText, /issue_number: context\.issue\.number/u);
  assert.match(workflowText, /dispatched claim-only issue review/u);
  assert.match(workflowText, /no pull request is needed/u);
  assert.match(workflowText, /createOrUpdateFileContents/u);
});

test('buildAvatarUrl defaults to GitHub public avatar', () => {
  const fields = parseIssueFormBody(formBody());

  assert.equal(buildAvatarUrl({ fields, username: 'octocat' }), 'https://github.com/octocat.png?size=512');
});

test('buildAvatarUrl accepts an explicit advanced avatar URL', () => {
  const fields = parseIssueFormBody(formBody({
    [FORM_LABELS.avatarUrl]: 'https://example.com/avatar.png',
  }));

  assert.equal(buildAvatarUrl({ fields, username: 'octocat' }), 'https://example.com/avatar.png');
});

test('collectLinks reads one input per supported platform and keeps custom labels', () => {
  const fields = parseIssueFormBody(formBody());

  assert.deepEqual(collectLinks(fields), [
    {
      type: 'github',
      url: 'https://github.com/octocat',
    },
    {
      type: 'custom',
      url: 'https://example.com',
      label: '個人網站',
    },
  ]);
});

test('collectLinks preserves contributor-friendly platform priority', () => {
  const fields = parseIssueFormBody(formBody({
    GitHub: 'https://github.com/octocat',
    個人網站: 'https://example.com',
    Blog: 'https://blog.example.com',
    Instagram: 'https://www.instagram.com/octocat',
    Telegram: 'https://t.me/octocat',
    LinkedIn: 'https://www.linkedin.com/in/octocat',
    Facebook: 'https://www.facebook.com/octocat',
    YouTube: 'https://www.youtube.com/@octocat',
    Slides: 'https://speakerdeck.com/octocat',
    GitLab: 'https://gitlab.com/octocat',
    Discord: 'https://discord.gg/example',
    Mastodon: 'https://mastodon.social/@octocat',
    Threads: 'https://www.threads.net/@octocat',
    X: 'https://x.com/octocat',
    [CUSTOM_LINK_URL_FIELD]: '',
  }));

  assert.deepEqual(collectLinks(fields).map((link) => link.type), [
    'github',
    'website',
    'blog',
    'instagram',
    'telegram',
    'linkedin',
    'facebook',
    'youtube',
    'slides',
    'gitlab',
    'discord',
    'mastodon',
    'threads',
    'x',
  ]);
});

test('buildProfileRequestPullRequest creates profile JSON and linked PR body', () => {
  const result = buildProfileRequestPullRequest({
    issue: issue(formBody({
      [FORM_LABELS.historicalHints]: 'http://sitcon.org/credits/?claim=1&claims=EVENT-B%2Fsite%3Asource-1',
    })),
  });

  assert.equal(result.username, 'octocat');
  assert.equal(result.branchName, 'profile-request/issue-123-octocat');
  assert.equal(result.profilePath, 'profiles/octocat.json');
  assert.equal(result.prTitle, '新增我的 profile: octocat');
  assert.match(result.profileText, /"display_name": "Octocat"/);
  assert.match(result.profileText, /"avatar_url": "https:\/\/github.com\/octocat.png\?size=512"/);
  assert.match(result.profileText, /"type": "github"/);
  assert.match(result.prBody, /Refs #123/);
  assert.equal(result.hasSiteClaims, true);
  assert.match(result.prBody, /我確認這份 profile 沒有放入會破壞頁面/);
  assert.match(result.prBody, /## 貢獻紀錄標記網址（選填）/);
  assert.match(result.prBody, /http:\/\/sitcon\.org\/credits\/\?claim=1&claims=EVENT-B%2Fsite%3Asource-1/);
});

test('buildProfileRequestPullRequest marks existing profile as update', () => {
  const result = buildProfileRequestPullRequest({
    issue: issue(),
    profileExists: true,
  });

  assert.equal(result.prTitle, '更新我的 profile: octocat');
  assert.match(result.prBody, /- \[x\] 更新我的 profile/);
  assert.match(result.prBody, /- \[ \] 新增我的 profile/);
});

test('buildProfileRequestPullRequest requires display name even if issue body is edited', () => {
  assert.throws(
    () => buildProfileRequestPullRequest({
      issue: issue(formBody({ [FORM_LABELS.displayName]: '' })),
    }),
    /表單缺少必要欄位：公開顯示名稱/,
  );
});

test('buildProfileRequestPullRequest validates generated profile JSON', () => {
  assert.throws(
    () => buildProfileRequestPullRequest({
      issue: issue(formBody({ [FORM_LABELS.avatarUrl]: 'http://example.com/avatar.png' })),
    }),
    /公開頭像圖片 URL：需要使用 `https:\/\/` 開頭/,
  );
});

test('buildProfileRequestPullRequest explains issue form link validation in Traditional Chinese', () => {
  assert.throws(
    () => buildProfileRequestPullRequest({
      issue: issue(formBody({
        GitHub: 'https://github.com/octocat',
        個人網站: 'https://example.com',
        Blog: 'https://blog.example.com',
        Instagram: 'https://www.instagram.com/octocat',
        Telegram: 'https://t.me/octocat',
        LinkedIn: 'https://www.linkedin.com/in/octocat',
        Facebook: 'http://www.facebook.com/octocat',
        YouTube: 'https://www.youtube.com/@octocat',
        Slides: 'https://speakerdeck.com/octocat',
        [CUSTOM_LINK_URL_FIELD]: '',
      })),
    }),
    (error) => {
      assert.match(error.message, /公開連結最多只能填 8 個/);
      assert.match(error.message, /Facebook 欄位的網址：需要使用 `https:\/\/` 開頭/);
      assert.doesNotMatch(error.message, /ERROR/);
      assert.doesNotMatch(error.message, /must contain 8 links or fewer/);
      return true;
    },
  );
});

test('formatFailureComment tells issue authors to edit the issue and retry', () => {
  const comment = formatFailureComment('表單內容還不能建立 profile PR，請修改下列欄位：\n\n- 公開連結最多只能填 8 個。');

  assert.match(comment, /請直接編輯這個 issue/);
  assert.match(comment, /系統會自動重試/);
  assert.match(comment, /公開連結最多只能填 8 個/);
});

test('buildProfileRequestPullRequest rejects edited issue body with missing acknowledgement', () => {
  assert.throws(
    () => buildProfileRequestPullRequest({
      issue: issue(formBody({ [FORM_LABELS.acknowledgements]: `- [x] ${VOLUNTARY_PUBLIC_PROFILE_ACKNOWLEDGEMENT}` })),
    }),
    /請保留並勾選所有公開資料確認事項/,
  );
});
