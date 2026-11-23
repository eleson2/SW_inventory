import { describe, it, expect } from 'vitest';
import { parseSnapshot, effectiveUsage, calibrate, headroom, formatUsage, type Usage } from './agent-usage.ts';
import { usageDelta } from './agent-cost.ts';

const usage = (h5: number, d7: number, reset5 = 'A', reset7 = 'W'): Usage => ({
	five_hour: { used: h5, resets_at: reset5 },
	seven_day: { used: d7, resets_at: reset7 },
	extra_usage_enabled: false,
	at: 'now'
});

const defaults = { five_hour: 4, seven_day: 0.5 };

describe('parseSnapshot', () => {
	const snap = {
		five_hour: { used: 23, resets_at: '2026-11-24T03:00:00Z' },
		seven_day: { used: 41.5, resets_at: null },
		extra_usage_enabled: true,
		at: '2026-11-23T23:00:00Z'
	};

	it('reads a published snapshot (text or object)', () => {
		const u = parseSnapshot(JSON.stringify(snap))!;
		expect(u.five_hour).toEqual({ used: 23, resets_at: '2026-11-24T03:00:00Z' });
		expect(u.seven_day).toEqual({ used: 41.5, resets_at: null });
		expect(formatUsage(u)).toContain('extra usage ON');
		expect(parseSnapshot(snap)).toEqual(u);
	});

	it('rejects missing, malformed or empty snapshots', () => {
		expect(parseSnapshot('')).toBeNull();
		expect(parseSnapshot('{not json')).toBeNull();
		expect(parseSnapshot({ ...snap, at: undefined })).toBeNull();
		expect(parseSnapshot({ at: snap.at, five_hour: null, seven_day: { used: 'x' } })).toBeNull();
	});
});

describe('effectiveUsage', () => {
	const rate = { five_hour: 4, seven_day: 0.5 };
	const snap: Usage = {
		five_hour: { used: 30, resets_at: '2026-11-24T03:00:00Z' },
		seven_day: { used: 50, resets_at: '2026-11-30T20:00:00Z' },
		extra_usage_enabled: false,
		at: '2026-11-24T00:00:00Z'
	};

	it('adds agent runs recorded after the snapshot', () => {
		const runs = [
			{ usd: 5, at: '2026-11-23T23:00:00Z' }, // before the snapshot: already included
			{ usd: 2, at: '2026-11-24T01:00:00Z' }
		];
		const u = effectiveUsage(snap, runs, rate, new Date('2026-11-24T02:00:00Z'));
		expect(u.five_hour!.used).toBe(38); // 30 + 2 x 4
		expect(u.seven_day!.used).toBe(51); // 50 + 2 x 0.5
	});

	it('starts a window at 0 once its reset time has passed', () => {
		const runs = [
			{ usd: 2, at: '2026-11-24T01:00:00Z' }, // before the 5-hour reset
			{ usd: 1, at: '2026-11-24T04:00:00Z' } // after it
		];
		const u = effectiveUsage(snap, runs, rate, new Date('2026-11-24T05:00:00Z'));
		expect(u.five_hour).toEqual({ used: 4, resets_at: null });
		expect(u.seven_day!.used).toBe(51.5);
	});

	it('caps at 100%', () => {
		const u = effectiveUsage(snap, [{ usd: 100, at: '2026-11-24T01:00:00Z' }], rate, new Date('2026-11-24T02:00:00Z'));
		expect(u.five_hour!.used).toBe(100);
	});
});

describe('headroom (2x rule)', () => {
	const rate = { ...defaults, samples: 0 };

	it('passes when both windows have twice the expected use left', () => {
		// $5 -> 5h 20%, weekly 2.5%; needs 40% / 5% left
		const r = headroom(usage(50, 90), 5, rate);
		expect(r.ok).toBe(true);
		expect(r.reason).toContain('not yet calibrated');
	});

	it('fails on the 5-hour window', () => {
		expect(headroom(usage(61, 10), 5, rate).ok).toBe(false); // 39% left < 40%
	});

	it('fails on the weekly window', () => {
		const r = headroom(usage(0, 96), 5, rate); // 4% left < 5%
		expect(r.ok).toBe(false);
		expect(r.reason).toContain('resets W');
	});

	it('fails closed without usage data', () => {
		expect(headroom(null, 1, rate).ok).toBe(false);
		expect(headroom({ ...usage(0, 0), seven_day: null }, 1, rate).ok).toBe(false);
	});
});

describe('calibrate', () => {
	it('uses defaults below 3 measured runs', () => {
		expect(calibrate([{ usd: 2, pct_5h: 10, pct_7d: 1 }], defaults)).toEqual({ ...defaults, samples: 0 });
	});

	it('averages percent per dollar over measured runs', () => {
		const runs = [
			{ usd: 2, pct_5h: 10, pct_7d: 1 },
			{ usd: 3, pct_5h: 12, pct_7d: 2 },
			{ usd: 5, pct_5h: 18, pct_7d: 2 },
			{ usd: 4 } // not measured
		];
		expect(calibrate(runs, defaults)).toEqual({ five_hour: 4, seven_day: 0.5, samples: 3 });
	});
});

describe('usageDelta', () => {
	it('measures percentage points used within the same window', () => {
		expect(usageDelta(usage(10, 20), usage(22.5, 21))).toEqual({ pct_5h: 12.5, pct_7d: 1 });
	});

	it('drops a window that reset during the run', () => {
		expect(usageDelta(usage(80, 20, 'A'), usage(5, 21, 'B'))).toEqual({ pct_5h: undefined, pct_7d: 1 });
		expect(usageDelta(null, usage(1, 1))).toEqual({ pct_5h: undefined, pct_7d: undefined });
	});
});
