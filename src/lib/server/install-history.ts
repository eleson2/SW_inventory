/**
 * Install history (D2): writes lpar_software_history. Every change to lpar_software calls
 * recordInstallChanges() in the same transaction, so the history cannot drift from the current
 * state. Installs from before the history existed are rebuilt (reconstructed = true) the first
 * time they change, or by backfillInstallHistory().
 */
import type { Prisma } from '@prisma/client';
import { db } from './db.ts';
import { auditRollback } from '#lib/utils/rollbacks.ts';
import {
	classifyChange,
	pairKey,
	reconstructEvents,
	type AuditRollback,
	type CurrentInstall,
	type HistorySource,
	type VersionPair
} from '#lib/utils/install-history.ts';

type Client = Prisma.TransactionClient;

export interface InstallChange {
	lpar_id: string;
	software_id: string;
	/** The lpar_software row before the change; null when the product was not installed */
	before: CurrentInstall | null;
	/** The version after the change; null when the product was removed */
	to: VersionPair | null;
	/** When it took effect (default now); never earlier than the pair's last event */
	at?: Date | null;
	rollback?: boolean;
	reason?: string | null;
}

/** Audit-log rollbacks per LPAR x product, for rebuilding history */
async function loadAuditRollbacks(client: Client, lparIds: string[]): Promise<Map<string, AuditRollback[]>> {
	const map = new Map<string, AuditRollback[]>();
	if (lparIds.length === 0) return map;
	const entries = await client.audit_log.findMany({
		where: { entity_type: 'lpar_software', action: 'rollback', entity_id: { in: lparIds } },
		select: { entity_id: true, timestamp: true, changes: true }
	});
	for (const entry of entries) {
		const r = auditRollback(entry);
		if (!r) continue;
		const key = pairKey(r.lpar_id, r.software_id);
		map.set(key, [...(map.get(key) ?? []), r]);
	}
	return map;
}

/** Write the rebuilt history of installs that have none yet; returns the last event time per pair */
async function writeReconstructed(client: Client, rows: CurrentInstall[]): Promise<Map<string, Date>> {
	const latest = new Map<string, Date>();
	if (rows.length === 0) return latest;
	const audits = await loadAuditRollbacks(client, [...new Set(rows.map((r) => r.lpar_id))]);
	const data = rows.flatMap((row) => {
		const key = pairKey(row.lpar_id, row.software_id);
		const events = reconstructEvents(row, audits.get(key));
		latest.set(key, events[events.length - 1].occurred_at);
		return events.map((e) => ({ ...e, lpar_id: row.lpar_id, software_id: row.software_id }));
	});
	await client.lpar_software_history.createMany({ data });
	return latest;
}

/**
 * Record changes to installed software. Call in the transaction that changes lpar_software,
 * with each row as it was before. Changes that change nothing are skipped.
 */
export async function recordInstallChanges(
	client: Client,
	changes: InstallChange[],
	source: HistorySource,
	packageId: string | null = null
): Promise<number> {
	const real = changes.flatMap((c) => {
		const before = c.before ? { version: c.before.current_version, ptf_level: c.before.current_ptf_level } : null;
		const event = c.rollback ? 'rollback' : classifyChange(before, c.to);
		return event ? [{ ...c, event, from: before }] : [];
	});
	if (real.length === 0) return 0;

	const lparIds = [...new Set(real.map((c) => c.lpar_id))];
	const softwareIds = [...new Set(real.map((c) => c.software_id))];
	const existing = await client.lpar_software_history.findMany({
		where: { lpar_id: { in: lparIds }, software_id: { in: softwareIds } },
		select: { lpar_id: true, software_id: true, occurred_at: true }
	});
	const latest = new Map<string, Date>();
	for (const e of existing) {
		const key = pairKey(e.lpar_id, e.software_id);
		if (!latest.has(key) || latest.get(key)! < e.occurred_at) latest.set(key, e.occurred_at);
	}

	// Installs from before the history: rebuild what led to the current version first
	const unrecorded = real.filter((c) => c.before && !latest.has(pairKey(c.lpar_id, c.software_id))).map((c) => c.before!);
	for (const [key, at] of await writeReconstructed(client, unrecorded)) latest.set(key, at);

	const now = new Date();
	await client.lpar_software_history.createMany({
		data: real.map((c) => {
			const last = latest.get(pairKey(c.lpar_id, c.software_id));
			let at = c.at ?? now;
			if (last && at <= last) at = new Date(Math.max(now.getTime(), last.getTime() + 1));
			return {
				lpar_id: c.lpar_id,
				software_id: c.software_id,
				event: c.event,
				from_version: c.from?.version ?? null,
				from_ptf_level: c.from?.ptf_level || null,
				to_version: c.to?.version ?? null,
				to_ptf_level: c.to?.ptf_level || null,
				occurred_at: at,
				source,
				package_id: packageId,
				reason: c.reason ?? null
			};
		})
	});
	return real.length;
}

/**
 * Rebuild the history of every current install that has none (existing data, seeds, imports
 * from before D2). Cheap when nothing is missing; called by the pages that show history.
 */
export async function backfillInstallHistory(): Promise<number> {
	const [installs, recorded] = await Promise.all([
		db.lpar_software.findMany(),
		db.lpar_software_history.groupBy({ by: ['lpar_id', 'software_id'] })
	]);
	const have = new Set(recorded.map((r) => pairKey(r.lpar_id, r.software_id)));
	const missing = installs.filter((i) => !have.has(pairKey(i.lpar_id, i.software_id)));
	if (missing.length === 0) return 0;
	return (await writeReconstructed(db, missing)).size;
}
