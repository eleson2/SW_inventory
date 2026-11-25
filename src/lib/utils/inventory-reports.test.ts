import { describe, it, expect } from 'vitest';
import { buildInstalledMatrix, type MatrixInstall, type MatrixLpar } from './installed-matrix.ts';
import {
	buildCurrency,
	buildVersionSprawl,
	buildWhereUsed,
	currencyOf,
	currencyRecords,
	sprawlRecords,
	whereUsedRecords
} from './inventory-reports.ts';
import { buildUptake } from './maintenance-level.ts';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const today = d('2026-11-25');
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

const matrix = buildInstalledMatrix({
	lpars: [lpar('a1'), lpar('a2'), lpar('g1', globex, false)],
	software: [
		{ id: 'db2', name: 'Db2', product_code: null, vendor: ibm },
		{ id: 'cics', name: 'CICS', product_code: null, vendor: ibm }
	],
	installs: [
		install('a1', 'db2', 'V13R1M0', 'RSU2510'),
		install('a2', 'db2', '13', 'RSU2504'),
		install('g1', 'db2', 'V12R1M0', 'RSU2501'),
		install('a1', 'cics', 'V5R6M0', 'RSU2510')
	],
	packageItems: [
		{ package_id: 'p1', software_id: 'db2', version: 'V13R1M0', vendor_version: '13', ptf_level: 'RSU2510' },
		{ package_id: 'p1', software_id: 'cics', version: 'V6R1M0', vendor_version: null, ptf_level: 'RSU2510' }
	]
});
const known = {
	db2: [
		{ version: 'V12R1M0', vendor_version: '12', end_of_support: d('2026-06-30') },
		{ version: 'V13R1M0', vendor_version: '13', end_of_support: null }
	],
	cics: [{ version: 'V5R6M0', vendor_version: null }]
};

describe('R2 where used', () => {
	it('lists every LPAR running the product, newest level first, with counts per release', () => {
		const r = buildWhereUsed(matrix, known);
		const db2 = r.rows.filter((x) => x.software.id === 'db2');
		expect(db2.map((x) => [x.lpar.code, x.release, x.ptf, x.status])).toEqual([
			['A1', 'V13R1M0', 'RSU2510', 'match'],
			['A2', 'V13R1M0', 'RSU2504', 'behind'],
			['G1', 'V12R1M0', 'RSU2501', 'no_package']
		]);
		expect(r.releases.find((x) => x.release === 'V13R1M0')).toMatchObject({ count: 2 });
		expect(r).toMatchObject({ lparCount: 3, customerCount: 2 });
		expect(whereUsedRecords(r)).toHaveLength(4);
	});
	it('narrows to chosen releases', () => {
		expect(buildWhereUsed(matrix, known, ['V12R1M0']).rows.map((x) => x.lpar.code)).toEqual(['G1']);
	});
});

describe('R4 version sprawl', () => {
	it('counts distinct releases and levels per product, most levels first', () => {
		const rows = buildVersionSprawl(matrix, known);
		expect(rows.map((r) => [r.software.name, r.releases, r.levels.length, r.lpars, r.oldest, r.newest])).toEqual([
			['Db2', 2, 3, 3, 'V12R1M0 RSU2501', 'V13R1M0 RSU2510'],
			['CICS', 1, 1, 1, 'V5R6M0 RSU2510', 'V5R6M0 RSU2510']
		]);
		expect(sprawlRecords(rows)).toHaveLength(4);
	});
});

describe('C5 currency score', () => {
	it('classifies against the package, out of support first', () => {
		expect(currencyOf('match', null, today)).toBe('current');
		expect(currencyOf('ahead', null, today)).toBe('current');
		expect(currencyOf('match', d('2026-01-01'), today)).toBe('out_of_support');
		expect(currencyOf('not_in_package', null, today)).toBe('outside');
		expect(currencyOf('no_package', null, today)).toBe('outside');
		expect(currencyOf('missing', null, today)).toBeNull();
	});
	it('scores customers and LPARs, worst first', () => {
		const r = buildCurrency(matrix, known, today);
		expect(r.customers.map((c) => [c.customer.name, c.score])).toEqual([
			['Globex', 0],
			['Acme', 1 / 3]
		]);
		expect(r.customers[0].counts.out_of_support).toBe(1); // Db2 12 past its end of support
		const acmeRow = r.customers[1];
		expect(acmeRow.counts).toEqual({ current: 1, behind: 2, outside: 0, out_of_support: 0 });
		expect(r.total).toMatchObject({ installed: 4, score: 1 / 4 });
		expect(currencyRecords(r).map((x) => x.score_pct)).toEqual(['0', '0', '50']);
	});
});

describe('V6 maintenance uptake', () => {
	it('counts LPARs reaching each level', () => {
		const level = (code: string, date: string, ptf: string) => ({
			id: code,
			vendor_id: 'v-ibm',
			code,
			release_date: d(date),
			items: [{ software_id: 'db2', version: 'V13R1M0', vendor_version: null, ptf_level: ptf }]
		});
		const [v] = buildUptake(
			{
				vendors: [ibm],
				lpars: [
					{ id: 'a1', code: 'A1', name: 'a1', customer: acme },
					{ id: 'a2', code: 'A2', name: 'a2', customer: acme }
				],
				software: [{ id: 'db2', name: 'Db2', vendor_id: 'v-ibm' }],
				bundles: [level('RSU2504', '2026-04-01', 'RSU2504'), level('RSU2510', '2026-10-01', 'RSU2510')],
				installs: [
					{ lpar_id: 'a1', software_id: 'db2', version: 'V13R1M0', ptf_level: 'RSU2510' },
					{ lpar_id: 'a2', software_id: 'db2', version: 'V13R1M0', ptf_level: 'RSU2504' }
				]
			},
			today
		);
		expect(v.levels.map((l) => [l.bundle.code, l.reached, l.lpars, l.months])).toEqual([
			['RSU2510', 1, 2, 1],
			['RSU2504', 2, 2, 7]
		]);
	});
});
