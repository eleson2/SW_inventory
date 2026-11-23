/**
 * Subscription usage limits (5-hour and weekly windows) for agent runs on a Claude
 * subscription, and the "at least 2x headroom" rule.
 *
 * Source: a snapshot published from the owner's machine. Claude Code passes `rate_limits`
 * to the status line; ~/.claude/usage-statusline.js saves them to
 * ~/.claude/usage-snapshot.json and scripts/publish-usage.ts copies that to the repo
 * variable AGENT_USAGE_SNAPSHOT. (The api/oauth/usage endpoint refuses setup-token
 * tokens with HTTP 403, so CI cannot read usage itself.)
 *
 * A snapshot is only as fresh as the owner's last Claude Code session. That is safe:
 * without activity usage only goes down; a window whose reset time has passed counts as
 * empty; agent runs recorded after the snapshot are added (effectiveUsage).
 * Callers must fail closed: no snapshot -> no agent run.
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

export const HEADROOM_FACTOR = 2;
/** Calibrated figures are used once this many runs have before/after measurements. */
export const MIN_SAMPLES = 3;

function window(raw: unknown): UsageWindow | null {
	if (!raw || typeof raw !== 'object') return null;
	const w = raw as { used?: unknown; resets_at?: unknown };
	if (typeof w.used !== 'number' || !Number.isFinite(w.used)) return null;
	return { used: w.used, resets_at: typeof w.resets_at === 'string' ? w.resets_at : null };
}

/** Parse a published snapshot (JSON text or object); null if missing or malformed. */
export function parseSnapshot(raw: unknown): Usage | null {
	let j: unknown = raw;
	if (typeof raw === 'string') {
		if (!raw.trim()) return null;
		try {
			j = JSON.parse(raw);
		} catch {
			return null;
		}
	}
	if (!j || typeof j !== 'object') return null;
	const r = j as Record<string, unknown>;
	if (typeof r.at !== 'string' || Number.isNaN(Date.parse(r.at))) return null;
	const u: Usage = {
		five_hour: window(r.five_hour),
		seven_day: window(r.seven_day),
		extra_usage_enabled: r.extra_usage_enabled === true,
		at: r.at
	};
	return u.five_hour || u.seven_day ? u : null;
}

/**
 * Usage now, from an older snapshot: a window whose reset time has passed starts at 0;
 * agent runs recorded after the snapshot (or after the reset) are added at `rate`.
 */
export function effectiveUsage(
	snap: Usage,
	runs: { usd: number; at: string }[],
	rate: { five_hour: number; seven_day: number },
	now = new Date()
): Usage {
	const adjust = (w: UsageWindow | null, perUsd: number): UsageWindow | null => {
		if (!w) return null;
		const reset = w.resets_at ? Date.parse(w.resets_at) : NaN;
		const hasReset = !Number.isNaN(reset) && reset <= now.getTime();
		const since = hasReset ? reset : Date.parse(snap.at);
		const added = runs.filter((r) => Date.parse(r.at) > since).reduce((a, r) => a + r.usd * perUsd, 0);
		return {
			used: Math.min(100, (hasReset ? 0 : w.used) + added),
			resets_at: hasReset ? null : w.resets_at
		};
	};
	return {
		...snap,
		five_hour: adjust(snap.five_hour, rate.five_hour),
		seven_day: adjust(snap.seven_day, rate.seven_day)
	};
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
