/**
 * Package lifecycle per LPAR (lpar_package_rollouts): planning, installing on deploy,
 * superseding, cancelling and the backfill of existing package assignments.
 */
import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import { testDb, cleanupTestDatabase, seedTestData, disconnectTestDatabase } from '../../prisma/test-helpers';

vi.mock('../../src/lib/server/db.ts', async () => {
	const { testDb } = await import('../../prisma/test-helpers');
	return { db: testDb, createAuditLog: async () => {} };
});

const { markInstalled, planRollouts, updateRollouts, backfillRollouts, importAuditHistory, RolloutError } = await import(
	'../../src/lib/server/rollouts.ts'
);

describe('Package rollouts', () => {
	let lparA: { id: string };
	let lparB: { id: string };
	let q1: { id: string };
	let q2: { id: string };

	const stages = async (packageId: string) =>
		Object.fromEntries(
			(await testDb.lpar_package_rollouts.findMany({ where: { package_id: packageId } })).map((r) => [r.lpar_id, r.stage])
		);

	afterAll(async () => {
		await disconnectTestDatabase();
	});

	beforeEach(async () => {
		await cleanupTestDatabase();
		const data = await seedTestData();
		const pkg = (code: string, date: string) =>
			testDb.packages.create({ data: { code, name: code, version: '1.0', release_date: new Date(date) } });
		q1 = await pkg('Q1', '2026-01-01');
		q2 = await pkg('Q2', '2026-04-01');
		const lpar = (code: string, current_package_id: string | null) =>
			testDb.lpars.create({ data: { code, name: code, customer_id: data.customers.acme.id, current_package_id } });
		lparA = await lpar('A', q1.id);
		lparB = await lpar('B', null);
	});

	it('backfills the current package as installed, once', async () => {
		expect(await backfillRollouts()).toBe(1);
		expect(await stages(q1.id)).toEqual({ [lparA.id]: 'installed' });
		expect(await backfillRollouts()).toBe(0);
	});

	it('plans, dates, installs and supersedes', async () => {
		await backfillRollouts();
		const plan = await planRollouts(q2.id, [lparA.id, lparB.id], null, 'CHG1');
		expect(plan).toEqual({ added: 2, skipped: 0 });
		expect(await stages(q2.id)).toEqual({ [lparA.id]: 'initiated', [lparB.id]: 'initiated' });
		expect(await planRollouts(q2.id, [lparA.id], null, null)).toEqual({ added: 0, skipped: 1 });

		const ids = (await testDb.lpar_package_rollouts.findMany({ where: { package_id: q2.id } })).map((r) => r.id);
		await updateRollouts(q2.id, ids, { plannedDate: new Date('2026-12-01') });
		expect(Object.values(await stages(q2.id))).toEqual(['planned', 'planned']);

		await testDb.$transaction((tx) => markInstalled(tx, [lparA.id], q2.id));
		expect(await stages(q2.id)).toEqual({ [lparA.id]: 'installed', [lparB.id]: 'planned' });
		expect(await stages(q1.id)).toEqual({ [lparA.id]: 'superseded' });

		// An installed rollout can no longer be changed
		const installed = (await testDb.lpar_package_rollouts.findFirst({ where: { package_id: q2.id, lpar_id: lparA.id } }))!;
		await expect(updateRollouts(q2.id, [installed.id], { cancel: true })).rejects.toThrow(RolloutError);
	});

	it('deploys without a plan, and re-opens a cancelled rollout', async () => {
		await testDb.$transaction((tx) => markInstalled(tx, [lparB.id], q1.id));
		expect(await stages(q1.id)).toEqual({ [lparB.id]: 'installed' });

		await planRollouts(q2.id, [lparB.id], new Date('2026-12-01'), null);
		const r = (await testDb.lpar_package_rollouts.findFirst({ where: { package_id: q2.id } }))!;
		await updateRollouts(q2.id, [r.id], { cancel: true });
		expect(await stages(q2.id)).toEqual({ [lparB.id]: 'cancelled' });
		expect(await planRollouts(q2.id, [lparB.id], null, null)).toEqual({ added: 1, skipped: 0 });
		expect(await stages(q2.id)).toEqual({ [lparB.id]: 'initiated' });
	});
	it('imports earlier packages from the audit log as superseded, once', async () => {
		await testDb.audit_log.createMany({
			data: [
				{ entity_type: 'lpar', entity_id: lparA.id, action: 'update', changes: { action: 'package_deployment', package_id: q2.id, deployed_at: '2025-05-01T00:00:00Z' }, timestamp: new Date('2025-05-01') },
				{ entity_type: 'lpar', entity_id: lparA.id, action: 'update', changes: { before: { current_package_id: q2.id }, after: { current_package_id: q1.id } }, timestamp: new Date('2025-09-01') }
			]
		});
		await backfillRollouts(); // A's current package q1 + history
		const rows = await testDb.lpar_package_rollouts.findMany({ where: { lpar_id: lparA.id }, orderBy: { installed_at: 'asc' } });
		expect(rows.map((r) => [r.package_id, r.stage, r.installed_at?.toISOString().slice(0, 10), r.superseded_at?.toISOString().slice(0, 10) ?? null])).toEqual([
			[q2.id, 'superseded', '2025-05-01', '2025-09-01'],
			[q1.id, 'installed', '2025-09-01', null]
		]);
		expect(await importAuditHistory()).toBe(0);
	});
});
