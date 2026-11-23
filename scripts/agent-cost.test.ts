import { describe, it, expect } from 'vitest';
import { parseResult, extractBlocks, summarize, formatSummary, totalTokens, type RunCost } from './agent-cost.ts';

const result = {
	type: 'result',
	subtype: 'success',
	is_error: false,
	duration_ms: 240000,
	num_turns: 18,
	session_id: 'abc',
	total_cost_usd: 2.5,
	usage: { input_tokens: 1000, output_tokens: 20000, cache_creation_input_tokens: 50000, cache_read_input_tokens: 900000 }
};

const AT = '2026-11-23T00:00:00.000Z';

function costComment(run: RunCost): string {
	return `**Agent run**\n<!-- agent-cost ${JSON.stringify(run)} -->`;
}

describe('parseResult', () => {
	it('reads a single --output-format json result', () => {
		const run = parseResult(result, 'fixer', AT);
		expect(run).toMatchObject({ agent: 'fixer', usd: 2.5, turns: 18, cache_read_tokens: 900000, is_error: false });
		expect(totalTokens(run)).toBe(971000);
	});

	it('takes the last result message from a message array', () => {
		const run = parseResult([{ type: 'system' }, { type: 'result', ...result, total_cost_usd: 1 }, { type: 'result', ...result }], 'x', AT);
		expect(run.usd).toBe(2.5);
	});

	it('rejects output without cost', () => {
		expect(() => parseResult({ type: 'result' }, 'x')).toThrow(/total_cost_usd/);
		expect(() => parseResult([{ type: 'assistant' }], 'x')).toThrow(/No result/);
	});
});

describe('extractBlocks', () => {
	it('finds hidden JSON blocks and skips malformed ones', () => {
		const text = 'a <!-- cost-estimate {"usd":[1,2]} --> b <!-- cost-estimate {broken} --> <!-- other {"x":1} -->';
		expect(extractBlocks(text, 'cost-estimate')).toEqual([{ usd: [1, 2] }]);
	});
});

describe('summarize', () => {
	const run = parseResult(result, 'fixer', AT);

	it('sums runs and compares with the latest estimate', () => {
		const comments = [
			'<!-- cost-estimate {"size":"S","usd":[0.5,1]} -->',
			'<!-- cost-estimate {"size":"M","usd":[4,9]} -->',
			costComment(run),
			costComment({ ...run, usd: 2, is_error: true }),
			'plain comment'
		];
		const s = summarize(comments);
		expect(s).toMatchObject({ runs: 2, usd: 4.5, turns: 36, errors: 1, verdict: 'within' });
		expect(s.estimate?.size).toBe('M');
		expect(formatSummary(s)).toContain('M ($4–9) — ✓ within');
	});

	it('marks over and under the range', () => {
		expect(summarize(['<!-- cost-estimate {"usd":[0.5,1]} -->', costComment(run)]).verdict).toBe('over');
		expect(summarize(['<!-- cost-estimate {"usd":[5,9]} -->', costComment(run)]).verdict).toBe('under');
	});

	it('works without an estimate', () => {
		const s = summarize([costComment(run)]);
		expect(s.verdict).toBeUndefined();
		expect(formatSummary(s)).toContain('Estimate**: none');
	});
});
