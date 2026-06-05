import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const CLAIM_CHECK_NAME = 'Confirm Credits appearance links';
export const CLAIM_CHECK_ACTION_ID = 'apply-claims';

export async function main(argv = process.argv.slice(2)) {
  const eventPath = getArgValue(argv, '--event');
  const outputPath = getArgValue(argv, '--output');
  if (!eventPath || !outputPath) {
    throw new Error('usage: node scripts/profiles/claim-check-dispatch.mjs --event=<event.json> --output=<payload.json>');
  }

  const event = JSON.parse(await readFile(eventPath, 'utf8'));
  const result = buildApplyClaimsDispatch(event);
  await import('node:fs/promises').then(({ writeFile }) => (
    writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`)
  ));
  console.log(result.dispatch ? 'apply-profile-claims dispatch is ready.' : `Skipping dispatch: ${result.reason}`);
}

export function buildApplyClaimsDispatch(event) {
  const checkRun = event?.check_run;
  const action = event?.requested_action;
  if (event?.action !== 'requested_action') {
    return { dispatch: false, reason: 'not-requested-action' };
  }
  if (checkRun?.name !== CLAIM_CHECK_NAME) {
    return { dispatch: false, reason: 'not-profile-claim-check' };
  }
  if (action?.identifier !== CLAIM_CHECK_ACTION_ID) {
    return { dispatch: false, reason: 'not-apply-claims-action' };
  }

  const pullRequests = checkRun.pull_requests ?? [];
  if (pullRequests.length !== 1) {
    return { dispatch: false, reason: 'expected-one-pull-request' };
  }
  const pull = pullRequests[0];
  const headSha = checkRun.head_sha;
  if (!pull.number || !headSha) {
    return { dispatch: false, reason: 'missing-pull-number-or-head-sha' };
  }

  return {
    dispatch: true,
    reason: 'ready',
    payload: {
      source_repository: 'sitcon-tw/credits-profiles',
      pull_number: pull.number,
      head_sha: headSha,
      check_run_id: checkRun.id,
      requested_by: event.sender?.login ?? '',
    },
  };
}

function getArgValue(argv, name) {
  const index = argv.indexOf(name);
  if (index >= 0) {
    return argv[index + 1];
  }
  const prefix = `${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
