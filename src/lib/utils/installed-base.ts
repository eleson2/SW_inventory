/**
 * Report V1: installed base summary with trend. The footprint per vendor at the end of each
 * month, from the package every LPAR had installed then (lpar_package_rollouts) and that
 * package's items. Changes outside packages (rollbacks, one-off PTFs) are not in the trend.
 */

export interface BaseLpar {
	id: string;
	customerId: string;
	deletedAt: Date | null;
}
export interface BaseRollout {
	lpar_id: string;
	package_id: string;
	installed_at: Date | null;
	superseded_at: Date | null;
}
export interface BaseVendor {
	id: string;
	code: string;
	name: string;
}
export interface BaseItem {
	softwareId: string;
	version: string;
	vendor: BaseVendor;
}
export interface Footprint {
	lpars: number;
	customers: number;
	products: number;
	releases: number;
	installs: number;
}
export interface BasePoint {
	/** End of the month (today for the current month) */
	at: Date;
	total: Footprint;
	byVendor: Record<string, Footprint>;
}
export interface InstalledBase {
	points: BasePoint[];
	/** Vendors with a footprint in any month, most installs now first */
	vendors: BaseVendor[];
}

export const MONTH_CHOICES = [6, 12, 24] as const;
export const COMPARE_CHOICES = [1, 3, 12] as const;

/** End of each of the last `months` months; the last point is `today` */
export function monthPoints(months: number, today: Date): Date[] {
	const points: Date[] = [];
	for (let i = months - 1; i >= 1; i--) {
		points.push(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i + 1, 1) - 1));
	}
	points.push(today);
	return points;
}

/** The package installed on the LPAR at `at` (the latest installed before it, not yet superseded) */
export function packageAt(rollouts: BaseRollout[], at: Date): string | null {
	let best: BaseRollout | null = null;
	for (const r of rollouts) {
		if (!r.installed_at || r.installed_at > at) continue;
		if (r.superseded_at && r.superseded_at <= at) continue;
		if (!best || r.installed_at > best.installed_at!) best = r;
	}
	return best?.package_id ?? null;
}

class Tally {
	lpars = new Set<string>();
	customers = new Set<string>();
	products = new Set<string>();
	releases = new Set<string>();
	installs = 0;
	result(): Footprint {
		const { lpars, customers, products, releases, installs } = this;
		return { lpars: lpars.size, customers: customers.size, products: products.size, releases: releases.size, installs };
	}
}

export function buildInstalledBase(
	input: { lpars: BaseLpar[]; rollouts: BaseRollout[]; items: Map<string, BaseItem[]> },
	points: Date[]
): InstalledBase {
	const byLpar = new Map<string, BaseRollout[]>();
	for (const r of input.rollouts) byLpar.set(r.lpar_id, [...(byLpar.get(r.lpar_id) ?? []), r]);
	const vendors = new Map<string, BaseVendor>();

	const result = points.map((at): BasePoint => {
		const total = new Tally();
		const tallies = new Map<string, Tally>();
		for (const lpar of input.lpars) {
			if (lpar.deletedAt && lpar.deletedAt <= at) continue;
			const pkg = packageAt(byLpar.get(lpar.id) ?? [], at);
			for (const item of (pkg && input.items.get(pkg)) || []) {
				vendors.set(item.vendor.id, item.vendor);
				let t = tallies.get(item.vendor.id);
				if (!t) tallies.set(item.vendor.id, (t = new Tally()));
				for (const tally of [t, total]) {
					tally.lpars.add(lpar.id);
					tally.customers.add(lpar.customerId);
					tally.products.add(item.softwareId);
					tally.releases.add(`${item.softwareId}|${item.version}`);
					tally.installs++;
				}
			}
		}
		return { at, total: total.result(), byVendor: Object.fromEntries([...tallies].map(([id, t]) => [id, t.result()])) };
	});

	const last = result.at(-1);
	const installsNow = (id: string) => last?.byVendor[id]?.installs ?? 0;
	return {
		points: result,
		vendors: [...vendors.values()].sort((a, b) => installsNow(b.id) - installsNow(a.id) || a.name.localeCompare(b.name))
	};
}

export const EMPTY_FOOTPRINT: Footprint = { lpars: 0, customers: 0, products: 0, releases: 0, installs: 0 };

export const BASE_CSV_COLUMNS = ['month', 'vendor', 'vendor_code', 'lpars', 'customers', 'products', 'releases', 'installs'] as const;

/** One record per month x vendor, plus a total ("All vendors") per month */
export function baseRecords(base: InstalledBase): Record<(typeof BASE_CSV_COLUMNS)[number], string>[] {
	return base.points.flatMap((p) => {
		const month = p.at.toISOString().slice(0, 7);
		const row = (vendor: string, code: string, f: Footprint) => ({
			month,
			vendor,
			vendor_code: code,
			lpars: String(f.lpars),
			customers: String(f.customers),
			products: String(f.products),
			releases: String(f.releases),
			installs: String(f.installs)
		});
		return [
			row('All vendors', '', p.total),
			...base.vendors.map((v) => row(v.name, v.code, p.byVendor[v.id] ?? EMPTY_FOOTPRINT))
		];
	});
}
