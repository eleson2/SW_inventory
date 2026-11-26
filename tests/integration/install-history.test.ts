/**
 * Install history (D2): recording changes, rebuilding history from before it existed, and
 * replaying the history to the current lpar_software state.
 */
import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import { testDb, cleanupTestDatabase, seedTestData, disconnectTestDatabase } from '../../prisma/test-helpers';
import { pairKey, stateAt } from '../../src/lib/utils/install-history.ts';

vi.mock('../../src/lib/server/db.ts', async () => {
	const { testDb } = await import('../../prisma/test-helpers');
	return { db: testDb, createAuditLog: async () => {} };
});

const { recordInstallChanges, backfillInstallHistory } = await import('../../src/lib/server/install-history.ts');

describe('Install history', () => {
	let lparA: { id: string };
	let lparB: { id: string };
	let cics: { id: string };
	let db2: { id: string };

	afterAll(async () => {
		await disconnectTestDatabase();
	});

	beforeEach(async () => {
		await cleanupTestDatabase();
		const data = await seedTestData();
		cics = data.software.cics;
		db2 = await testDb.software.create({ data: { name: 'Db2', vendor_id: data.vendors.ibm.id } });
		const lpar = (code: string) => testDb.lpars.create({ data: { code, name: code, customer_id: data.customers.acme.id } });
		lparA = await lpar('A');
		lparB = await lpar('B');
		// Installs from before the history existed
		await testDb.lpar_software.createMany({
			data: [
				{
					lpar_id: lparA.id,
					software_id: cics.id,
					current_version: 'V6R1M0',
					current_ptf_level: 'UI1',
					previous_version: 'V5R6M0',
					installed_date: new Date('2025-01-10')
				},
				{ lpar_id: lparA.id, software_id: db2.id, current_version: 'V13R1M0', installed_date: new Date('2025-02-01') },
				{ lpar_id: lparB.id, software_id: cics.id, current_version: 'V5R6M0', installed_date: new Date('2024-11-01') }
			]
		});
	});

	const row = (lpar_id: string, software_id: string) =>
		testDb.lpar_software.findUniqueOrThrow({ where: { lpar_id_software_id: { lpar_id, software_id } } });

	/** The history replayed to now must equal lpar_software exactly */
	async function expectReplayMatchesCurrent() {
		const [events, installs] = await Promise.all([testDb.lpar_software_history.findMany(), testDb.lpar_software.findMany()]);
		const replayed = Object.fromEntries([...stateAt(events)].map(([k, v]) => [k, `${v.version} ${v.ptf_level ?? ''}`]));
		const current = Object.fromEntries(
			installs.map((i) => [pairKey(i.lpar_id, i.software_id), `${i.current_version} ${i.current_ptf_level ?? ''}`])
		);
		expect(replayed).toEqual(current);
	}

	it('records changes, rebuilding earlier history first, and replays to the current state', async () => {
		// A PTF change on CICS (no history yet: the earlier upgrade is rebuilt first)
		const before = await row(lparA.id, cics.id);
		await testDb.$transaction(async (tx) => {
			await tx.lpar_software.update({ where: { id: before.id }, data: { current_ptf_level: 'UI2' } });
			await recordInstallChanges(tx, [
				{ lpar_id: lparA.id, software_id: cics.id, before, to: { version: 'V6R1M0', ptf_level: 'UI2' } }
			], 'deploy');
		});
		// Db2 removed, and a no-op change that must not be recorded
		const db2Row = await row(lparA.id, db2.id);
		await testDb.lpar_software.delete({ where: { id: db2Row.id } });
		const bRow = await row(lparB.id, cics.id);
		expect(
			await recordInstallChanges(
				testDb,
				[
					{ lpar_id: lparA.id, software_id: db2.id, before: db2Row, to: null },
					{ lpar_id: lparB.id, software_id: cics.id, before: bRow, to: { version: 'V5R6M0', ptf_level: null } }
				],
				'lpar_edit'
			)
		).toBe(1);

		const historyA = await testDb.lpar_software_history.findMany({
			where: { lpar_id: lparA.id },
			orderBy: { occurred_at: 'asc' }
		});
		expect(historyA.map((e) => [e.event, e.to_version, e.to_ptf_level, e.reconstructed])).toEqual([
			['upgrade', 'V6R1M0', 'UI1', true],
			['install', 'V13R1M0', null, true],
			['ptf', 'V6R1M0', 'UI2', false],
			['remove', null, null, false]
		]);

		// LPAR B's CICS had no change yet: the backfill rebuilds it, once
		expect(await backfillInstallHistory()).toBe(1);
		expect(await backfillInstallHistory()).toBe(0);
		await expectReplayMatchesCurrent();

		// What LPAR A had in mid-January 2025: CICS before the PTF change, no Db2 yet
		const january = stateAt(await testDb.lpar_software_history.findMany(), new Date('2025-01-15'));
		expect(january.get(pairKey(lparA.id, cics.id))).toEqual({ version: 'V6R1M0', ptf_level: 'UI1' });
		expect(january.has(pairKey(lparA.id, db2.id))).toBe(false);
	});

	it('never dates a change before the last recorded event', async () => {
		await backfillInstallHistory();
		const before = await row(lparB.id, cics.id);
		await testDb.lpar_software.update({ where: { id: before.id }, data: { current_version: 'V6R1M0' } });
		await recordInstallChanges(testDb, [
			{ lpar_id: lparB.id, software_id: cics.id, before, to: { version: 'V6R1M0', ptf_level: null }, at: new Date('2020-01-01') }
		], 'lpar_edit');
		const last = await testDb.lpar_software_history.findFirstOrThrow({
			where: { lpar_id: lparB.id },
			orderBy: { occurred_at: 'desc' }
		});
		expect(last.event).toBe('upgrade');
		expect(last.occurred_at > new Date('2024-11-01')).toBe(true);
		await expectReplayMatchesCurrent();
	});
});
