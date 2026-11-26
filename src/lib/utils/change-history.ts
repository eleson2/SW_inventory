/**
 * C2 change history: what changed on the LPARs in a period (installs, upgrades, PTF changes,
 * rollbacks, removals), per customer and LPAR, from the install history. Fits a monthly service
 * report; the customer view leaves out rollback reasons and internal sources.
 * Pure functions; query in #lib/server/reports.ts.
 */
import { EVENT_LABEL, SOURCE_LABEL, versionText, type HistoryEvent, type HistorySource } from './install-history.ts';

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Period from ?from=&to= (YYYY-MM-DD, both inclusive). Default: the previous calendar month
 * (a monthly service report). `end` is the exclusive upper bound (the day after `to`).
 */
export function readMonthPeriod(url: URL, today = new Date()) {
	const read = (key: string) => {
		const raw = url.searchParams.get(key);
		const d = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00Z`) : null;
		return d && !Number.isNaN(d.getTime()) && iso(d) === raw ? d : null;
	};
	const firstOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
	let from = read('from') ?? new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
	let to = read('to') ?? new Date(firstOfMonth.getTime() - DAY);
	if (from > to) [from, to] = [to, from];
	return { from: iso(from), to: iso(to), start: from, end: new Date(to.getTime() + DAY) };
}

/** Quick periods for the period picker */
export function periodPresets(today = new Date()): { label: string; from: string; to: string }[] {
	const y = today.getUTCFullYear();
	const m = today.getUTCMonth();
	const month = (offset: number) => ({
		from: iso(new Date(Date.UTC(y, m + offset, 1))),
		to: iso(new Date(Date.UTC(y, m + offset + 1, 0)))
	});
	const quarter = Math.floor(m / 3) * 3;
	return [
		{ label: 'Last month', ...month(-1) },
		{ label: 'This month', from: month(0).from, to: iso(today) },
		{ label: 'Last 3 months', from: iso(new Date(Date.UTC(y, m - 3, 1))), to: month(-1).to },
		{ label: 'Last quarter', from: iso(new Date(Date.UTC(y, quarter - 3, 1))), to: iso(new Date(Date.UTC(y, quarter, 0))) }
	];
}

/** Customer-facing wording: plain, no internal notes */
export const CUSTOMER_EVENT_LABEL: Record<HistoryEvent, string> = {
	install: 'Installed',
	upgrade: 'Upgraded',
	downgrade: 'Moved to an earlier release',
	ptf: 'Maintenance applied',
	rollback: 'Previous level restored',
	remove: 'Removed'
};

export interface ChangeEvent {
	id: string;
	occurred_at: Date;
	event: string;
	from_version: string | null;
	from_ptf_level: string | null;
	to_version: string | null;
	to_ptf_level: string | null;
	source: string;
	reason: string | null;
	reconstructed: boolean;
	lpar: { id: string; code: string; name: string; customer: { id: string; code: string; name: string } };
	software: { id: string; name: string; vendor: { id: string; code: string; name: string } };
	package: { id: string; code: string; version: string } | null;
}

export interface ChangeHistory {
	customers: {
		customer: ChangeEvent['lpar']['customer'];
		lpars: { lpar: Omit<ChangeEvent['lpar'], 'customer'>; events: ChangeEvent[] }[];
		changes: number;
	}[];
	totals: { changes: number; lpars: number; products: number; rollbacks: number; byEvent: Partial<Record<HistoryEvent, number>> };
	/** Events rebuilt from data recorded before the history existed */
	reconstructed: number;
}

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/** Group events per customer and LPAR, oldest first within an LPAR (reads like a log). */
export function buildChangeHistory(events: ChangeEvent[], options: { hidePtf?: boolean } = {}): ChangeHistory {
	const shown = events.filter((e) => !(options.hidePtf && e.event === 'ptf'));
	const customers = new Map<string, ChangeHistory['customers'][number]>();
	const lpars = new Map<string, ChangeHistory['customers'][number]['lpars'][number]>();
	const byEvent: Partial<Record<HistoryEvent, number>> = {};
	for (const e of shown) {
		let c = customers.get(e.lpar.customer.id);
		if (!c) customers.set(e.lpar.customer.id, (c = { customer: e.lpar.customer, lpars: [], changes: 0 }));
		let l = lpars.get(e.lpar.id);
		if (!l) {
			const { customer: _c, ...lpar } = e.lpar;
			lpars.set(e.lpar.id, (l = { lpar, events: [] }));
			c.lpars.push(l);
		}
		l.events.push(e);
		c.changes++;
		byEvent[e.event as HistoryEvent] = (byEvent[e.event as HistoryEvent] ?? 0) + 1;
	}
	for (const c of customers.values()) {
		c.lpars.sort((a, b) => byText(a.lpar.code, b.lpar.code));
		for (const l of c.lpars) {
			l.events.sort((a, b) => a.occurred_at.getTime() - b.occurred_at.getTime() || byText(a.software.name, b.software.name));
		}
	}
	return {
		customers: [...customers.values()].sort((a, b) => byText(a.customer.name, b.customer.name)),
		totals: {
			changes: shown.length,
			lpars: lpars.size,
			products: new Set(shown.map((e) => e.software.id)).size,
			rollbacks: byEvent.rollback ?? 0,
			byEvent
		},
		reconstructed: shown.filter((e) => e.reconstructed).length
	};
}

export const CHANGE_CSV_COLUMNS = [
	'date',
	'customer',
	'lpar',
	'vendor',
	'product',
	'change',
	'from_version',
	'from_ptf_level',
	'to_version',
	'to_ptf_level',
	'through',
	'package',
	'reason',
	'rebuilt'
] as const;

/** CSV: one row per change. The customer view leaves out the source, package source and reason. */
export function changeRecords(
	report: ChangeHistory,
	customerView = false
): Record<(typeof CHANGE_CSV_COLUMNS)[number], string>[] {
	return report.customers.flatMap((c) =>
		c.lpars.flatMap((l) =>
			l.events.map((e) => ({
				date: e.occurred_at.toISOString().slice(0, 10),
				customer: c.customer.name,
				lpar: l.lpar.code,
				vendor: e.software.vendor.name,
				product: e.software.name,
				change: (customerView ? CUSTOMER_EVENT_LABEL : EVENT_LABEL)[e.event as HistoryEvent] ?? e.event,
				from_version: e.from_version ?? '',
				from_ptf_level: e.from_ptf_level ?? '',
				to_version: e.to_version ?? '',
				to_ptf_level: e.to_ptf_level ?? '',
				through: customerView ? '' : (SOURCE_LABEL[e.source as HistorySource] ?? e.source),
				package: e.package ? `${e.package.code} ${e.package.version}` : '',
				reason: customerView ? '' : (e.reason ?? ''),
				rebuilt: e.reconstructed && !customerView ? 'yes' : ''
			}))
		)
	);
}

/** "V5R6M0 UI1 → V6R1M0 UI2", "→ V6R1M0", "V6R1M0 →" */
export function changeText(e: Pick<ChangeEvent, 'from_version' | 'from_ptf_level' | 'to_version' | 'to_ptf_level'>): string {
	const from = versionText(e.from_version, e.from_ptf_level);
	const to = versionText(e.to_version, e.to_ptf_level);
	return [from, to].filter(Boolean).join(' → ');
}
