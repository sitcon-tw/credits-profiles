import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildApplyClaimsDispatch } from './claim-check-dispatch.mjs';

function event(overrides = {}) {
  return {
    action: 'requested_action',
    requested_action: { identifier: 'apply-claims' },
    sender: { login: 'maintainer' },
    check_run: {
      id: 123,
      name: 'Confirm Credits appearance links',
      head_sha: 'abc123',
      pull_requests: [{ number: 58 }],
    },
    ...overrides,
  };
}

test('buildApplyClaimsDispatch creates credits repository dispatch payload', () => {
  assert.deepEqual(buildApplyClaimsDispatch(event()), {
    dispatch: true,
    reason: 'ready',
    payload: {
      source_repository: 'sitcon-tw/credits-profiles',
      pull_number: 58,
      head_sha: 'abc123',
      check_run_id: 123,
      requested_by: 'maintainer',
    },
  });
});

test('buildApplyClaimsDispatch ignores unrelated check runs', () => {
  assert.deepEqual(buildApplyClaimsDispatch(event({
    check_run: {
      name: 'Other check',
      head_sha: 'abc123',
      pull_requests: [{ number: 58 }],
    },
  })), {
    dispatch: false,
    reason: 'not-profile-claim-check',
  });
});

test('buildApplyClaimsDispatch requires one pull request', () => {
  assert.deepEqual(buildApplyClaimsDispatch(event({
    check_run: {
      name: 'Confirm Credits appearance links',
      head_sha: 'abc123',
      pull_requests: [],
    },
  })), {
    dispatch: false,
    reason: 'expected-one-pull-request',
  });
});
