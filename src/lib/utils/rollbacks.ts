/**
 * Rollback reports: quality record per product over a period (V4) and open rollbacks (L5).
 * Pure functions; the queries are in #lib/server/reports.ts.
 */
import type { BaseCustomer } from './vendor-base.ts';

/** Open rollbacks older than this many days are flagged */
export const OPEN_ROLLBACK_FLAG_DAYS = 30;

export interface RollbackLpar {
	id: string;
	code: string;
	customer: BaseCustomer;
}
export interface RollbackSoftware {
	id: string;
	name: string;
	vendor: { id: string; code: string; name: string };
}

/** One rollback event (from the audit log, or the LPAR's install record) */
export interface RollbackEvent {
	lpar_id: string;
	software_id: string;
	at: Date;
	from_version: string | null;
	from_ptf: string | null;
	to_version: string | null;
	to_ptf: string | null;
	reason: string | null;
}

/**
 * Rollback events from audit log entries plus install records, without counting one rollback
 * twice: an install record's rollback is dropped when the audit log has the same LPAR and product
 * within a minute of it.
 */
export function mergeRollbackEvents(audit: RollbackEvent[], installs: RollbackEvent[]): RollbackEvent[] {
	const extra = installs.filter(
		(i) =>
			!audit.some(
				(a) =>
					a.lpar_id === i.lpar_id &&
					a.software_id === i.software_id &&
					Math.abs(a.at.getTime() - i.at.getTime()) < 60_000
			)
	);
	return [...audit, ...extra].sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** The software id etc. from an audit entry's `changes` JSON; null when it is not a rollback. */
export function auditRollback(
	entry: { entity_id: string; timestamp: Date; changes: unknown }
): RollbackEvent | null {
	const c = entry.changes as Record<string, unknown> | null;
	if (!c || typeof c !== 'object' || typeof c.software_id !== 'string') return null;
	const text = (v: unknown) => (typeof v === 'string' && v ? v : null);
	return {
		lpar_id: entry.entity_id,
		software_id: c.software_id,
		at: entry.timestamp,
		from_version: text(c.from_version),
		from_ptf: text(c.from_ptf),
		to_version: text(c.to_version),
		to_ptf: text(c.to_ptf),
		reason: text(c.reason)
	};
}

export interface QualityEvent extends RollbackEvent {
	lpar: RollbackLpar;
}
export interface QualityRow {
	software: RollbackSoftware;
	rollbacks: number;
	lparCount: number;
	customerCount: number;
	latest: Date;
	events: QualityEvent[];
}
export interface QualityReport {
	rows: QualityRow[];
	totals: { rollbacks: number; products: number; lpars: number };
}

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/** V4: rollbacks per product, most rollbacks first. Events outside the given LPARs/software are skipped. */
export function buildQuality(input: {
	lpars: RollbackLpar[];
	software: RollbackSoftware[];
	events: RollbackEvent[];
}): QualityReport {
	const lparById = new Map(input.lpars.map((l) => [l.id, l]));
	const softwareById = new Map(input.software.map((s) => [s.id, s]));
	const groups = new Map<string, QualityEvent[]>();
	const lpars = new Set<string>();
	for (const e of input.events) {
		const lpar = lparById.get(e.lpar_id);
		if (!lpar || !softwareById.has(e.software_id)) continue;
		const list = groups.get(e.software_id) ?? [];
		list.push({ ...e, lpar });
		groups.set(e.software_id, list);
		lpars.add(lpar.id);
	}
	const rows: QualityRow[] = [...groups.entries()].map(([softwareId, events]) => {
		events.sort((a, b) => b.at.getTime() - a.at.getTime());
		return {
			software: softwareById.get(softwareId)!,
			rollbacks: events.length,
			lparCount: new Set(events.map((e) => e.lpar.id)).size,
			customerCount: new Set(events.map((e) => e.lpar.customer.id)).size,
			latest: events[0].at,
			events
		};
	});
	rows.sort(
		(a, b) =>
			b.rollbacks - a.rollbacks ||
			b.latest.getTime() - a.latest.getTime() ||
			byText(a.software.name, b.software.name)
	);
	return {
		rows,
		totals: { rollbacks: rows.reduce((n, r) => n + r.rollbacks, 0), products: rows.length, lpars: lpars.size }
	};
}

export const QUALITY_CSV_COLUMNS = [
	'vendor',
	'product',
	'rolled_back_at',
	'customer',
	'customer_code',
	'lpar',
	'from_version',
	'from_ptf_level',
	'to_version',
	'to_ptf_level',
	'reason'
] as const;

/** One record per rollback. */
export function qualityRecords(report: QualityReport): Record<(typeof QUALITY_CSV_COLUMNS)[number], string>[] {
	return report.rows.flatMap((row) =>
		row.events.map((e) => ({
			vendor: row.software.vendor.name,
			product: row.software.name,
			rolled_back_at: e.at.toISOString().slice(0, 10),
			customer: e.lpar.customer.name,
			customer_code: e.lpar.customer.code,
			lpar: e.lpar.code,
			from_version: e.from_version ?? '',
			from_ptf_level: e.from_ptf ?? '',
			to_version: e.to_version ?? '',
			to_ptf_level: e.to_ptf ?? '',
			reason: e.reason ?? ''
		}))
	);
}

/** L5: an install that is still rolled back */
export interface OpenRollback {
	lpar: RollbackLpar;
	software: RollbackSoftware;
	at: Date | null;
	ageDays: number | null;
	flagged: boolean;
	/** The version it was rolled back from (not reapplied yet) */
	from_version: string | null;
	from_ptf: string | null;
	/** The version running now */
	to_version: string;
	to_ptf: string | null;
	reason: string | null;
}

const DAY = 86_400_000;

export function buildOpenRollbacks(
	input: {
		lpars: RollbackLpar[];
		software: RollbackSoftware[];
		installs: {
			lpar_id: string;
			software_id: string;
			current_version: string;
			current_ptf_level: string | null;
			previous_version: string | null;
			previous_ptf_level: string | null;
			rolled_back_at: Date | null;
			rollback_reason: string | null;
		}[];
	},
	today = new Date()
): OpenRollback[] {
	const lparById = new Map(input.lpars.map((l) => [l.id, l]));
	const softwareById = new Map(input.software.map((s) => [s.id, s]));
	const rows: OpenRollback[] = [];
	for (const i of input.installs) {
		const lpar = lparById.get(i.lpar_id);
		const software = softwareById.get(i.software_id);
		if (!lpar || !software) continue;
		const ageDays = i.rolled_back_at ? Math.floor((today.getTime() - i.rolled_back_at.getTime()) / DAY) : null;
		rows.push({
			lpar,
			software,
			at: i.rolled_back_at,
			ageDays,
			flagged: ageDays === null || ageDays > OPEN_ROLLBACK_FLAG_DAYS,
			from_version: i.previous_version,
			from_ptf: i.previous_ptf_level,
			to_version: i.current_version,
			to_ptf: i.current_ptf_level,
			reason: i.rollback_reason
		});
	}
	// Oldest first; unknown dates first of all
	return rows.sort(
		(a, b) =>
			(a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0) ||
			byText(a.lpar.customer.name, b.lpar.customer.name) ||
			byText(a.lpar.code, b.lpar.code) ||
			byText(a.software.name, b.software.name)
	);
}

export const OPEN_ROLLBACK_CSV_COLUMNS = [
	'rolled_back_at',
	'age_days',
	'customer',
	'customer_code',
	'lpar',
	'vendor',
	'product',
	'rolled_back_from_version',
	'rolled_back_from_ptf_level',
	'running_version',
	'running_ptf_level',
	'reason'
] as const;

export function openRollbackRecords(rows: OpenRollback[]): Record<(typeof OPEN_ROLLBACK_CSV_COLUMNS)[number], string>[] {
	return rows.map((r) => ({
		rolled_back_at: r.at?.toISOString().slice(0, 10) ?? '',
		age_days: r.ageDays === null ? '' : String(r.ageDays),
		customer: r.lpar.customer.name,
		customer_code: r.lpar.customer.code,
		lpar: r.lpar.code,
		vendor: r.software.vendor.name,
		product: r.software.name,
		rolled_back_from_version: r.from_version ?? '',
		rolled_back_from_ptf_level: r.from_ptf ?? '',
		running_version: r.to_version,
		running_ptf_level: r.to_ptf ?? '',
		reason: r.reason ?? ''
	}));
}
