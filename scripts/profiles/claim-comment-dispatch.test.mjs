import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildApplyClaimsDispatch,
  isApplyCheckboxChecked,
  parseClaimMetadata,
} from './claim-comment-dispatch.mjs';

function commentBody({ checked = false, pullNumber = 60, headSha = 'head-sha' } = {}) {
  return [
    '<!-- sitcon-credits-profile-claim-confirmation -->',
    `<!-- sitcon-credits-profile-claim: {"pull_number":${pullNumber},"head_sha":"${headSha}","plan_hash":"hash","username":"octocat"} -->`,
    `${checked ? '- [x]' : '- [ ]'} 我已確認上述 2 筆歷史貢獻連結，請更新 SITCON Credits canonical Google Sheets。 <!-- sitcon-credits-profile-claim-apply -->`,
  ].join('\n');
}

function event(body = commentBody({ checked: true })) {
  return {
    action: 'edited',
    issue: {
      number: 60,
      pull_request: { url: 'https://api.github.com/repos/sitcon-tw/credits-profiles/pulls/60' },
    },
    comment: {
      id: 123,
      body,
    },
    repository: {
      name: 'credits-profiles',
      owner: { login: 'sitcon-tw' },
    },
    sender: { login: 'maintainer' },
  };
}

test('isApplyCheckboxChecked detects checked confirmation item only', () => {
  assert.equal(isApplyCheckboxChecked(commentBody({ checked: false })), false);
  assert.equal(isApplyCheckboxChecked(commentBody({ checked: true })), true);
});

test('parseClaimMetadata reads hidden claim metadata', () => {
  assert.deepEqual(parseClaimMetadata(commentBody({ checked: true })), {
    pull_number: 60,
    head_sha: 'head-sha',
    plan_hash: 'hash',
    username: 'octocat',
  });
});

test('buildApplyClaimsDispatch skips unchecked comments', () => {
  assert.deepEqual(buildApplyClaimsDispatch(event(commentBody({ checked: false }))), {
    dispatch: false,
    reason: 'apply-checkbox-not-checked',
  });
});

test('buildApplyClaimsDispatch creates apply workflow payload', () => {
  assert.deepEqual(buildApplyClaimsDispatch(event()), {
    dispatch: true,
    reason: 'ready',
    payload: {
      source_repository: 'sitcon-tw/credits-profiles',
      pull_number: 60,
      head_sha: 'head-sha',
      confirmation_comment_id: 123,
      requested_by: 'maintainer',
    },
  });
});

test('buildApplyClaimsDispatch rejects mismatched pull numbers', () => {
  assert.deepEqual(buildApplyClaimsDispatch(event(commentBody({ checked: true, pullNumber: 61 }))), {
    dispatch: false,
    reason: 'pull-number-mismatch',
  });
});
