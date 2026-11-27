/**
 * Move data between databases (e.g. PostgreSQL -> SQLite) via provider-neutral JSON.
 *
 *   npm run db:export                       # write every table to backup/<table>.json
 *   npm run db:import                       # load backup/ into an EMPTY database
 *   npm run db:import -- --replace          # delete all existing rows first
 *   npm run db:export -- --dir some/folder  # use another folder (both commands)
 *
 * Both commands use whichever database DATABASE_URL points at, through the
 * currently generated Prisma client, so run `npm run db:generate` after
 * switching DATABASE_URL.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { clearAllData } from '../prisma/lib/clear-data.ts';

const ROOT = resolve(import.meta.dirname, '..');
if (!process.env.DATABASE_URL && existsSync(join(ROOT, '.env'))) {
	process.loadEnvFile(join(ROOT, '.env'));
}

/** Tables in foreign-key order (parents first). */
const TABLES = [
	'users',
	'vendors',
	'customers',
	'software_categories',
	'software',
	'software_versions',
	'vendor_bundles',
	'vendor_bundle_items',
	'packages',
	'package_items',
	'lpars',
	'lpar_software',
	'lpar_sets',
	'lpar_set_members',
	'lpar_package_rollouts',
	'lpar_software_history',
	'audit_log'
] as const;
type Table = (typeof TABLES)[number];

const CHUNK = 500;

const args = process.argv.slice(2);
const command = args[0];
const dirArg = args.indexOf('--dir');
const dir = resolve(ROOT, dirArg >= 0 ? args[dirArg + 1] : 'backup');
const replace = args.includes('--replace');

const db = new PrismaClient();
// Generic access to each model delegate by table name
const model = (table: Table) => (db as unknown as Record<Table, any>)[table];

/** DateTime fields per model, so ISO strings in the JSON can be turned back into Dates. */
const dateFields = new Map(
	Prisma.dmmf.datamodel.models.map((m) => [
		m.name,
		m.fields.filter((f) => f.type === 'DateTime').map((f) => f.name)
	])
);

function reviveDates(table: Table, row: Record<string, unknown>) {
	for (const field of dateFields.get(table) ?? []) {
		if (typeof row[field] === 'string') row[field] = new Date(row[field] as string);
	}
	return row;
}

async function exportAll() {
	mkdirSync(dir, { recursive: true });
	for (const table of TABLES) {
		const rows = await model(table).findMany({ orderBy: table === 'lpar_set_members' ? [{ set_id: 'asc' }, { lpar_id: 'asc' }] : { id: 'asc' } });
		writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows, null, 1));
		console.log(`  ${table.padEnd(18)} ${rows.length} rows`);
	}
	console.log(`Exported to ${dir}`);
}

async function importAll() {
	const data = Object.fromEntries(
		TABLES.map((table) => {
			const file = join(dir, `${table}.json`);
			if (!existsSync(file)) {
				// Backups made before a table existed (e.g. vendor_bundles) simply lack its file
				console.warn(`  ${table.padEnd(18)} no ${table}.json, importing 0 rows`);
				return [table, []];
			}
			const rows = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>[];
			return [table, rows.map((row) => reviveDates(table, row))];
		})
	) as Record<Table, Record<string, unknown>[]>;

	const existing = await Promise.all(TABLES.map((t) => model(t).count()));
	if (existing.some((n) => n > 0)) {
		if (!replace) {
			throw new Error('Target database is not empty. Re-run with --replace to delete all existing rows first.');
		}
		console.log('Deleting existing rows...');
		await clearAllData(db);
	}

	// software.current_version_id points at software_versions, which are inserted
	// after software; insert software without it and set it afterwards.
	const currentVersions = data.software
		.filter((s) => s.current_version_id)
		.map((s) => ({
			id: s.id as string,
			current_version_id: s.current_version_id as string,
			updated_at: s.updated_at as Date // keep the original; @updatedAt would overwrite it
		}));
	data.software = data.software.map((s) => ({ ...s, current_version_id: null }));

	await db.$transaction(
		async (tx) => {
			const txModel = (table: Table) => (tx as unknown as Record<Table, any>)[table];
			for (const table of TABLES) {
				const rows = data[table];
				for (let i = 0; i < rows.length; i += CHUNK) {
					await txModel(table).createMany({ data: rows.slice(i, i + CHUNK) });
				}
				console.log(`  ${table.padEnd(18)} ${rows.length} rows`);
				if (table === 'software_versions') {
					for (const { id, ...data } of currentVersions) {
						await tx.software.update({ where: { id }, data });
					}
				}
			}
		},
		{ maxWait: 30_000, timeout: 10 * 60_000 }
	);
	console.log(`Imported from ${dir}`);
}

try {
	if (command === 'export') await exportAll();
	else if (command === 'import') await importAll();
	else {
		console.error('Usage: tsx scripts/db-transfer.ts export|import [--dir <folder>] [--replace]');
		process.exitCode = 1;
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
} finally {
	await db.$disconnect();
}
