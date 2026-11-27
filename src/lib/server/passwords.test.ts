import { describe, it, expect } from 'vitest';
import { hashPassword, passwordProblem, verifyPassword } from './passwords.ts';

describe('passwords', () => {
	it('verifies the password it hashed, and nothing else', async () => {
		const hash = await hashPassword('correct horse');
		expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[\w-]+\$[\w-]+$/);
		expect(await verifyPassword('correct horse', hash)).toBe(true);
		expect(await verifyPassword('correct hors', hash)).toBe(false);
	});

	it('salts every hash', async () => {
		expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
	});

	it('never matches a missing or malformed hash', async () => {
		expect(await verifyPassword('x', null)).toBe(false);
		expect(await verifyPassword('x', '')).toBe(false);
		expect(await verifyPassword('x', 'plain-text')).toBe(false);
	});

	it('rejects short passwords and the username', () => {
		expect(passwordProblem('short')).toMatch(/at least 8/);
		expect(passwordProblem('Erland.L', 'erland.l')).toMatch(/username/);
		expect(passwordProblem('long enough')).toBeNull();
	});
});
