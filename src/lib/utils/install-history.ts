/**
 * Install history (D2): pure logic for lpar_software_history events. Recording is in
 * #lib/server/install-history.ts; replaying events up to a date gives what each LPAR had then.
 */
import { compareVersions } from './version-parser.ts';

export const HISTORY_EVENTS = ['install', 'upgrade', 'downgrade', 'ptf', 'rollback', 'remove'] as const;
export type HistoryEvent = (typeof HISTORY_EVENTS)[number];

export const HISTORY_SOURCES = ['deploy', 'rollback', 'lpar_edit', 'import', 'clone', 'backfill'] as const;
export type HistorySource = (typeof HISTORY_SOURCES)[number];

export const EVENT_LABEL: Record<HistoryEvent, string> = {
	install: 'Installed',
	upgrade: 'Upgraded',
	downgrade: 'Downgraded',
	ptf: 'PTF level',
	rollback: 'Rolled back',
	remove: 'Removed'
};

export const SOURCE_LABEL: Record<HistorySource, string> = {
	deploy: 'Package deploy',
	rollback: 'Rollback',
	lpar_edit: 'LPAR edit',
	import: 'Import',
	clone: 'LPAR clone',
	backfill: 'Rebuilt'
};

export interface VersionPair {
	version: string;
	ptf_level: string | null;
}

export interface HistoryRow {
	lpar_id: string;
	software_id: string;
	event: string;
	from_version: string | null;
	from_ptf_level: string | null;
	to_version: string | null;
	to_ptf_level: string | null;
	occurred_at: Date;
	source: string;
	package_id: string | null;
	reason: string | null;
	reconstructed: boolean;
}

const ptf = (p: string | null | undefined) => p || null;
export const pairKey = (lparId: string, softwareId: string) => `${lparId}|${softwareId}`;

/**
 * The event for a change from `from` to `to` (null = not installed), or null when nothing
 * changed. Same release with another PTF level = `ptf`; rollbacks are flagged by the caller.
 */
export function classifyChange(from: VersionPair | null, to: VersionPair | null): HistoryEvent | null {
	if (!from && !to) return null;
	if (!from) return 'install';
	if (!to) return 'remove';
	if (from.version === to.version && ptf(from.ptf_level) === ptf(to.ptf_level)) return null;
	const release = compareVersions(to.version, from.version);
	if (release !== 0) return release > 0 ? 'upgrade' : 'downgrade';
	// Same release (possibly spelled differently, "6.1" vs "V6R1M0"): only the PTF level counts
	return ptf(from.ptf_level) === ptf(to.ptf_level) ? null : 'ptf';
}

/** Oldest first (stable, so equal times keep their insert order) */
function byTime(a: { occurred_at: Date }, b: { occurred_at: Date }) {
	return a.occurred_at.getTime() - b.occurred_at.getTime();
}

/**
 * What every LPAR had installed at `at` (inclusive): the last event per LPAR x product at or
 * before that moment; `remove` means not installed. Key: pairKey(lpar, software).
 */
export function stateAt(events: HistoryRow[], at: Date = new Date(8.64e15)): Map<string, VersionPair> {
	const last = new Map<string, HistoryRow>();
	for (const e of [...events].sort(byTime)) {
		if (e.occurred_at > at) continue;
		last.set(pairKey(e.lpar_id, e.software_id), e);
	}
	const state = new Map<string, VersionPair>();
	for (const [key, e] of last) {
		if (e.to_version) state.set(key, { version: e.to_version, ptf_level: ptf(e.to_ptf_level) });
	}
	return state;
}

export interface CurrentInstall {
	lpar_id: string;
	software_id: string;
	current_version: string;
	current_ptf_level: string | null;
	previous_version: string | null;
	previous_ptf_level: string | null;
	installed_date: Date | null;
	rolled_back: boolean;
	rolled_back_at: Date | null;
	rollback_reason: string | null;
}

export interface AuditRollback {
	at: Date;
	from_version: string | null;
	from_ptf: string | null;
	to_version: string | null;
	to_ptf: string | null;
	reason: string | null;
}

type NewEvent = Omit<HistoryRow, 'lpar_id' | 'software_id'>;

/**
 * Rebuild the history of one current install from what was recorded before the history
 * existed: its install date, its previous version, its rollback state and rollbacks in the
 * audit log. Every event is marked reconstructed; the last one always ends at the current version.
 */
export function reconstructEvents(row: CurrentInstall, auditRollbacks: AuditRollback[] = [], fallbackAt = new Date()): NewEvent[] {
	const current = { version: row.current_version, ptf_level: ptf(row.current_ptf_level) };
	// A previous version equal to the current one (seen in older data) tells nothing
	const recorded = row.previous_version ? { version: row.previous_version, ptf_level: ptf(row.previous_ptf_level) } : null;
	const previous = recorded && classifyChange(recorded, current) ? recorded : null;
	const installedAt = row.installed_date ?? fallbackAt;
	const base = { source: 'backfill', package_id: null, reconstructed: true };
	const events: NewEvent[] = [];
	const rollback = (r: AuditRollback): NewEvent => ({
		...base,
		event: 'rollback',
		from_version: r.from_version,
		from_ptf_level: ptf(r.from_ptf),
		to_version: r.to_version,
		to_ptf_level: ptf(r.to_ptf),
		occurred_at: r.at,
		reason: r.reason
	});

	if (row.rolled_back && row.rolled_back_at && previous) {
		// Installed the previous version, then rolled back to the current one
		if (installedAt < row.rolled_back_at) {
			events.push({
				...base,
				event: 'install',
				from_version: null,
				from_ptf_level: null,
				to_version: previous.version,
				to_ptf_level: previous.ptf_level,
				occurred_at: installedAt,
				reason: null
			});
		}
		events.push(
			rollback({
				at: row.rolled_back_at,
				from_version: previous.version,
				from_ptf: previous.ptf_level,
				to_version: current.version,
				to_ptf: current.ptf_level,
				reason: row.rollback_reason
			})
		);
	} else {
		events.push({
			...base,
			event: (previous && classifyChange(previous, current)) || 'install',
			from_version: previous?.version ?? null,
			from_ptf_level: previous?.ptf_level ?? null,
			to_version: current.version,
			to_ptf_level: current.ptf_level,
			occurred_at: installedAt,
			reason: null
		});
	}

	// Earlier rollbacks from the audit log (the latest one is already in the row)
	const known = new Set(events.map((e) => e.occurred_at.getTime()));
	const earliest = Math.min(...events.map((e) => e.occurred_at.getTime()));
	for (const r of auditRollbacks) {
		const t = r.at.getTime();
		if (t < earliest && ![...known].some((k) => Math.abs(k - t) < 60_000)) events.push(rollback(r));
	}
	events.sort(byTime);

	const last = events[events.length - 1];
	if (last.to_version !== current.version || ptf(last.to_ptf_level) !== current.ptf_level) {
		events.push({
			...base,
			event: classifyChange({ version: last.to_version ?? '', ptf_level: last.to_ptf_level }, current) ?? 'install',
			from_version: last.to_version,
			from_ptf_level: last.to_ptf_level,
			to_version: current.version,
			to_ptf_level: current.ptf_level,
			occurred_at: new Date(Math.max(last.occurred_at.getTime() + 1, installedAt.getTime())),
			reason: null
		});
	}
	return events;
}

/** "V6R1M0 UI12345" */
export function versionText(version: string | null, ptfLevel: string | null): string {
	return version ? [version, ptfLevel].filter(Boolean).join(' ') : '';
}
