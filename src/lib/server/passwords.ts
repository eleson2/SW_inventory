/**
 * Password hashing with scrypt from node:crypto (no extra dependency).
 *
 * Stored format: `scrypt$<N>$<r>$<p>$<salt base64url>$<hash base64url>`, so the cost
 * parameters can be raised later without breaking existing hashes.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

export const MIN_PASSWORD_LENGTH = 8;

function scrypt(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
	return new Promise((resolve, reject) =>
		scryptCb(password, salt, KEY_LENGTH, { ...options, maxmem: 64 * 1024 * 1024 }, (err, key) =>
			err ? reject(err) : resolve(key)
		)
	);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const hash = await scrypt(password, salt, { N, r: R, p: P });
	return ['scrypt', N, R, P, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

/** True when `password` matches `stored`. A missing or malformed hash never matches. */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
	const parts = (stored ?? '').split('$');
	if (parts.length !== 6 || parts[0] !== 'scrypt') {
		// Do the same work anyway, so timing does not reveal that the user has no password
		await scrypt(password, Buffer.alloc(16), { N, r: R, p: P });
		return false;
	}
	const [, n, r, p, salt, hash] = parts;
	const expected = Buffer.from(hash, 'base64url');
	const actual = await scrypt(password, Buffer.from(salt, 'base64url'), { N: Number(n), r: Number(r), p: Number(p) });
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Error message for a new password, or null when it is acceptable. */
export function passwordProblem(password: string, username?: string): string | null {
	if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
	if (password.length > 200) return 'Password must be at most 200 characters.';
	if (username && password.toLowerCase() === username.toLowerCase()) return 'Password must not be the username.';
	return null;
}
