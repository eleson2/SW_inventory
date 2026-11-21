/**
 * The few places where application queries differ between database providers.
 *
 * App code should not contain raw SQL. Anything provider-specific belongs here,
 * so switching DB_PROVIDER (postgresql | sqlite) needs no other code changes.
 */

export type DbProvider = 'postgresql' | 'sqlite';

/**
 * Provider in use, derived from DATABASE_URL (`file:` URLs are SQLite).
 * Read lazily: Prisma loads .env into process.env when the client is created.
 */
export function dbProvider(): DbProvider {
	return (process.env.DATABASE_URL ?? '').startsWith('file:') ? 'sqlite' : 'postgresql';
}

/**
 * Case-insensitive "contains" filter for a string column.
 *
 * Postgres needs `mode: 'insensitive'`. SQLite's LIKE is already case-insensitive
 * (for ASCII letters only, so "ä" will not match "Ä"), and its Prisma client has
 * no `mode` option.
 */
export function textContains(value: string): { contains: string; mode?: 'insensitive' } {
	return dbProvider() === 'sqlite' ? { contains: value } : { contains: value, mode: 'insensitive' };
}

/**
 * One-time connection setup. On SQLite, WAL mode lets reads proceed while a write
 * is in progress (it is stored in the database file, so setting it once is enough).
 * Lock waits are configured with `?socket_timeout=<seconds>` on the DATABASE_URL.
 */
export async function configureDatabase(db: {
	$queryRawUnsafe: (sql: string) => Promise<unknown>;
}): Promise<void> {
	if (dbProvider() !== 'sqlite') return;
	await db.$queryRawUnsafe('PRAGMA journal_mode = WAL');
}

/**
 * Interactive transaction timeouts. SQLite allows one writer at a time, so a
 * transaction may have to wait for another one to finish before it can start.
 */
export function transactionTimeouts(): { maxWait: number; timeout: number } {
	return dbProvider() === 'sqlite'
		? { maxWait: 15_000, timeout: 30_000 }
		: { maxWait: 5_000, timeout: 10_000 };
}
