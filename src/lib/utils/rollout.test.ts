import { describe, it, expect } from 'vitest';
import { buildRolloutReport, isOverdue, rolloutRecords, type RolloutRecord } from './rollout.ts';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const today = new Date('2026-11-25T12:00:00Z');
const acme = { id: 'c1', code: 'ACME', name: 'Acme' };
const lpars = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, code: id.toUpperCase(), name: id, customer: acme }));
const pkg = { id: 'q2', code: 'Q2', name: 'Q2 2026', version: '1.0', release_date: d('2026-04-01') };
const rec = (lpar_id: string, stage: string, extra: Partial<RolloutRecord> = {}): RolloutRecord => ({
	id: `${lpar_id}-q2`,
	lpar_id,
	package_id: 'q2',
	stage,
	planned_date: null,
	initiated_at: d('2026-10-01'),
	installed_at: null,
	superseded_at: null,
	cancelled_at: null,
	notes: null,
	...extra
});

describe('rollout progress (L3)', () => {
	it('flags planned dates before today', () => {
		expect(isOverdue({ stage: 'planned', planned_date: d('2026-11-24') }, today)).toBe(true);
		expect(isOverdue({ stage: 'planned', planned_date: d('2026-11-25') }, today)).toBe(false);
		expect(isOverdue({ stage: 'installed', planned_date: d('2026-01-01') }, today)).toBe(false);
	});

	it('counts stages, progress excludes cancelled, rows planned first', () => {
		const [g] = buildRolloutReport(
			{
				packages: [pkg],
				lpars,
				rollouts: [
					rec('a', 'installed', { installed_at: d('2026-11-01') }),
					rec('b', 'planned', { planned_date: d('2026-11-20') }),
					rec('c', 'initiated'),
					rec('d', 'cancelled'),
					rec('e', 'superseded'),
					rec('zz', 'planned') // LPAR outside scope
				],
				compliance: new Map([
					['a', { packageId: 'q2', value: 0.5 }],
					['b', { packageId: 'q1', value: 1 }]
				])
			},
			today
		);
		expect(g.counts).toEqual({ initiated: 1, planned: 1, installed: 1, superseded: 1, cancelled: 1 });
		expect(g.progress).toBe(2 / 4);
		expect(g.overdue).toBe(1);
		expect(g.rows.map((r) => [r.lpar.code, r.stage, r.compliance])).toEqual([
			['B', 'planned', null], // compliance is with another package
			['C', 'initiated', null],
			['A', 'installed', 0.5],
			['E', 'superseded', null],
			['D', 'cancelled', null]
		]);
		expect(rolloutRecords([g])[0]).toMatchObject({ lpar: 'B', overdue: 'yes', planned_date: '2026-11-20' });
	});
});
