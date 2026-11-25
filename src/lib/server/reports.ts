/**
 * Report queries shared by routes (page loads and CSV exports).
 */
import { db } from './db.ts';
import { sameVersion } from '#lib/utils/version-parser.ts';
import { buildInstalledMatrix, type InstalledMatrix } from '#lib/utils/installed-matrix.ts';
import { buildVendorBase, type VendorBase } from '#lib/utils/vendor-base.ts';
import { buildEosReport, type EosReport } from '#lib/utils/end-of-support.ts';
import { buildMaintenanceLevels, buildUptake, type MaintenanceLevels } from '#lib/utils/maintenance-level.ts';
import {
	buildCurrency,
	buildVersionSprawl,
	buildWhereUsed,
	type CurrencyReport,
	type KnownVersions,
	type SprawlRow,
	type WhereUsed
} from '#lib/utils/inventory-reports.ts';
import {
	auditRollback,
	buildOpenRollbacks,
	buildQuality,
	mergeRollbackEvents,
	type OpenRollback,
	type QualityReport,
	type RollbackEvent
} from '#lib/utils/rollbacks.ts';
import { lparWhere, softwareWhere, type ReportScope } from './report-scope.ts';
import { buildCompliance } from '#lib/utils/package-compliance.ts';
import { buildRolloutReport, type RolloutGroup } from '#lib/utils/rollout.ts';
import { backfillRollouts } from './rollouts.ts';
import { buildInstalledBase, monthPoints, type BaseItem, type InstalledBase } from '#lib/utils/installed-base.ts';

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

/** Report L1: installed releases with their end-of-support date. */
export async function getEndOfSupport(scope: ReportScope): Promise<EosReport> {
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
				versions: { select: { version: true, vendor_version: true, end_of_support: true } }
			}
		})
	]);
	const installs = await db.lpar_software.findMany({
		where: { lpar_id: { in: lpars.map((l) => l.id) }, software_id: { in: software.map((s) => s.id) } },
		select: { lpar_id: true, software_id: true, current_version: true, current_ptf_level: true }
	});
	return buildEosReport({
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

/** LPARs and software in scope, in the shape the rollback and level reports use. */
async function scopeEntities(scope: ReportScope) {
	const [lpars, software] = await Promise.all([
		db.lpars.findMany({
			where: lparWhere(scope),
			select: { id: true, code: true, name: true, customers: { select: { id: true, code: true, name: true } } }
		}),
		db.software.findMany({
			where: softwareWhere(scope),
			select: { id: true, name: true, vendors: { select: { id: true, code: true, name: true } } }
		})
	]);
	return {
		lpars: lpars.map(({ customers, ...l }) => ({ ...l, customer: customers })),
		software: software.map(({ vendors, ...s }) => ({ ...s, vendor: vendors }))
	};
}

/** Input of L4 and V6: LPARs, software, vendor levels and installs in scope. */
async function loadLevelInput(scope: ReportScope) {
	const { lpars, software } = await scopeEntities(scope);
	const softwareIds = software.map((s) => s.id);
	const vendorIds = [...new Set(software.map((s) => s.vendor.id))];
	const [bundles, installs] = await Promise.all([
		db.vendor_bundles.findMany({
			where: { active: true, vendor_id: { in: vendorIds } },
			select: {
				id: true,
				vendor_id: true,
				code: true,
				release_date: true,
				items: {
					where: { software_id: { in: softwareIds } },
					select: {
						software_id: true,
						software_version: { select: { version: true, vendor_version: true, ptf_level: true } }
					}
				}
			}
		}),
		db.lpar_software.findMany({
			where: { lpar_id: { in: lpars.map((l) => l.id) }, software_id: { in: softwareIds } },
			select: { lpar_id: true, software_id: true, current_version: true, current_ptf_level: true }
		})
	]);
	const vendors = new Map(software.map((s) => [s.vendor.id, s.vendor]));
	return {
		vendors: [...vendors.values()],
		lpars,
		software: software.map((s) => ({ id: s.id, name: s.name, vendor_id: s.vendor.id })),
		bundles: bundles.map((b) => ({
			...b,
			items: b.items.map((i) => ({ software_id: i.software_id, ...i.software_version }))
		})),
		installs: installs.map((i) => ({
			lpar_id: i.lpar_id,
			software_id: i.software_id,
			version: i.current_version,
			ptf_level: i.current_ptf_level
		}))
	};
}

/** Report L4: per LPAR and vendor, the newest vendor level every product reaches. */
export async function getMaintenanceLevels(scope: ReportScope): Promise<MaintenanceLevels> {
	return buildMaintenanceLevels(await loadLevelInput(scope));
}

/** Report V6: per vendor level, how many LPARs reach it. */
export async function getMaintenanceUptake(scope: ReportScope) {
	return buildUptake(await loadLevelInput(scope));
}

/** Known versions (with end of support) of the given software, by software id. */
async function knownVersions(softwareIds: string[]): Promise<KnownVersions> {
	const rows = await db.software_versions.findMany({
		where: { software_id: { in: softwareIds } },
		select: { software_id: true, version: true, vendor_version: true, end_of_support: true }
	});
	const known: KnownVersions = {};
	for (const { software_id, ...v } of rows) (known[software_id] ??= []).push(v);
	return known;
}
const matrixSoftwareIds = (m: InstalledMatrix) => m.vendors.flatMap((v) => v.rows.map((r) => r.software.id));

/** Report R2: every LPAR running the given products (optionally only the given releases). */
export async function getWhereUsed(scope: ReportScope, softwareIds: string[], releases: string[] = []): Promise<WhereUsed> {
	const allowed = scope.softwareIds.length ? softwareIds.filter((id) => scope.softwareIds.includes(id)) : softwareIds;
	if (allowed.length === 0) return { rows: [], lparCount: 0, customerCount: 0, releases: [] };
	const matrix = await getInstalledMatrix({ ...scope, softwareIds: allowed });
	return buildWhereUsed(matrix, await knownVersions(matrixSoftwareIds(matrix)), releases);
}

/** Report R4: distinct releases and PTF levels per installed product. */
export async function getVersionSprawl(scope: ReportScope): Promise<SprawlRow[]> {
	const matrix = await getInstalledMatrix(scope);
	return buildVersionSprawl(matrix, await knownVersions(matrixSoftwareIds(matrix)));
}

/** Report C5: share of installed products current with the package, behind, outside it, out of support. */
export async function getCurrency(scope: ReportScope): Promise<CurrencyReport> {
	const matrix = await getInstalledMatrix(scope);
	return buildCurrency(matrix, await knownVersions(matrixSoftwareIds(matrix)));
}

/** Report V4: rollbacks per product between two dates (audit log, plus install records without one). */
export async function getQuality(scope: ReportScope, from: Date, to: Date): Promise<QualityReport> {
	const { lpars, software } = await scopeEntities(scope);
	const lparIds = lpars.map((l) => l.id);
	const softwareIds = software.map((s) => s.id);
	const [audit, installs] = await Promise.all([
		db.audit_log.findMany({
			where: { action: 'rollback', entity_type: 'lpar_software', entity_id: { in: lparIds }, timestamp: { gte: from, lt: to } },
			select: { entity_id: true, timestamp: true, changes: true }
		}),
		db.lpar_software.findMany({
			where: { lpar_id: { in: lparIds }, software_id: { in: softwareIds }, rolled_back_at: { gte: from, lt: to } },
			select: {
				lpar_id: true,
				software_id: true,
				rolled_back_at: true,
				rollback_reason: true,
				current_version: true,
				current_ptf_level: true,
				previous_version: true,
				previous_ptf_level: true
			}
		})
	]);
	const events = mergeRollbackEvents(
		audit.map(auditRollback).filter((e): e is RollbackEvent => e !== null),
		installs.map((i) => ({
			lpar_id: i.lpar_id,
			software_id: i.software_id,
			at: i.rolled_back_at!,
			// After a rollback, previous = the version rolled back from, current = the one restored
			from_version: i.previous_version,
			from_ptf: i.previous_ptf_level,
			to_version: i.current_version,
			to_ptf: i.current_ptf_level,
			reason: i.rollback_reason
		}))
	);
	return buildQuality({ lpars, software, events });
}

/** Report L5: installs still rolled back (not reapplied by a later deploy). */
export async function getOpenRollbacks(scope: ReportScope): Promise<OpenRollback[]> {
	const { lpars, software } = await scopeEntities(scope);
	const installs = await db.lpar_software.findMany({
		where: {
			rolled_back: true,
			lpar_id: { in: lpars.map((l) => l.id) },
			software_id: { in: software.map((s) => s.id) }
		},
		select: {
			lpar_id: true,
			software_id: true,
			current_version: true,
			current_ptf_level: true,
			previous_version: true,
			previous_ptf_level: true,
			rolled_back_at: true,
			rollback_reason: true
		}
	});
	return buildOpenRollbacks({ lpars, software, installs });
}

/** Report L3: rollout progress per package for the LPARs in scope (optionally some packages). */
export async function getRolloutProgress(scope: ReportScope, packageIds: string[] = []): Promise<RolloutGroup[]> {
	await backfillRollouts();
	const lpars = await db.lpars.findMany({
		where: lparWhere(scope),
		select: { id: true, code: true, name: true, customers: { select: { id: true, code: true, name: true } } }
	});
	const lparIds = lpars.map((l) => l.id);
	const [rollouts, matrix] = await Promise.all([
		db.lpar_package_rollouts.findMany({
			where: { lpar_id: { in: lparIds }, ...(packageIds.length && { package_id: { in: packageIds } }) },
			include: { package: { select: { id: true, code: true, name: true, version: true, release_date: true } } }
		}),
		// Compliance is about every product, whatever the vendor/product filter says
		getInstalledMatrix({ ...scope, vendorIds: [], softwareIds: [] })
	]);
	const compliance = new Map(
		buildCompliance(matrix).rows.map((r) => [r.lpar.id, { packageId: r.lpar.package?.id ?? null, value: r.compliance }])
	);
	const packages = new Map(rollouts.map((r) => [r.package.id, r.package]));
	return buildRolloutReport({
		packages: [...packages.values()],
		lpars: lpars.map(({ customers, ...l }) => ({ ...l, customer: customers })),
		rollouts: rollouts.map(({ package: _p, ...r }) => r),
		compliance
	});
}

/** Report V1: footprint per vendor at the end of each of the last `months` months, from installed packages. */
export async function getInstalledBase(scope: ReportScope, months: number, today = new Date()): Promise<InstalledBase> {
	await backfillRollouts();
	// Deleted LPARs count until they were deleted
	const { active: _active, ...where } = lparWhere(scope);
	const lpars = await db.lpars.findMany({
		where,
		select: { id: true, customer_id: true, active: true, deleted_at: true, updated_at: true }
	});
	const rollouts = await db.lpar_package_rollouts.findMany({
		where: { lpar_id: { in: lpars.map((l) => l.id) }, stage: { in: ['installed', 'superseded'] } },
		select: { lpar_id: true, package_id: true, installed_at: true, superseded_at: true }
	});
	const packageItems = await db.package_items.findMany({
		where: { package_id: { in: [...new Set(rollouts.map((r) => r.package_id))] }, software: softwareWhere(scope) },
		select: {
			package_id: true,
			software_id: true,
			software_version: { select: { version: true } },
			software: { select: { vendors: { select: { id: true, code: true, name: true } } } }
		}
	});
	const items = new Map<string, BaseItem[]>();
	for (const i of packageItems) {
		const list = items.get(i.package_id) ?? [];
		list.push({ softwareId: i.software_id, version: i.software_version.version, vendor: i.software.vendors });
		items.set(i.package_id, list);
	}
	return buildInstalledBase(
		{
			lpars: lpars.map((l) => ({
				id: l.id,
				customerId: l.customer_id,
				deletedAt: l.active ? null : (l.deleted_at ?? l.updated_at)
			})),
			rollouts,
			items
		},
		monthPoints(months, today)
	);
}
