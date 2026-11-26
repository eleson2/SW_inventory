import { describe, it, expect } from 'vitest';
import { buildLowFootprint, environmentText, footprintRecords, readMaxLpars, type FootprintSoftware } from './low-footprint.ts';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const lpars = [
	{ id: 'p1', customer_id: 'c1', environment: 'PROD' },
	{ id: 'p2', customer_id: 'c2', environment: 'PROD' },
	{ id: 'p3', customer_id: 'c2', environment: 'PROD' },
	{ id: 't1', customer_id: 'c1', environment: 'TEST' },
	{ id: 'd1', customer_id: 'c1', environment: 'DEV' },
	{ id: 'x1', customer_id: 'c1', environment: null }
];
const ibm = { id: 'ibm', code: 'IBM', name: 'IBM' };
const sw = (id: string): FootprintSoftware => ({ id, name: id, vendor: ibm, category: null });
const software = ['wide', 'single', 'testonly', 'unset', 'unused', 'shelf'].map(sw);
const inst = (lpar_id: string, software_id: string, date = '2025-01-01', rolled: string | null = null) => ({
	lpar_id,
	software_id,
	installed_date: d(date),
	rolled_back_at: rolled ? d(rolled) : null
});
const installs = [
	inst('p1', 'wide'),
	inst('p2', 'wide'),
	inst('p3', 'wide'),
	inst('p1', 'single', '2024-03-01', '2025-06-01'),
	inst('t1', 'testonly'),
	inst('d1', 'testonly'),
	inst('t1', 'unset'),
	inst('x1', 'unset'),
	inst('zz', 'wide') // LPAR outside scope
];

describe('low-footprint products (V2)', () => {
	it('lists products on few LPARs or only on test/dev, smallest first', () => {
		const r = buildLowFootprint({
			lpars,
			software,
			installs,
			packages: new Map([['shelf', 2]]),
			overlapping: new Set(['single']),
			maxLpars: 1
		});
		expect(r.rows.map((x) => [x.software.id, x.fewLpars, x.nonProdOnly, x.overlaps])).toEqual([
			['single', true, false, true],
			['testonly', false, true, false]
			// 'unset' runs on 2 LPARs, one without environment: not test/dev only
		]);
		expect(r.rows[0].lastChange).toEqual(d('2025-06-01')); // the rollback is the latest change
		expect(r.notInstalled.map((n) => [n.software.id, n.packages])).toEqual([
			['shelf', 2],
			['unused', 0]
		]);
		expect(r.installedProducts).toBe(4);
		expect(footprintRecords(r).map((x) => x.reasons)).toEqual(['1 LPAR; Overlaps (V3)', 'Test/dev only', 'Not installed', 'Not installed']);
	});

	it('reads the limit and describes environments', () => {
		expect([readMaxLpars(null), readMaxLpars('5'), readMaxLpars('0'), readMaxLpars('x'), readMaxLpars('100')]).toEqual([2, 5, 2, 2, 2]);
		expect(environmentText({ TEST: 1, PROD: 2, none: 1 })).toBe('2 PROD, 1 TEST, 1 not set');
	});
});
