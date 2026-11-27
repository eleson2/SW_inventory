/**
 * User accounts: login (including the .env admin), session versions, and the admin rules.
 */
import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import { testDb, cleanupTestDatabase, disconnectTestDatabase } from '../../prisma/test-helpers';

vi.mock('../../src/lib/server/db.ts', async () => {
	const { testDb } = await import('../../prisma/test-helpers');
	return {
		db: testDb,
		createAuditLog: (entity_type: string, entity_id: string, action: string, changes: object, user_id?: string) =>
			testDb.audit_log.create({ data: { entity_type, entity_id, action, changes, user_id } })
	};
});

const {
	authenticate,
	loadSessionUser,
	createUser,
	updateUser,
	setPassword,
	changeOwnPassword,
	readUserForm,
	globalRoles,
	migrateLegacyRoles,
	UserError
} = await import('../../src/lib/server/users.ts');
const { can } = await import('../../src/lib/utils/permissions.ts');

const envAdmin = { username: 'Admin', password: 'env-password' };

const form = (fields: Record<string, string>, roles: string[] = []) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(fields)) f.set(k, v);
	for (const role of roles) f.append('role', role);
	return f;
};

describe('users', () => {
	afterAll(async () => {
		await disconnectTestDatabase();
	});

	beforeEach(async () => {
		await cleanupTestDatabase();
	});

	it('logs in the .env user as an admin and adds it to users', async () => {
		expect(await authenticate('admin', 'wrong', envAdmin)).toBeNull();
		const login = await authenticate(' ADMIN ', 'env-password', envAdmin);
		expect(login?.user).toMatchObject({ username: 'admin', is_env_user: true });
		expect(can(login!.user, 'manage_users')).toBe(true);
		expect(await testDb.users.count()).toBe(1);
		// A second login reuses the row
		await authenticate('admin', 'env-password', envAdmin);
		expect(await testDb.users.count()).toBe(1);
		expect(await testDb.user_roles.count()).toBe(1);

		// Its admin role comes back even if removed from the database
		await testDb.user_roles.deleteMany();
		expect(can((await authenticate('admin', 'env-password', envAdmin))!.user, 'manage_users')).toBe(true);
	});

	it('logs in a created user, but not when inactive', async () => {
		const admin = (await authenticate('admin', 'env-password', envAdmin))!.user;
		const input = readUserForm(form({ username: 'Bo.Berg', display_name: 'Bo Berg' }, ['package_creator', 'nonsense']));
		const bo = await createUser(input, 'bo-password', envAdmin, admin.id);
		expect(bo).toMatchObject({ username: 'bo.berg', active: true });
		expect(globalRoles(bo)).toEqual(['package_creator']);

		expect(await authenticate('bo.berg', 'nope', envAdmin)).toBeNull();
		const login = await authenticate('bo.berg', 'bo-password', envAdmin);
		expect(login?.user).toMatchObject({ id: bo.id, is_env_user: false });
		expect(can(login!.user, 'create_package')).toBe(true);
		expect(can(login!.user, 'manage_users')).toBe(false);
		expect(await loadSessionUser(bo.id, login!.sessionVersion, envAdmin)).not.toBeNull();

		// Deactivating ends the session and blocks login
		await updateUser(bo.id, readUserForm(form({ username: 'bo.berg', display_name: 'Bo Berg', active_present: '1' })), envAdmin, admin.id);
		expect(await loadSessionUser(bo.id, login!.sessionVersion, envAdmin)).toBeNull();
		expect(await authenticate('bo.berg', 'bo-password', envAdmin)).toBeNull();

		const audit = await testDb.audit_log.findMany({ where: { entity_id: bo.id } });
		expect(audit.map((a) => a.action).sort()).toEqual(['create', 'update']);
		expect(audit.every((a) => a.user_id === admin.id)).toBe(true);
		expect(JSON.stringify(audit)).not.toContain('scrypt');
	});

	it('ends sessions when the password changes', async () => {
		const admin = (await authenticate('admin', 'env-password', envAdmin))!.user;
		const bo = await createUser(readUserForm(form({ username: 'bo', display_name: 'Bo' })), 'bo-password', envAdmin, admin.id);
		const old = (await authenticate('bo', 'bo-password', envAdmin))!;

		await expect(changeOwnPassword(bo.id, 'wrong', 'new-password', envAdmin)).rejects.toThrow(/Current password/);
		const updated = await changeOwnPassword(bo.id, 'bo-password', 'new-password', envAdmin);
		expect(await loadSessionUser(bo.id, old.sessionVersion, envAdmin)).toBeNull();
		expect(await loadSessionUser(bo.id, updated.session_version, envAdmin)).not.toBeNull();
		expect(await authenticate('bo', 'new-password', envAdmin)).not.toBeNull();

		await setPassword(bo.id, 'admin-reset', envAdmin, admin.id);
		expect(await loadSessionUser(bo.id, updated.session_version, envAdmin)).toBeNull();
	});

	it('protects the .env user and stops admins locking themselves out', async () => {
		const admin = (await authenticate('admin', 'env-password', envAdmin))!.user;
		const reserved = readUserForm(form({ username: 'admin', display_name: 'Other' }));
		await expect(createUser(reserved, 'password1', envAdmin, admin.id)).rejects.toThrow(/\.env/);

		// The .env user stays an active admin whatever the form says
		const demoted = readUserForm(form({ username: 'renamed', display_name: 'Boss', active_present: '1' }));
		const kept = await updateUser(admin.id, demoted, envAdmin, 'someone-else');
		expect(kept).toMatchObject({ username: 'admin', display_name: 'Boss', active: true });
		expect(globalRoles(kept)).toEqual(['admin']);
		await expect(setPassword(admin.id, 'password1', envAdmin, admin.id)).rejects.toThrow(/AUTH_PASSWORD/);

		const anna = await createUser(
			readUserForm(form({ username: 'anna', display_name: 'Anna' }, ['admin'])),
			'anna-password',
			envAdmin,
			admin.id
		);
		const selfDemote = readUserForm(form({ username: 'anna', display_name: 'Anna', active_present: '1', active: 'on' }));
		await expect(updateUser(anna.id, selfDemote, envAdmin, anna.id)).rejects.toThrow(UserError);
	});

	it('rejects bad input and duplicate usernames', async () => {
		expect(() => readUserForm(form({ username: 'a b', display_name: 'X' }))).toThrow(/Username/);
		expect(() => readUserForm(form({ username: 'ab', display_name: '' }))).toThrow(/Name/);
		expect(() => readUserForm(form({ username: 'ab', display_name: 'X', email: 'nope' }))).toThrow(/Email/);
		const admin = (await authenticate('admin', 'env-password', envAdmin))!.user;
		await createUser(readUserForm(form({ username: 'bo', display_name: 'Bo' })), 'bo-password', envAdmin, admin.id);
		await expect(
			createUser(readUserForm(form({ username: 'BO', display_name: 'Bo 2' })), 'bo-password', envAdmin, admin.id)
		).rejects.toThrow(/taken/);
		await expect(
			createUser(readUserForm(form({ username: 'cy', display_name: 'Cy' })), 'short', envAdmin, admin.id)
		).rejects.toThrow(/at least 8/);
	});

	it('replaces global roles on edit and keeps scoped ones', async () => {
		const admin = (await authenticate('admin', 'env-password', envAdmin))!.user;
		const bo = await createUser(readUserForm(form({ username: 'bo', display_name: 'Bo' }, ['admin'])), 'bo-password', envAdmin, admin.id);
		const customerId = crypto.randomUUID();
		await testDb.user_roles.create({ data: { user_id: bo.id, role: 'editor', scope_type: 'customer', scope_id: customerId, is_contact: true } });

		const edited = await updateUser(bo.id, readUserForm(form({ username: 'bo', display_name: 'Bo', active_present: '1', active: 'on' }, ['package_creator'])), envAdmin, admin.id);
		expect(globalRoles(edited)).toEqual(['package_creator']);
		expect(edited.roles.filter((r) => r.scope_type === 'customer')).toMatchObject([{ scope_id: customerId, is_contact: true }]);

		const audit = await testDb.audit_log.findFirst({ where: { entity_id: bo.id, action: 'update' } });
		expect(audit?.changes).toMatchObject({ before: { roles: ['admin'] }, after: { roles: ['package_creator'] } });
	});

	it('converts the phase-1 flags into roles once', async () => {
		const old = await testDb.users.create({ data: { username: 'old', display_name: 'Old', is_admin: true, can_create_packages: true } });
		const half = await testDb.users.create({
			data: { username: 'half', display_name: 'Half', can_create_packages: true, roles: { create: { role: 'package_creator' } } }
		});
		expect(await migrateLegacyRoles()).toBe(2);
		expect(await migrateLegacyRoles()).toBe(0);

		const roles = async (id: string) => globalRoles(await testDb.users.findUniqueOrThrow({ where: { id }, include: { roles: true } }));
		expect(await roles(old.id)).toEqual(['admin', 'package_creator']);
		expect(await roles(half.id)).toEqual(['package_creator']);
		expect(await testDb.users.count({ where: { OR: [{ is_admin: true }, { can_create_packages: true }] } })).toBe(0);
	});

	it('ignores cookies from before user accounts', async () => {
		expect(await loadSessionUser('admin', 0, envAdmin)).toBeNull();
	});
});
