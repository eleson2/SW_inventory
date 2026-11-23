/**
 * Recreate the e2e database (prisma/e2e.db by default) and load the seed data.
 * Runs before the e2e dev server starts (see playwright.config.ts), so every
 * run starts from the same data and never touches the dev database.
 */
import { execSync } from 'node:child_process';

const env = {
	...process.env,
	DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'file:./e2e.db',
	PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes'
};

execSync('npx tsx scripts/db.ts db push --force-reset --skip-generate', { env, stdio: 'inherit' });
execSync('npx tsx prisma/seed.ts', { env, stdio: 'inherit' });
