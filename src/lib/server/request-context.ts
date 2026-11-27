/**
 * Per-request context: who is acting. `hooks.server.ts` runs every request inside it, so
 * code deep down (audit log, install history) records the acting user without every caller
 * passing it along. Outside a request (scripts, tests) there is no user.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
	userId: string | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithUser = <T>(userId: string | null, fn: () => T): T => storage.run({ userId }, fn);

/** The logged-in user of the current request, or null. */
export const currentUserId = (): string | null => storage.getStore()?.userId ?? null;
