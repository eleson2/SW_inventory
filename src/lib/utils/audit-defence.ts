/**
 * X2 vendor audit defence: per vendor and product, every LPAR it is installed on, the release
 * and PTF level, and since when (installed continuously since; on this release since), plus
 * earlier installs that were removed. From the install history, so it works as of a date.
 * Licence entitlements come with D4. Pure functions; query in #lib/server/reports.ts.
 */
import { compareVersions } from './version-parser.ts';
import { pairKey, type HistoryRow } from './install-history.ts';

export interface AuditLpar {
	id: string;
	code: string;
	name: string;
	environment: string | null;
	customer: { id: string; code: string; name: string };
}

export interface AuditSoftware {
	id: string;
	name: string;
	product_code: string | null;
	vendor: { id: string; code: string; name: string };
}

export interface AuditInstall {
	lpar: AuditLpar;
	version: string;
	ptf_level: string | null;
	/** Installed continuously since (the last install after any removal) */
	installedSince: Date;
	/** On the current release since (install, upgrade or downgrade into it) */
	releaseSince: Date;
	lastChange: Date;
	/** The "installed since" date comes from rebuilt history (approximate) */
	rebuilt: boolean;
}

export interface AuditRemoved {
	lpar: AuditLpar;
	/** Last version it had before removal */
	version: string | null;
	ptf_level: string | null;
	from: Date;
	to: Date;
}

export interface AuditProduct {
	software: AuditSoftware;
	installs: AuditInstall[];
	removed: AuditRemoved[];
	lpars: number;
	customers: number;
	releases: string[];
}

export interface AuditDefence {
	vendors: { vendor: AuditSoftware['vendor']; products: AuditProduct[]; lpars: number }[];
	totals: { products: number; installs: number; lpars: number; removed: number; rebuilt: number };
}

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/** Walk one LPAR x product's events (oldest first) up to `at`. */
function walk(events: HistoryRow[]) {
	let current: { version: string; ptf_level: string | null; since: Date; releaseSince: Date; last: Date; rebuilt: boolean } | null = null;
	const removed: { version: string | null; ptf_level: string | null; from: Date; to: Date }[] = [];
	for (const e of events) {
		if (!e.to_version) {
			if (current) removed.push({ version: current.version, ptf_level: current.ptf_level, from: current.since, to: e.occurred_at });
			current = null;
			continue;
		}
		if (!current) {
			current = {
				version: e.to_version,
				ptf_level: e.to_ptf_level || null,
				since: e.occurred_at,
				releaseSince: e.occurred_at,
				last: e.occurred_at,
				rebuilt: e.reconstructed
			};
			continue;
		}
		if (compareVersions(e.to_version, current.version) !== 0) current.releaseSince = e.occurred_at;
		current.version = e.to_version;
		current.ptf_level = e.to_ptf_level || null;
		current.last = e.occurred_at;
	}
	return { current, removed };
}

export function buildAuditDefence(input: {
	lpars: AuditLpar[];
	software: AuditSoftware[];
	/** History events of these LPARs and products up to the report date */
	events: HistoryRow[];
}): AuditDefence {
	const lparById = new Map(input.lpars.map((l) => [l.id, l]));
	const softwareById = new Map(input.software.map((s) => [s.id, s]));
	const pairs = new Map<string, HistoryRow[]>();
	for (const e of [...input.events].sort((a, b) => a.occurred_at.getTime() - b.occurred_at.getTime())) {
		if (!lparById.has(e.lpar_id) || !softwareById.has(e.software_id)) continue;
		const key = pairKey(e.lpar_id, e.software_id);
		pairs.set(key, [...(pairs.get(key) ?? []), e]);
	}

	const products = new Map<string, AuditProduct>();
	for (const events of pairs.values()) {
		const { lpar_id, software_id } = events[0];
		const lpar = lparById.get(lpar_id)!;
		const { current, removed } = walk(events);
		if (!current && removed.length === 0) continue;
		let p = products.get(software_id);
		if (!p) {
			products.set(software_id, (p = { software: softwareById.get(software_id)!, installs: [], removed: [], lpars: 0, customers: 0, releases: [] }));
		}
		if (current) {
			p.installs.push({
				lpar,
				version: current.version,
				ptf_level: current.ptf_level,
				installedSince: current.since,
				releaseSince: current.releaseSince,
				lastChange: current.last,
				rebuilt: current.rebuilt
			});
		}
		p.removed.push(...removed.map((r) => ({ lpar, ...r })));
	}

	const byLpar = (a: { lpar: AuditLpar }, b: { lpar: AuditLpar }) =>
		byText(a.lpar.customer.name, b.lpar.customer.name) || byText(a.lpar.code, b.lpar.code);
	const vendors = new Map<string, AuditDefence['vendors'][number] & { lparIds: Set<string> }>();
	for (const p of products.values()) {
		p.installs.sort(byLpar);
		p.removed.sort((a, b) => b.to.getTime() - a.to.getTime() || byLpar(a, b));
		p.lpars = p.installs.length;
		p.customers = new Set(p.installs.map((i) => i.lpar.customer.id)).size;
		p.releases = [...new Set(p.installs.map((i) => i.version))].sort((a, b) => compareVersions(b, a));
		let v = vendors.get(p.software.vendor.id);
		if (!v) vendors.set(p.software.vendor.id, (v = { vendor: p.software.vendor, products: [], lpars: 0, lparIds: new Set() }));
		v.products.push(p);
		p.installs.forEach((i) => v.lparIds.add(i.lpar.id));
	}

	const list = [...vendors.values()]
		.map(({ lparIds, ...v }) => ({
			...v,
			lpars: lparIds.size,
			products: v.products.sort((a, b) => byText(a.software.name, b.software.name))
		}))
		.sort((a, b) => byText(a.vendor.name, b.vendor.name));
	const all = list.flatMap((v) => v.products);
	return {
		vendors: list,
		totals: {
			products: all.filter((p) => p.installs.length > 0).length,
			installs: all.reduce((n, p) => n + p.installs.length, 0),
			lpars: new Set(all.flatMap((p) => p.installs.map((i) => i.lpar.id))).size,
			removed: all.reduce((n, p) => n + p.removed.length, 0),
			rebuilt: all.reduce((n, p) => n + p.installs.filter((i) => i.rebuilt).length, 0)
		}
	};
}

export const AUDIT_CSV_COLUMNS = [
	'vendor',
	'product',
	'product_code',
	'customer',
	'lpar',
	'environment',
	'status',
	'version',
	'ptf_level',
	'installed_since',
	'release_since',
	'last_change',
	'removed_on',
	'rebuilt'
] as const;

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

/** CSV: one row per install, then one per removed earlier install */
export function auditRecords(report: AuditDefence): Record<(typeof AUDIT_CSV_COLUMNS)[number], string>[] {
	return report.vendors.flatMap((v) =>
		v.products.flatMap((p) => {
			const base = (lpar: AuditLpar) => ({
				vendor: v.vendor.name,
				product: p.software.name,
				product_code: p.software.product_code ?? '',
				customer: lpar.customer.name,
				lpar: lpar.code,
				environment: lpar.environment ?? ''
			});
			return [
				...p.installs.map((i) => ({
					...base(i.lpar),
					status: 'installed',
					version: i.version,
					ptf_level: i.ptf_level ?? '',
					installed_since: day(i.installedSince),
					release_since: day(i.releaseSince),
					last_change: day(i.lastChange),
					removed_on: '',
					rebuilt: i.rebuilt ? 'yes' : ''
				})),
				...p.removed.map((r) => ({
					...base(r.lpar),
					status: 'removed',
					version: r.version ?? '',
					ptf_level: r.ptf_level ?? '',
					installed_since: day(r.from),
					release_since: '',
					last_change: '',
					removed_on: day(r.to),
					rebuilt: ''
				}))
			];
		})
	);
}
