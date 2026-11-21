/**
 * Minimal single-user authentication for demo deployments.
 *
 * Credentials come from AUTH_USERNAME / AUTH_PASSWORD (see src/env.ts). A successful login
 * sets an HMAC-signed, httpOnly session cookie; no session table is needed. Changing
 * AUTH_SECRET invalidates every outstanding session.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { AUTH_PASSWORD, AUTH_SECRET, AUTH_SESSION_HOURS, AUTH_USERNAME } from '$app/env/private';

export const SESSION_COOKIE = 'sw_session';

export interface SessionUser {
	username: string;
}

/** Constant-time string comparison (hashing first makes lengths equal). */
function safeEqual(a: string, b: string): boolean {
	const ha = createHash('sha256').update(a).digest();
	const hb = createHash('sha256').update(b).digest();
	return timingSafeEqual(ha, hb);
}

function sign(payload: string): string {
	return createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
}

export function checkCredentials(username: string, password: string): boolean {
	// Evaluate both so timing does not reveal which one was wrong
	const userOk = safeEqual(username, AUTH_USERNAME);
	const passOk = safeEqual(password, AUTH_PASSWORD);
	return userOk && passOk;
}

export function createSessionToken(username: string): { token: string; expires: Date } {
	const expires = new Date(Date.now() + AUTH_SESSION_HOURS * 3600_000);
	const payload = `${Buffer.from(username).toString('base64url')}.${expires.getTime()}`;
	return { token: `${payload}.${sign(payload)}`, expires };
}

export function verifySessionToken(token: string | undefined): SessionUser | null {
	if (!token) return null;
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	const [userPart, expPart, signature] = parts;
	if (!safeEqual(signature, sign(`${userPart}.${expPart}`))) return null;
	if (!(Number(expPart) > Date.now())) return null;
	const username = Buffer.from(userPart, 'base64url').toString();
	// Sessions for a renamed user are no longer valid
	if (!safeEqual(username, AUTH_USERNAME)) return null;
	return { username };
}

export function setSessionCookie(cookies: Cookies, url: URL, username: string): void {
	const { token, expires } = createSessionToken(username);
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
