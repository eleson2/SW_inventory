/**
 * Installed software matrix (report R1): products x LPARs, each cell compared with the
 * LPAR's assigned package. Pure functions; the database query is in #lib/server/reports.ts.
 */
import { comparePtfLevels, compareVersions, equivalentVersion } from './version-parser.ts';

export type MatrixStatus =
	| 'match' // installed = package
	| 'behind' // installed lower than package
	| 'ahead' // installed higher than package
	| 'not_in_package' // installed, LPAR has a package without this product
	| 'missing' // in the LPAR's package, not installed
	| 'no_package'; // installed, LPAR has no package (nothing to compare with)

export interface MatrixCustomer {
	id: string;
	code: string;
	name: string;
}

export interface MatrixPackage {
	id: string;
	code: string;
	name: string;
	version: string;
}

export interface MatrixLpar {
	id: string;
	code: string;
	name: string;
	customer: MatrixCustomer;
	package: MatrixPackage | null;
}

export interface MatrixSoftware {
	id: string;
	name: string;
	product_code: string | null;
	vendor: { id: string; code: string; name: string };
}

export interface MatrixInstall {
	lpar_id: string;
	software_id: string;
	version: string;
	ptf_level: string | null;
	installed_date: Date | null;
	rolled_back: boolean;
	rollback_reason: string | null;
}

export interface MatrixPackageItem {
	package_id: string;
	software_id: string;
	version: string;
	vendor_version: string | null;
	ptf_level: string | null;
}

export interface MatrixCell {
	status: MatrixStatus;
	installed: MatrixInstall | null;
	expected: MatrixPackageItem | null;
}

export interface MatrixRow {
	software: MatrixSoftware;
	/** By LPAR id; absent = neither installed nor in the LPAR's package */
	cells: Record<string, MatrixCell>;
	/** Some cell is not a plain match (no_package cells are neutral) */
	differs: boolean;
}

export interface InstalledMatrix {
	lpars: MatrixLpar[];
	vendors: { vendor: MatrixSoftware['vendor']; rows: MatrixRow[] }[];
}

/** Compare an installed version/PTF with the package's. */
export function compareWithPackage(
	installed: { version: string; ptf_level: string | null },
	expected: { version: string; vendor_version?: string | null; ptf_level: string | null }
): 'match' | 'behind' | 'ahead' {
	const sameRelease =
		equivalentVersion(installed.version, expected.version) ||
		(!!expected.vendor_version && equivalentVersion(installed.version, expected.vendor_version));
	let cmp: number;
	if (sameRelease) {
		const a = installed.ptf_level?.trim().toUpperCase() || null;
		const b = expected.ptf_level?.trim().toUpperCase() || null;
		cmp = a === b ? 0 : comparePtfLevels(a, b);
	} else {
		cmp = compareVersions(installed.version, expected.version);
		// Different spellings that compare equal numerically but are not equivalent ("V6" vs "abc")
		if (cmp === 0) cmp = installed.version.localeCompare(expected.version);
	}
	return cmp === 0 ? 'match' : cmp < 0 ? 'behind' : 'ahead';
}

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

export function buildInstalledMatrix(input: {
	lpars: MatrixLpar[];
	software: MatrixSoftware[];
	installs: MatrixInstall[];
	packageItems: MatrixPackageItem[];
}): InstalledMatrix {
	const lpars = [...input.lpars].sort(
		(a, b) => byText(a.customer.name, b.customer.name) || byText(a.code, b.code)
	);
	const softwareById = new Map(input.software.map((s) => [s.id, s]));
	const lparIds = new Set(lpars.map((l) => l.id));

	const itemsByPackage = new Map<string, Map<string, MatrixPackageItem>>();
	for (const item of input.packageItems) {
		let items = itemsByPackage.get(item.package_id);
		if (!items) itemsByPackage.set(item.package_id, (items = new Map()));
		items.set(item.software_id, item);
	}

	const rows = new Map<string, MatrixRow>();
	const rowFor = (softwareId: string) => {
		const software = softwareById.get(softwareId);
		if (!software) return undefined; // filtered out (vendor/product filter)
		let row = rows.get(softwareId);
		if (!row) rows.set(softwareId, (row = { software, cells: {}, differs: false }));
		return row;
	};

	const installsByLpar = new Map<string, Map<string, MatrixInstall>>();
	for (const install of input.installs) {
		if (!lparIds.has(install.lpar_id)) continue;
		let m = installsByLpar.get(install.lpar_id);
		if (!m) installsByLpar.set(install.lpar_id, (m = new Map()));
		m.set(install.software_id, install);
	}

	for (const lpar of lpars) {
		const installed = installsByLpar.get(lpar.id) ?? new Map<string, MatrixInstall>();
		const expected = lpar.package ? (itemsByPackage.get(lpar.package.id) ?? new Map()) : null;

		for (const [softwareId, install] of installed) {
			const row = rowFor(softwareId);
			if (!row) continue;
			const item = expected?.get(softwareId) ?? null;
			const status: MatrixStatus = !expected
				? 'no_package'
				: item
					? compareWithPackage(install, item)
					: 'not_in_package';
			row.cells[lpar.id] = { status, installed: install, expected: item };
		}
		if (expected) {
			for (const [softwareId, item] of expected) {
				if (installed.has(softwareId)) continue;
				const row = rowFor(softwareId);
				if (row) row.cells[lpar.id] = { status: 'missing', installed: null, expected: item };
			}
		}
	}

	const vendors = new Map<string, InstalledMatrix['vendors'][number]>();
	for (const row of rows.values()) {
		row.differs = Object.values(row.cells).some((c) => c.status !== 'match' && c.status !== 'no_package');
		const v = row.software.vendor;
		let group = vendors.get(v.id);
		if (!group) vendors.set(v.id, (group = { vendor: v, rows: [] }));
		group.rows.push(row);
	}
	const groups = [...vendors.values()].sort((a, b) => byText(a.vendor.name, b.vendor.name));
	for (const g of groups) g.rows.sort((a, b) => byText(a.software.name, b.software.name));
	return { lpars, vendors: groups };
}

export const MATRIX_CSV_COLUMNS = [
	'customer',
	'lpar',
	'package',
	'vendor',
	'product',
	'product_code',
	'installed_version',
	'ptf_level',
	'installed_date',
	'package_version',
	'package_vendor_version',
	'package_ptf_level',
	'status',
	'rolled_back',
	'rollback_reason'
] as const;

/** One record per LPAR x product cell, for CSV (filtering and pivoting). */
export function matrixRecords(matrix: InstalledMatrix): Record<(typeof MATRIX_CSV_COLUMNS)[number], string>[] {
	const out: Record<(typeof MATRIX_CSV_COLUMNS)[number], string>[] = [];
	for (const lpar of matrix.lpars) {
		for (const { rows } of matrix.vendors) {
			for (const { software, cells } of rows) {
				const cell = cells[lpar.id];
				if (!cell) continue;
				const { installed, expected } = cell;
				out.push({
					customer: lpar.customer.code,
					lpar: lpar.code,
					package: lpar.package ? `${lpar.package.code} ${lpar.package.version}` : '',
					vendor: software.vendor.code,
					product: software.name,
					product_code: software.product_code ?? '',
					installed_version: installed?.version ?? '',
					ptf_level: installed?.ptf_level ?? '',
					installed_date: installed?.installed_date ? installed.installed_date.toISOString().slice(0, 10) : '',
					package_version: expected?.version ?? '',
					package_vendor_version: expected?.vendor_version ?? '',
					package_ptf_level: expected?.ptf_level ?? '',
					status: cell.status,
					rolled_back: installed?.rolled_back ? 'yes' : '',
					rollback_reason: installed?.rollback_reason ?? ''
				});
			}
		}
	}
	return out;
}

export { toCsv } from './csv.ts';
