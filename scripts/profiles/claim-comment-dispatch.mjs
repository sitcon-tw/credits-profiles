import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const CLAIM_COMMENT_MARKER = '<!-- sitcon-credits-profile-claim-confirmation -->';
export const CLAIM_COMMENT_APPLY_MARKER = '<!-- sitcon-credits-profile-claim-apply -->';
export const CLAIM_COMMENT_METADATA_MARKER = 'sitcon-credits-profile-claim';

export async function main(argv = process.argv.slice(2)) {
  const eventPath = getArgValue(argv, '--event');
  const outputPath = getArgValue(argv, '--output');
  if (!eventPath || !outputPath) {
    throw new Error('usage: node scripts/profiles/claim-comment-dispatch.mjs --event=<event.json> --output=<payload.json>');
  }

  const event = JSON.parse(await readFile(eventPath, 'utf8'));
  const result = buildApplyClaimsDispatch(event);
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(result.dispatch ? 'apply-profile-claims dispatch is ready.' : `Skipping dispatch: ${result.reason}`);
}

export function buildApplyClaimsDispatch(event) {
  if (event?.action !== 'edited') {
    return { dispatch: false, reason: 'not-comment-edited' };
  }
  if (!event?.issue?.pull_request) {
    return { dispatch: false, reason: 'not-pull-request-comment' };
  }

  const body = String(event?.comment?.body ?? '');
  if (!body.includes(CLAIM_COMMENT_MARKER)) {
    return { dispatch: false, reason: 'not-profile-claim-comment' };
  }
  if (!isApplyCheckboxChecked(body)) {
    return { dispatch: false, reason: 'apply-checkbox-not-checked' };
  }

  const metadata = parseClaimMetadata(body);
  if (!metadata) {
    return { dispatch: false, reason: 'missing-claim-metadata' };
  }
  if (metadata.pull_number !== event.issue.number) {
    return { dispatch: false, reason: 'pull-number-mismatch' };
  }
  if (!metadata.head_sha) {
    return { dispatch: false, reason: 'missing-head-sha' };
  }

  return {
    dispatch: true,
    reason: 'ready',
    payload: {
      source_repository: `${event.repository.owner.login}/${event.repository.name}`,
      pull_number: metadata.pull_number,
      head_sha: metadata.head_sha,
      confirmation_comment_id: event.comment.id,
      requested_by: event.sender?.login ?? '',
    },
  };
}

export function isApplyCheckboxChecked(body) {
  return new RegExp(`-\\s*\\[[xX]\\][^\\n]*${escapeRegExp(CLAIM_COMMENT_APPLY_MARKER)}`).test(String(body ?? ''));
}

export function parseClaimMetadata(body) {
  const pattern = new RegExp(`<!--\\s*${CLAIM_COMMENT_METADATA_MARKER}:\\s*([\\s\\S]*?)\\s*-->`);
  const match = String(body ?? '').match(pattern);
  if (!match) {
    return null;
  }
  try {
    const parsed = JSON.parse(match[1]);
    return {
      pull_number: Number(parsed.pull_number),
      head_sha: String(parsed.head_sha ?? ''),
      plan_hash: String(parsed.plan_hash ?? ''),
      username: String(parsed.username ?? ''),
    };
  } catch {
    return null;
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
