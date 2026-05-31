import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_SITE_PROFILES_DIR = 'site-profiles';
const SUPPORT_FILES = new Set(['README.md']);
const ALLOWED_KEYS = new Set(['display_name', 'avatar_url']);
const REQUIRED_KEYS = ['display_name', 'avatar_url'];
const EVENT_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,126}[A-Za-z0-9])?$/;
const SOURCE_PERSON_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

async function main(argv = process.argv.slice(2)) {
  const siteProfilesDir = getArgValue(argv, '--dir') ?? DEFAULT_SITE_PROFILES_DIR;
  const result = await validateSiteProfilesDirectory(siteProfilesDir);

  for (const issue of result.issues) {
    console.error(formatIssue(issue));
  }

  if (result.issues.length > 0) {
    console.error(`Site profile validation failed: ${result.issues.length} errors.`);
    process.exitCode = 1;
    return;
  }

  console.log(`Site profile validation passed: ${result.profileCount} site profile files checked.`);
}

export async function validateSiteProfilesDirectory(siteProfilesDir = DEFAULT_SITE_PROFILES_DIR) {
  const issues = [];
  const entries = await readdir(siteProfilesDir, { withFileTypes: true });
  let profileCount = 0;

  for (const entry of entries) {
    if (SUPPORT_FILES.has(entry.name)) {
      if (!entry.isFile()) {
        addIssue(issues, entry.name, '', 'support entry must be a file');
      }
      continue;
    }

    if (!entry.isDirectory()) {
      addIssue(issues, entry.name, '', 'site profile entries must be event_id directories');
      continue;
    }

    if (!EVENT_ID_PATTERN.test(entry.name)) {
      addIssue(issues, entry.name, 'event_id', 'directory name must be a safe event_id');
      continue;
    }

    profileCount += await validateEventDirectory(issues, siteProfilesDir, entry.name);
  }

  return { issues, profileCount };
}

async function validateEventDirectory(issues, siteProfilesDir, eventId) {
  const eventDir = path.join(siteProfilesDir, eventId);
  const entries = await readdir(eventDir, { withFileTypes: true });
  const sourceIdsByLowercase = new Map();
  let profileCount = 0;

  for (const entry of entries) {
    const relativePath = path.posix.join(eventId, entry.name);

    if (entry.isDirectory()) {
      addIssue(issues, relativePath, '', 'nested directories are not allowed');
      continue;
    }
    if (!entry.isFile()) {
      addIssue(issues, relativePath, '', 'unexpected non-file entry');
      continue;
    }
    if (!entry.name.endsWith('.json')) {
      addIssue(issues, relativePath, '', 'site profile files must be JSON');
      continue;
    }

    const sourcePersonId = path.basename(entry.name, '.json');
    profileCount += 1;

    if (!SOURCE_PERSON_ID_PATTERN.test(sourcePersonId)) {
      addIssue(issues, relativePath, 'filename', 'filename must be a lowercase source person id followed by .json');
    }

    const lowercaseSourceId = sourcePersonId.toLowerCase();
    const existingFile = sourceIdsByLowercase.get(lowercaseSourceId);
    if (existingFile) {
      addIssue(issues, relativePath, 'filename', `duplicates source person id from ${existingFile}`);
    } else {
      sourceIdsByLowercase.set(lowercaseSourceId, relativePath);
    }

    await validateSiteProfileJson(issues, eventDir, entry.name, relativePath);
  }

  return profileCount;
}

async function validateSiteProfileJson(issues, eventDir, fileName, relativePath) {
  let profile;

  try {
    profile = JSON.parse(await readFile(path.join(eventDir, fileName), 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addIssue(issues, relativePath, '', `must contain valid JSON: ${message}`);
    return;
  }

  validateSiteProfileObject(issues, relativePath, profile);
}

export function validateSiteProfileJsonText(fileName, text) {
  const issues = [];
  let profile;

  try {
    profile = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addIssue(issues, fileName, '', `must contain valid JSON: ${message}`);
    return issues;
  }

  validateSiteProfileObject(issues, fileName, profile);
  return issues;
}

export function validateSiteProfileObject(issues, fileName, profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    addIssue(issues, fileName, '', 'site profile must be a JSON object');
    return;
  }

  for (const key of Object.keys(profile)) {
    if (!ALLOWED_KEYS.has(key)) {
      addIssue(issues, fileName, key, 'field is not allowed in site profile files');
    }
  }

  for (const key of REQUIRED_KEYS) {
    if (!Object.hasOwn(profile, key)) {
      addIssue(issues, fileName, key, 'required field is missing');
    }
  }

  validateStringField(issues, fileName, profile, 'display_name', { maxLength: 80, allowEmpty: false });
  validateAvatarUrl(issues, fileName, profile.avatar_url);
}

function validateStringField(issues, fileName, profile, field, options) {
  const value = profile[field];
  if (value === undefined) {
    return;
  }
  if (typeof value !== 'string') {
    addIssue(issues, fileName, field, 'must be a string');
    return;
  }
  if (!options.allowEmpty && value.trim() === '') {
    addIssue(issues, fileName, field, 'must not be blank');
  }
  if (value.length > options.maxLength) {
    addIssue(issues, fileName, field, `must be ${options.maxLength} characters or fewer`);
  }
  if (/[\r\n]/.test(value)) {
    addIssue(issues, fileName, field, 'must not contain line breaks');
  }
}

function validateAvatarUrl(issues, fileName, value) {
  if (value === undefined) {
    return;
  }
  if (typeof value !== 'string') {
    addIssue(issues, fileName, 'avatar_url', 'must be a string');
    return;
  }
  if (value === '') {
    return;
  }
  if (value.length > 2048) {
    addIssue(issues, fileName, 'avatar_url', 'must be 2048 characters or fewer');
  }
  validateUrl(issues, fileName, 'avatar_url', value, { protocols: ['https:'] });
}

function validateUrl(issues, fileName, field, value, options) {
  try {
    const url = new URL(value);
    if (!options.protocols.includes(url.protocol)) {
      addIssue(issues, fileName, field, `must use ${options.protocols.join(' or ')}`);
    }
  } catch {
    addIssue(issues, fileName, field, 'must be a valid URL');
  }
}

function getArgValue(argv, name) {
  const exactIndex = argv.indexOf(name);
  if (exactIndex !== -1) {
    const value = argv[exactIndex + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${name} requires a value.`);
    }
    return value;
  }

  const prefix = `${name}=`;
  const inlineArg = argv.find((arg) => arg.startsWith(prefix));
  if (!inlineArg) {
    return undefined;
  }

  const value = inlineArg.slice(prefix.length);
  if (!value) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function addIssue(issues, fileName, field, message) {
  issues.push({ fileName, field, message });
}

export function formatIssue(issue) {
  const location = issue.field ? `${issue.fileName} ${issue.field}` : issue.fileName;
  return `ERROR ${location}: ${issue.message}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
