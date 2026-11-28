/**
 * Deploy to the demo server and move data between this PC and the server, over ssh.
 * The work on the server is done by deploy/remote.sh, which backs up the server data
 * before every change (kept in /opt/sw-inventory/backups).
 *
 *   npm run deploy -- setup-sudo          # once: let the ssh user run the server script without a password
 *   npm run deploy                        # deploy HEAD, which must be on origin/main (rolls back if it fails)
 *   npm run deploy -- status              # revision, service state, health check
 *   npm run deploy -- logs [hours]        # the app's server log (default last 24 h)
 *   npm run deploy -- backup              # back up the server data now
 *   npm run deploy -- backups             # list server backups
 *   npm run deploy -- restore <name>      # put a server backup back
 *   npm run deploy -- data:pull [--load]  # server data -> backup/server-<time>/ (--load: into the local DB)
 *   npm run deploy -- data:push [--dir backup/x] [--yes]
 *                                         # local DB (or an existing export) -> replaces the server data
 *
 * Settings in .env (see .env.example): DEPLOY_HOST (user@host, required),
 * DEPLOY_APP_DIR, DEPLOY_BACKUP_DIR, DEPLOY_SERVICE, DEPLOY_SSH_KEY.
 * The ssh user needs sudo. Until `setup-sudo` is done the sudo password is asked once per command
 * (run from a real terminal); afterwards the installed /usr/local/sbin/sw-inventory-remote is used,
 * which runs with the server's default settings (the DEPLOY_*_DIR / SERVICE values are ignored).
 */
import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

const ROOT = resolve(import.meta.dirname, '..');
if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'));

const HOST = process.env.DEPLOY_HOST ?? '';
const REMOTE_ENV = {
	APP_DIR: process.env.DEPLOY_APP_DIR ?? '/opt/sw-inventory/app',
	BACKUP_ROOT: process.env.DEPLOY_BACKUP_DIR ?? '/opt/sw-inventory/backups',
	SERVICE: process.env.DEPLOY_SERVICE ?? 'sw-inventory'
};
const SSH_OPTS = process.env.DEPLOY_SSH_KEY ? ['-i', process.env.DEPLOY_SSH_KEY] : [];
const REMOTE_SCRIPT = '/tmp/sw-inventory-remote.sh';
const REMOTE_EXPORT = '/tmp/sw-inventory-data.tgz';
const INSTALLED = '/usr/local/sbin/sw-inventory-remote';

const timestamp = () => new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');

function run(cmd: string, args: string[], opts: SpawnSyncOptions = {}) {
	const result = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`${cmd} ${args[0] ?? ''} failed (exit ${result.status})`);
	return result;
}
const output = (cmd: string, args: string[]) =>
	run(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' }).stdout.toString().trim();
const npm = (args: string[]) => run('npm', args, { shell: process.platform === 'win32' });
/** Local files live under backup/ (git-ignored) and are passed relative: scp/tar may read "C:" as a host. */
const TMP = join(ROOT, 'backup');
const rel = (path: string) => relative(ROOT, path).replace(/\\/g, '/');
const scp = (from: string, to: string) => run('scp', [...SSH_OPTS, '-q', from, to]);

/** May the ssh user run the installed script with sudo without a password? */
let passwordless: boolean | undefined;
function canRunInstalled() {
	passwordless ??=
		spawnSync('ssh', [...SSH_OPTS, '-o', 'BatchMode=yes', HOST, `sudo -n -l ${INSTALLED}`], { stdio: 'ignore' })
			.status === 0;
	return passwordless;
}

/** Run one of remote.sh's commands as root: the installed copy if allowed, else upload it and sudo with password. */
function remote(...args: string[]) {
	if (args[0] !== 'setup-sudo' && canRunInstalled()) {
		run('ssh', [...SSH_OPTS, HOST, ['sudo', '-n', INSTALLED, ...args].join(' ')]);
		return;
	}
	if (!process.stdin.isTTY) {
		console.warn('No terminal: sudo cannot ask for a password here. Run `npm run deploy -- setup-sudo` once from a terminal.');
	}
	const script = readFileSync(join(ROOT, 'deploy/remote.sh'), 'utf8').replace(/\r\n/g, '\n');
	mkdirSync(TMP, { recursive: true });
	const local = join(TMP, `remote-${process.pid}.sh`);
	writeFileSync(local, script);
	try {
		scp(rel(local), `${HOST}:${REMOTE_SCRIPT}`);
	} finally {
		rmSync(local, { force: true });
	}
	const env = Object.entries(REMOTE_ENV).map(([k, v]) => `${k}='${v}'`);
	// -t so sudo can ask for a password
	run('ssh', [...SSH_OPTS, '-t', HOST, ['sudo', 'env', ...env, 'bash', REMOTE_SCRIPT, ...args].join(' ')]);
}

/** The prompt needs someone to type; without a terminal (e.g. `! cmd` in Claude Code) stop with a hint. */
function requireTerminal(question: string) {
	if (!process.stdin.isTTY) throw new Error(`${question}
No terminal to type "yes" in: run the same command with --yes to confirm.`);
}

async function confirm(question: string) {
	requireTerminal(question);
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	// Input ending (Ctrl+D) counts as no instead of leaving the question pending
	const closed = new Promise<string>((done) => rl.once('close', () => done('')));
	const answer = await Promise.race([rl.question(`${question} Type "yes" to continue: `), closed]);
	rl.close();
	return answer.trim().toLowerCase() === 'yes';
}

function deploy() {
	output('git', ['fetch', '--quiet', 'origin']);
	const sha = output('git', ['rev-parse', 'HEAD']);
	if (spawnSync('git', ['merge-base', '--is-ancestor', sha, 'origin/main'], { cwd: ROOT }).status !== 0) {
		throw new Error(`HEAD ${sha.slice(0, 9)} is not on GitHub's main yet; the server deploys only from there. Push (or merge) first.`);
	}
	if (output('git', ['status', '--porcelain', '--untracked-files=no'])) {
		console.warn('Note: you have uncommitted changes; they are NOT deployed (only the commit below).');
	}
	console.log(`Deploying ${output('git', ['log', '-1', '--format=%h %s'])} to ${HOST}`);
	remote('deploy', sha);
}

function dataPull(load: boolean) {
	const dir = join(ROOT, 'backup', `server-${timestamp()}`);
	remote('export-data');
	mkdirSync(dir, { recursive: true });
	const tgz = join(dir, 'data.tgz');
	scp(`${HOST}:${REMOTE_EXPORT}`, rel(tgz));
	run('ssh', [...SSH_OPTS, HOST, `rm -f ${REMOTE_EXPORT}`]);
	run('tar', ['-xzf', rel(tgz), '-C', rel(dir)]);
	rmSync(tgz);
	console.log(`Server data saved in ${rel(dir)}`);
	if (load) {
		console.log('Loading it into the local database (replaces local data)...');
		npm(['run', 'db:import', '--', '--dir', rel(dir), '--replace']);
	} else {
		console.log(`Load locally with: npm run db:import -- --dir ${rel(dir)} --replace`);
	}
}

async function dataPush(dirArg: string | undefined, yes: boolean) {
	if (!yes) requireTerminal(`This REPLACES all data on ${HOST}.`); // before the export, not after
	let dir: string;
	if (dirArg) {
		dir = resolve(ROOT, dirArg);
		if (!existsSync(join(dir, 'software.json'))) throw new Error(`${dirArg} is not a db:export folder`);
	} else {
		dir = join(ROOT, 'backup', `push-${timestamp()}`);
		console.log('Exporting the local database...');
		npm(['run', 'db:export', '--', '--dir', rel(dir)]);
	}
	if (!yes && !(await confirm(`This REPLACES all data on ${HOST} with ${rel(dir)} (the server data is backed up first).`))) {
		console.log('Cancelled.');
		return;
	}
	const tgz = join(TMP, `push-${process.pid}.tgz`);
	run('tar', ['-czf', rel(tgz), '-C', rel(dir), '.']);
	const remoteTgz = `/tmp/sw-inventory-push-${timestamp()}.tgz`;
	try {
		scp(rel(tgz), `${HOST}:${remoteTgz}`);
	} finally {
		rmSync(tgz, { force: true });
	}
	remote('import-data', remoteTgz);
}

const [command = 'deploy', ...rest] = process.argv.slice(2);
const flag = (name: string) => rest.includes(name);
const option = (name: string) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : undefined);

try {
	if (!HOST) throw new Error('Set DEPLOY_HOST=user@your-server in .env (see .env.example)');
	switch (command) {
		case 'deploy': deploy(); break;
		case 'setup-sudo': remote('setup-sudo'); break;
		case 'status': remote('status'); break;
		case 'logs': {
			const hours = rest[0] ?? '24';
			if (!/^\d{1,3}$/.test(hours)) throw new Error('Usage: npm run deploy -- logs [hours]');
			remote('logs', hours);
			break;
		}
		case 'backup': remote('backup', 'manual'); break;
		case 'backups': remote('backups'); break;
		case 'restore': {
			const name = rest[0];
			if (!name || !/^[\w.-]+$/.test(name)) throw new Error('Usage: npm run deploy -- restore <name>  (names: npm run deploy -- backups)');
			if (!flag('--yes') && !(await confirm(`This REPLACES all data on ${HOST} with backup ${name}.`))) break;
			remote('restore', name);
			break;
		}
		case 'data:pull': dataPull(flag('--load')); break;
		case 'data:push': await dataPush(option('--dir'), flag('--yes')); break;
		default:
			console.error(readFileSync(import.meta.filename, 'utf8').split('*/')[0]);
			process.exitCode = 1;
	}
} catch (error) {
	console.error(`\n${error instanceof Error ? error.message : error}`);
	process.exitCode = 1;
}
