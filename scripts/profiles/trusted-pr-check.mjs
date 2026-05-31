import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { checkProfilePullRequestScope } from './self-service-guard.mjs';
import {
  formatIssue,
  validateProfileJsonText,
} from './validate.mjs';

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
    throw new Error(`Unknown argument: ${arg}`);
  }

  for (const key of ['eventPath', 'filesPath']) {
    if (!options[key]) {
      throw new Error(`Missing required option: ${key}`);
    }
  }

  return options;
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
