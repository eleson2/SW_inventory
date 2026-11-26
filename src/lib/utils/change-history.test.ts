import { describe, it, expect } from 'vitest';
import { buildChangeHistory, changeRecords, changeText, periodPresets, readMonthPeriod, type ChangeEvent } from './change-history.ts';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const acme = { id: 'c1', code: 'ACME', name: 'Acme' };
const globex = { id: 'c2', code: 'GLX', name: 'Globex' };
const lpar = (id: string, customer = acme) => ({ id, code: id, name: id, customer });
const ibm = { id: 'ibm', code: 'IBM', name: 'IBM' };
let n = 0;
const ev = (l: ReturnType<typeof lpar>, product: string, event: string, at: string, extra: Partial<ChangeEvent> = {}): ChangeEvent => ({
	id: String(n++),
	occurred_at: d(at),
	event,
	from_version: 'V1',
	from_ptf_level: null,
	to_version: 'V2',
	to_ptf_level: null,
	source: 'deploy',
	reason: null,
	reconstructed: false,
	lpar: l,
	software: { id: product, name: product, vendor: ibm },
	package: null,
	...extra
});

describe('change history (C2)', () => {
	it('defaults to the previous calendar month and offers presets', () => {
		const p = readMonthPeriod(new URL('http://x/r'), d('2026-03-15'));
		expect([p.from, p.to, p.end.toISOString().slice(0, 10)]).toEqual(['2026-02-01', '2026-02-28', '2026-03-01']);
		const q = readMonthPeriod(new URL('http://x/r?from=2026-05-10&to=2026-01-01'), d('2026-06-01'));
		expect([q.from, q.to]).toEqual(['2026-01-01', '2026-05-10']);
		expect(readMonthPeriod(new URL('http://x/r?from=2026-02-30'), d('2026-03-15')).from).toBe('2026-02-01');
		expect(periodPresets(d('2026-05-20')).map((x) => [x.label, x.from, x.to])).toEqual([
			['Last month', '2026-04-01', '2026-04-30'],
			['This month', '2026-05-01', '2026-05-20'],
			['Last 3 months', '2026-02-01', '2026-04-30'],
			['Last quarter', '2026-01-01', '2026-03-31']
		]);
	});

	it('groups per customer and LPAR, oldest first, and can hide PTF-only changes', () => {
		const a = lpar('A');
		const b = lpar('B', globex);
		const events = [
			ev(a, 'CICS', 'ptf', '2026-02-10'),
			ev(b, 'DB2', 'rollback', '2026-02-05', { reason: 'Abends', source: 'rollback' }),
			ev(a, 'DB2', 'upgrade', '2026-02-03', { package: { id: 'p', code: 'Q1', version: '1' } })
		];
		const r = buildChangeHistory(events);
		expect(r.customers.map((c) => [c.customer.name, c.lpars.map((l) => l.events.map((e) => e.software.name))])).toEqual([
			['Acme', [['DB2', 'CICS']]],
			['Globex', [['DB2']]]
		]);
		expect(r.totals).toMatchObject({ changes: 3, lpars: 2, products: 2, rollbacks: 1 });
		expect(buildChangeHistory(events, { hidePtf: true }).totals.changes).toBe(2);

		const internal = changeRecords(r);
		const customer = changeRecords(r, true);
		expect(internal.map((x) => [x.change, x.through, x.reason, x.package])).toEqual([
			['Upgraded', 'Package deploy', '', 'Q1 1'],
			['PTF level', 'Package deploy', '', ''],
			['Rolled back', 'Rollback', 'Abends', '']
		]);
		expect(customer.map((x) => [x.change, x.through, x.reason])).toEqual([
			['Upgraded', '', ''],
			['Maintenance applied', '', ''],
			['Previous level restored', '', '']
		]);
		expect(changeText({ from_version: null, from_ptf_level: null, to_version: 'V2', to_ptf_level: 'UI1' })).toBe('V2 UI1');
		expect(changeText({ from_version: 'V1', from_ptf_level: null, to_version: 'V2', to_ptf_level: null })).toBe('V1 → V2');
	});
});
