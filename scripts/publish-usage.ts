/**
 * Publish this machine's Claude subscription usage for the agent headroom gate.
 *
 *   node scripts/publish-usage.ts [--force]
 *
 * Reads ~/.claude/usage-snapshot.json (written by the status line script
 * ~/.claude/usage-statusline.js from Claude Code's `rate_limits`) and stores it in the repo
 * variable AGENT_USAGE_SNAPSHOT with `gh variable set`, only when it changed.
 * Run by the Windows scheduled task "SWInv-PublishUsage" every 15 minutes.
 * Only usage percentages and reset times are published; no tokens.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SNAPSHOT = join(homedir(), '.claude', 'usage-snapshot.json');
const PUBLISHED = join(homedir(), '.claude', 'usage-snapshot.published.json');

function main(): void {
	if (!existsSync(SNAPSHOT)) {
		console.log(`no snapshot yet (${SNAPSHOT}); open Claude Code once so the status line writes it`);
		return;
	}
	const snapshot = JSON.stringify(JSON.parse(readFileSync(SNAPSHOT, 'utf8')));
	const last = existsSync(PUBLISHED) ? readFileSync(PUBLISHED, 'utf8') : '';
	if (snapshot === last && !process.argv.includes('--force')) {
		console.log('unchanged');
		return;
	}
	execFileSync('gh', ['variable', 'set', 'AGENT_USAGE_SNAPSHOT', '--body', snapshot], { cwd: ROOT, stdio: 'inherit' });
	writeFileSync(PUBLISHED, snapshot);
	console.log(`published ${snapshot}`);
}

try {
	main();
} catch (e) {
	console.error(`publish-usage: ${(e as Error).message}`);
	process.exit(1);
}
