import { describe, it, expect } from 'vitest';
import { auditRecords, buildAuditDefence } from './audit-defence.ts';
import type { HistoryRow } from './install-history.ts';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const acme = { id: 'c1', code: 'ACME', name: 'Acme' };
const lpars = ['A', 'B'].map((id) => ({ id, code: id, name: id, environment: 'PROD', customer: acme }));
const ibm = { id: 'ibm', code: 'IBM', name: 'IBM' };
const software = [{ id: 'S', name: 'CICS', product_code: 'CICSTS', vendor: ibm }];
const ev = (lpar_id: string, event: string, at: string, to: string | null, ptf: string | null = null, reconstructed = false): HistoryRow => ({
	lpar_id,
	software_id: 'S',
	event,
	from_version: null,
	from_ptf_level: null,
	to_version: to,
	to_ptf_level: ptf,
	occurred_at: d(at),
	source: 'deploy',
	package_id: null,
	reason: null,
	reconstructed
});

describe('vendor audit defence (X2)', () => {
	it('gives installed-since and release-since per LPAR, and earlier removed installs', () => {
		const events = [
			ev('A', 'install', '2024-01-01', 'V5R6M0', 'UI1', true),
			ev('A', 'ptf', '2024-06-01', 'V5R6M0', 'UI2'),
			ev('A', 'upgrade', '2025-03-01', 'V6R1M0', 'UI3'),
			ev('A', 'ptf', '2025-09-01', 'V6R1M0', 'UI4'),
			ev('B', 'install', '2024-02-01', 'V5R6M0'),
			ev('B', 'remove', '2024-08-01', null),
			ev('B', 'install', '2025-01-15', 'V5R6M0'),
			ev('X', 'install', '2024-01-01', 'V5R6M0') // LPAR outside scope
		];
		const r = buildAuditDefence({ lpars, software, events });
		const p = r.vendors[0].products[0];
		expect(p.installs.map((i) => [i.lpar.code, i.version, i.ptf_level, i.installedSince, i.releaseSince, i.lastChange, i.rebuilt])).toEqual([
			['A', 'V6R1M0', 'UI4', d('2024-01-01'), d('2025-03-01'), d('2025-09-01'), true],
			['B', 'V5R6M0', null, d('2025-01-15'), d('2025-01-15'), d('2025-01-15'), false]
		]);
		expect(p.removed.map((x) => [x.lpar.code, x.from, x.to])).toEqual([['B', d('2024-02-01'), d('2024-08-01')]]);
		expect(p.releases).toEqual(['V6R1M0', 'V5R6M0']);
		expect(r.totals).toEqual({ products: 1, installs: 2, lpars: 2, removed: 1, rebuilt: 1 });
		expect(auditRecords(r).map((x) => [x.lpar, x.status, x.installed_since, x.removed_on])).toEqual([
			['A', 'installed', '2024-01-01', ''],
			['B', 'installed', '2025-01-15', ''],
			['B', 'removed', '2024-02-01', '2024-08-01']
		]);
	});
});
