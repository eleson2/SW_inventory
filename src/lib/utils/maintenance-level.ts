/**
 * Maintenance level per LPAR (report L4): for each LPAR and vendor, the newest vendor level
 * (RSU, CARS) that every product of that vendor on the LPAR reaches, and how old it is.
 * Pure functions; the query is in #lib/server/reports.ts.
 */
import { compareVersions, equivalentVersion } from './version-parser.ts';
import { compareWithPackage } from './installed-matrix.ts';
import { monthsBetween } from './end-of-support.ts';
import type { BaseCustomer } from './vendor-base.ts';

/** Under this many months: green; up to STALE: amber; older: red */
export const LEVEL_FRESH_MONTHS = 6;
export const LEVEL_STALE_MONTHS = 12;

export type LevelAge = 'fresh' | 'aging' | 'stale' | 'below';

export interface LevelVendor {
	id: string;
	code: string;
	name: string;
}
export interface LevelLpar {
	id: string;
	code: string;
	name: string;
	customer: BaseCustomer;
}
export interface LevelBundle {
	id: string;
	vendor_id: string;
	code: string;
	release_date: Date;
	items: { software_id: string; version: string; vendor_version: string | null; ptf_level: string | null }[];
}
export interface LevelInstall {
	lpar_id: string;
	software_id: string;
	version: string;
	ptf_level: string | null;
}

export interface LevelCell {
	/** Newest level every product reaches; null = below the oldest known level */
	bundle: { id: string; code: string; release_date: Date } | null;
	months: number | null;
	age: LevelAge;
	/** Products holding the LPAR below the vendor's newest level */
	behindLatest: string[];
	products: number;
}

export interface LevelRow {
	lpar: LevelLpar;
	cells: Record<string, LevelCell | undefined>;
}

export interface MaintenanceLevels {
	vendors: (LevelVendor & { latest: { code: string; release_date: Date }; staleLpars: number })[];
	rows: LevelRow[];
}

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

export function levelAge(months: number | null): LevelAge {
	if (months === null) return 'below';
	if (months < LEVEL_FRESH_MONTHS) return 'fresh';
	return months <= LEVEL_STALE_MONTHS ? 'aging' : 'stale';
}

/**
 * Does the install reach the bundle's level of this software? Compared with the bundle's item of
 * the same release; when the bundle lacks that release, with its highest release (a newer release
 * reaches it, an older one does not). Undefined when the bundle has no item for the software.
 */
export function reachesLevel(install: LevelInstall, bundle: LevelBundle): boolean | undefined {
	const items = bundle.items.filter((i) => i.software_id === install.software_id);
	if (items.length === 0) return undefined;
	const same = items.find(
		(i) =>
			equivalentVersion(install.version, i.version) ||
			(!!i.vendor_version && equivalentVersion(install.version, i.vendor_version))
	);
	const item = same ?? [...items].sort((a, b) => compareVersions(b.version, a.version))[0];
	return compareWithPackage(install, item) !== 'behind';
}

export function buildMaintenanceLevels(
	input: {
		vendors: LevelVendor[];
		lpars: LevelLpar[];
		/** software id -> vendor id and name */
		software: { id: string; name: string; vendor_id: string }[];
		bundles: LevelBundle[];
		installs: LevelInstall[];
	},
	today = new Date()
): MaintenanceLevels {
	const softwareById = new Map(input.software.map((s) => [s.id, s]));
	const bundlesByVendor = new Map<string, LevelBundle[]>();
	for (const b of input.bundles) {
		const list = bundlesByVendor.get(b.vendor_id) ?? [];
		list.push(b);
		bundlesByVendor.set(b.vendor_id, list);
	}
	for (const list of bundlesByVendor.values()) list.sort((a, b) => b.release_date.getTime() - a.release_date.getTime());

	const vendors = input.vendors
		.filter((v) => bundlesByVendor.has(v.id))
		.sort((a, b) => byText(a.name, b.name));

	const installsByLpar = new Map<string, LevelInstall[]>();
	for (const i of input.installs) {
		const list = installsByLpar.get(i.lpar_id) ?? [];
		list.push(i);
		installsByLpar.set(i.lpar_id, list);
	}

	const rows: LevelRow[] = [...input.lpars]
		.sort((a, b) => byText(a.customer.name, b.customer.name) || byText(a.code, b.code))
		.map((lpar) => {
			const cells: Record<string, LevelCell | undefined> = {};
			for (const vendor of vendors) {
				const installs = (installsByLpar.get(lpar.id) ?? []).filter(
					(i) => softwareById.get(i.software_id)?.vendor_id === vendor.id
				);
				const bundles = bundlesByVendor.get(vendor.id)!;
				// Only bundles that say something about this LPAR's products
				const relevant = bundles.filter((b) => installs.some((i) => reachesLevel(i, b) !== undefined));
				if (relevant.length === 0) continue;
				const reached = relevant.find((b) => installs.every((i) => reachesLevel(i, b) !== false));
				const months = reached ? Math.max(0, monthsBetween(reached.release_date, today)) : null;
				const latest = relevant[0];
				cells[vendor.id] = {
					bundle: reached ? { id: reached.id, code: reached.code, release_date: reached.release_date } : null,
					months,
					age: levelAge(months),
					behindLatest: installs
						.filter((i) => reachesLevel(i, latest) === false)
						.map((i) => softwareById.get(i.software_id)!.name)
						.sort(byText),
					products: installs.length
				};
			}
			return { lpar, cells };
		});

	return {
		vendors: vendors.map((v) => {
			const latest = bundlesByVendor.get(v.id)![0];
			return {
				...v,
				latest: { code: latest.code, release_date: latest.release_date },
				staleLpars: rows.filter((r) => {
					const age = r.cells[v.id]?.age;
					return age === 'stale' || age === 'below';
				}).length
			};
		}),
		rows
	};
}

export const LEVEL_CSV_COLUMNS = [
	'customer',
	'customer_code',
	'lpar',
	'vendor',
	'level',
	'level_date',
	'months_old',
	'products',
	'behind_latest'
] as const;

/** One record per LPAR x vendor with products of that vendor. */
export function levelRecords(report: MaintenanceLevels): Record<(typeof LEVEL_CSV_COLUMNS)[number], string>[] {
	return report.rows.flatMap((row) =>
		report.vendors.flatMap((v) => {
			const cell = row.cells[v.id];
			if (!cell) return [];
			return [
				{
					customer: row.lpar.customer.name,
					customer_code: row.lpar.customer.code,
					lpar: row.lpar.code,
					vendor: v.name,
					level: cell.bundle?.code ?? 'below oldest known level',
					level_date: cell.bundle?.release_date.toISOString().slice(0, 10) ?? '',
					months_old: cell.months === null ? '' : String(cell.months),
					products: String(cell.products),
					behind_latest: cell.behindLatest.join('; ')
				}
			];
		})
	);
}

// ---------------------------------------------------------------- V6 maintenance uptake

export interface UptakeRow {
	bundle: { id: string; code: string; release_date: Date };
	months: number;
	/** LPARs with products of the vendor in this level */
	lpars: number;
	/** ... of which every product reaches the level */
	reached: number;
	share: number | null;
}

/** Per vendor level (newest first): how many LPARs reach it. Uses the same rule as L4. */
export function buildUptake(
	input: Parameters<typeof buildMaintenanceLevels>[0],
	today = new Date()
): (LevelVendor & { levels: UptakeRow[] })[] {
	const vendorOf = new Map(input.software.map((s) => [s.id, s.vendor_id]));
	const installsByLpar = new Map<string, LevelInstall[]>();
	for (const i of input.installs) {
		const list = installsByLpar.get(i.lpar_id) ?? [];
		list.push(i);
		installsByLpar.set(i.lpar_id, list);
	}
	return input.vendors
		.map((vendor) => {
			const levels = input.bundles
				.filter((b) => b.vendor_id === vendor.id)
				.sort((a, b) => b.release_date.getTime() - a.release_date.getTime())
				.map((bundle) => {
					let lpars = 0;
					let reached = 0;
					for (const lpar of input.lpars) {
						const installs = (installsByLpar.get(lpar.id) ?? []).filter((i) => vendorOf.get(i.software_id) === vendor.id);
						const results = installs.map((i) => reachesLevel(i, bundle)).filter((r) => r !== undefined);
						if (results.length === 0) continue;
						lpars++;
						if (results.every(Boolean)) reached++;
					}
					return {
						bundle: { id: bundle.id, code: bundle.code, release_date: bundle.release_date },
						months: Math.max(0, monthsBetween(bundle.release_date, today)),
						lpars,
						reached,
						share: lpars ? reached / lpars : null
					};
				});
			return { ...vendor, levels };
		})
		.filter((v) => v.levels.length > 0)
		.sort((a, b) => byText(a.name, b.name));
}

export const UPTAKE_CSV_COLUMNS = ['vendor', 'level', 'release_date', 'months_old', 'lpars_reached', 'lpars', 'share_pct'] as const;

export function uptakeRecords(
	vendors: ReturnType<typeof buildUptake>
): Record<(typeof UPTAKE_CSV_COLUMNS)[number], string>[] {
	return vendors.flatMap((v) =>
		v.levels.map((l) => ({
			vendor: v.name,
			level: l.bundle.code,
			release_date: l.bundle.release_date.toISOString().slice(0, 10),
			months_old: String(l.months),
			lpars_reached: String(l.reached),
			lpars: String(l.lpars),
			share_pct: l.share === null ? '' : String(Math.round(l.share * 100))
		}))
	);
}
