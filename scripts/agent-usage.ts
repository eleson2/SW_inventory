/**
 * Subscription usage limits (5-hour and weekly windows) for agent runs on a Claude
 * subscription (CLAUDE_CODE_OAUTH_TOKEN), and the "at least 2x headroom" rule.
 *
 * Reads GET https://api.anthropic.com/api/oauth/usage. This endpoint is NOT documented
 * by Anthropic (community status-line tools use it); it may change or refuse the token.
 * Callers must fail closed: no usage data -> no agent run.
 *
 * The token is only sent in the Authorization header; it is never printed or stored.
 */

export interface UsageWindow {
	/** percent of the window used, 0-100 */
	used: number;
	resets_at: string | null;
}

export interface Usage {
	five_hour: UsageWindow | null;
	seven_day: UsageWindow | null;
	/** paid usage beyond the plan is switched on in the account */
	extra_usage_enabled: boolean;
	at: string;
}

/** Percent of each window consumed per API-equivalent dollar (total_cost_usd). */
export interface PctPerUsd {
	five_hour: number;
	seven_day: number;
	/** number of measured runs behind the figures; 0 = defaults */
	samples: number;
}

export const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
export const HEADROOM_FACTOR = 2;
/** Calibrated figures are used once this many runs have before/after measurements. */
export const MIN_SAMPLES = 3;

function window(raw: unknown): UsageWindow | null {
	if (!raw || typeof raw !== 'object') return null;
	const w = raw as { utilization?: unknown; resets_at?: unknown };
	if (typeof w.utilization !== 'number' || !Number.isFinite(w.utilization)) return null;
	return { used: w.utilization, resets_at: typeof w.resets_at === 'string' ? w.resets_at : null };
}

export function parseUsage(json: unknown, at = new Date().toISOString()): Usage {
	const r = (json ?? {}) as Record<string, any>;
	return {
		five_hour: window(r.five_hour),
		seven_day: window(r.seven_day),
		extra_usage_enabled: r.extra_usage?.is_enabled === true,
		at
	};
}

export async function fetchUsage(token: string, timeoutMs = 10000): Promise<Usage> {
	const res = await fetch(USAGE_URL, {
		headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': 'oauth-2025-04-20' },
		signal: AbortSignal.timeout(timeoutMs)
	});
	if (res.status !== 200) throw new Error(`usage endpoint returned HTTP ${res.status}`);
	return parseUsage(await res.json());
}

/**
 * Percent-per-dollar from runs that recorded usage before and after.
 * Other activity on the same subscription during a run inflates the delta, which only
 * makes the gate more cautious. Falls back to the defaults below MIN_SAMPLES.
 */
export function calibrate(
	runs: { usd: number; pct_5h?: number; pct_7d?: number }[],
	defaults: { five_hour: number; seven_day: number }
): PctPerUsd {
	const measured = runs.filter(
		(r) => r.usd > 0 && typeof r.pct_5h === 'number' && typeof r.pct_7d === 'number' && r.pct_5h >= 0 && r.pct_7d >= 0
	);
	if (measured.length < MIN_SAMPLES) return { ...defaults, samples: 0 };
	const usd = measured.reduce((a, r) => a + r.usd, 0);
	return {
		five_hour: measured.reduce((a, r) => a + r.pct_5h!, 0) / usd,
		seven_day: measured.reduce((a, r) => a + r.pct_7d!, 0) / usd,
		samples: measured.length
	};
}

/**
 * The rule: in both windows, remaining >= 2 x what the run is expected to use.
 * `usd` is the upper bound of the estimate (API-equivalent dollars).
 */
export function headroom(
	usage: Usage | null,
	usd: number,
	rate: PctPerUsd,
	factor = HEADROOM_FACTOR
): { ok: boolean; reason: string } {
	if (!usage) return { ok: false, reason: 'Subscription usage could not be read; not starting (fail closed).' };
	const parts: string[] = [];
	let ok = true;
	for (const [label, w, perUsd] of [
		['5-hour', usage.five_hour, rate.five_hour],
		['weekly', usage.seven_day, rate.seven_day]
	] as const) {
		if (!w) {
			ok = false;
			parts.push(`${label} window: no data`);
			continue;
		}
		const remaining = Math.max(0, 100 - w.used);
		const needed = factor * usd * perUsd;
		const fits = remaining >= needed;
		ok &&= fits;
		parts.push(
			`${label}: ${remaining.toFixed(0)}% left, needs ${needed.toFixed(0)}% (${factor} x ~${(usd * perUsd).toFixed(1)}%)` +
				(fits ? '' : ` ✗${w.resets_at ? `, resets ${w.resets_at}` : ''}`)
		);
	}
	const basis = rate.samples ? `calibrated on ${rate.samples} runs` : 'default rates, not yet calibrated';
	return { ok, reason: `${ok ? 'Enough' : 'Not enough'} subscription headroom for ~$${usd}: ${parts.join('; ')} [${basis}].` };
}

export function formatUsage(u: Usage): string {
	const w = (label: string, x: UsageWindow | null) =>
		x ? `${label} ${x.used.toFixed(0)}% used${x.resets_at ? ` (resets ${x.resets_at})` : ''}` : `${label} n/a`;
	return `${w('5-hour', u.five_hour)} · ${w('weekly', u.seven_day)} · extra usage ${u.extra_usage_enabled ? 'ON (billed beyond the plan!)' : 'off'}`;
}
