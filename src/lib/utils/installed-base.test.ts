import { describe, it, expect } from 'vitest';
import { packageHistoryFromAudit } from './rollout.ts';
import { baseRecords, buildInstalledBase, monthPoints, packageAt } from './installed-base.ts';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const ibm = { id: 'ibm', code: 'IBM', name: 'IBM' };
const bc = { id: 'bc', code: 'BROADCOM', name: 'Broadcom' };

describe('package history from the audit log', () => {
	it('reads deployments, edits and creation; skips unchanged packages', () => {
		const periods = packageHistoryFromAudit([
			{ entity_id: 'a', action: 'create', changes: { code: 'A', current_package_id: 'p1' }, timestamp: d('2025-01-01') },
			{ entity_id: 'a', action: 'update', changes: { before: { current_package_id: 'p1' }, after: { current_package_id: 'p1', name: 'x' } }, timestamp: d('2025-02-01') },
			{ entity_id: 'a', action: 'update', changes: { action: 'package_deployment', package_id: 'p2', deployed_at: '2025-04-10T00:00:00Z' }, timestamp: d('2025-04-10') },
			{ entity_id: 'b', action: 'update', changes: { before: { packageId: 'p1' }, after: { packageId: 'p2' } }, timestamp: d('2025-03-01') },
			{ entity_id: 'c', action: 'update', changes: 'not json', timestamp: d('2025-03-01') }
		]);
		expect(periods).toEqual([
			{ lparId: 'a', packageId: 'p1', from: d('2025-01-01'), until: d('2025-04-10') },
			{ lparId: 'a', packageId: 'p2', from: d('2025-04-10'), until: null },
			{ lparId: 'b', packageId: 'p2', from: d('2025-03-01'), until: null }
		]);
	});
});

describe('installed base (V1)', () => {
	it('month ends, the last point is today', () => {
		expect(monthPoints(3, d('2026-11-25')).map((p) => p.toISOString().slice(0, 10))).toEqual(['2026-09-30', '2026-10-31', '2026-11-25']);
	});

	it('picks the package installed at a date', () => {
		const rollouts = [
			{ lpar_id: 'a', package_id: 'p1', installed_at: d('2026-01-01'), superseded_at: d('2026-06-01') },
			{ lpar_id: 'a', package_id: 'p2', installed_at: d('2026-06-01'), superseded_at: null }
		];
		expect(packageAt(rollouts, d('2025-12-31'))).toBeNull();
		expect(packageAt(rollouts, d('2026-03-01'))).toBe('p1');
		expect(packageAt(rollouts, d('2026-06-01'))).toBe('p2');
	});

	it('counts footprint per vendor per month, deleted LPARs until deleted', () => {
		const items = new Map([
			['p1', [{ softwareId: 'cics', version: 'V5R6M0', vendor: ibm }]],
			['p2', [{ softwareId: 'cics', version: 'V6R1M0', vendor: ibm }, { softwareId: 'endevor', version: '19.0', vendor: bc }]]
		]);
		const base = buildInstalledBase(
			{
				lpars: [
					{ id: 'a', customerId: 'c1', deletedAt: null },
					{ id: 'b', customerId: 'c2', deletedAt: d('2026-10-15') }
				],
				rollouts: [
					{ lpar_id: 'a', package_id: 'p1', installed_at: d('2026-08-01'), superseded_at: d('2026-11-01') },
					{ lpar_id: 'a', package_id: 'p2', installed_at: d('2026-11-01'), superseded_at: null },
					{ lpar_id: 'b', package_id: 'p1', installed_at: d('2026-07-01'), superseded_at: null }
				],
				items
			},
			monthPoints(3, d('2026-11-25'))
		);
		const [sep, oct, nov] = base.points;
		expect(sep.total).toEqual({ lpars: 2, customers: 2, products: 1, releases: 1, installs: 2 });
		expect(oct.total.lpars).toBe(1); // b deleted on 15 Oct
		expect(nov.byVendor.ibm).toEqual({ lpars: 1, customers: 1, products: 1, releases: 1, installs: 1 });
		expect(nov.byVendor.bc.installs).toBe(1);
		expect(base.vendors.map((v) => v.id)).toEqual(['bc', 'ibm']); // tie on installs: by name
		expect(baseRecords(base).filter((r) => r.month === '2026-09')).toHaveLength(3);
	});
});
