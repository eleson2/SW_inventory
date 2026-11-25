/**
 * Inventory reports built on the installed software matrix (R1):
 *   R2 where used, R4 version sprawl, C5 currency score.
 * Pure functions; the queries are in #lib/server/reports.ts.
 */
import { comparePtfLevels, compareVersions } from './version-parser.ts';
import { releaseOf } from './vendor-base.ts';
import { releaseEndOfSupport } from './end-of-support.ts';
import type { InstalledMatrix, MatrixCustomer, MatrixLpar, MatrixSoftware, MatrixStatus } from './installed-matrix.ts';

/** Known versions of a product, to name the release of an install in the inventory's notation */
export type KnownVersions = Record<
	string,
	{ version: string; vendor_version: string | null; end_of_support?: Date | null }[]
>;

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
/** Release first, then PTF level */
const compareLevel = (a: { release: string; ptf: string | null }, b: { release: string; ptf: string | null }) =>
	compareVersions(a.release, b.release) || comparePtfLevels(a.ptf, b.ptf);
const levelText = (release: string, ptf: string | null) => (ptf ? `${release} ${ptf}` : release);

// ---------------------------------------------------------------- R2 where used

export interface WhereUsedRow {
	lpar: MatrixLpar;
	software: MatrixSoftware;
	release: string;
	ptf: string | null;
	installedDate: Date | null;
	/** Compared with the LPAR's package (match/behind/ahead/not_in_package/no_package) */
	status: MatrixStatus;
	rolledBack: boolean;
}

export interface WhereUsed {
	rows: WhereUsedRow[];
	lparCount: number;
	customerCount: number;
	/** Per release, then per PTF level: number of LPARs, newest first */
	releases: { software: MatrixSoftware; release: string; count: number; ptfs: { ptf: string | null; count: number }[] }[];
}

/** Every LPAR running the matrix's products (optionally only the given releases). */
export function buildWhereUsed(matrix: InstalledMatrix, known: KnownVersions, releases: string[] = []): WhereUsed {
	const lparById = new Map(matrix.lpars.map((l) => [l.id, l]));
	const rows: WhereUsedRow[] = [];
	for (const group of matrix.vendors) {
		for (const row of group.rows) {
			for (const [lparId, cell] of Object.entries(row.cells)) {
				if (!cell.installed) continue; // "missing" cells: not running it
				const release = releaseOf(cell.installed, { versions: known[row.software.id] ?? [] });
				if (releases.length && !releases.includes(release)) continue;
				rows.push({
					lpar: lparById.get(lparId)!,
					software: row.software,
					release,
					ptf: cell.installed.ptf_level,
					installedDate: cell.installed.installed_date,
					status: cell.status,
					rolledBack: cell.installed.rolled_back
				});
			}
		}
	}
	rows.sort(
		(a, b) =>
			byText(a.software.name, b.software.name) ||
			compareLevel(b, a) ||
			byText(a.lpar.customer.name, b.lpar.customer.name) ||
			byText(a.lpar.code, b.lpar.code)
	);

	const byRelease = new Map<string, WhereUsed['releases'][number]>();
	for (const r of rows) {
		const key = `${r.software.id}|${r.release}`;
		let entry = byRelease.get(key);
		if (!entry) byRelease.set(key, (entry = { software: r.software, release: r.release, count: 0, ptfs: [] }));
		entry.count++;
		const ptf = entry.ptfs.find((p) => (p.ptf ?? '') === (r.ptf ?? ''));
		if (ptf) ptf.count++;
		else entry.ptfs.push({ ptf: r.ptf, count: 1 });
	}
	for (const e of byRelease.values()) e.ptfs.sort((a, b) => comparePtfLevels(b.ptf, a.ptf));

	return {
		rows,
		lparCount: new Set(rows.map((r) => r.lpar.id)).size,
		customerCount: new Set(rows.map((r) => r.lpar.customer.id)).size,
		releases: [...byRelease.values()]
	};
}

export const WHERE_USED_CSV_COLUMNS = [
	'vendor',
	'product',
	'release',
	'ptf_level',
	'customer',
	'customer_code',
	'lpar',
	'installed_date',
	'package_status',
	'rolled_back'
] as const;

export function whereUsedRecords(report: WhereUsed): Record<(typeof WHERE_USED_CSV_COLUMNS)[number], string>[] {
	return report.rows.map((r) => ({
		vendor: r.software.vendor.name,
		product: r.software.name,
		release: r.release,
		ptf_level: r.ptf ?? '',
		customer: r.lpar.customer.name,
		customer_code: r.lpar.customer.code,
		lpar: r.lpar.code,
		installed_date: r.installedDate ? new Date(r.installedDate).toISOString().slice(0, 10) : '',
		package_status: r.status,
		rolled_back: r.rolledBack ? 'yes' : ''
	}));
}

// ---------------------------------------------------------------- R4 version sprawl

export interface SprawlRow {
	software: MatrixSoftware;
	releases: number;
	/** Distinct release + PTF level combinations, most LPARs first */
	levels: { release: string; ptf: string | null; lpars: number }[];
	lpars: number;
	oldest: string;
	newest: string;
}

/** Distinct releases and release + PTF levels per installed product, most levels first. */
export function buildVersionSprawl(matrix: InstalledMatrix, known: KnownVersions): SprawlRow[] {
	const rows: SprawlRow[] = [];
	for (const group of matrix.vendors) {
		for (const row of group.rows) {
			const levels = new Map<string, { release: string; ptf: string | null; lpars: number }>();
			for (const cell of Object.values(row.cells)) {
				if (!cell.installed) continue;
				const release = releaseOf(cell.installed, { versions: known[row.software.id] ?? [] });
				const ptf = cell.installed.ptf_level?.trim().toUpperCase() || null;
				const key = `${release}|${ptf ?? ''}`;
				const level = levels.get(key);
				if (level) level.lpars++;
				else levels.set(key, { release, ptf, lpars: 1 });
			}
			if (levels.size === 0) continue;
			const list = [...levels.values()];
			const sorted = [...list].sort(compareLevel);
			rows.push({
				software: row.software,
				releases: new Set(list.map((l) => l.release)).size,
				levels: list.sort((a, b) => b.lpars - a.lpars || compareLevel(b, a)),
				lpars: list.reduce((n, l) => n + l.lpars, 0),
				oldest: levelText(sorted[0].release, sorted[0].ptf),
				newest: levelText(sorted.at(-1)!.release, sorted.at(-1)!.ptf)
			});
		}
	}
	return rows.sort(
		(a, b) => b.levels.length - a.levels.length || b.releases - a.releases || byText(a.software.name, b.software.name)
	);
}

export const SPRAWL_CSV_COLUMNS = ['vendor', 'product', 'release', 'ptf_level', 'lpars', 'product_levels', 'product_releases'] as const;

/** One record per product x release + PTF level. */
export function sprawlRecords(rows: SprawlRow[]): Record<(typeof SPRAWL_CSV_COLUMNS)[number], string>[] {
	return rows.flatMap((r) =>
		r.levels.map((l) => ({
			vendor: r.software.vendor.name,
			product: r.software.name,
			release: l.release,
			ptf_level: l.ptf ?? '',
			lpars: String(l.lpars),
			product_levels: String(r.levels.length),
			product_releases: String(r.releases)
		}))
	);
}

// ---------------------------------------------------------------- C5 currency score

/** out_of_support wins over the package comparison */
export type Currency = 'current' | 'behind' | 'outside' | 'out_of_support';
export const CURRENCIES: Currency[] = ['current', 'behind', 'outside', 'out_of_support'];

/**
 * An install's currency: out of support when its release's end of support has passed; otherwise
 * current when it matches (or is ahead of) the LPAR's package, behind when below it, and outside
 * when the product is not in the package or the LPAR has no package.
 */
export function currencyOf(status: MatrixStatus, endOfSupport: Date | null, today: Date): Currency | null {
	if (status === 'missing') return null; // not installed
	if (endOfSupport && endOfSupport < today) return 'out_of_support';
	if (status === 'match' || status === 'ahead') return 'current';
	if (status === 'behind') return 'behind';
	return 'outside';
}

export interface CurrencyCounts {
	counts: Record<Currency, number>;
	installed: number;
	/** current / installed, 0..1; null when nothing is installed */
	score: number | null;
}
export interface CurrencyLpar extends CurrencyCounts {
	lpar: MatrixLpar;
}
export interface CurrencyCustomer extends CurrencyCounts {
	customer: MatrixCustomer;
	lpars: CurrencyLpar[];
}
export interface CurrencyReport {
	customers: CurrencyCustomer[];
	total: CurrencyCounts;
}

function tally(list: Currency[]): CurrencyCounts {
	const counts = Object.fromEntries(CURRENCIES.map((c) => [c, 0])) as Record<Currency, number>;
	for (const c of list) counts[c]++;
	return { counts, installed: list.length, score: list.length ? counts.current / list.length : null };
}

/** Score order: worst first, nothing installed last */
const byScore = (a: CurrencyCounts, b: CurrencyCounts) =>
	(a.score === null ? 1 : 0) - (b.score === null ? 1 : 0) || (a.score ?? 0) - (b.score ?? 0);

export function buildCurrency(matrix: InstalledMatrix, known: KnownVersions, today = new Date()): CurrencyReport {
	const perLpar = new Map<string, Currency[]>(matrix.lpars.map((l) => [l.id, []]));
	for (const group of matrix.vendors) {
		for (const row of group.rows) {
			const versions = known[row.software.id] ?? [];
			for (const [lparId, cell] of Object.entries(row.cells)) {
				const eos = cell.installed
					? releaseEndOfSupport(
							{ versions: versions.map((v) => ({ ...v, end_of_support: v.end_of_support ?? null })) },
							releaseOf(cell.installed, { versions })
						)
					: null;
				const c = currencyOf(cell.status, eos, today);
				if (c) perLpar.get(lparId)?.push(c);
			}
		}
	}
	const customers = new Map<string, { customer: MatrixCustomer; lpars: CurrencyLpar[]; all: Currency[] }>();
	for (const lpar of matrix.lpars) {
		const list = perLpar.get(lpar.id)!;
		let c = customers.get(lpar.customer.id);
		if (!c) customers.set(lpar.customer.id, (c = { customer: lpar.customer, lpars: [], all: [] }));
		c.lpars.push({ lpar, ...tally(list) });
		c.all.push(...list);
	}
	const result = [...customers.values()].map(({ customer, lpars, all }) => ({
		customer,
		lpars: lpars.sort((a, b) => byScore(a, b) || byText(a.lpar.code, b.lpar.code)),
		...tally(all)
	}));
	result.sort((a, b) => byScore(a, b) || byText(a.customer.name, b.customer.name));
	return { customers: result, total: tally([...customers.values()].flatMap((c) => c.all)) };
}

export const CURRENCY_CSV_COLUMNS = [
	'customer',
	'customer_code',
	'lpar',
	'package',
	'installed',
	'current',
	'behind',
	'outside_package',
	'out_of_support',
	'score_pct'
] as const;

/** One record per LPAR. */
export function currencyRecords(report: CurrencyReport): Record<(typeof CURRENCY_CSV_COLUMNS)[number], string>[] {
	return report.customers.flatMap((c) =>
		c.lpars.map((l) => ({
			customer: c.customer.name,
			customer_code: c.customer.code,
			lpar: l.lpar.code,
			package: l.lpar.package ? `${l.lpar.package.code} ${l.lpar.package.version}` : '',
			installed: String(l.installed),
			current: String(l.counts.current),
			behind: String(l.counts.behind),
			outside_package: String(l.counts.outside),
			out_of_support: String(l.counts.out_of_support),
			score_pct: l.score === null ? '' : String(Math.round(l.score * 100))
		}))
	);
}
