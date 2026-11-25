import { describe, it, expect } from 'vitest';
import { buildMaintenanceLevels, levelAge, levelRecords, reachesLevel, type LevelBundle } from './maintenance-level.ts';
import {
	auditRollback,
	buildOpenRollbacks,
	buildQuality,
	mergeRollbackEvents,
	qualityRecords,
	type RollbackEvent
} from './rollbacks.ts';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const today = d('2026-11-25');
const ibm = { id: 'v-ibm', code: 'IBM', name: 'IBM' };
const acme = { id: 'c-acme', code: 'ACME', name: 'Acme' };
const globex = { id: 'c-globex', code: 'GLOBEX', name: 'Globex' };

describe('maintenance level (L4)', () => {
	const bundle = (id: string, date: string, cics: string, db2: { v: string; p: string }[]): LevelBundle => ({
		id,
		vendor_id: 'v-ibm',
		code: id,
		release_date: d(date),
		items: [
			{ software_id: 'cics', version: 'V6R1M0', vendor_version: null, ptf_level: cics },
			...db2.map((x) => ({ software_id: 'db2', version: x.v, vendor_version: null, ptf_level: x.p }))
		]
	});
	const bundles = [
		bundle('RSU2510', '2026-10-01', 'RSU2510', [{ v: 'V13R1M0', p: 'RSU2510' }]),
		bundle('RSU2504', '2026-04-01', 'RSU2504', [
			{ v: 'V12R1M0', p: 'RSU2504' },
			{ v: 'V13R1M0', p: 'RSU2504' }
		]),
		bundle('RSU2501', '2025-01-01', 'RSU2501', [{ v: 'V12R1M0', p: 'RSU2501' }])
	];

	it('compares with the same release, else the highest', () => {
		const inst = (v: string, p: string) => ({ lpar_id: 'x', software_id: 'db2', version: v, ptf_level: p });
		expect(reachesLevel(inst('V12R1M0', 'RSU2504'), bundles[1])).toBe(true);
		expect(reachesLevel(inst('V12R1M0', 'RSU2512'), bundles[0])).toBe(false); // 12 not in RSU2510: behind 13
		expect(reachesLevel(inst('V14R1M0', 'RSU2401'), bundles[0])).toBe(true);
		expect(reachesLevel({ ...inst('V1', 'X'), software_id: 'ims' }, bundles[0])).toBeUndefined();
	});

	it('ages: under 6 months green, up to 12 amber, older red', () => {
		expect([levelAge(5), levelAge(6), levelAge(12), levelAge(13), levelAge(null)]).toEqual([
			'fresh',
			'aging',
			'aging',
			'stale',
			'below'
		]);
	});

	const report = buildMaintenanceLevels(
		{
			vendors: [ibm],
			lpars: [
				{ id: 'a', code: 'A', name: 'a', customer: acme },
				{ id: 'b', code: 'B', name: 'b', customer: acme },
				{ id: 'c', code: 'C', name: 'c', customer: globex }
			],
			software: [
				{ id: 'cics', name: 'CICS', vendor_id: 'v-ibm' },
				{ id: 'db2', name: 'Db2', vendor_id: 'v-ibm' }
			],
			bundles,
			installs: [
				{ lpar_id: 'a', software_id: 'cics', version: 'V6R1M0', ptf_level: 'RSU2510' },
				{ lpar_id: 'a', software_id: 'db2', version: 'V13R1M0', ptf_level: 'RSU2510' },
				{ lpar_id: 'b', software_id: 'cics', version: 'V6R1M0', ptf_level: 'RSU2510' },
				{ lpar_id: 'b', software_id: 'db2', version: 'V12R1M0', ptf_level: 'RSU2504' }, // holds B at RSU2504
				{ lpar_id: 'c', software_id: 'cics', version: 'V6R1M0', ptf_level: 'RSU2412' }
			]
		},
		today
	);

	it('takes the newest level every product reaches', () => {
		const cell = (id: string) => report.rows.find((r) => r.lpar.id === id)!.cells['v-ibm']!;
		expect(cell('a')).toMatchObject({ bundle: { code: 'RSU2510' }, months: 1, age: 'fresh', behindLatest: [] });
		expect(cell('b')).toMatchObject({ bundle: { code: 'RSU2504' }, months: 7, age: 'aging', behindLatest: ['Db2'] });
		expect(cell('c')).toMatchObject({ bundle: null, age: 'below' });
		expect(report.vendors[0]).toMatchObject({ latest: { code: 'RSU2510' }, staleLpars: 1 });
		expect(levelRecords(report).map((r) => r.level)).toEqual(['RSU2510', 'RSU2504', 'below oldest known level']);
	});
});

describe('rollbacks (V4, L5)', () => {
	const lpars = [
		{ id: 'a', code: 'A', customer: acme },
		{ id: 'c', code: 'C', customer: globex }
	];
	const software = [
		{ id: 'cics', name: 'CICS', vendor: ibm },
		{ id: 'db2', name: 'Db2', vendor: ibm }
	];
	const ev = (lpar_id: string, software_id: string, at: string, reason = 'abend'): RollbackEvent => ({
		lpar_id,
		software_id,
		at: new Date(at),
		from_version: 'V6R1M0',
		from_ptf: 'RSU2510',
		to_version: 'V6R1M0',
		to_ptf: 'RSU2504',
		reason
	});

	it('reads audit entries and skips the same rollback in install records', () => {
		const audit = auditRollback({
			entity_id: 'a',
			timestamp: new Date('2026-11-01T10:00:00Z'),
			changes: { software_id: 'cics', from_version: 'V6R1M0', to_version: 'V5R6M0', reason: 'S0C4' }
		})!;
		expect(audit).toMatchObject({ lpar_id: 'a', software_id: 'cics', to_version: 'V5R6M0', from_ptf: null });
		expect(auditRollback({ entity_id: 'a', timestamp: today, changes: {} })).toBeNull();
		const merged = mergeRollbackEvents(
			[audit],
			[ev('a', 'cics', '2026-11-01T10:00:20Z'), ev('c', 'cics', '2026-10-01T10:00:00Z')]
		);
		expect(merged.map((e) => e.lpar_id)).toEqual(['a', 'c']);
	});

	it('V4: counts rollbacks per product, most first, every rollback in the CSV', () => {
		const report = buildQuality({
			lpars,
			software,
			events: [
				ev('a', 'cics', '2026-11-01T00:00:00Z'),
				ev('a', 'cics', '2026-08-01T00:00:00Z'),
				ev('c', 'cics', '2026-09-01T00:00:00Z'),
				ev('c', 'db2', '2026-10-01T00:00:00Z'),
				ev('zz', 'db2', '2026-10-01T00:00:00Z') // outside scope
			]
		});
		expect(report.rows.map((r) => [r.software.name, r.rollbacks, r.lparCount, r.customerCount])).toEqual([
			['CICS', 3, 2, 2],
			['Db2', 1, 1, 1]
		]);
		expect(report.totals).toEqual({ rollbacks: 4, products: 2, lpars: 2 });
		expect(qualityRecords(report)).toHaveLength(4);
	});

	it('L5: oldest first, flags older than 30 days', () => {
		const install = (lpar_id: string, software_id: string, at: Date | null) => ({
			lpar_id,
			software_id,
			current_version: 'V6R1M0',
			current_ptf_level: 'RSU2504',
			previous_version: 'V6R1M0',
			previous_ptf_level: 'RSU2510',
			rolled_back_at: at,
			rollback_reason: 'abend'
		});
		const rows = buildOpenRollbacks(
			{
				lpars,
				software,
				installs: [install('a', 'cics', d('2026-11-15')), install('c', 'db2', d('2026-10-01'))]
			},
			today
		);
		expect(rows.map((r) => [r.lpar.code, r.ageDays, r.flagged])).toEqual([
			['C', 55, true],
			['A', 10, false]
		]);
	});
});
