import { describe, it, expect } from 'vitest';
import { parseUsage, calibrate, headroom, formatUsage, type Usage } from './agent-usage.ts';
import { usageDelta } from './agent-cost.ts';

const usage = (h5: number, d7: number, reset5 = 'A', reset7 = 'W'): Usage => ({
	five_hour: { used: h5, resets_at: reset5 },
	seven_day: { used: d7, resets_at: reset7 },
	extra_usage_enabled: false,
	at: 'now'
});

const defaults = { five_hour: 4, seven_day: 0.5 };

describe('parseUsage', () => {
	it('reads both windows and the extra-usage flag', () => {
		const u = parseUsage({
			five_hour: { utilization: 23, resets_at: '2026-11-24T03:00:00Z' },
			seven_day: { utilization: 41.5, resets_at: null },
			extra_usage: { is_enabled: true },
			seven_day_opus: { utilization: 5 }
		});
		expect(u.five_hour).toEqual({ used: 23, resets_at: '2026-11-24T03:00:00Z' });
		expect(u.seven_day).toEqual({ used: 41.5, resets_at: null });
		expect(u.extra_usage_enabled).toBe(true);
		expect(formatUsage(u)).toContain('extra usage ON');
	});

	it('treats missing or malformed windows as unknown', () => {
		const u = parseUsage({ five_hour: null, seven_day: { utilization: 'x' } });
		expect(u.five_hour).toBeNull();
		expect(u.seven_day).toBeNull();
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
