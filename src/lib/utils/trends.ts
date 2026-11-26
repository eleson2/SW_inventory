/**
 * X4 trends: installed base, currency (C5 rules) and version sprawl (R4 rules) at each month end,
 * for the total and per vendor or customer. Each point is the installed matrix as of that date
 * (install history replay + the package the LPAR had then). Pure; query in #lib/server/reports.ts.
 */
import { releaseOf } from './vendor-base.ts';
import { releaseEndOfSupport } from './end-of-support.ts';
import { CURRENCIES, currencyOf, type Currency, type KnownVersions } from './inventory-reports.ts';
import type { InstalledMatrix } from './installed-matrix.ts';

export const TREND_GROUPS = ['total', 'vendor', 'customer'] as const;
export type TrendGroupBy = (typeof TREND_GROUPS)[number];

export interface TrendMetrics {
	lpars: number;
	customers: number;
	products: number;
	/** Distinct product x release in use */
	releases: number;
	installs: number;
	currency: Record<Currency, number>;
	/** current / installs, 0..1; null without installs */
	currentShare: number | null;
	/** Products running more than one release */
	multiRelease: number;
	/** Average releases per installed product */
	avgReleases: number | null;
	/** Distinct product x release x PTF level */
	ptfLevels: number;
}

export interface TrendGroup {
	key: string;
	label: string;
	/** One per point, oldest first */
	values: TrendMetrics[];
}

export interface Trends {
	points: { at: Date; rebuilt: boolean }[];
	total: TrendMetrics[];
	vendor: TrendGroup[];
	customer: TrendGroup[];
}

interface Entry {
	lpar: string;
	customer: string;
	product: string;
	release: string;
	ptf: string;
	currency: Currency;
}

export const emptyMetrics = (): TrendMetrics => ({
	lpars: 0,
	customers: 0,
	products: 0,
	releases: 0,
	installs: 0,
	currency: Object.fromEntries(CURRENCIES.map((c) => [c, 0])) as Record<Currency, number>,
	currentShare: null,
	multiRelease: 0,
	avgReleases: null,
	ptfLevels: 0
});

function measure(entries: Entry[]): TrendMetrics {
	const m = emptyMetrics();
	if (entries.length === 0) return m;
	const releasesOf = new Map<string, Set<string>>();
	const levels = new Set<string>();
	for (const e of entries) {
		m.currency[e.currency]++;
		if (!releasesOf.has(e.product)) releasesOf.set(e.product, new Set());
		releasesOf.get(e.product)!.add(e.release);
		levels.add(`${e.product}|${e.release}|${e.ptf}`);
	}
	const perProduct = [...releasesOf.values()].map((s) => s.size);
	m.lpars = new Set(entries.map((e) => e.lpar)).size;
	m.customers = new Set(entries.map((e) => e.customer)).size;
	m.products = releasesOf.size;
	m.releases = perProduct.reduce((a, b) => a + b, 0);
	m.installs = entries.length;
	m.currentShare = m.currency.current / entries.length;
	m.multiRelease = perProduct.filter((n) => n > 1).length;
	m.avgReleases = m.releases / m.products;
	m.ptfLevels = levels.size;
	return m;
}

/** Metrics of one matrix (one point): total, per vendor id, per customer id (with labels). */
export function measurePoint(matrix: InstalledMatrix, known: KnownVersions, at: Date) {
	const lparById = new Map(matrix.lpars.map((l) => [l.id, l]));
	const byVendor = new Map<string, { label: string; entries: Entry[] }>();
	const byCustomer = new Map<string, { label: string; entries: Entry[] }>();
	const all: Entry[] = [];
	for (const group of matrix.vendors) {
		for (const row of group.rows) {
			const versions = known[row.software.id] ?? [];
			const withEos = { versions: versions.map((v) => ({ ...v, end_of_support: v.end_of_support ?? null })) };
			for (const [lparId, cell] of Object.entries(row.cells)) {
				const lpar = lparById.get(lparId);
				if (!cell.installed || !lpar) continue;
				const release = releaseOf(cell.installed, { versions });
				const currency = currencyOf(cell.status, releaseEndOfSupport(withEos, release), at);
				if (!currency) continue;
				const entry: Entry = {
					lpar: lparId,
					customer: lpar.customer.id,
					product: row.software.id,
					release,
					ptf: cell.installed.ptf_level?.trim().toUpperCase() ?? '',
					currency
				};
				all.push(entry);
				const v = byVendor.get(row.software.vendor.id) ?? { label: row.software.vendor.name, entries: [] };
				v.entries.push(entry);
				byVendor.set(row.software.vendor.id, v);
				const c = byCustomer.get(lpar.customer.id) ?? { label: lpar.customer.name, entries: [] };
				c.entries.push(entry);
				byCustomer.set(lpar.customer.id, c);
			}
		}
	}
	const each = (m: Map<string, { label: string; entries: Entry[] }>) =>
		new Map([...m].map(([k, g]) => [k, { label: g.label, metrics: measure(g.entries) }]));
	return { total: measure(all), vendor: each(byVendor), customer: each(byCustomer) };
}

/** Combine per-point measurements into series; groups with installs now first, then by name. */
export function buildTrends(
	measured: { at: Date; point: ReturnType<typeof measurePoint> }[],
	historyStart: Date | null
): Trends {
	const series = (kind: 'vendor' | 'customer'): TrendGroup[] => {
		const labels = new Map<string, string>();
		for (const { point } of measured) for (const [k, g] of point[kind]) labels.set(k, g.label);
		return [...labels]
			.map(([key, label]) => ({
				key,
				label,
				values: measured.map(({ point }) => point[kind].get(key)?.metrics ?? emptyMetrics())
			}))
			.sort(
				(a, b) =>
					b.values.at(-1)!.installs - a.values.at(-1)!.installs ||
					a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
			);
	};
	return {
		points: measured.map(({ at }) => ({ at, rebuilt: !historyStart || at < historyStart })),
		total: measured.map(({ point }) => point.total),
		vendor: series('vendor'),
		customer: series('customer')
	};
}

export const TREND_CSV_COLUMNS = [
	'month_end',
	'group',
	'lpars',
	'customers',
	'products',
	'releases',
	'installs',
	'current',
	'behind',
	'outside_package',
	'out_of_support',
	'current_pct',
	'multi_release_products',
	'avg_releases_per_product',
	'ptf_levels',
	'rebuilt_history'
] as const;

/** CSV: one row per month and group (the total, or each vendor / customer). */
export function trendRecords(report: Trends, groupBy: TrendGroupBy): Record<(typeof TREND_CSV_COLUMNS)[number], string>[] {
	const groups = groupBy === 'total' ? [{ label: 'Total', values: report.total }] : report[groupBy];
	return report.points.flatMap((p, i) =>
		groups.map((g) => {
			const m = g.values[i];
			return {
				month_end: p.at.toISOString().slice(0, 10),
				group: g.label,
				lpars: String(m.lpars),
				customers: String(m.customers),
				products: String(m.products),
				releases: String(m.releases),
				installs: String(m.installs),
				current: String(m.currency.current),
				behind: String(m.currency.behind),
				outside_package: String(m.currency.outside),
				out_of_support: String(m.currency.out_of_support),
				current_pct: m.currentShare === null ? '' : String(Math.round(m.currentShare * 100)),
				multi_release_products: String(m.multiRelease),
				avg_releases_per_product: m.avgReleases === null ? '' : m.avgReleases.toFixed(2),
				ptf_levels: String(m.ptfLevels),
				rebuilt_history: p.rebuilt ? 'yes' : ''
			};
		})
	);
}
