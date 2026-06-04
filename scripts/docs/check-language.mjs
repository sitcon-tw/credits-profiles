import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SKIPPED_DIRS = new Set(['.git', '.agents', '.codex', 'dist', 'node_modules', 'tmp']);
const BANNED_PATTERNS = [
  {
    pattern: /目前/u,
    reason: 'Docs describe the current repository state by default; omit this unless a dated or revision-specific comparison is required.',
  },
  {
    pattern: /舊版/u,
    reason: 'Prefer a specific revision, date, release, or version number over relative version labels.',
  },
  {
    pattern: /新版/u,
    reason: 'Prefer a specific revision, date, release, or version number over relative version labels.',
  },
  {
    pattern: /最近/u,
    reason: 'Prefer a specific date, run id, revision, or release over relative time wording.',
  },
];

export async function main(argv = process.argv.slice(2)) {
  const rootDir = argv[0] ?? process.cwd();
  const markdownFiles = await collectMarkdownFiles(rootDir);
  const findings = [];

  for (const filePath of markdownFiles) {
    const text = await readFile(filePath, 'utf8');
    const lines = text.split(/\r?\n/u);
    for (const [index, line] of lines.entries()) {
      for (const { pattern, reason } of BANNED_PATTERNS) {
        const match = line.match(pattern);
        if (!match) {
          continue;
        }
        findings.push({
          filePath,
          lineNumber: index + 1,
          term: match[0],
          reason,
        });
      }
    }
  }

  if (findings.length > 0) {
    console.error('Documentation language check failed:');
    for (const finding of findings) {
      console.error(
        `- ${path.relative(rootDir, finding.filePath)}:${finding.lineNumber}: "${finding.term}" - ${finding.reason}`,
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Documentation language check passed for ${markdownFiles.length} Markdown files.`);
}

async function collectMarkdownFiles(rootDir) {
  const files = [];
  await visit(rootDir, files);
  return files.sort((left, right) => left.localeCompare(right));
}

async function visit(dirPath, files) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) {
        await visit(entryPath, files);
      }
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
