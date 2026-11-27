/**
 * Login sessions.
 *
 * A successful login sets an HMAC-signed, httpOnly session cookie holding the user id and the
 * user's session version; no session table is needed. Each request reloads the user
 * (`loadSessionUser()` in users.ts), so deactivating a user or resetting a password (which
 * raises the version) ends their sessions at once. Changing AUTH_SECRET ends every session.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { AUTH_PASSWORD, AUTH_SECRET, AUTH_SESSION_HOURS, AUTH_USERNAME } from '$app/env/private';
import type { EnvAdmin } from '#lib/server/users.ts';

export const SESSION_COOKIE = 'sw_session';

/** The always-working admin login from .env. */
export const envAdmin: EnvAdmin = { username: AUTH_USERNAME, password: AUTH_PASSWORD };

/** Constant-time string comparison (hashing first makes lengths equal). */
function safeEqual(a: string, b: string): boolean {
	const ha = createHash('sha256').update(a).digest();
	const hb = createHash('sha256').update(b).digest();
	return timingSafeEqual(ha, hb);
}

function sign(payload: string): string {
	return createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
}

export function createSessionToken(userId: string, sessionVersion: number): { token: string; expires: Date } {
	const expires = new Date(Date.now() + AUTH_SESSION_HOURS * 3600_000);
	const payload = `${userId}.${sessionVersion}.${expires.getTime()}`;
	return { token: `${payload}.${sign(payload)}`, expires };
}

/** The user id and session version in a valid, unexpired cookie, or null. */
export function verifySessionToken(token: string | undefined): { userId: string; sessionVersion: number } | null {
	if (!token) return null;
	const parts = token.split('.');
	if (parts.length !== 4) return null;
	const [userId, version, expPart, signature] = parts;
	if (!safeEqual(signature, sign(`${userId}.${version}.${expPart}`))) return null;
	if (!(Number(expPart) > Date.now())) return null;
	const sessionVersion = Number(version);
	if (!Number.isInteger(sessionVersion)) return null;
	return { userId, sessionVersion };
}

export function setSessionCookie(cookies: Cookies, url: URL, userId: string, sessionVersion: number): void {
	const { token, expires } = createSessionToken(userId, sessionVersion);
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		// Allow plain-HTTP demos; behind HTTPS the cookie is marked Secure
		secure: url.protocol === 'https:',
		expires
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

/** Only allow same-site relative redirect targets after login. */
export function safeRedirectTarget(target: string | null): string {
	if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return '/';
	return target;
}

// --- Brute-force protection: simple in-memory limiter per client address ---

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60_000;
const attempts = new Map<string, { count: number; resetAt: number }>();

/** Returns seconds until the client may retry, or 0 if allowed. */
export function loginRetryAfter(key: string): number {
	const entry = attempts.get(key);
	if (!entry || entry.resetAt <= Date.now()) return 0;
	return entry.count >= MAX_ATTEMPTS ? Math.ceil((entry.resetAt - Date.now()) / 1000) : 0;
}

export function recordFailedLogin(key: string): void {
	const now = Date.now();
	const entry = attempts.get(key);
	if (!entry || entry.resetAt <= now) {
		attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
	} else {
		entry.count++;
	}
	// Keep the map from growing without bound
	if (attempts.size > 10_000) {
		for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k);
	}
}

export function clearFailedLogins(key: string): void {
	attempts.delete(key);
}
