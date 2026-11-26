import { describe, it, expect } from 'vitest';
import { classifyChange, endOfDay, installsAt, reconstructEvents, stateAt, pairKey, type CurrentInstall, type HistoryRow } from './install-history.ts';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const v = (version: string, ptf_level: string | null = null) => ({ version, ptf_level });

describe('install history (D2)', () => {
	it('classifies changes', () => {
		expect(classifyChange(null, v('V5R6M0'))).toBe('install');
		expect(classifyChange(v('V5R6M0'), null)).toBe('remove');
		expect(classifyChange(v('V5R6M0', 'UI1'), v('V5R6M0', 'UI1'))).toBeNull();
		expect(classifyChange(v('V5R6M0', 'UI1'), v('V5R6M0', ''))).toBe('ptf');
		expect(classifyChange(v('V5R6M0', 'UI1'), v('V5R6M0', 'UI2'))).toBe('ptf');
		expect(classifyChange(v('V5R6M0'), v('V6R1M0'))).toBe('upgrade');
		expect(classifyChange(v('V6R1M0'), v('V5R6M0'))).toBe('downgrade');
		expect(classifyChange(v('6.1', 'UI1'), v('V6R1M0', 'UI1'))).toBeNull();
	});

	it('replays the state at a date', () => {
		const e = (software_id: string, at: string, to: string | null): HistoryRow => ({
			lpar_id: 'L',
			software_id,
			event: to ? 'install' : 'remove',
			from_version: null,
			from_ptf_level: null,
			to_version: to,
			to_ptf_level: null,
			occurred_at: d(at),
			source: 'deploy',
			package_id: null,
			reason: null,
			reconstructed: false
		});
		const events = [e('a', '2025-03-01', 'V2'), e('a', '2025-01-01', 'V1'), e('b', '2025-02-01', 'X'), e('b', '2025-04-01', null)];
		const at = (s: string) => Object.fromEntries([...stateAt(events, d(s))].map(([k, x]) => [k, x.version]));
		expect(at('2024-12-31')).toEqual({});
		expect(at('2025-02-15')).toEqual({ [pairKey('L', 'a')]: 'V1', [pairKey('L', 'b')]: 'X' });
		expect(at('2025-05-01')).toEqual({ [pairKey('L', 'a')]: 'V2' });
	});

	const row = (over: Partial<CurrentInstall>): CurrentInstall => ({
		lpar_id: 'L',
		software_id: 'S',
		current_version: 'V6R1M0',
		current_ptf_level: 'UI2',
		previous_version: null,
		previous_ptf_level: null,
		installed_date: d('2025-01-10'),
		rolled_back: false,
		rolled_back_at: null,
		rollback_reason: null,
		...over
	});
	const replay = (r: CurrentInstall, audit = []) =>
		reconstructEvents(r, audit).map((e) => ({ ...e, lpar_id: r.lpar_id, software_id: r.software_id }));

	it('rebuilds a plain install and an upgrade from the previous version', () => {
		expect(replay(row({})).map((e) => [e.event, e.to_version, e.reconstructed])).toEqual([['install', 'V6R1M0', true]]);
		const up = replay(row({ previous_version: 'V5R6M0' }));
		expect(up.map((e) => [e.event, e.from_version, e.to_version])).toEqual([['upgrade', 'V5R6M0', 'V6R1M0']]);
		const same = replay(row({ previous_version: 'V6R1M0', previous_ptf_level: 'UI2' }));
		expect(same.map((e) => [e.event, e.from_version])).toEqual([['install', null]]);
	});

	it('rebuilds a rollback and ends at the current version', () => {
		const r = row({
			current_version: 'V5R6M0',
			current_ptf_level: 'UI1',
			previous_version: 'V6R1M0',
			previous_ptf_level: 'UI2',
			rolled_back: true,
			rolled_back_at: d('2025-02-01'),
			rollback_reason: 'Abends'
		});
		const events = replay(r);
		expect(events.map((e) => [e.event, e.to_version, e.reason])).toEqual([
			['install', 'V6R1M0', null],
			['rollback', 'V5R6M0', 'Abends']
		]);
		expect(stateAt(events).get(pairKey('L', 'S'))).toEqual(v('V5R6M0', 'UI1'));
	});

	it('adds older audit rollbacks and still ends at the current version', () => {
		const audit = [
			{ at: d('2024-06-01'), from_version: 'V5R6M0', from_ptf: null, to_version: 'V5R5M0', to_ptf: null, reason: 'old' }
		];
		const events = replay(row({}), audit as never);
		expect(events.map((e) => e.event)).toEqual(['rollback', 'install']);
		expect(stateAt(events).get(pairKey('L', 'S'))).toEqual(v('V6R1M0', 'UI2'));
	});
});

describe('installs at a date', () => {
	const ev = (event: string, at: string, to: string | null, reason: string | null = null): HistoryRow => ({
		lpar_id: 'L',
		software_id: 'S',
		event,
		from_version: null,
		from_ptf_level: null,
		to_version: to,
		to_ptf_level: null,
		occurred_at: d(at),
		source: 'deploy',
		package_id: null,
		reason,
		reconstructed: false
	});
	const events = [
		ev('install', '2025-01-01', 'V1'),
		ev('upgrade', '2025-03-01', 'V2'),
		ev('rollback', '2025-03-05', 'V1', 'Abends'),
		ev('remove', '2025-06-01', null)
	];
	it('replays version, install date and rollback state', () => {
		expect(installsAt(events, d('2024-12-01'))).toEqual([]);
		expect(installsAt(events, d('2025-03-02'))[0]).toMatchObject({ current_version: 'V2', installed_date: d('2025-03-01'), rolled_back: false });
		expect(installsAt(events, d('2025-04-01'))[0]).toMatchObject({
			current_version: 'V1',
			installed_date: d('2025-03-01'),
			rolled_back: true,
			rolled_back_at: d('2025-03-05'),
			rollback_reason: 'Abends'
		});
		expect(installsAt(events, d('2025-07-01'))).toEqual([]);
	});
	it('reads an as-of date as the end of that day', () => {
		expect(endOfDay('2025-06-30')?.toISOString()).toBe('2025-06-30T23:59:59.999Z');
		expect([endOfDay(''), endOfDay('2025-02-30'), endOfDay('30/06/2025'), endOfDay(null)]).toEqual([null, null, null, null]);
	});
});
