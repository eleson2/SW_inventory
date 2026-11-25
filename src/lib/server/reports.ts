/**
 * Report queries shared by routes (page loads and CSV exports).
 */
import { db } from './db.ts';
import { sameVersion } from '#lib/utils/version-parser.ts';
import { buildInstalledMatrix, type InstalledMatrix } from '#lib/utils/installed-matrix.ts';
import { buildVendorBase, type VendorBase } from '#lib/utils/vendor-base.ts';
import { lparWhere, softwareWhere, type ReportScope } from './report-scope.ts';

export type SoftwareByCustomerRow = {
	customer_id: string;
	customer_name: string;
	customer_code: string;
	software_id: string;
	software_name: string;
	vendor_name: string;
	vendor_code: string;
	version: string;
	ptf_level: string | null;
	release_date: Date | null;
	lpar_count: number;
	lpar_names: string[];
	lpar_codes: string[];
	latest_install_date: Date | null;
	has_rollbacks: boolean;
};

/**
 * Installed software per customer, grouped by software + installed version.
 * Active customers, LPARs, software and vendors only.
 *
 * Portable implementation: loads the matching installs and groups them in memory,
 * which is fine for thousands of rows. For much larger data, a provider-specific
 * SQL GROUP BY (or the Postgres view in prisma/postgres-extras) can go here.
 */
export async function getSoftwareByCustomer(customerIds: string[]): Promise<SoftwareByCustomerRow[]> {
	const installs = await db.lpar_software.findMany({
		where: {
			lpars: {
				active: true,
				customers: { active: true },
				...(customerIds.length > 0 && { customer_id: { in: customerIds } })
			},
			software: { active: true, vendors: { active: true } }
		},
		select: {
			current_version: true,
			current_ptf_level: true,
			installed_date: true,
			rolled_back: true,
			lpars: {
				select: { id: true, name: true, code: true, customers: { select: { id: true, name: true, code: true } } }
			},
			software: {
				select: {
					id: true,
					name: true,
					vendors: { select: { name: true, code: true } },
					versions: { select: { version: true, ptf_level: true, release_date: true } }
				}
			}
		}
	});

	const groups = new Map<string, SoftwareByCustomerRow & { lparIds: Set<string> }>();
	for (const ls of installs) {
		const { lpars: lpar, software } = ls;
		const key = [lpar.customers.id, software.id, ls.current_version, ls.current_ptf_level ?? ''].join('|');
		let row = groups.get(key);
		if (!row) {
			const installedVersion = { version: ls.current_version, ptf_level: ls.current_ptf_level };
			row = {
				customer_id: lpar.customers.id,
				customer_name: lpar.customers.name,
				customer_code: lpar.customers.code,
				software_id: software.id,
				software_name: software.name,
				vendor_name: software.vendors.name,
				vendor_code: software.vendors.code,
				version: ls.current_version,
				ptf_level: ls.current_ptf_level,
				release_date: software.versions.find((v) => sameVersion(v, installedVersion))?.release_date ?? null,
				lpar_count: 0,
				lpar_names: [],
				lpar_codes: [],
				latest_install_date: null,
				has_rollbacks: false,
				lparIds: new Set()
			};
			groups.set(key, row);
		}
		if (!row.lparIds.has(lpar.id)) {
			row.lparIds.add(lpar.id);
			row.lpar_names.push(lpar.name);
			row.lpar_codes.push(lpar.code);
		}
		if (ls.installed_date && (!row.latest_install_date || ls.installed_date > row.latest_install_date)) {
			row.latest_install_date = ls.installed_date;
		}
		row.has_rollbacks ||= ls.rolled_back;
	}

	const byText = (a: string, b: string) => a.localeCompare(b);
	return [...groups.values()]
		.map(({ lparIds, ...row }) => ({
			...row,
			lpar_count: lparIds.size,
			lpar_names: row.lpar_names.sort(byText),
			lpar_codes: row.lpar_codes.sort(byText)
		}))
		.sort(
			(a, b) =>
				byText(a.customer_name, b.customer_name) ||
				byText(a.software_name, b.software_name) ||
				// release_date DESC, unknown dates first (matches Postgres NULLS FIRST for DESC)
				(b.release_date?.getTime() ?? Infinity) - (a.release_date?.getTime() ?? Infinity) ||
				0
		);
}

/**
 * Report R1: installed software matrix for the LPARs and software in scope,
 * each cell compared with the LPAR's assigned package.
 */
export async function getInstalledMatrix(scope: ReportScope): Promise<InstalledMatrix> {
	const [lpars, software] = await Promise.all([
		db.lpars.findMany({
			where: lparWhere(scope),
			select: {
				id: true,
				code: true,
				name: true,
				customers: { select: { id: true, code: true, name: true } },
				packages: { select: { id: true, code: true, name: true, version: true, active: true } }
			}
		}),
		db.software.findMany({
			where: softwareWhere(scope),
			select: {
				id: true,
				name: true,
				product_code: true,
				vendors: { select: { id: true, code: true, name: true } }
			}
		})
	]);
	const lparIds = lpars.map((l) => l.id);
	const packageIds = [...new Set(lpars.flatMap((l) => (l.packages?.active ? [l.packages.id] : [])))];
	const [installs, packageItems] = await Promise.all([
		db.lpar_software.findMany({
			where: { lpar_id: { in: lparIds } },
			select: {
				lpar_id: true,
				software_id: true,
				current_version: true,
				current_ptf_level: true,
				installed_date: true,
				rolled_back: true,
				rollback_reason: true
			}
		}),
		db.package_items.findMany({
			where: { package_id: { in: packageIds } },
			select: {
				package_id: true,
				software_id: true,
				software_version: { select: { version: true, vendor_version: true, ptf_level: true } }
			}
		})
	]);

	return buildInstalledMatrix({
		lpars: lpars.map((l) => ({
			id: l.id,
			code: l.code,
			name: l.name,
			customer: l.customers,
			package: l.packages?.active
				? { id: l.packages.id, code: l.packages.code, name: l.packages.name, version: l.packages.version }
				: null
		})),
		software: software.map(({ vendors, ...s }) => ({ ...s, vendor: vendors })),
		installs: installs.map((i) => ({
			lpar_id: i.lpar_id,
			software_id: i.software_id,
			version: i.current_version,
			ptf_level: i.current_ptf_level,
			installed_date: i.installed_date,
			rolled_back: i.rolled_back,
			rollback_reason: i.rollback_reason
		})),
		packageItems: packageItems.map((p) => ({
			package_id: p.package_id,
			software_id: p.software_id,
			...p.software_version
		}))
	});
}

/** Report R3: installed base per product and release for the LPARs and software in scope. */
export async function getVendorBase(scope: ReportScope): Promise<VendorBase> {
	const [lpars, software] = await Promise.all([
		db.lpars.findMany({
			where: lparWhere(scope),
			select: { id: true, code: true, customers: { select: { id: true, code: true, name: true } } }
		}),
		db.software.findMany({
			where: softwareWhere(scope),
			select: {
				id: true,
				name: true,
				product_code: true,
				vendors: { select: { id: true, code: true, name: true } },
				current_version: { select: { version: true } },
				versions: { select: { version: true, vendor_version: true } }
			}
		})
	]);
	const installs = await db.lpar_software.findMany({
		where: { lpar_id: { in: lpars.map((l) => l.id) }, software_id: { in: software.map((s) => s.id) } },
		select: { lpar_id: true, software_id: true, current_version: true, current_ptf_level: true }
	});
	return buildVendorBase({
		lpars: lpars.map((l) => ({ id: l.id, code: l.code, customer: l.customers })),
		software: software.map(({ vendors, current_version, ...s }) => ({
			...s,
			vendor: vendors,
			current_version: current_version?.version ?? null
		})),
		installs: installs.map((i) => ({
			lpar_id: i.lpar_id,
			software_id: i.software_id,
			version: i.current_version,
			ptf_level: i.current_ptf_level
		}))
	});
}

export interface StatementChange {
	lpar_id: string;
	software_id: string;
	kind: 'installed' | 'rolled_back';
	date: Date;
	version: string;
	ptf_level: string | null;
	previous_version: string | null;
	previous_ptf_level: string | null;
}

/**
 * Report C1 "Changes since": installs and rollbacks on these LPARs on or after `since`, newest
 * first. Read from lpar_software (the latest change per LPAR and product), so a product
 * changed twice in the period shows its latest change only.
 */
export async function getStatementChanges(lparIds: string[], softwareIds: string[], since: Date): Promise<StatementChange[]> {
	const rows = await db.lpar_software.findMany({
		where: {
			lpar_id: { in: lparIds },
			software_id: { in: softwareIds },
			OR: [{ installed_date: { gte: since } }, { rolled_back_at: { gte: since } }]
		},
		select: {
			lpar_id: true,
			software_id: true,
			current_version: true,
			current_ptf_level: true,
			previous_version: true,
			previous_ptf_level: true,
			installed_date: true,
			rolled_back: true,
			rolled_back_at: true
		}
	});
	return rows
		.map((r): StatementChange => {
			const rolledBack = r.rolled_back && !!r.rolled_back_at && r.rolled_back_at >= since;
			return {
				lpar_id: r.lpar_id,
				software_id: r.software_id,
				kind: rolledBack ? 'rolled_back' : 'installed',
				date: rolledBack ? r.rolled_back_at! : r.installed_date,
				version: r.current_version,
				ptf_level: r.current_ptf_level,
				previous_version: r.previous_version,
				previous_ptf_level: r.previous_ptf_level
			};
		})
		.sort((a, b) => b.date.getTime() - a.date.getTime());
}
