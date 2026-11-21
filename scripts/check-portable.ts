/**
 * Fails if app code uses raw SQL or Postgres-only Prisma options outside
 * src/lib/server/db-dialect.ts, so the app keeps running on every provider.
 *
 *   npx tsx scripts/check-portable.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ALLOWED = new Set(['src/lib/server/db-dialect.ts']);
const RULES: [RegExp, string][] = [
	[/\$(queryRaw|executeRaw)(Unsafe)?\b/, 'raw SQL (use Prisma queries, or add a helper to db-dialect.ts)'],
	[/mode:\s*['"]insensitive['"]/, "mode: 'insensitive' (use textContains() from db-dialect.ts)"],
	[/skipDuplicates/, 'skipDuplicates (not supported on SQLite)']
];

function* walk(dir: string): Generator<string> {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) yield* walk(path);
		else if (/\.(ts|js|svelte)$/.test(name)) yield path;
	}
}

let problems = 0;
for (const file of walk(join(ROOT, 'src'))) {
	const rel = relative(ROOT, file).replaceAll('\\', '/');
	if (ALLOWED.has(rel)) continue;
	readFileSync(file, 'utf8')
		.split('\n')
		.forEach((line, i) => {
			for (const [pattern, message] of RULES) {
				if (pattern.test(line)) {
					console.error(`${rel}:${i + 1}: ${message}`);
					problems++;
				}
			}
		});
}

if (problems > 0) {
	console.error(`\n${problems} non-portable database usage(s) found.`);
	process.exit(1);
}
console.log('OK: no provider-specific database code outside db-dialect.ts');
