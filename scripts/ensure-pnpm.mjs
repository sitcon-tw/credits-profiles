const userAgent = process.env.npm_config_user_agent ?? '';

if (!userAgent.startsWith('pnpm/')) {
  console.error('This repository uses pnpm. Run package scripts with pnpm, not npm, yarn, or bun.');
  process.exit(1);
}
