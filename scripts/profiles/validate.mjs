import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_PROFILES_DIR = 'profiles';
const TEMPLATE_FILE = '_template.json';
const EXAMPLE_FILE = '_example.json';
const SUPPORT_FILES = new Set(['README.md', TEMPLATE_FILE, EXAMPLE_FILE]);
const ALLOWED_KEYS = new Set(['$schema', 'display_name', 'bio', 'avatar_url', 'links']);
const REQUIRED_KEYS = ['display_name', 'bio', 'avatar_url', 'links'];
const GITHUB_USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const STANDARD_LINK_TYPES = new Set([
  'github',
  'gitlab',
  'website',
  'blog',
  'linkedin',
  'facebook',
  'instagram',
  'threads',
  'x',
  'discord',
  'telegram',
  'mastodon',
  'youtube',
  'slides',
]);
const CUSTOM_LINK_TYPE = 'custom';
const ALLOWED_LINK_TYPES = new Set([...STANDARD_LINK_TYPES, CUSTOM_LINK_TYPE]);

const args = process.argv.slice(2);
const profilesDir = getArgValue('--dir') ?? DEFAULT_PROFILES_DIR;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

async function main() {
  const issues = [];
  const entries = await readdir(profilesDir, { withFileTypes: true });
  const entryNames = new Set(entries.map((entry) => entry.name));
  const profileFiles = [];
  const usernamesByLowercase = new Map();

  for (const entry of entries) {
    if (entry.isDirectory()) {
      addIssue(issues, entry.name, '', 'unexpected directory in profiles directory');
      continue;
    }
    if (!entry.isFile()) {
      addIssue(issues, entry.name, '', 'unexpected non-file entry in profiles directory');
      continue;
    }
    if (SUPPORT_FILES.has(entry.name)) {
      continue;
    }
    if (!entry.name.endsWith('.json')) {
      addIssue(issues, entry.name, '', 'unexpected file; profile files must be JSON');
      continue;
    }

    const username = path.basename(entry.name, '.json');
    profileFiles.push(entry.name);

    if (!GITHUB_USERNAME_PATTERN.test(username)) {
      addIssue(issues, entry.name, 'filename', 'filename must be a valid GitHub username followed by .json');
    }

    const lowercaseUsername = username.toLowerCase();
    const existingFile = usernamesByLowercase.get(lowercaseUsername);
    if (existingFile) {
      addIssue(issues, entry.name, 'filename', `duplicates GitHub username from ${existingFile}`);
    } else {
      usernamesByLowercase.set(lowercaseUsername, entry.name);
    }
  }

  await validateProfileJson(issues, TEMPLATE_FILE, { template: true });
  if (entryNames.has(EXAMPLE_FILE)) {
    await validateProfileJson(issues, EXAMPLE_FILE, { template: false });
  }
  for (const fileName of profileFiles.sort()) {
    await validateProfileJson(issues, fileName, { template: false });
  }

  for (const issue of issues) {
    console.error(formatIssue(issue));
  }

  if (issues.length > 0) {
    console.error(`Profile validation failed: ${issues.length} errors.`);
    process.exitCode = 1;
    return;
  }

  console.log(`Profile validation passed: ${profileFiles.length} profile files checked.`);
}

async function validateProfileJson(issues, fileName, options) {
  const filePath = path.join(profilesDir, fileName);
  let profile;

  try {
    profile = JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addIssue(issues, fileName, '', `must contain valid JSON: ${message}`);
    return;
  }

  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    addIssue(issues, fileName, '', 'profile must be a JSON object');
    return;
  }

  for (const key of Object.keys(profile)) {
    if (!ALLOWED_KEYS.has(key)) {
      addIssue(issues, fileName, key, 'field is not allowed in profile files');
    }
  }

  for (const key of REQUIRED_KEYS) {
    if (!Object.hasOwn(profile, key)) {
      addIssue(issues, fileName, key, 'required field is missing');
    }
  }

  validateOptionalSchemaHint(issues, fileName, profile.$schema, options);
  validateStringField(issues, fileName, profile, 'display_name', { maxLength: 80, allowNewline: false });
  validateStringField(issues, fileName, profile, 'bio', { maxLength: 800, allowNewline: true });
  validateAvatarUrl(issues, fileName, profile.avatar_url);
  validateLinks(issues, fileName, profile.links);
}

function validateOptionalSchemaHint(issues, fileName, value, options) {
  if (value === undefined) {
    return;
  }
  if (typeof value !== 'string') {
    addIssue(issues, fileName, '$schema', 'must be a string when present');
    return;
  }
  if (value !== '../schemas/profile.schema.json') {
    const expectation = options.template ? 'template should reference' : 'profile should reference';
    addIssue(issues, fileName, '$schema', `${expectation} ../schemas/profile.schema.json`);
  }
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
  if (value.length > options.maxLength) {
    addIssue(issues, fileName, field, `must be ${options.maxLength} characters or fewer`);
  }
  if (!options.allowNewline && /[\r\n]/.test(value)) {
    addIssue(issues, fileName, field, 'must not contain line breaks');
  }
  if (containsPrivateContact(value)) {
    addIssue(issues, fileName, field, 'must not contain email addresses or phone numbers');
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

function validateLinks(issues, fileName, links) {
  if (links === undefined) {
    return;
  }
  if (!Array.isArray(links)) {
    addIssue(issues, fileName, 'links', 'must be an array');
    return;
  }
  if (links.length > 8) {
    addIssue(issues, fileName, 'links', 'must contain 8 links or fewer');
  }

  links.forEach((link, index) => {
    const baseField = `links[${index}]`;
    if (!link || typeof link !== 'object' || Array.isArray(link)) {
      addIssue(issues, fileName, baseField, 'must be an object');
      return;
    }

    const allowedLinkKeys = new Set(['type', 'label', 'url']);
    for (const key of Object.keys(link)) {
      if (!allowedLinkKeys.has(key)) {
        addIssue(issues, fileName, `${baseField}.${key}`, 'field is not allowed in profile links');
      }
    }

    validateRequiredLinkString(issues, fileName, link, `${baseField}.type`, 'type', {
      maxLength: 40,
      checkPrivateContact: false,
    });
    validateRequiredLinkString(issues, fileName, link, `${baseField}.url`, 'url', {
      maxLength: 2048,
      checkPrivateContact: false,
    });

    if (typeof link.type === 'string' && !ALLOWED_LINK_TYPES.has(link.type)) {
      addIssue(issues, fileName, `${baseField}.type`, `must be one of: ${[...ALLOWED_LINK_TYPES].join(', ')}`);
    }

    if (link.type === CUSTOM_LINK_TYPE) {
      validateRequiredLinkString(issues, fileName, link, `${baseField}.label`, 'label', {
        maxLength: 40,
        checkPrivateContact: true,
      });
    } else if (Object.hasOwn(link, 'label')) {
      addIssue(issues, fileName, `${baseField}.label`, 'must be omitted unless link type is custom');
    }

    if (typeof link.url === 'string' && link.url !== '') {
      validateUrl(issues, fileName, `${baseField}.url`, link.url, { protocols: ['https:'] });
    }
  });
}

function validateRequiredLinkString(issues, fileName, link, fieldPath, key, options) {
  const value = link[key];
  if (typeof value !== 'string') {
    addIssue(issues, fileName, fieldPath, 'must be a string');
    return;
  }
  if (value === '') {
    addIssue(issues, fileName, fieldPath, 'must not be blank');
  }
  if (value.length > options.maxLength) {
    addIssue(issues, fileName, fieldPath, `must be ${options.maxLength} characters or fewer`);
  }
  if (options.checkPrivateContact && containsPrivateContact(value)) {
    addIssue(issues, fileName, fieldPath, 'must not contain email addresses or phone numbers');
  }
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

function containsPrivateContact(value) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value) || /(?:\+?\d[\s-]?){8,}/.test(value);
}

function addIssue(issues, fileName, field, message) {
  issues.push({ fileName, field, message });
}

function formatIssue(issue) {
  const location = issue.field ? `${issue.fileName} ${issue.field}` : issue.fileName;
  return `ERROR ${location}: ${issue.message}`;
}

function getArgValue(name) {
  const prefix = `${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  return value?.slice(prefix.length);
}
