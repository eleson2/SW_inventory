/**
 * Package compliance (report L2): one row per LPAR, summarising the installed software matrix
 * (R1). Compliance = matching products / (products in the package + products installed outside
 * it); software outside the package counts against compliance. LPARs without a package have no %.
 */
import type { InstalledMatrix, MatrixLpar, MatrixStatus } from './installed-matrix.ts';

export type CountedStatus = Exclude<MatrixStatus, 'no_package'>;
export const COUNTED: CountedStatus[] = ['match', 'behind', 'ahead', 'not_in_package', 'missing'];

export interface ComplianceRow {
	lpar: MatrixLpar;
	counts: Record<CountedStatus, number>;
	/** Products judged: in the package or installed outside it */
	judged: number;
	/** Installed products on an LPAR without a package */
	installedWithoutPackage: number;
	/** 0..1, null when the LPAR has no package or nothing to judge */
	compliance: number | null;
}

export interface ComplianceReport {
	rows: ComplianceRow[];
	totals: {
		/** Matching / judged over all LPARs with a package, 0..1 (null when nothing judged) */
		compliance: number | null;
		lparsWithPackage: number;
		fullyCompliant: number;
		withoutPackage: number;
	};
}

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

export function buildCompliance(matrix: InstalledMatrix): ComplianceReport {
	const rows: ComplianceRow[] = matrix.lpars.map((lpar) => {
		const counts = Object.fromEntries(COUNTED.map((s) => [s, 0])) as Record<CountedStatus, number>;
		let installedWithoutPackage = 0;
		for (const group of matrix.vendors) {
			for (const row of group.rows) {
				const cell = row.cells[lpar.id];
				if (!cell) continue;
				if (cell.status === 'no_package') installedWithoutPackage++;
				else counts[cell.status]++;
			}
		}
		const judged = COUNTED.reduce((n, s) => n + counts[s], 0);
		return {
			lpar,
			counts,
			judged,
			installedWithoutPackage,
			compliance: lpar.package && judged > 0 ? counts.match / judged : null
		};
	});

	// Worst first; LPARs without a package (or with nothing to judge) last
	rows.sort(
		(a, b) =>
			(a.compliance === null ? 1 : 0) - (b.compliance === null ? 1 : 0) ||
			(a.compliance ?? 0) - (b.compliance ?? 0) ||
			byText(a.lpar.customer.name, b.lpar.customer.name) ||
			byText(a.lpar.code, b.lpar.code)
	);

	const withPackage = rows.filter((r) => r.lpar.package);
	const judged = withPackage.reduce((n, r) => n + r.judged, 0);
	const matching = withPackage.reduce((n, r) => n + r.counts.match, 0);
	return {
		rows,
		totals: {
			compliance: judged ? matching / judged : null,
			lparsWithPackage: withPackage.length,
			fullyCompliant: withPackage.filter((r) => r.compliance === 1).length,
			withoutPackage: rows.length - withPackage.length
		}
	};
}

export const COMPLIANCE_CSV_COLUMNS = [
	'customer',
	'customer_code',
	'lpar',
	'package',
	'package_version',
	'products_judged',
	'match',
	'behind',
	'ahead',
	'not_in_package',
	'missing',
	'compliance_pct',
	'installed_without_package'
] as const;

export function complianceRecords(report: ComplianceReport): Record<(typeof COMPLIANCE_CSV_COLUMNS)[number], string>[] {
	return report.rows.map((r) => ({
		customer: r.lpar.customer.name,
		customer_code: r.lpar.customer.code,
		lpar: r.lpar.code,
		package: r.lpar.package?.code ?? '',
		package_version: r.lpar.package?.version ?? '',
		products_judged: String(r.judged),
		match: String(r.counts.match),
		behind: String(r.counts.behind),
		ahead: String(r.counts.ahead),
		not_in_package: String(r.counts.not_in_package),
		missing: String(r.counts.missing),
		compliance_pct: r.compliance === null ? '' : String(Math.round(r.compliance * 100)),
		installed_without_package: String(r.installedWithoutPackage)
	}));
}
