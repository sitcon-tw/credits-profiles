import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';

import { validateSiteProfileJsonText } from './validate.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function makeSiteProfilesDir(profile, options = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'sitcon-site-profiles-'));
  const eventDir = path.join(dir, options.eventId ?? 'SITCON-2026');
  await mkdir(eventDir, { recursive: true });
  await writeFile(path.join(dir, 'README.md'), '# Site Profiles\n');
  await writeSiteProfile(eventDir, options.fileName ?? 'speaker-1.json', profile);
  return dir;
}

async function writeSiteProfile(dir, fileName, profile) {
  await writeFile(path.join(dir, fileName), `${JSON.stringify(profile, null, 2)}\n`);
}

async function validateSiteProfiles(dir) {
  return execFileAsync('node', ['scripts/site-profiles/validate.mjs', `--dir=${dir}`], {
    cwd: repoRoot,
  });
}

function validSiteProfile(overrides = {}) {
  return {
    display_name: 'SITCON 講者',
    avatar_url: 'https://example.com/avatar.png',
    ...overrides,
  };
}

test('site profile validation accepts display name and avatar URL', async () => {
  const dir = await makeSiteProfilesDir(validSiteProfile());

  await assert.doesNotReject(validateSiteProfiles(dir));
});

test('site profile validation accepts blank avatar URL', async () => {
  const issues = validateSiteProfileJsonText('speaker-1.json', JSON.stringify(validSiteProfile({
    avatar_url: '',
  })));

  assert.deepEqual(issues, []);
});

test('site profile validation rejects extra fields', () => {
  const issues = validateSiteProfileJsonText('speaker-1.json', JSON.stringify(validSiteProfile({
    bio: 'Should not be stored here.',
  })));

  assert.match(issues.map((issue) => issue.message).join('\n'), /field is not allowed/);
});

test('site profile validation rejects blank display name', () => {
  const issues = validateSiteProfileJsonText('speaker-1.json', JSON.stringify(validSiteProfile({
    display_name: '',
  })));

  assert.match(issues.map((issue) => issue.message).join('\n'), /must not be blank/);
});

test('site profile validation rejects non-HTTPS avatar URL', async () => {
  const dir = await makeSiteProfilesDir(validSiteProfile({
    avatar_url: 'http://example.com/avatar.png',
  }));

  await assert.rejects(validateSiteProfiles(dir));
});

test('site profile validation rejects non-lowercase source person id filenames', async () => {
  const dir = await makeSiteProfilesDir(validSiteProfile(), {
    fileName: 'Speaker_1.json',
  });

  await assert.rejects(validateSiteProfiles(dir));
});
