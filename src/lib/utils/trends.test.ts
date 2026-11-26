import { describe, it, expect } from 'vitest';
import { buildInstalledMatrix, type MatrixInstall, type MatrixLpar } from './installed-matrix.ts';
import { buildTrends, measurePoint, trendRecords } from './trends.ts';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const ibm = { id: 'v-ibm', code: 'IBM', name: 'IBM' };
const acme = { id: 'c-acme', code: 'ACME', name: 'Acme' };
const globex = { id: 'c-globex', code: 'GLOBEX', name: 'Globex' };
const pkg = { id: 'p1', code: 'Q1', name: 'Q1', version: '1.0' };
const lpar = (id: string, customer = acme, withPackage = true): MatrixLpar => ({
	id,
	code: id.toUpperCase(),
	name: id,
	customer,
	package: withPackage ? pkg : null
});
const install = (lpar_id: string, software_id: string, version: string, ptf_level: string | null): MatrixInstall => ({
	lpar_id,
	software_id,
	version,
	ptf_level,
	installed_date: d('2026-01-15'),
	rolled_back: false,
	rollback_reason: null
});
const software = [
	{ id: 'db2', name: 'Db2', product_code: null, vendor: ibm },
	{ id: 'cics', name: 'CICS', product_code: null, vendor: ibm }
];
const packageItems = [
	{ package_id: 'p1', software_id: 'db2', version: 'V13R1M0', vendor_version: '13', ptf_level: 'RSU2510' },
	{ package_id: 'p1', software_id: 'cics', version: 'V6R1M0', vendor_version: null, ptf_level: 'RSU2510' }
];
const known = {
	db2: [
		{ version: 'V12R1M0', vendor_version: '12', end_of_support: d('2026-06-30') },
		{ version: 'V13R1M0', vendor_version: '13', end_of_support: null }
	],
	cics: [{ version: 'V5R6M0', vendor_version: null }]
};
const lpars = [lpar('a1'), lpar('a2'), lpar('g1', globex, false)];
const now = buildInstalledMatrix({
	lpars,
	software,
	installs: [
		install('a1', 'db2', 'V13R1M0', 'RSU2510'),
		install('a2', 'db2', '13', 'RSU2504'),
		install('g1', 'db2', 'V12R1M0', 'RSU2501'),
		install('a1', 'cics', 'V5R6M0', 'RSU2510')
	],
	packageItems
});
const before = buildInstalledMatrix({ lpars, software, installs: [install('g1', 'db2', 'V12R1M0', 'RSU2501')], packageItems });

describe('X4 trends', () => {
	it('measures installed base, currency and sprawl at a point, in total and per group', () => {
		const p = measurePoint(now, known, d('2026-11-25'));
		expect(p.total).toEqual({
			lpars: 3,
			customers: 2,
			products: 2,
			releases: 3,
			installs: 4,
			currency: { current: 1, behind: 2, outside: 0, out_of_support: 1 },
			currentShare: 0.25,
			multiRelease: 1,
			avgReleases: 1.5,
			ptfLevels: 4
		});
		expect(p.vendor.get('v-ibm')!.metrics).toEqual(p.total);
		expect(p.customer.get('c-globex')!.metrics).toMatchObject({ installs: 1, currency: { out_of_support: 1 } });
		// Before its end of support, V12 on an LPAR without a package is outside the package
		expect(measurePoint(now, known, d('2026-05-31')).total.currency).toEqual({ current: 1, behind: 2, outside: 1, out_of_support: 0 });
	});

	it('builds series per group with empty months, flags rebuilt months and writes CSV', () => {
		const r = buildTrends(
			[
				{ at: d('2026-09-30'), point: measurePoint(before, known, d('2026-09-30')) },
				{ at: d('2026-11-25'), point: measurePoint(now, known, d('2026-11-25')) }
			],
			d('2026-10-15')
		);
		expect(r.points.map((p) => p.rebuilt)).toEqual([true, false]);
		expect(r.total.map((m) => m.installs)).toEqual([1, 4]);
		expect(r.customer.map((g) => [g.label, g.values.map((m) => m.installs)])).toEqual([
			['Acme', [0, 3]],
			['Globex', [1, 1]]
		]);
		const csv = trendRecords(r, 'customer');
		expect(csv.map((x) => [x.month_end, x.group, x.installs, x.current_pct, x.rebuilt_history])).toEqual([
			['2026-09-30', 'Acme', '0', '', 'yes'],
			['2026-09-30', 'Globex', '1', '0', 'yes'],
			['2026-11-25', 'Acme', '3', '33', ''],
			['2026-11-25', 'Globex', '1', '0', '']
		]);
	});
});
