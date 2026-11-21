/**
 * Report queries shared by routes (page loads and CSV exports).
 */
import { db } from './db.ts';
import { sameVersion } from '#lib/utils/version-parser.ts';

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
