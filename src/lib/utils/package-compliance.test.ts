import { describe, it, expect } from 'vitest';
import { buildInstalledMatrix, type MatrixInstall, type MatrixLpar } from './installed-matrix.ts';
import { buildCompliance, complianceRecords } from './package-compliance.ts';

const ibm = { id: 'v-ibm', code: 'IBM', name: 'IBM' };
const acme = { id: 'c-acme', code: 'ACME', name: 'Acme' };
const pkg = { id: 'p1', code: 'Q1', name: 'Q1 2026', version: '1.0' };
const lpar = (id: string, withPackage = true): MatrixLpar => ({
	id,
	code: id.toUpperCase(),
	name: id,
	customer: acme,
	package: withPackage ? pkg : null
});
const install = (lpar_id: string, software_id: string, version: string, ptf_level: string | null): MatrixInstall => ({
	lpar_id,
	software_id,
	version,
	ptf_level,
	installed_date: new Date('2026-01-15T10:00:00Z'),
	rolled_back: false,
	rollback_reason: null
});

const matrix = buildInstalledMatrix({
	lpars: [lpar('good'), lpar('bad'), lpar('nopkg', false)],
	software: [
		{ id: 'cics', name: 'CICS', product_code: null, vendor: ibm },
		{ id: 'db2', name: 'Db2', product_code: null, vendor: ibm },
		{ id: 'ims', name: 'IMS', product_code: null, vendor: ibm }
	],
	installs: [
		install('good', 'cics', 'V6R1M0', 'RSU2510'),
		install('good', 'db2', 'V13R1M0', 'RSU2510'),
		install('bad', 'cics', 'V6R1M0', 'RSU2504'), // behind
		install('bad', 'ims', 'V15R5M0', null), // not in package: counts against
		install('nopkg', 'cics', 'V6R1M0', null)
	],
	packageItems: [
		{ package_id: 'p1', software_id: 'cics', version: 'V6R1M0', vendor_version: null, ptf_level: 'RSU2510' },
		{ package_id: 'p1', software_id: 'db2', version: 'V13R1M0', vendor_version: null, ptf_level: 'RSU2510' }
	]
});
const report = buildCompliance(matrix);

describe('buildCompliance', () => {
	it('counts software outside the package against compliance', () => {
		const bad = report.rows[0];
		expect(bad.lpar.code).toBe('BAD');
		expect(bad.counts).toEqual({ match: 0, behind: 1, ahead: 0, not_in_package: 1, missing: 1 });
		expect(bad).toMatchObject({ judged: 3, compliance: 0 });
	});

	it('sorts worst first, LPARs without a package last', () => {
		expect(report.rows.map((r) => [r.lpar.code, r.compliance])).toEqual([
			['BAD', 0],
			['GOOD', 1],
			['NOPKG', null]
		]);
		expect(report.rows[2].installedWithoutPackage).toBe(1);
	});

	it('totals over LPARs with a package', () => {
		expect(report.totals).toEqual({ compliance: 2 / 5, lparsWithPackage: 2, fullyCompliant: 1, withoutPackage: 1 });
	});

	it('exports one CSV row per LPAR', () => {
		const records = complianceRecords(report);
		expect(records.map((r) => r.compliance_pct)).toEqual(['0', '100', '']);
	});
});
