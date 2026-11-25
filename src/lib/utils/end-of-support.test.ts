import { describe, it, expect } from 'vitest';
import { toCsv } from './csv.ts';
import { EOS_CSV_COLUMNS, buildEosReport, eosRecords, eosStatus, monthsBetween, releaseEndOfSupport } from './end-of-support.ts';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const today = d('2026-11-25');
const ibm = { id: 'v-ibm', code: 'IBM', name: 'IBM' };
const acme = { id: 'c-acme', code: 'ACME', name: 'Acme' };
const globex = { id: 'c-globex', code: 'GLOBEX', name: 'Globex' };
const lpars = [
	{ id: 'l1', code: 'ACME1', customer: acme },
	{ id: 'l2', code: 'GLX1', customer: globex }
];
const db2 = {
	id: 's-db2',
	name: 'Db2',
	product_code: null,
	vendor: ibm,
	current_version: 'V13R1M0',
	versions: [
		{ version: 'V12R1M0', vendor_version: '12', end_of_support: null },
		{ version: 'V12R1M0', vendor_version: '12', end_of_support: d('2027-06-30') }, // another PTF level
		{ version: 'V13R1M0', vendor_version: '13', end_of_support: d('2031-12-31') }
	]
};
const cics = {
	id: 's-cics',
	name: 'CICS',
	product_code: 'CICSTS',
	vendor: ibm,
	current_version: 'V6R1M0',
	versions: [
		{ version: 'V5R5M0', vendor_version: null, end_of_support: d('2026-09-30') },
		{ version: 'V6R1M0', vendor_version: null, end_of_support: null }
	]
};

describe('helpers', () => {
	it('counts whole months', () => {
		expect(monthsBetween(today, d('2027-06-30'))).toBe(7);
		expect(monthsBetween(today, d('2027-11-24'))).toBe(11);
		expect(monthsBetween(today, d('2026-09-30'))).toBe(-1);
	});
	it('classifies against a 12-month window', () => {
		expect(eosStatus(null, today)).toBe('unknown');
		expect(eosStatus(d('2026-11-24'), today)).toBe('past');
		expect(eosStatus(d('2027-11-25'), today)).toBe('soon');
		expect(eosStatus(d('2027-11-26'), today)).toBe('later');
	});
	it('takes the release date from any PTF level', () => {
		expect(releaseEndOfSupport(db2, '12')).toEqual(d('2027-06-30'));
		expect(releaseEndOfSupport(cics, 'V6R1M0')).toBeNull();
	});
});

describe('buildEosReport', () => {
	const report = buildEosReport(
		{
			lpars,
			software: [db2, cics],
			installs: [
				{ lpar_id: 'l1', software_id: 's-db2', version: 'V12R1M0', ptf_level: null },
				{ lpar_id: 'l2', software_id: 's-db2', version: '12', ptf_level: null },
				{ lpar_id: 'l2', software_id: 's-cics', version: 'V5R5M0', ptf_level: null },
				{ lpar_id: 'l1', software_id: 's-cics', version: 'V6R1M0', ptf_level: null }
			]
		},
		today
	);

	it('sorts past, then ending soon, then later, then no date', () => {
		expect(report.rows.map((r) => [r.software.name, r.release, r.status])).toEqual([
			['CICS', 'V5R5M0', 'past'],
			['Db2', 'V12R1M0', 'soon'],
			['CICS', 'V6R1M0', 'unknown']
		]);
		expect(report.counts).toEqual({ past: 1, soon: 1, later: 0, unknown: 1 });
		expect(report.lparsAtRisk).toBe(2);
	});

	it('groups LPARs per release and names a newer release', () => {
		const db2Row = report.rows[1];
		expect(db2Row.lpars.map((l) => l.code)).toEqual(['ACME1', 'GLX1']);
		expect(db2Row).toMatchObject({ customerCount: 2, monthsLeft: 7, newerRelease: 'V13R1M0' });
		expect(report.rows[2].newerRelease).toBeNull();
	});

	it('exports one CSV row per release x LPAR', () => {
		const records = eosRecords(report);
		expect(records).toHaveLength(4);
		expect(toCsv(EOS_CSV_COLUMNS, records)).toContain(',-1,'); // a negative number stays a number
		expect(records[1]).toMatchObject({
			status: 'ends within 12 months',
			end_of_support: '2027-06-30',
			product: 'Db2',
			lpar: 'ACME1'
		});
	});
});
