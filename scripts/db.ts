/**
 * Run Prisma CLI commands against the database provider selected by DATABASE_URL.
 *
 *   npx tsx scripts/db.ts generate        # prisma generate
 *   npx tsx scripts/db.ts db push         # prisma db push
 *   npx tsx scripts/db.ts studio          # prisma studio
 *   npx tsx scripts/db.ts schema          # only write the derived schema, print its path
 *
 * prisma/schema.prisma (PostgreSQL) is the single source of truth. For SQLite
 * (DATABASE_URL starting with `file:`) this writes prisma/schema.sqlite.prisma,
 * derived by stripping Postgres native types (@db.*) and replacing the
 * gen_random_uuid() default with Prisma's uuid().
 *
 * SQLite `file:` paths are relative to the schema file, so `file:./dev.db`
 * means prisma/dev.db for both the CLI and the app.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SOURCE_SCHEMA = resolve(ROOT, 'prisma/schema.prisma');
const SQLITE_SCHEMA = resolve(ROOT, 'prisma/schema.sqlite.prisma');

// Load .env without overriding variables already set in the shell
if (!process.env.DATABASE_URL && existsSync(resolve(ROOT, '.env'))) {
	process.loadEnvFile(resolve(ROOT, '.env'));
}

export type DbProvider = 'postgresql' | 'sqlite';

export function providerFromUrl(url: string | undefined): DbProvider {
	return (url ?? '').startsWith('file:') ? 'sqlite' : 'postgresql';
}

/** Derive the SQLite schema from the Postgres schema. */
export function toSqliteSchema(source: string): string {
	const out = source
		.replace(/(datasource\s+db\s*\{[^}]*provider\s*=\s*)"postgresql"/, '$1"sqlite"')
		.replace(/@default\(dbgenerated\("gen_random_uuid\(\)"\)\)/g, '@default(uuid())')
		.replace(/[ \t]*@db\.\w+(\([^)]*\))?/g, '');

	// Fail loudly on anything else Postgres-specific, rather than generating a broken schema
	const leftovers = out.match(/dbgenerated\(|@db\.|"postgresql"/g);
	if (leftovers) {
		throw new Error(`Cannot derive SQLite schema; unhandled Postgres syntax: ${[...new Set(leftovers)].join(', ')}`);
	}
	return (
		'// GENERATED from prisma/schema.prisma by scripts/db.ts. Do not edit; edit schema.prisma instead.\n\n' +
		out
	);
}

/** Write the schema for the active provider and return its path. */
export function schemaPath(provider: DbProvider): string {
	if (provider === 'postgresql') return SOURCE_SCHEMA;
	const derived = toSqliteSchema(readFileSync(SOURCE_SCHEMA, 'utf8'));
	const current = existsSync(SQLITE_SCHEMA) ? readFileSync(SQLITE_SCHEMA, 'utf8') : '';
	if (derived !== current) writeFileSync(SQLITE_SCHEMA, derived);
	return SQLITE_SCHEMA;
}

function main() {
	const args = process.argv.slice(2);
	const provider = providerFromUrl(process.env.DATABASE_URL);
	const schema = schemaPath(provider);

	if (args.length === 0 || args[0] === 'schema') {
		console.log(`${provider}: ${schema}`);
		return;
	}

	console.log(`[db] provider=${provider} schema=${schema.replace(ROOT, '.')}`);
	const result = spawnSync('npx', ['prisma', ...args, '--schema', schema], {
		stdio: 'inherit',
		shell: true,
		cwd: ROOT
	});
	process.exit(result.status ?? 1);
}

if (resolve(process.argv[1] ?? '') === resolve(import.meta.filename)) {
	main();
}
