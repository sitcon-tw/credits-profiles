# AGENTS.md

This repository maintains opt-in public profile files for SITCON Credits contributors.

The public reader-facing documentation should be written in Traditional Chinese for Taiwan unless a file explicitly targets another audience. This file is written in English because it is intended for LLM agents and automated maintainers.

## Repository Role

- This repository stores low-risk, opt-in profile data for GitHub usernames.
- The main SITCON Credits repository is https://github.com/sitcon-tw/credits.
- Historical event appearances, event scope, role records, source URLs, and accepted identity links are not maintained here.
- A profile file existing here does not prove that any historical appearance belongs to that GitHub username.

## Data Boundary

Profile files live at `profiles/<github_username>.json`. The filename is the profile link key. Do not add a separate identity identifier, alias list, appearance list, source URL list, or historical contribution list inside profile files.

Allowed profile fields are documented by `profiles/README.md`, `profiles/_template.json`, and `schemas/profile.schema.json`. The current low-risk fields are:

- preferred public display name
- biography
- avatar URL
- public email address
- public links

Do not expand the schema unless the user explicitly asks for a profile policy or schema change.

## Identity Handling

Never merge identities automatically based only on:

- matching or similar display names
- matching or similar nicknames
- romanization similarity
- GitHub/account-name similarity
- profile PR text
- memory from prior tasks
- LLM inference

Contributors may state in a PR which historical appearances they believe are theirs. Treat that as a signal of intent and evidence for maintainer review in the main SITCON Credits data, not as automatic approval to change or accept an identity link.

Maintainer-approved identity links belong in the main SITCON Credits canonical data, not in profile files.

## Privacy and Data Minimization

Profile data is opt-in public data. Do not add, infer, preserve, or publish:

- private email addresses
- email addresses outside the `public_email` field
- phone numbers
- physical addresses
- identity documents
- internal contact information
- non-opt-in social accounts
- unrelated private information
- other people's identity clues

If a person asks to remove profile data, remove or blank only the profile-layer data requested. Do not delete or rewrite historical event records from this repository because this repository does not own those records.

## Tooling

Use pnpm for all package-manager operations and package scripts. Do not use npm, yarn, or bun, and do not create or commit `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock`, `bun.lock`, or `bun.lockb`.

Local validation:

```bash
pnpm profiles:validate
pnpm test
```

These checks validate file format, filename shape, allowed fields, URL rules, public email format, and basic data minimization. They do not approve identity links, historical record corrections, removal requests, or privacy policy changes.

## Automation Status

GitHub Actions CI and a self-service PR ownership guard exist in `.github/workflows/`. The guard checks non-maintainer pull requests for low-risk profile scope: a self-service PR may only change the author's own `profiles/<github_username>.json` file.

Do not describe branch protection, auto-merge, generated profile templates, or cross-repository build integration as active until the corresponding files and repository settings exist.

Passing the self-service guard must not be treated as identity-merge approval. It also does not approve historical record corrections, profile removals, profile renames, privacy policy exceptions, or changes outside the profile file owned by the PR author.

## Agent Operating Rules

- Inspect the current repository state before editing.
- Keep changes small, reviewable, and aligned with the existing documentation.
- Do not invent people, roles, aliases, biographies, avatar URLs, links, source URLs, event names, or profile links.
- Do not turn guesses into data. Mark uncertainty for human review instead.
- Do not add historical appearance records to this repository.
- Do not claim that changes in this repository update the main SITCON Credits canonical data.
- Keep public-facing wording respectful and non-ranking. This project records and thanks contributors; it must not turn contribution history into a leaderboard.
