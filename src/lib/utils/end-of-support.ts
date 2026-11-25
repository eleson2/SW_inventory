/**
 * End-of-support horizon (report L1): installed releases with their end-of-support date, the
 * ones ending within 12 months highlighted. Pure functions; the query is in #lib/server/reports.ts.
 */
import { compareVersions, equivalentVersion } from './version-parser.ts';
import { releaseOf, type BaseInstall, type BaseLpar, type BaseSoftware } from './vendor-base.ts';

/** Releases ending within this many months are called out */
export const EOS_WARNING_MONTHS = 12;

export type EosStatus = 'past' | 'soon' | 'later' | 'unknown';

export interface EosSoftware extends BaseSoftware {
	versions: { version: string; vendor_version: string | null; end_of_support: Date | null }[];
}

export interface EosRow {
	software: EosSoftware;
	release: string;
	endOfSupport: Date | null;
	/** Whole months from today to the end of support; negative when already past */
	monthsLeft: number | null;
	status: EosStatus;
	lpars: BaseLpar[];
	customerCount: number;
	/** Highest known release newer than this one, if any */
	newerRelease: string | null;
}

export interface EosReport {
	rows: EosRow[];
	counts: Record<EosStatus, number>;
	/** LPARs running at least one release that is past or ends within EOS_WARNING_MONTHS */
	lparsAtRisk: number;
}

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/** Whole calendar months from `from` to `to` (negative when `to` is earlier). */
export function monthsBetween(from: Date, to: Date): number {
	let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
	if (months > 0 && to.getUTCDate() < from.getUTCDate()) months--;
	if (months < 0 && to.getUTCDate() > from.getUTCDate()) months++;
	return months;
}

export function eosStatus(endOfSupport: Date | null, today: Date): EosStatus {
	if (!endOfSupport) return 'unknown';
	if (endOfSupport < today) return 'past';
	const limit = new Date(today);
	limit.setUTCMonth(limit.getUTCMonth() + EOS_WARNING_MONTHS);
	return endOfSupport <= limit ? 'soon' : 'later';
}

/** A release's end of support: support ends per release, so any PTF level's date counts (latest wins). */
export function releaseEndOfSupport(software: Pick<EosSoftware, 'versions'>, release: string): Date | null {
	const dates = software.versions
		.filter(
			(v) =>
				v.end_of_support &&
				(equivalentVersion(v.version, release) || (!!v.vendor_version && equivalentVersion(v.vendor_version, release)))
		)
		.map((v) => v.end_of_support!.getTime());
	return dates.length ? new Date(Math.max(...dates)) : null;
}

const ORDER: Record<EosStatus, number> = { past: 0, soon: 1, later: 2, unknown: 3 };

export function buildEosReport(
	input: { lpars: BaseLpar[]; software: EosSoftware[]; installs: BaseInstall[] },
	today = new Date()
): EosReport {
	const lparById = new Map(input.lpars.map((l) => [l.id, l]));
	const softwareById = new Map(input.software.map((s) => [s.id, s]));

	const groups = new Map<string, { software: EosSoftware; release: string; lpars: Map<string, BaseLpar> }>();
	for (const install of input.installs) {
		const lpar = lparById.get(install.lpar_id);
		const software = softwareById.get(install.software_id);
		if (!lpar || !software) continue;
		const release = releaseOf(install, software);
		const key = `${software.id}|${release}`;
		let group = groups.get(key);
		if (!group) groups.set(key, (group = { software, release, lpars: new Map() }));
		group.lpars.set(lpar.id, lpar);
	}

	const rows: EosRow[] = [...groups.values()].map(({ software, release, lpars }) => {
		const endOfSupport = releaseEndOfSupport(software, release);
		const newer = [...new Set(software.versions.map((v) => v.version))]
			.filter((v) => compareVersions(v, release) > 0)
			.sort((a, b) => compareVersions(b, a));
		const list = [...lpars.values()].sort(
			(a, b) => byText(a.customer.name, b.customer.name) || byText(a.code, b.code)
		);
		return {
			software,
			release,
			endOfSupport,
			monthsLeft: endOfSupport ? monthsBetween(today, endOfSupport) : null,
			status: eosStatus(endOfSupport, today),
			lpars: list,
			customerCount: new Set(list.map((l) => l.customer.id)).size,
			newerRelease: newer[0] ?? null
		};
	});
	rows.sort(
		(a, b) =>
			ORDER[a.status] - ORDER[b.status] ||
			(a.endOfSupport?.getTime() ?? 0) - (b.endOfSupport?.getTime() ?? 0) ||
			byText(a.software.name, b.software.name) ||
			compareVersions(b.release, a.release)
	);

	const counts: Record<EosStatus, number> = { past: 0, soon: 0, later: 0, unknown: 0 };
	const atRisk = new Set<string>();
	for (const row of rows) {
		counts[row.status]++;
		if (row.status === 'past' || row.status === 'soon') row.lpars.forEach((l) => atRisk.add(l.id));
	}
	return { rows, counts, lparsAtRisk: atRisk.size };
}

export const EOS_CSV_COLUMNS = [
	'status',
	'end_of_support',
	'months_left',
	'vendor',
	'product',
	'product_code',
	'release',
	'newer_release',
	'customer',
	'customer_code',
	'lpar'
] as const;

const STATUS_TEXT: Record<EosStatus, string> = {
	past: 'out of support',
	soon: `ends within ${EOS_WARNING_MONTHS} months`,
	later: 'supported',
	unknown: 'no date'
};

/** One record per product x release x LPAR. */
export function eosRecords(report: EosReport): Record<(typeof EOS_CSV_COLUMNS)[number], string>[] {
	return report.rows.flatMap((row) =>
		row.lpars.map((lpar) => ({
			status: STATUS_TEXT[row.status],
			end_of_support: row.endOfSupport?.toISOString().slice(0, 10) ?? '',
			months_left: row.monthsLeft === null ? '' : String(row.monthsLeft),
			vendor: row.software.vendor.name,
			product: row.software.name,
			product_code: row.software.product_code ?? '',
			release: row.release,
			newer_release: row.newerRelease ?? '',
			customer: lpar.customer.name,
			customer_code: lpar.customer.code,
			lpar: lpar.code
		}))
	);
}
