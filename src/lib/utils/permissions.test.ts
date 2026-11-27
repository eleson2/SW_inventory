import { describe, it, expect } from 'vitest';
import {
	allowedScopeIds,
	can,
	canAnywhere,
	filterAllowed,
	GLOBAL_ROLES,
	hasGlobalRole,
	isRoleName,
	type RoleAssignment
} from './permissions.ts';

const user = (...roles: Partial<RoleAssignment>[]) => ({
	roles: roles.map((r) => ({ role: 'admin', scope_type: null, scope_id: null, is_contact: false, ...r }))
});

const acmeEditor = user({ role: 'editor', scope_type: 'customer', scope_id: 'acme' });
const ibmEditor = user({ role: 'editor', scope_type: 'vendor', scope_id: 'ibm' });
const pkgEditor = user({ role: 'editor', scope_type: 'package', scope_id: 'q1' });

describe('can', () => {
	it('refuses without a user or roles', () => {
		expect(can(null, 'manage_users')).toBe(false);
		expect(can(undefined, 'create_package')).toBe(false);
		expect(can(user(), 'create_package')).toBe(false);
	});

	it('lets a global admin do everything', () => {
		const admin = user({ role: 'admin' });
		expect(can(admin, 'manage_users')).toBe(true);
		expect(can(admin, 'edit_lpar', { customer: 'c1' })).toBe(true);
	});

	it('limits a role to its actions', () => {
		const creator = user({ role: 'package_creator' });
		expect(can(creator, 'create_package')).toBe(true);
		expect(can(creator, 'manage_users')).toBe(false);
		expect(can(creator, 'edit_package', { package: 'q1' })).toBe(false);
	});

	it('lets a global editor change everything but users, top-level records and LPARs', () => {
		const editor = user({ role: 'editor' });
		expect(can(editor, 'edit_customer', { customer: 'x' })).toBe(true);
		expect(can(editor, 'edit_bundle', { vendor: 'x' })).toBe(true);
		expect(can(editor, 'edit_package', { package: 'y' })).toBe(true);
		expect(can(editor, 'edit_lpar', { customer: 'x' })).toBe(false);
		expect(can(editor, 'deploy_package', { customer: 'x' })).toBe(false);
		expect(can(editor, 'plan_rollout', { customer: 'x' })).toBe(false);
		expect(can(editor, 'manage_users')).toBe(false);
		expect(can(editor, 'manage_customers')).toBe(false);
		expect(can(editor, 'create_package')).toBe(false);
	});

	it('applies a customer editor to that customer and its LPARs only', () => {
		expect(can(acmeEditor, 'edit_customer', { customer: 'acme' })).toBe(true);
		expect(can(acmeEditor, 'edit_lpar', { customer: 'acme' })).toBe(true);
		expect(can(acmeEditor, 'edit_lpar', { customer: 'globex' })).toBe(false);
		expect(can(acmeEditor, 'edit_lpar')).toBe(false);
		// The id must match the scope type, not just any id
		expect(can(acmeEditor, 'edit_vendor', { vendor: 'acme' })).toBe(false);
		expect(can(acmeEditor, 'manage_customers')).toBe(false);
	});

	it('applies a vendor editor to its software and bundles', () => {
		expect(can(ibmEditor, 'edit_software', { vendor: 'ibm' })).toBe(true);
		expect(can(ibmEditor, 'edit_bundle', { vendor: 'ibm' })).toBe(true);
		expect(can(ibmEditor, 'edit_software', { vendor: 'broadcom' })).toBe(false);
		expect(can(ibmEditor, 'edit_lpar', { customer: 'acme' })).toBe(false);
	});

	it('allows rollouts and deploys only to editors of the LPAR customer and admins', () => {
		const target = { customer: 'acme', package: 'q1' };
		expect(can(acmeEditor, 'deploy_package', target)).toBe(true);
		expect(can(acmeEditor, 'plan_rollout', { customer: 'globex', package: 'q1' })).toBe(false);
		expect(can(pkgEditor, 'deploy_package', target)).toBe(false);
		expect(can(pkgEditor, 'plan_rollout', target)).toBe(false);
		expect(can(pkgEditor, 'edit_package', { package: 'q1' })).toBe(true);
		expect(can(ibmEditor, 'deploy_package', target)).toBe(false);
		expect(can(user({ role: 'admin' }), 'deploy_package', target)).toBe(true);
	});

	it('grants nothing for unknown roles', () => {
		expect(can(user({ role: 'superuser' }), 'manage_users')).toBe(false);
		expect(isRoleName('toString')).toBe(false);
	});
});

describe('canAnywhere / allowedScopeIds', () => {
	it('answers whether an action is allowed somewhere', () => {
		expect(canAnywhere(acmeEditor, 'edit_lpar')).toBe(true);
		expect(canAnywhere(acmeEditor, 'edit_software')).toBe(false); // the role allows it, but only on a vendor
		expect(canAnywhere(pkgEditor, 'deploy_package')).toBe(false);
		expect(canAnywhere(user({ role: 'editor' }), 'edit_lpar')).toBe(false);
		expect(canAnywhere(user({ role: 'package_creator' }), 'edit_lpar')).toBe(false);
		expect(canAnywhere(null, 'edit_lpar')).toBe(false);
	});

	it('lists the scope ids, or all for a global role', () => {
		const two = user(
			{ role: 'editor', scope_type: 'customer', scope_id: 'acme' },
			{ role: 'editor', scope_type: 'customer', scope_id: 'globex' },
			{ role: 'editor', scope_type: 'vendor', scope_id: 'ibm' }
		);
		expect(allowedScopeIds(two, 'edit_lpar', 'customer')).toEqual(['acme', 'globex']);
		expect(allowedScopeIds(two, 'edit_software', 'vendor')).toEqual(['ibm']);
		expect(allowedScopeIds(user({ role: 'editor' }), 'edit_customer', 'customer')).toBe('all');
		expect(allowedScopeIds(user({ role: 'editor' }), 'edit_lpar', 'customer')).toEqual([]);
		expect(allowedScopeIds(user({ role: 'package_creator' }), 'edit_lpar', 'customer')).toEqual([]);

		const customers = [{ id: 'acme' }, { id: 'globex' }, { id: 'initech' }];
		expect(filterAllowed(two, 'edit_lpar', 'customer', customers, (c) => c.id).map((c) => c.id)).toEqual(['acme', 'globex']);
	});
});

describe('roles', () => {
	it('lists the global roles and finds them on a user', () => {
		expect(GLOBAL_ROLES).toEqual(['admin', 'editor', 'package_creator']);
		const u = user({ role: 'package_creator' }, { role: 'admin', scope_type: 'customer', scope_id: 'x' });
		expect(hasGlobalRole(u, 'package_creator')).toBe(true);
		expect(hasGlobalRole(u, 'admin')).toBe(false);
	});
});
