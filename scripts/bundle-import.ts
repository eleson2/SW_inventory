/**
 * Import vendor bundle CSVs (from `npm run bundles:fetch`) straight into the database,
 * with the same code as the /import page, and print a compact report with checks.
 *
 *   npm run bundles:import -- bundles/RSU2601.csv [more.csv ...] --check   # dry run (SQLite: on a copy)
 *   npm run bundles:import -- bundles/RSU2601.csv [more.csv ...]           # import
 *   npm run bundles:import -- --codes BROADCOM                             # software + product codes
 *   npm run bundles:import -- --set-code BROADCOM "CA 7" AL2121            # set a product code
 *
 * Output is meant to be read as is: lines starting with "!" need a decision.
 * Exit code: 0 ok, 1 errors, 2 usage.
 */
import { copyFileSync, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import XLSX from 'xlsx';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const usage = () => {
	console.error(
		'Usage: npm run bundles:import -- <file.csv>... [--check] [--list]\n' +
			'       npm run bundles:import -- --codes <VENDOR_CODE>\n' +
			'       npm run bundles:import -- --set-code <VENDOR_CODE> "<software name>" <PRODUCT_CODE>'
	);
	process.exit(2);
};

const STOP = new Set(['ibm', 'ca', 'broadcom', 'for', 'the', 'z', 'os', 'zos', 'and', 'of', 'server', 'manager', 'system', 'operating']);
const tokens = (name: string) =>
	new Set(
		name
			.toLowerCase()
			.split(/[^a-z0-9]+/)
			.filter((t) => t && !STOP.has(t))
	);
/** Names that may be the same product: a shared word, or one name containing the other. */
function similar(a: string, b: string): boolean {
	const na = a.toLowerCase().replace(/[^a-z0-9]/g, '');
	const nb = b.toLowerCase().replace(/[^a-z0-9]/g, '');
	if (na.includes(nb) || nb.includes(na)) return true;
	const tb = tokens(b);
	return [...tokens(a)].some((t) => tb.has(t));
}

const notation = (v: string) => (/^V\d+R\d+(M\d+)?$/i.test(v) ? 'VRM' : /^\d+(\.\d+)+$/.test(v) ? 'dotted' : 'other');

/** SQLite: point DATABASE_URL at a temporary copy, so --check never touches the real data. */
function useDatabaseCopy(): string {
	const url = process.env.DATABASE_URL ?? readEnvUrl();
	if (!url?.startsWith('file:')) {
		console.error('--check works on SQLite only (copies the database file). On PostgreSQL, import into a test database.');
		process.exit(2);
	}
	const [path, query] = url.slice(5).split('?');
	const source = isAbsolute(path) ? path : resolve('prisma', path);
	if (!existsSync(source)) {
		console.error(`Database file not found: ${source}`);
		process.exit(2);
	}
	const copy = join(mkdtempSync(join(tmpdir(), 'bundle-check-')), 'check.db');
	copyFileSync(source, copy);
	process.env.DATABASE_URL = `file:${copy.replace(/\\/g, '/')}${query ? `?${query}` : ''}`;
	return copy;
}

function readEnvUrl(): string | undefined {
	if (!existsSync('.env')) return undefined;
	const line = readFileSync('.env', 'utf8')
		.split(/\r?\n/)
		.find((l) => /^\s*DATABASE_URL\s*=/.test(l));
	return line?.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
}

async function main() {
	if (args.length === 0 || flag('--help')) usage();
	const check = flag('--check');
	if (check) useDatabaseCopy();

	// Loaded after DATABASE_URL is final
	const { db } = await import('../src/lib/server/db.ts');
	const { importBundleRows, parseBundleRows } = await import('../src/lib/server/bundles.ts');

	try {
		if (flag('--codes')) {
			const vendorCode = args[args.indexOf('--codes') + 1]?.toUpperCase() ?? usage();
			const software = await db.software.findMany({
				where: { vendors: { code: vendorCode }, active: true },
				select: { name: true, product_code: true },
				orderBy: { name: 'asc' }
			});
			if (software.length === 0) console.log(`No active software for vendor ${vendorCode}.`);
			for (const s of software) console.log(`${(s.product_code ?? '-').padEnd(10)} ${s.name}`);
			return 0;
		}

		if (flag('--set-code')) {
			const i = args.indexOf('--set-code');
			const [vendorCode, name, code] = args.slice(i + 1, i + 4);
			if (!vendorCode || !name || !code) usage();
			const matches = await db.software.findMany({
				where: { vendors: { code: vendorCode.toUpperCase() }, name },
				select: { id: true }
			});
			if (matches.length !== 1) {
				console.error(`! ${matches.length} software named "${name}" for ${vendorCode}; use the exact name from --codes.`);
				return 1;
			}
			const taken = await db.software.findFirst({
				where: { vendors: { code: vendorCode.toUpperCase() }, product_code: code.toUpperCase(), NOT: { id: matches[0].id } },
				select: { name: true }
			});
			if (taken) {
				console.error(`! ${code.toUpperCase()} is already the code of "${taken.name}".`);
				return 1;
			}
			await db.software.update({ where: { id: matches[0].id }, data: { product_code: code.toUpperCase() } });
			console.log(`${name}: product code ${code.toUpperCase()}`);
			return 0;
		}

		const files = args.filter((a) => !a.startsWith('--'));
		if (files.length === 0) usage();
		const rows = files.flatMap((file) => {
			const workbook = XLSX.read(readFileSync(file), { type: 'buffer', raw: true });
			const data = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
			return parseBundleRows(data);
		});
		// Oldest level first: carry-forward uses the previous level of the same vendor/type
		rows.sort((a, b) => a.release_date.localeCompare(b.release_date) || a.bundle_code.localeCompare(b.bundle_code));

		const started = new Date(Date.now() - 1000);
		const before = new Set((await db.software.findMany({ select: { id: true } })).map((s) => s.id));
		const result = await importBundleRows(rows);

		console.log(`${check ? 'CHECK (dry run on a copy, nothing saved)' : 'IMPORTED'}: ${result.message}`);
		for (const e of result.errors) console.log(`! error: ${e}`);
		for (const s of result.skippedProducts) console.log(`  skipped: ${s}`);

		const codes = [...new Set(rows.map((r) => `${r.vendor_code.toUpperCase()}|${r.bundle_code.toUpperCase()}`))];
		for (const key of codes) {
			const [vendorCode, bundleCode] = key.split('|');
			const bundle = await db.vendor_bundles.findFirst({
				where: { code: bundleCode, vendors: { code: vendorCode } },
				include: {
					items: {
						include: {
							software: { select: { id: true, name: true, product_code: true } },
							software_version: { select: { version: true, vendor_version: true, ptf_level: true, created_at: true } }
						}
					}
				}
			});
			if (!bundle) continue;
			const products = new Set(bundle.items.map((i) => i.software_id));
			const carried = bundle.items.filter((i) => i.notes?.startsWith('Unchanged since')).length;
			console.log(`\n${bundleCode} (${vendorCode}, ${bundle.release_date.toISOString().slice(0, 10)}): ${bundle.items.length} items, ${products.size} products, ${carried} carried forward`);

			const vendorSoftware = await db.software.findMany({
				where: { vendor_id: bundle.vendor_id, active: true },
				select: { id: true, name: true, product_code: true, versions: { select: { version: true } } }
			});

			// New products: possibly an existing product under another name / without a code
			for (const s of vendorSoftware.filter((v) => !before.has(v.id))) {
				const look = vendorSoftware.filter((o) => before.has(o.id) && similar(o.name, s.name));
				const hint = look.length
					? ` - similar existing: ${look.map((o) => `"${o.name}" [${o.product_code ?? 'no code'}]`).join(', ')}`
					: '';
				console.log(`${look.length ? '!' : ' '} new product: ${s.name} [${s.product_code ?? 'no code'}]${hint}`);
			}

			// New versions, per product; flag a notation that differs from the product's usual one
			const created = bundle.items.filter((i) => i.software_version.created_at >= started);
			const byProduct = new Map<string, string[]>();
			for (const i of created) byProduct.set(i.software.name, [...(byProduct.get(i.software.name) ?? []), i.software_version.version]);
			if (byProduct.size > 0) {
				console.log(`  new versions: ${[...byProduct].map(([n, v]) => `${n} ${v.length}`).join(', ')}`);
			}
			for (const i of created) {
				const others = vendorSoftware.find((s) => s.id === i.software_id)?.versions.map((v) => v.version) ?? [];
				const styles = others.map(notation);
				const usual = ['VRM', 'dotted', 'other'].sort((a, b) => styles.filter((s) => s === b).length - styles.filter((s) => s === a).length)[0];
				const mine = notation(i.software_version.version);
				if (others.length > 2 && mine !== usual && styles.filter((s) => s === usual).length * 2 > styles.length) {
					console.log(`! notation: ${i.software.name} ${i.software_version.version} [vendor ${i.software_version.vendor_version ?? '-'}] while most versions are ${usual}`);
				}
			}

			// A later level of the same type was imported before this one: its carry-forward missed this level
			const later = await db.vendor_bundles.findMany({
				where: { vendor_id: bundle.vendor_id, bundle_type: bundle.bundle_type, release_date: { gt: bundle.release_date } },
				select: { code: true }
			});
			if (later.length > 0) {
				console.log(`! later level(s) already imported: ${later.map((b) => b.code).join(', ')}; re-import their CSVs so carry-forward includes ${bundleCode}`);
			}

			const noCode = vendorSoftware.filter((s) => !s.product_code);
			if (noCode.length > 0) {
				console.log(`  software without product code (${noCode.length}): ${noCode.slice(0, 10).map((s) => s.name).join(', ')}${noCode.length > 10 ? ', ...' : ''}`);
			}

			if (flag('--list')) {
				for (const i of [...bundle.items].sort((a, b) => a.software.name.localeCompare(b.software.name))) {
					const v = i.software_version;
					const vendor = v.vendor_version && v.vendor_version !== v.version ? ` [${v.vendor_version}]` : '';
					console.log(`    ${i.software.name}: ${v.version}${vendor} ${v.ptf_level ?? ''}${i.notes?.startsWith('Unchanged') ? ' (carried)' : ''}`);
				}
			}
		}
		return result.errors.length > 0 ? 1 : 0;
	} finally {
		await db.$disconnect();
	}
}

main().then(
	(code) => process.exit(code),
	(error) => {
		console.error(`! ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}
);
