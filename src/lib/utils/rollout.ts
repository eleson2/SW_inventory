/**
 * Package lifecycle (LCM) per LPAR and rollout progress (report L3). Pure functions; the
 * database side is in #lib/server/rollouts.ts.
 *
 *   initiated -> planned -> installed -> superseded      (or cancelled before installing)
 */

export const ROLLOUT_STAGES = ['initiated', 'planned', 'installed', 'superseded', 'cancelled'] as const;
export type RolloutStage = (typeof ROLLOUT_STAGES)[number];

export const STAGE_LABEL: Record<RolloutStage, string> = {
	initiated: 'Initiated',
	planned: 'Planned',
	installed: 'Installed',
	superseded: 'Superseded',
	cancelled: 'Cancelled'
};

/** Stages that still lead to an install */
export const OPEN_STAGES: RolloutStage[] = ['initiated', 'planned'];

export function isStage(value: string): value is RolloutStage {
	return (ROLLOUT_STAGES as readonly string[]).includes(value);
}

/** A planned rollout whose date has passed without an install */
export function isOverdue(r: { stage: string; planned_date: Date | null }, today: Date): boolean {
	return r.stage === 'planned' && !!r.planned_date && r.planned_date.getTime() < startOfDay(today).getTime();
}

function startOfDay(d: Date) {
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export interface RolloutLpar {
	id: string;
	code: string;
	name: string;
	customer: { id: string; code: string; name: string };
}
export interface RolloutPackage {
	id: string;
	code: string;
	name: string;
	version: string;
	release_date: Date;
}
export interface RolloutRecord {
	id: string;
	lpar_id: string;
	package_id: string;
	stage: string;
	planned_date: Date | null;
	initiated_at: Date;
	installed_at: Date | null;
	superseded_at: Date | null;
	cancelled_at: Date | null;
	notes: string | null;
}

export interface RolloutRow extends RolloutRecord {
	stage: RolloutStage;
	lpar: RolloutLpar;
	overdue: boolean;
	/** Package compliance (L2) of the LPAR, when this package is its current one; 0..1 */
	compliance: number | null;
}
export interface RolloutGroup {
	package: RolloutPackage;
	counts: Record<RolloutStage, number>;
	/** Installed (or superseded since) / all targets that are not cancelled; 0..1 */
	progress: number | null;
	overdue: number;
	rows: RolloutRow[];
}

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
const ORDER: Record<RolloutStage, number> = { planned: 0, initiated: 1, installed: 2, superseded: 3, cancelled: 4 };

/** L3: rollouts grouped per package (newest package first), rows by stage then date. */
export function buildRolloutReport(
	input: {
		packages: RolloutPackage[];
		lpars: RolloutLpar[];
		rollouts: RolloutRecord[];
		/** LPAR id -> compliance with its current package (0..1, null = nothing to compare) */
		compliance: Map<string, { packageId: string | null; value: number | null }>;
	},
	today = new Date()
): RolloutGroup[] {
	const lparById = new Map(input.lpars.map((l) => [l.id, l]));
	const groups = new Map<string, RolloutGroup>();
	for (const pkg of input.packages) {
		groups.set(pkg.id, {
			package: pkg,
			counts: Object.fromEntries(ROLLOUT_STAGES.map((s) => [s, 0])) as Record<RolloutStage, number>,
			progress: null,
			overdue: 0,
			rows: []
		});
	}
	for (const r of input.rollouts) {
		const group = groups.get(r.package_id);
		const lpar = lparById.get(r.lpar_id);
		if (!group || !lpar || !isStage(r.stage)) continue;
		const c = input.compliance.get(lpar.id);
		const row: RolloutRow = {
			...r,
			stage: r.stage,
			lpar,
			overdue: isOverdue(r, today),
			compliance: c && c.packageId === r.package_id ? c.value : null
		};
		group.rows.push(row);
		group.counts[row.stage]++;
		if (row.overdue) group.overdue++;
	}
	const result = [...groups.values()].filter((g) => g.rows.length > 0);
	for (const g of result) {
		const targets = g.rows.length - g.counts.cancelled;
		g.progress = targets ? (g.counts.installed + g.counts.superseded) / targets : null;
		g.rows.sort(
			(a, b) =>
				ORDER[a.stage] - ORDER[b.stage] ||
				(a.planned_date?.getTime() ?? Infinity) - (b.planned_date?.getTime() ?? Infinity) ||
				byText(a.lpar.customer.name, b.lpar.customer.name) ||
				byText(a.lpar.code, b.lpar.code)
		);
	}
	return result.sort(
		(a, b) => b.package.release_date.getTime() - a.package.release_date.getTime() || byText(a.package.code, b.package.code)
	);
}

export const ROLLOUT_CSV_COLUMNS = [
	'package',
	'package_version',
	'customer',
	'customer_code',
	'lpar',
	'stage',
	'planned_date',
	'overdue',
	'installed_at',
	'superseded_at',
	'cancelled_at',
	'compliance_pct',
	'notes'
] as const;

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

export function rolloutRecords(groups: RolloutGroup[]): Record<(typeof ROLLOUT_CSV_COLUMNS)[number], string>[] {
	return groups.flatMap((g) =>
		g.rows.map((r) => ({
			package: g.package.code,
			package_version: g.package.version,
			customer: r.lpar.customer.name,
			customer_code: r.lpar.customer.code,
			lpar: r.lpar.code,
			stage: r.stage,
			planned_date: day(r.planned_date),
			overdue: r.overdue ? 'yes' : '',
			installed_at: day(r.installed_at),
			superseded_at: day(r.superseded_at),
			cancelled_at: day(r.cancelled_at),
			compliance_pct: r.compliance === null ? '' : String(Math.round(r.compliance * 100)),
			notes: r.notes ?? ''
		}))
	);
}
