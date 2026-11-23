/**
 * Meter the cost of Claude agent runs per GitHub issue, and compare it with the estimate.
 *
 *   npx tsx scripts/agent-cost.ts record <result.json> --issue 12 --agent fixer [--post]
 *   npx tsx scripts/agent-cost.ts summary --issue 12 [--post]
 *   npx tsx scripts/agent-cost.ts gate --issue 12 [--max-usd 15] [--headroom] [--post]   # exit 2: may not start
 *   npx tsx scripts/agent-cost.ts usage [--out usage.json]       # subscription 5-hour / weekly usage
 *   npx tsx scripts/agent-cost.ts headroom --usd 1 [--issue 12 --post]   # 2x rule for a fixed budget
 *
 * Subscription usage comes from the AGENT_USAGE_SNAPSHOT environment variable (the repo
 * variable published by scripts/publish-usage.ts; see agent-usage.ts).
 * `record --usage-before a.json --usage-after b.json` stores how much of each window the run
 * used; after 3 such runs the headroom rule uses those rates instead of
 * AGENT_PCT_PER_USD_5H / AGENT_PCT_PER_USD_7D (defaults 4 and 0.5 percent per dollar).
 *   npx tsx scripts/agent-cost.ts report [--limit 200]          # CSV of all issues with agent runs
 *
 * <result.json> is the output of `claude -p ... --output-format json` (one result object),
 * or a stream-json / claude-code-action execution file (an array of messages; the last
 * `type: "result"` message is used).
 *
 * The issue's comments are the ledger: `record --post` adds a comment with a hidden
 *   <!-- agent-cost {...} -->
 * block, and the estimator agent posts a hidden
 *   <!-- cost-estimate {"size":"M","usd":[4,9],"tokens":[1500000,3000000]} -->
 * block. `summary` and `report` read them back with `gh`, so nothing is committed.
 *
 * With a Claude subscription instead of an API key, total_cost_usd is the API-equivalent
 * price, not what you are billed; tokens and turns are the real measure then.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { calibrate, effectiveUsage, formatUsage, headroom, parseSnapshot, type Usage } from './agent-usage.ts';

export interface RunCost {
	agent: string;
	usd: number;
	input_tokens: number;
	output_tokens: number;
	cache_write_tokens: number;
	cache_read_tokens: number;
	turns: number;
	duration_ms: number;
	is_error: boolean;
	session_id?: string;
	at: string;
	/** subscription usage consumed during the run, in percentage points (if measured) */
	pct_5h?: number;
	pct_7d?: number;
}

export interface Estimate {
	size?: string;
	usd: [number, number];
	tokens?: [number, number];
}

export interface Summary {
	runs: number;
	usd: number;
	tokens: number;
	turns: number;
	duration_ms: number;
	errors: number;
	estimate?: Estimate;
	/** 'under' | 'within' | 'over' the estimated USD range */
	verdict?: 'under' | 'within' | 'over';
}

const COST_TAG = 'agent-cost';
const ESTIMATE_TAG = 'cost-estimate';

/** Extract the result message from Claude's JSON output (object or message array). */
export function parseResult(json: unknown, agent: string, at = new Date().toISOString()): RunCost {
	const result = Array.isArray(json)
		? [...json].reverse().find((m) => m && typeof m === 'object' && (m as { type?: string }).type === 'result')
		: json;
	if (!result || typeof result !== 'object') throw new Error('No result message found in the Claude output');
	const r = result as Record<string, any>;
	if (typeof r.total_cost_usd !== 'number') throw new Error('Result has no total_cost_usd (use --output-format json)');
	const u = r.usage ?? {};
	return {
		agent,
		usd: r.total_cost_usd,
		input_tokens: u.input_tokens ?? 0,
		output_tokens: u.output_tokens ?? 0,
		cache_write_tokens: u.cache_creation_input_tokens ?? 0,
		cache_read_tokens: u.cache_read_input_tokens ?? 0,
		turns: r.num_turns ?? 0,
		duration_ms: r.duration_ms ?? 0,
		is_error: Boolean(r.is_error),
		session_id: r.session_id,
		at
	};
}

export function totalTokens(c: RunCost): number {
	return c.input_tokens + c.output_tokens + c.cache_write_tokens + c.cache_read_tokens;
}

/** All hidden `<!-- tag {...} -->` blocks in a text, parsed; malformed blocks are skipped. */
export function extractBlocks<T>(text: string, tag: string): T[] {
	const out: T[] = [];
	const re = new RegExp(`<!--\\s*${tag}\\s+(\\{[\\s\\S]*?\\})\\s*-->`, 'g');
	for (const m of text.matchAll(re)) {
		try {
			out.push(JSON.parse(m[1]) as T);
		} catch {
			/* ignore */
		}
	}
	return out;
}

/** Sum the runs; the latest estimate wins. */
export function summarize(comments: string[]): Summary {
	const runs = comments.flatMap((c) => extractBlocks<RunCost>(c, COST_TAG));
	const estimates = comments.flatMap((c) => extractBlocks<Estimate>(c, ESTIMATE_TAG));
	const s: Summary = {
		runs: runs.length,
		usd: round(runs.reduce((a, r) => a + r.usd, 0)),
		tokens: runs.reduce((a, r) => a + totalTokens(r), 0),
		turns: runs.reduce((a, r) => a + r.turns, 0),
		duration_ms: runs.reduce((a, r) => a + r.duration_ms, 0),
		errors: runs.filter((r) => r.is_error).length
	};
	const estimate = estimates.at(-1);
	if (estimate && Array.isArray(estimate.usd)) {
		s.estimate = estimate;
		const [lo, hi] = estimate.usd;
		s.verdict = s.usd < lo ? 'under' : s.usd > hi ? 'over' : 'within';
	}
	return s;
}

/**
 * May an agent start implementing this issue?
 * - A proposal needs the `approved` label.
 * - Without `approved`, there must be an estimate whose upper bound is within maxUsd.
 */
export function gate(labels: string[], estimate: Estimate | undefined, maxUsd: number): { ok: boolean; reason: string } {
	const approved = labels.includes('approved');
	if (labels.includes('proposal') && !approved) {
		return { ok: false, reason: 'Proposal not approved yet: add the `approved` label to build it.' };
	}
	if (approved) return { ok: true, reason: 'Approved by the owner.' };
	if (!estimate) {
		return { ok: false, reason: 'No cost estimate yet: wait for the estimator, or add the `approved` label.' };
	}
	const hi = estimate.usd[1];
	if (hi > maxUsd) {
		return {
			ok: false,
			reason: `Estimate up to $${hi} exceeds the $${maxUsd} limit: add the \`approved\` label to proceed.`
		};
	}
	return { ok: true, reason: `Estimate up to $${hi} is within the $${maxUsd} limit.` };
}

function round(n: number): number {
	return Math.round(n * 100) / 100;
}

function fmtTokens(n: number): string {
	return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n);
}

function fmtMinutes(ms: number): string {
	return `${Math.round(ms / 60000)} min`;
}

export function formatRun(c: RunCost): string {
	return (
		`**Agent run (${c.agent})**: $${c.usd.toFixed(2)} · ${fmtTokens(totalTokens(c))} tokens ` +
		`(in ${fmtTokens(c.input_tokens)}, out ${fmtTokens(c.output_tokens)}, cache read ${fmtTokens(c.cache_read_tokens)}, ` +
		`cache write ${fmtTokens(c.cache_write_tokens)}) · ${c.turns} turns · ${fmtMinutes(c.duration_ms)}` +
		(c.pct_5h !== undefined || c.pct_7d !== undefined
			? ` · subscription: 5-hour +${c.pct_5h ?? '?'}%, weekly +${c.pct_7d ?? '?'}%`
			: '') +
		(c.is_error ? ' · **ended with an error**' : '')
	);
}

export function formatSummary(s: Summary): string {
	let line =
		`**Actual cost**: $${s.usd.toFixed(2)} · ${fmtTokens(s.tokens)} tokens · ${s.runs} run(s) · ` +
		`${s.turns} turns · ${fmtMinutes(s.duration_ms)}`;
	if (s.errors) line += ` · ${s.errors} failed run(s)`;
	if (s.estimate) {
		const [lo, hi] = s.estimate.usd;
		const mark = { under: '↓ under', within: '✓ within', over: '↑ over' }[s.verdict!];
		line += `\n**Estimate**: ${s.estimate.size ?? '?'} ($${lo}–${hi}) — ${mark}`;
	} else {
		line += '\n**Estimate**: none';
	}
	return line;
}

// ---------------------------------------------------------------- gh helpers

function gh(args: string[]): string {
	return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function issueComments(issue: number): string[] {
	const out = gh(['api', '--paginate', `repos/{owner}/{repo}/issues/${issue}/comments`, '--jq', '.[].body | @json']);
	return out
		.split('\n')
		.filter(Boolean)
		.map((l) => JSON.parse(l) as string);
}

function postComment(issue: number, body: string): void {
	gh(['issue', 'comment', String(issue), '--body', body]);
}

/** Recorded runs of the most recent issues (calibration data). */
function recentRuns(limit = 50): RunCost[] {
	const issues = JSON.parse(gh(['issue', 'list', '--state', 'all', '--limit', String(limit), '--json', 'number'])) as {
		number: number;
	}[];
	return issues.flatMap((i) => issueComments(i.number).flatMap((c) => extractBlocks<RunCost>(c, COST_TAG)));
}

function defaultRates() {
	const n = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
	return { five_hour: n(process.env.AGENT_PCT_PER_USD_5H, 4), seven_day: n(process.env.AGENT_PCT_PER_USD_7D, 0.5) };
}

/** The published snapshot, or null (with the reason on stderr). */
function readSnapshot(): Usage | null {
	const snap = parseSnapshot(process.env.AGENT_USAGE_SNAPSHOT ?? '');
	if (!snap) console.error('AGENT_USAGE_SNAPSHOT is missing or invalid (run scripts/publish-usage.ts on your machine)');
	return snap;
}

/** Snapshot adjusted for resets and for agent runs recorded since; null if no snapshot. */
function currentUsage(): { usage: Usage | null; rate: ReturnType<typeof calibrate> } {
	const snap = readSnapshot();
	const runs = snap ? recentRuns() : [];
	const rate = calibrate(runs, defaultRates());
	return { usage: snap ? effectiveUsage(snap, runs, rate) : null, rate };
}

async function checkHeadroom(usd: number): Promise<{ ok: boolean; reason: string; usage: Usage | null }> {
	const { usage, rate } = currentUsage();
	const result = headroom(usage, usd, rate);
	if (usage) result.reason += ` Usage snapshot from ${usage.at}.`;
	if (usage?.extra_usage_enabled) {
		result.reason += ' Warning: extra usage is ON, so work beyond the plan is billed.';
	}
	return { ...result, usage };
}

function readUsageFile(path: string | undefined): Usage | null {
	if (!path) return null;
	try {
		return JSON.parse(readFileSync(path, 'utf8')) as Usage;
	} catch {
		return null;
	}
}

/** Percentage points used between two snapshots; undefined if a window reset in between. */
export function usageDelta(before: Usage | null, after: Usage | null): { pct_5h?: number; pct_7d?: number } {
	const d = (a?: { used: number; resets_at: string | null } | null, b?: { used: number; resets_at: string | null } | null) =>
		a && b && a.resets_at === b.resets_at && b.used >= a.used ? Math.round((b.used - a.used) * 100) / 100 : undefined;
	return { pct_5h: d(before?.five_hour, after?.five_hour), pct_7d: d(before?.seven_day, after?.seven_day) };
}

// ---------------------------------------------------------------- CLI

function option(args: string[], name: string): string | undefined {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : undefined;
}

function requireIssue(args: string[]): number {
	const n = Number(option(args, '--issue'));
	if (!Number.isInteger(n) || n <= 0) throw new Error('--issue <number> is required');
	return n;
}

async function main(argv: string[]): Promise<void> {
	const [cmd, ...args] = argv;
	const post = args.includes('--post');

	if (cmd === 'record') {
		const file = args[0];
		if (!file || file.startsWith('--')) throw new Error('record <result.json> --issue N --agent NAME');
		const issue = requireIssue(args);
		const run = parseResult(JSON.parse(readFileSync(file, 'utf8')), option(args, '--agent') ?? 'agent');
		Object.assign(
			run,
			usageDelta(readUsageFile(option(args, '--usage-before')), readUsageFile(option(args, '--usage-after')))
		);
		const body = `${formatRun(run)}\n<!-- ${COST_TAG} ${JSON.stringify(run)} -->`;
		console.log(formatRun(run));
		if (post) postComment(issue, body);
		return;
	}

	if (cmd === 'summary') {
		const issue = requireIssue(args);
		const text = formatSummary(summarize(issueComments(issue)));
		console.log(text);
		if (post) postComment(issue, text);
		return;
	}

	if (cmd === 'gate') {
		const issue = requireIssue(args);
		const maxUsd = Number(option(args, '--max-usd') ?? '15');
		const labels = (
			JSON.parse(gh(['issue', 'view', String(issue), '--json', 'labels'])) as { labels: { name: string }[] }
		).labels.map((l) => l.name);
		const estimate = summarize(issueComments(issue)).estimate;
		let { ok, reason } = gate(labels, estimate, maxUsd);
		if (ok && args.includes('--headroom')) {
			// Without an estimate (approved by the owner), budget for the cost limit.
			const h = await checkHeadroom(estimate?.usd[1] ?? maxUsd);
			ok = h.ok;
			reason = `${reason} ${h.reason}`;
		}
		console.log(reason);
		if (!ok) {
			if (post) postComment(issue, `**Agent not started.** ${reason}`);
			process.exit(2);
		}
		return;
	}

	if (cmd === 'usage') {
		const { usage } = currentUsage();
		if (!usage) process.exit(3);
		console.log(`${formatUsage(usage)} · snapshot ${usage.at}`);
		const out = option(args, '--out');
		if (out) writeFileSync(out, JSON.stringify(usage));
		return;
	}

	if (cmd === 'headroom') {
		const usd = Number(option(args, '--usd'));
		if (!(usd > 0)) throw new Error('--usd <amount> is required');
		const { ok, reason } = await checkHeadroom(usd);
		console.log(reason);
		if (!ok) {
			const issue = Number(option(args, '--issue'));
			if (post && issue > 0) postComment(issue, `**Agent not started.** ${reason}`);
			process.exit(2);
		}
		return;
	}

	if (cmd === 'report') {
		const limit = option(args, '--limit') ?? '200';
		const issues = JSON.parse(
			gh(['issue', 'list', '--state', 'all', '--limit', limit, '--json', 'number,title,state,labels'])
		) as { number: number; title: string; state: string; labels: { name: string }[] }[];
		console.log('issue,state,labels,runs,usd,tokens,turns,minutes,est_size,est_usd_low,est_usd_high,verdict,title');
		for (const i of issues) {
			const s = summarize(issueComments(i.number));
			if (!s.runs && !s.estimate) continue;
			const cells = [
				i.number,
				i.state,
				i.labels.map((l) => l.name).join(' '),
				s.runs,
				s.usd.toFixed(2),
				s.tokens,
				s.turns,
				Math.round(s.duration_ms / 60000),
				s.estimate?.size ?? '',
				s.estimate?.usd[0] ?? '',
				s.estimate?.usd[1] ?? '',
				s.verdict ?? '',
				`"${i.title.replace(/"/g, '""')}"`
			];
			console.log(cells.join(','));
		}
		return;
	}

	console.error('Usage: agent-cost.ts record <result.json> --issue N --agent NAME [--usage-before F --usage-after F] [--post]');
	console.error('       agent-cost.ts summary --issue N [--post]');
	console.error('       agent-cost.ts gate --issue N [--max-usd 15] [--headroom] [--post]');
	console.error('       agent-cost.ts usage [--out usage.json]');
	console.error('       agent-cost.ts headroom --usd X [--issue N --post]');
	console.error('       agent-cost.ts report [--limit 200]');
	process.exit(1);
}

if (import.meta.main) {
	try {
		await main(process.argv.slice(2));
	} catch (e) {
		console.error(`error: ${(e as Error).message}`);
		process.exit(1);
	}
}
