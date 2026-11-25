/**
 * Package lifecycle (LCM) per LPAR: lpar_package_rollouts.
 *
 *   initiated  "Plan rollout" on the package's Rollout page
 *   planned    a planned date is set
 *   installed  the package is deployed to the LPAR, or assigned as its current package
 *   superseded a later package was installed on the LPAR
 *   cancelled  an initiated/planned rollout was called off (kept for history)
 *
 * Every change writes an audit entry (entity `lpar_package_rollout`).
 */
import type { Prisma } from '@prisma/client';
import { db, createAuditLog } from './db.ts';
import { transactionTimeouts } from './db-dialect.ts';
import { OPEN_STAGES, packageHistoryFromAudit, type RolloutStage } from '#lib/utils/rollout.ts';

type Tx = Prisma.TransactionClient;

/**
 * Record that `packageId` is now installed on these LPARs: their rollout of it becomes
 * installed (created when there was none: deploying needs no plan), and the package
 * previously installed on each LPAR becomes superseded. Call inside the transaction that
 * installs the package.
 */
export async function markInstalled(tx: Tx, lparIds: string[], packageId: string, at = new Date()): Promise<void> {
	if (lparIds.length === 0) return;
	const existing = await tx.lpar_package_rollouts.findMany({
		where: { lpar_id: { in: lparIds }, OR: [{ package_id: packageId }, { stage: 'installed' }] }
	});
	for (const lparId of lparIds) {
		const own = existing.find((r) => r.lpar_id === lparId && r.package_id === packageId);
		if (own?.stage === 'installed') continue; // re-deploying the same package
		const superseded = existing.filter(
			(r) => r.lpar_id === lparId && r.package_id !== packageId && r.stage === 'installed'
		);
		if (superseded.length) {
			await tx.lpar_package_rollouts.updateMany({
				where: { id: { in: superseded.map((r) => r.id) } },
				data: { stage: 'superseded', superseded_at: at }
			});
		}
		const data = { stage: 'installed', installed_at: at, superseded_at: null, cancelled_at: null };
		const row = own
			? await tx.lpar_package_rollouts.update({ where: { id: own.id }, data })
			: await tx.lpar_package_rollouts.create({
					data: { lpar_id: lparId, package_id: packageId, initiated_at: at, ...data }
				});
		await createAuditLog(
			'lpar_package_rollout',
			row.id,
			'update',
			{
				lpar_id: lparId,
				package_id: packageId,
				from: own?.stage ?? null,
				to: 'installed',
				superseded_package_ids: superseded.map((r) => r.package_id)
			},
			undefined,
			tx
		);
	}
}

/**
 * Existing data: every LPAR's current package counts as installed. Creates the missing
 * installed rollouts (dated by the LPAR's latest install, else its last change). Cheap when
 * nothing is missing; called by the pages that show rollouts.
 */
export async function backfillRollouts(): Promise<number> {
	const lpars = await db.lpars.findMany({
		where: { current_package_id: { not: null } },
		select: {
			id: true,
			current_package_id: true,
			updated_at: true,
			rollouts: { where: { stage: 'installed' }, select: { package_id: true } },
			lpar_software: { select: { installed_date: true }, orderBy: { installed_date: 'desc' }, take: 1 }
		}
	});
	const missing = lpars.filter((l) => !l.rollouts.some((r) => r.package_id === l.current_package_id));
	if (missing.length > 0) {
		await db.$transaction(async (tx) => {
			for (const l of missing) {
				await markInstalled(tx, [l.id], l.current_package_id!, l.lpar_software[0]?.installed_date ?? l.updated_at);
			}
		}, transactionTimeouts());
	}
	await importAuditHistory();
	return missing.length;
}

/**
 * Packages LPARs had before the rollouts existed, from the audit log: each earlier package
 * becomes a superseded rollout, and an installed rollout gets the audit's (earlier) install date.
 * Only adds what is missing, so it is safe to run on every call.
 */
export async function importAuditHistory(): Promise<number> {
	const entries = await db.audit_log.findMany({
		where: { entity_type: 'lpar', action: { in: ['create', 'update'] } },
		select: { entity_id: true, action: true, changes: true, timestamp: true }
	});
	const periods = packageHistoryFromAudit(entries);
	if (periods.length === 0) return 0;
	const [rows, lpars, packages] = await Promise.all([
		db.lpar_package_rollouts.findMany({ where: { lpar_id: { in: [...new Set(periods.map((p) => p.lparId))] } } }),
		db.lpars.findMany({ select: { id: true } }),
		db.packages.findMany({ select: { id: true } })
	]);
	const lparIds = new Set(lpars.map((l) => l.id));
	const packageIds = new Set(packages.map((p) => p.id));
	const work: (() => Promise<unknown>)[] = [];
	for (const p of periods) {
		if (!lparIds.has(p.lparId) || !packageIds.has(p.packageId)) continue;
		const row = rows.find((r) => r.lpar_id === p.lparId && r.package_id === p.packageId);
		if (!row) {
			if (!p.until) continue; // still current: backfillRollouts records it
			const data = {
				lpar_id: p.lparId,
				package_id: p.packageId,
				stage: 'superseded',
				initiated_at: p.from,
				installed_at: p.from,
				superseded_at: p.until,
				notes: 'From the audit log'
			};
			rows.push({ ...data, id: '', planned_date: null, cancelled_at: null, created_at: p.from, updated_at: p.from });
			work.push(async () => {
				const created = await db.lpar_package_rollouts.create({ data });
				await createAuditLog('lpar_package_rollout', created.id, 'create', { ...data, source: 'audit_log' });
			});
		} else if ((row.stage === 'installed' || row.stage === 'superseded') && row.installed_at && p.from < row.installed_at) {
			row.installed_at = p.from;
			work.push(() => db.lpar_package_rollouts.update({ where: { id: row.id }, data: { installed_at: p.from } }));
		}
	}
	for (const w of work) await w();
	return work.length;
}

/**
 * Start (or re-open a cancelled) rollout of a package to LPARs, optionally with a planned
 * date. LPARs that already have an open or installed rollout of it are skipped.
 */
export async function planRollouts(
	packageId: string,
	lparIds: string[],
	plannedDate: Date | null,
	notes: string | null
): Promise<{ added: number; skipped: number }> {
	return db.$transaction(async (tx) => {
		const existing = await tx.lpar_package_rollouts.findMany({
			where: { package_id: packageId, lpar_id: { in: lparIds } }
		});
		const stage: RolloutStage = plannedDate ? 'planned' : 'initiated';
		let added = 0;
		for (const lparId of lparIds) {
			const own = existing.find((r) => r.lpar_id === lparId);
			if (own && own.stage !== 'cancelled') continue;
			const data = {
				stage,
				planned_date: plannedDate,
				initiated_at: new Date(),
				cancelled_at: null,
				...(notes ? { notes } : {})
			};
			const row = own
				? await tx.lpar_package_rollouts.update({ where: { id: own.id }, data })
				: await tx.lpar_package_rollouts.create({ data: { lpar_id: lparId, package_id: packageId, ...data } });
			await createAuditLog(
				'lpar_package_rollout',
				row.id,
				own ? 'update' : 'create',
				{ lpar_id: lparId, package_id: packageId, from: own?.stage ?? null, to: stage, planned_date: plannedDate },
				undefined,
				tx
			);
			added++;
		}
		return { added, skipped: lparIds.length - added };
	}, transactionTimeouts());
}

export class RolloutError extends Error {}

/** Change open rollouts: set/clear the planned date, the note, or cancel them. */
export async function updateRollouts(
	packageId: string,
	ids: string[],
	change: { plannedDate?: Date | null; notes?: string | null; cancel?: boolean }
): Promise<number> {
	return db.$transaction(async (tx) => {
		const rows = await tx.lpar_package_rollouts.findMany({ where: { id: { in: ids }, package_id: packageId } });
		const open = rows.filter((r) => (OPEN_STAGES as string[]).includes(r.stage));
		if (open.length === 0) throw new RolloutError('Only initiated or planned rollouts can be changed');
		for (const r of open) {
			const data: Prisma.lpar_package_rolloutsUpdateInput = {};
			if (change.cancel) {
				data.stage = 'cancelled';
				data.cancelled_at = new Date();
			} else if (change.plannedDate !== undefined) {
				data.planned_date = change.plannedDate;
				data.stage = change.plannedDate ? 'planned' : 'initiated';
			}
			if (change.notes !== undefined) data.notes = change.notes;
			await tx.lpar_package_rollouts.update({ where: { id: r.id }, data });
			await createAuditLog(
				'lpar_package_rollout',
				r.id,
				'update',
				{ lpar_id: r.lpar_id, package_id: packageId, from: r.stage, to: data.stage ?? r.stage, ...change },
				undefined,
				tx
			);
		}
		return open.length;
	}, transactionTimeouts());
}
