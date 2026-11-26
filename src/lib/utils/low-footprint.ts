/**
 * V2 low-footprint products: installed products on few LPARs (at most a chosen number) or only
 * on test/dev LPARs, candidates to drop or consolidate; plus active products installed nowhere
 * in scope. Pure functions; query in #lib/server/reports.ts.
 */
import { NON_PROD, NO_ENVIRONMENT, isEnvironment } from './environment.ts';

export const DEFAULT_MAX_LPARS = 2;
export const MAX_LPARS_LIMIT = 99;

/** The "few LPARs" limit from the URL (`?max=`), 1..99, default 2 */
export function readMaxLpars(value: string | null): number {
	const n = Number(value);
	return Number.isInteger(n) && n >= 1 && n <= MAX_LPARS_LIMIT ? n : DEFAULT_MAX_LPARS;
}

export interface FootprintLpar {
	id: string;
	customer_id: string;
	environment: string | null;
}

export interface FootprintSoftware {
	id: string;
	name: string;
	vendor: { id: string; code: string; name: string };
	category: { id: string; name: string } | null;
}

export interface FootprintInstall {
	lpar_id: string;
	software_id: string;
	installed_date: Date | null;
	rolled_back_at: Date | null;
}

export interface FootprintRow {
	software: FootprintSoftware;
	lpars: number;
	customers: number;
	/** LPARs per environment; NO_ENVIRONMENT for LPARs without one */
	environments: Record<string, number>;
	/** Latest install or rollback on any of its LPARs */
	lastChange: Date | null;
	fewLpars: boolean;
	/** Every LPAR running it is TEST or DEV */
	nonProdOnly: boolean;
	/** Also listed in V3 (overlapping products) */
	overlaps: boolean;
}

export interface LowFootprint {
	rows: FootprintRow[];
	/** Active products in scope installed on none of the LPARs in scope */
	notInstalled: { software: FootprintSoftware; packages: number }[];
	/** Installed products in scope, for "N of M" */
	installedProducts: number;
	maxLpars: number;
}

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
const latest = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a > b ? a : b);

export function buildLowFootprint(input: {
	lpars: FootprintLpar[];
	software: FootprintSoftware[];
	installs: FootprintInstall[];
	/** software id -> number of active packages holding it */
	packages: Map<string, number>;
	/** software ids listed in V3 */
	overlapping: Set<string>;
	maxLpars: number;
}): LowFootprint {
	const lparById = new Map(input.lpars.map((l) => [l.id, l]));
	const softwareById = new Map(input.software.map((s) => [s.id, s]));

	const bySoftware = new Map<string, { lpars: Set<string>; lastChange: Date | null }>();
	for (const i of input.installs) {
		if (!lparById.has(i.lpar_id) || !softwareById.has(i.software_id)) continue;
		let entry = bySoftware.get(i.software_id);
		if (!entry) bySoftware.set(i.software_id, (entry = { lpars: new Set(), lastChange: null }));
		entry.lpars.add(i.lpar_id);
		entry.lastChange = latest(entry.lastChange, latest(i.installed_date, i.rolled_back_at));
	}

	const rows: FootprintRow[] = [];
	for (const [softwareId, entry] of bySoftware) {
		const lpars = [...entry.lpars].map((id) => lparById.get(id)!);
		const environments: Record<string, number> = {};
		for (const l of lpars) {
			const key = isEnvironment(l.environment) ? l.environment : NO_ENVIRONMENT;
			environments[key] = (environments[key] ?? 0) + 1;
		}
		const fewLpars = lpars.length <= input.maxLpars;
		const nonProdOnly = lpars.every((l) => (NON_PROD as readonly string[]).includes(l.environment ?? ''));
		if (!fewLpars && !nonProdOnly) continue;
		rows.push({
			software: softwareById.get(softwareId)!,
			lpars: lpars.length,
			customers: new Set(lpars.map((l) => l.customer_id)).size,
			environments,
			lastChange: entry.lastChange,
			fewLpars,
			nonProdOnly,
			overlaps: input.overlapping.has(softwareId)
		});
	}
	rows.sort(
		(a, b) =>
			a.lpars - b.lpars ||
			Number(b.overlaps) - Number(a.overlaps) ||
			byText(a.software.vendor.name, b.software.vendor.name) ||
			byText(a.software.name, b.software.name)
	);

	const notInstalled = input.software
		.filter((s) => !bySoftware.has(s.id))
		.map((software) => ({ software, packages: input.packages.get(software.id) ?? 0 }))
		.sort(
			(a, b) =>
				b.packages - a.packages ||
				byText(a.software.vendor.name, b.software.vendor.name) ||
				byText(a.software.name, b.software.name)
		);

	return { rows, notInstalled, installedProducts: bySoftware.size, maxLpars: input.maxLpars };
}

/** "2 PROD, 1 TEST, 1 not set" */
export function environmentText(environments: Record<string, number>): string {
	const order = ['PROD', 'TEST', 'DEV', 'DR', NO_ENVIRONMENT];
	return order
		.filter((e) => environments[e])
		.map((e) => `${environments[e]} ${e === NO_ENVIRONMENT ? 'not set' : e}`)
		.join(', ');
}

/** Why a row is listed */
export function footprintReasons(r: FootprintRow, maxLpars: number): string[] {
	return [
		...(r.fewLpars ? [r.lpars === 1 ? '1 LPAR' : `${r.lpars} LPARs (≤ ${maxLpars})`] : []),
		...(r.nonProdOnly ? ['Test/dev only'] : []),
		...(r.overlaps ? ['Overlaps (V3)'] : [])
	];
}

export const FOOTPRINT_CSV_COLUMNS = [
	'vendor',
	'product',
	'category',
	'lpars',
	'customers',
	'environments',
	'last_change',
	'reasons',
	'packages'
] as const;

/** CSV: one row per listed product, then the products installed nowhere (0 LPARs) */
export function footprintRecords(report: LowFootprint): Record<(typeof FOOTPRINT_CSV_COLUMNS)[number], string>[] {
	const base = (s: FootprintSoftware) => ({
		vendor: s.vendor.name,
		product: s.name,
		category: s.category?.name ?? 'Unclassified'
	});
	return [
		...report.rows.map((r) => ({
			...base(r.software),
			lpars: String(r.lpars),
			customers: String(r.customers),
			environments: environmentText(r.environments),
			last_change: r.lastChange ? r.lastChange.toISOString().slice(0, 10) : '',
			reasons: footprintReasons(r, report.maxLpars).join('; '),
			packages: ''
		})),
		...report.notInstalled.map((n) => ({
			...base(n.software),
			lpars: '0',
			customers: '0',
			environments: '',
			last_change: '',
			reasons: 'Not installed',
			packages: String(n.packages)
		}))
	];
}
