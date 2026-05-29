import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function makeProfilesDir(profile) {
  const dir = await mkdtemp(path.join(tmpdir(), 'sitcon-profiles-'));

  await writeProfile(dir, '_template.json', {
    $schema: '../schemas/profile.schema.json',
    display_name: '',
    bio: '',
    avatar_url: '',
    links: [],
  });
  await writeProfile(dir, '_example.json', {
    $schema: '../schemas/profile.schema.json',
    display_name: 'SITCON 夥伴',
    bio: '曾參與 SITCON 相關活動。',
    avatar_url: 'https://example.com/avatar.png',
    links: [
      {
        type: 'github',
        url: 'https://github.com/octocat',
      },
      {
        type: 'custom',
        label: '個人網站',
        url: 'https://example.com',
      },
    ],
  });
  await writeFile(path.join(dir, 'README.md'), '# Profiles\n');
  await writeProfile(dir, 'octocat.json', profile);

  return dir;
}

async function writeProfile(dir, fileName, profile) {
  await writeFile(path.join(dir, fileName), `${JSON.stringify(profile, null, 2)}\n`);
}

async function validateProfiles(dir) {
  return execFileAsync('node', ['scripts/profiles/validate.mjs', `--dir=${dir}`], {
    cwd: repoRoot,
  });
}

function validProfile(link) {
  return {
    $schema: '../schemas/profile.schema.json',
    display_name: 'Octocat',
    bio: '',
    avatar_url: '',
    links: [link],
  };
}

test('profile validation accepts a standard link type without label', async () => {
  const dir = await makeProfilesDir(validProfile({
    type: 'telegram',
    url: 'https://t.me/octocat',
  }));

  await assert.doesNotReject(validateProfiles(dir));
});

test('profile validation accepts a custom link with label', async () => {
  const dir = await makeProfilesDir(validProfile({
    type: 'custom',
    label: '個人網站',
    url: 'https://example.com',
  }));

  await assert.doesNotReject(validateProfiles(dir));
});

test('profile validation rejects a custom link without label', async () => {
  const dir = await makeProfilesDir(validProfile({
    type: 'custom',
    url: 'https://example.com',
  }));

  await assert.rejects(validateProfiles(dir));
});

test('profile validation rejects a label on a standard link type', async () => {
  const dir = await makeProfilesDir(validProfile({
    type: 'github',
    label: 'GitHub',
    url: 'https://github.com/octocat',
  }));

  await assert.rejects(validateProfiles(dir));
});

test('profile validation rejects unknown link types', async () => {
  const dir = await makeProfilesDir(validProfile({
    type: 'fediverse',
    url: 'https://example.com/@octocat',
  }));

  await assert.rejects(validateProfiles(dir));
});

test('profile validation rejects non-HTTPS link URLs', async () => {
  const dir = await makeProfilesDir(validProfile({
    type: 'website',
    url: 'http://example.com',
  }));

  await assert.rejects(validateProfiles(dir));
});
