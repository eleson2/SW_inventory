import { describe, it, expect } from 'vitest';
import { buildOverlap, overlapRecords, type OverlapSoftware } from './overlap.ts';

const acme = { id: 'c1', code: 'ACME', name: 'Acme' };
const globex = { id: 'c2', code: 'GLOBEX', name: 'Globex' };
const lpars = [
	{ id: 'a', code: 'A', name: 'a', customer: acme },
	{ id: 'b', code: 'B', name: 'b', customer: acme },
	{ id: 'c', code: 'C', name: 'c', customer: globex }
];
const ibm = { id: 'ibm', code: 'IBM', name: 'IBM' };
const bmc = { id: 'bmc', code: 'BMC', name: 'BMC' };
const mon = { id: 'mon', name: 'Monitoring' };
const db = { id: 'db', name: 'Database' };
const sw = (id: string, vendor: typeof ibm, category: typeof mon | null): OverlapSoftware => ({
	id,
	name: id,
	vendor,
	category
});
const software = [
	sw('omegamon', ibm, mon),
	sw('mainview', bmc, mon),
	sw('omegamon-db2', ibm, mon),
	sw('db2', ibm, db),
	sw('ims', ibm, db),
	sw('endevor', bmc, null)
];
const installs = [
	['a', 'omegamon'],
	['b', 'omegamon'],
	['a', 'mainview'],
	['c', 'mainview'],
	['c', 'omegamon-db2'],
	['a', 'db2'],
	['b', 'ims'],
	['a', 'endevor'],
	['zz', 'db2'] // LPAR outside scope
].map(([lpar_id, software_id]) => ({ lpar_id, software_id }));

describe('overlapping products (V3)', () => {
	it('finds categories with products from several vendors, side by side per LPAR', () => {
		const r = buildOverlap({ lpars, software, installs });
		expect(r.categories.map((c) => c.category.name)).toEqual(['Monitoring']); // Database is IBM only
		const [m] = r.categories;
		expect(m.vendors).toBe(2);
		expect(m.lparIds.sort()).toEqual(['a', 'b', 'c']);
		expect(m.sideBySide.sort()).toEqual(['a', 'c']); // omegamon+mainview on A, mainview+omegamon-db2 on C
		const omegamon = m.products.find((p) => p.software.id === 'omegamon')!;
		expect(omegamon).toMatchObject({ customers: 1, share: 2 / 3 });
		expect(omegamon.alsoOn.map((o) => [o.software.id, o.lpars])).toEqual([['mainview', 1]]); // same vendor not listed
		expect(r.unclassified).toBe(1);
		expect(r.productsInvolved).toBe(3);
		expect(r.lparsWithOverlap).toBe(2);
		expect(overlapRecords(r).find((x) => x.product === 'mainview' && x.lpar === 'A')!.overlaps_on_lpar).toBe('omegamon');
	});

	it('also counts the same vendor when asked', () => {
		const r = buildOverlap({ lpars, software, installs }, true);
		expect(r.categories.map((c) => c.category.name)).toEqual(['Monitoring', 'Database']);
		expect(r.categories[1].sideBySide).toEqual([]); // db2 and ims never on one LPAR
	});
});
