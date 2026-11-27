import { describe, it, expect } from 'vitest';
import { can, GLOBAL_ROLES, hasGlobalRole, isRoleName, type RoleAssignment } from './permissions.ts';

const user = (...roles: Partial<RoleAssignment>[]) => ({
	roles: roles.map((r) => ({ role: 'admin', scope_type: null, scope_id: null, is_contact: false, ...r }))
});

describe('can', () => {
	it('refuses without a user or roles', () => {
		expect(can(null, 'manage_users')).toBe(false);
		expect(can(undefined, 'create_package')).toBe(false);
		expect(can(user(), 'create_package')).toBe(false);
	});

	it('lets a global admin do everything', () => {
		const admin = user({ role: 'admin' });
		expect(can(admin, 'manage_users')).toBe(true);
		expect(can(admin, 'create_package', { customer: 'c1' })).toBe(true);
	});

	it('limits a role to its actions', () => {
		const creator = user({ role: 'package_creator' });
		expect(can(creator, 'create_package')).toBe(true);
		expect(can(creator, 'manage_users')).toBe(false);
	});

	it('applies a scoped role only to targets in that scope', () => {
		const acmeOnly = user({ role: 'package_creator', scope_type: 'customer', scope_id: 'acme' });
		expect(can(acmeOnly, 'create_package')).toBe(false);
		expect(can(acmeOnly, 'create_package', { customer: 'globex' })).toBe(false);
		expect(can(acmeOnly, 'create_package', { customer: 'acme' })).toBe(true);
		expect(can(acmeOnly, 'create_package', { vendor: 'acme' })).toBe(false);
	});

	it('grants nothing for unknown roles', () => {
		expect(can(user({ role: 'superuser' }), 'manage_users')).toBe(false);
		expect(isRoleName('toString')).toBe(false);
	});
});

describe('roles', () => {
	it('lists the global roles and finds them on a user', () => {
		expect(GLOBAL_ROLES).toEqual(['admin', 'package_creator']);
		const u = user({ role: 'package_creator' }, { role: 'admin', scope_type: 'customer', scope_id: 'x' });
		expect(hasGlobalRole(u, 'package_creator')).toBe(true);
		expect(hasGlobalRole(u, 'admin')).toBe(false);
	});
});
