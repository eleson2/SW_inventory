import { describe, it, expect } from 'vitest';
import {
	buildInstalledMatrix,
	compareWithPackage,
	matrixRecords,
	toCsv,
	type MatrixInstall,
	type MatrixLpar
} from './installed-matrix.ts';

const ibm = { id: 'v-ibm', code: 'IBM', name: 'IBM' };
const bc = { id: 'v-bc', code: 'BROADCOM', name: 'Broadcom' };
const acme = { id: 'c-acme', code: 'ACME', name: 'Acme' };
const globex = { id: 'c-globex', code: 'GLOBEX', name: 'Globex' };
const pkg = { id: 'p1', code: 'Q1', name: 'Q1 2026', version: '1.0' };

const lpar = (id: string, customer = acme, withPackage = true): MatrixLpar => ({
	id,
	code: id.toUpperCase(),
	name: id,
	customer,
	package: withPackage ? pkg : null
});
const install = (lpar_id: string, software_id: string, version: string, ptf_level: string | null = null): MatrixInstall => ({
	lpar_id,
	software_id,
	version,
	ptf_level,
	installed_date: new Date('2026-01-15T10:00:00Z'),
	rolled_back: false,
	rollback_reason: null
});

const software = [
	{ id: 'cics', name: 'CICS TS', product_code: 'CICSTS', vendor: ibm },
	{ id: 'db2', name: 'Db2', product_code: 'DB2', vendor: ibm },
	{ id: 'endevor', name: 'Endevor', product_code: 'C2141', vendor: bc },
	{ id: 'ims', name: 'IMS', product_code: 'IMS', vendor: ibm }
];
const packageItems = [
	{ package_id: 'p1', software_id: 'cics', version: 'V6R1M0', vendor_version: '6.1', ptf_level: 'RSU2510' },
	{ package_id: 'p1', software_id: 'db2', version: 'V13R1M0', vendor_version: null, ptf_level: 'RSU2510' }
];

describe('compareWithPackage', () => {
	it('compares PTF levels within the same release, in any notation', () => {
		expect(compareWithPackage({ version: '6.1', ptf_level: 'RSU2510' }, packageItems[0])).toBe('match');
		expect(compareWithPackage({ version: 'V6R1M0', ptf_level: 'rsu2504' }, packageItems[0])).toBe('behind');
		expect(compareWithPackage({ version: 'V6R1M0', ptf_level: 'RSU2511' }, packageItems[0])).toBe('ahead');
	});

	it('compares releases first', () => {
		expect(compareWithPackage({ version: 'V5R6M0', ptf_level: 'RSU2512' }, packageItems[0])).toBe('behind');
		expect(compareWithPackage({ version: 'V6R2M0', ptf_level: null }, packageItems[0])).toBe('ahead');
	});
});

describe('buildInstalledMatrix', () => {
	const matrix = buildInstalledMatrix({
		lpars: [lpar('globp1', globex), lpar('acmep2'), lpar('acmep1'), lpar('acmet1', acme, false)],
		software,
		installs: [
			install('acmep1', 'cics', 'V6R1M0', 'RSU2510'),
			install('acmep2', 'cics', 'V5R6M0', 'RSU2504'),
			install('acmep1', 'endevor', 'V19R1M0', 'LU17806'),
			install('acmet1', 'db2', 'V12R1M0', 'RSU2410'),
			install('acmep1', 'db2', 'V13R1M0', 'RSU2510'),
			install('acmep2', 'db2', 'V13R1M0', 'RSU2510'),
			install('globp1', 'cics', 'V6R1M0', 'RSU2510'),
			install('globp1', 'db2', 'V13R1M0', 'RSU2510'),
			install('other', 'ims', 'V15R1M0') // LPAR not in scope
		],
		packageItems
	});
	const row = (id: string) => matrix.vendors.flatMap((v) => v.rows).find((r) => r.software.id === id)!;

	it('orders LPARs by customer, then code; vendors and products by name', () => {
		expect(matrix.lpars.map((l) => l.id)).toEqual(['acmep1', 'acmep2', 'acmet1', 'globp1']);
		expect(matrix.vendors.map((v) => v.vendor.code)).toEqual(['BROADCOM', 'IBM']);
		expect(matrix.vendors[1].rows.map((r) => r.software.id)).toEqual(['cics', 'db2']);
	});

	it('compares each cell with the LPAR package', () => {
		expect(row('cics').cells.acmep1.status).toBe('match');
		expect(row('cics').cells.acmep2.status).toBe('behind');
		expect(row('endevor').cells.acmep1.status).toBe('not_in_package');
		expect(row('db2').cells.acmet1.status).toBe('no_package');
	});

	it('adds missing cells for package items that are not installed', () => {
		expect(row('cics').cells.acmet1).toBeUndefined(); // no package: nothing expected
		expect(row('endevor').cells.acmep2).toBeUndefined();
		const missing = buildInstalledMatrix({ lpars: [lpar('x')], software, installs: [], packageItems });
		expect(missing.vendors[0].rows.map((r) => [r.software.id, r.cells.x.status])).toEqual([
			['cics', 'missing'],
			['db2', 'missing']
		]);
	});

	it('flags rows with differences; no_package cells are neutral', () => {
		expect(row('cics').differs).toBe(true);
		expect(row('db2').differs).toBe(false);
		expect(row('endevor').differs).toBe(true);
	});

	it('drops products that are filtered out and LPARs out of scope', () => {
		const ibmOnly = buildInstalledMatrix({
			lpars: [lpar('acmep1')],
			software: software.filter((s) => s.vendor === ibm),
			installs: [install('acmep1', 'endevor', 'V19R1M0'), install('other', 'ims', 'V15R1M0')],
			packageItems
		});
		expect(ibmOnly.vendors.flatMap((v) => v.rows.map((r) => r.software.id))).toEqual(['cics', 'db2']);
	});

	it('produces one CSV record per cell', () => {
		const records = matrixRecords(matrix);
		expect(records).toHaveLength(8); // 8 installs in scope, nothing missing
		expect(records.find((r) => r.lpar === 'ACMEP2' && r.product === 'CICS TS')).toMatchObject({
			customer: 'ACME',
			package: 'Q1 1.0',
			installed_version: 'V5R6M0',
			ptf_level: 'RSU2504',
			installed_date: '2026-01-15',
			package_version: 'V6R1M0',
			package_vendor_version: '6.1',
			status: 'behind'
		});
	});
});

describe('toCsv', () => {
	it('quotes separators and neutralises formulas', () => {
		const csv = toCsv(['a', 'b'] as const, [{ a: 'x, "y"', b: '=SUM(A1)' }]);
		expect(csv).toBe('a,b\r\n"x, ""y""",\'=SUM(A1)\r\n');
	});
});
