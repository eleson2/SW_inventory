/**
 * Editors per customer / vendor / package (scoped editor roles): assigning, the single contact,
 * the admin-only form actions, what a user is responsible for, and cleanup on delete.
 */
import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import { testDb, cleanupTestDatabase, seedTestData, disconnectTestDatabase } from '../../prisma/test-helpers';

vi.mock('../../src/lib/server/db.ts', async () => {
	const { testDb } = await import('../../prisma/test-helpers');
	return {
		db: testDb,
		createAuditLog: (entity_type: string, entity_id: string, action: string, changes: object, user_id?: string) =>
			testDb.audit_log.create({ data: { entity_type, entity_id, action, changes, user_id } })
	};
});

const { addEditor, editorActions, loadEditors, loadResponsibilities, removeScopeRoles } = await import(
	'../../src/lib/server/editors.ts'
);
const { loadSessionUser } = await import('../../src/lib/server/users.ts');
const { can } = await import('../../src/lib/utils/permissions.ts');

const envAdmin = { username: 'admin', password: 'x' };

describe('editors', () => {
	let acme: { id: string; name: string };
	let ibm: { id: string };
	let anna: { id: string };
	let bo: { id: string };
	let admin: { id: string };

	afterAll(async () => {
		await disconnectTestDatabase();
	});

	beforeEach(async () => {
		await cleanupTestDatabase();
		const data = await seedTestData();
		acme = data.customers.acme;
		ibm = data.vendors.ibm;
		anna = await testDb.users.create({ data: { username: 'anna', display_name: 'Anna' } });
		bo = await testDb.users.create({ data: { username: 'bo', display_name: 'Bo' } });
		admin = await testDb.users.create({ data: { username: 'boss', display_name: 'Boss', roles: { create: { role: 'admin' } } } });
	});

	const sessionOf = async (id: string) => (await loadSessionUser(id, 0, envAdmin))!;

	it('makes a customer editor able to change that customer only', async () => {
		await addEditor(testDb, 'customer', acme.id, anna.id, false);
		const user = await sessionOf(anna.id);
		expect(can(user, 'edit_lpar', { customer: acme.id })).toBe(true);
		expect(can(user, 'edit_lpar', { customer: crypto.randomUUID() })).toBe(false);
		expect(can(user, 'edit_software', { vendor: ibm.id })).toBe(false);
		expect(await loadResponsibilities(anna.id)).toMatchObject([{ scope_type: 'customer', name: acme.name, is_contact: false }]);
	});

	it('keeps one contact per scope and does not duplicate editors', async () => {
		await addEditor(testDb, 'customer', acme.id, anna.id, true);
		await addEditor(testDb, 'customer', acme.id, bo.id, true);
		await addEditor(testDb, 'customer', acme.id, bo.id, false); // again: no second row
		const { editors, candidates, canManage } = await loadEditors('customer', acme.id, await sessionOf(admin.id));
		expect(editors.map((e) => [e.username, e.is_contact])).toEqual([
			['bo', true],
			['anna', false]
		]);
		expect(canManage).toBe(true);
		expect(candidates.map((u) => u.username)).toEqual(['boss']);

		// Non-admins see the list but get no candidates
		expect((await loadEditors('customer', acme.id, await sessionOf(anna.id))).candidates).toEqual([]);
	});

	it('runs the form actions for admins only and audits them', async () => {
		const actions = editorActions('customer');
		const event = (userId: string, fields: Record<string, string>) => {
			const body = new FormData();
			for (const [k, v] of Object.entries(fields)) body.set(k, v);
			return sessionOf(userId).then(
				(user) =>
					({
						request: new Request('http://x', { method: 'POST', body }),
						locals: { user },
						params: { id: acme.id }
					}) as never
			);
		};

		await expect(actions.addEditor(await event(anna.id, { user_id: anna.id }))).rejects.toMatchObject({ status: 403 });

		expect(await actions.addEditor(await event(admin.id, { user_id: anna.id, contact: 'on' }))).toMatchObject({
			editorSaved: expect.stringContaining('contact')
		});
		const role = await testDb.user_roles.findFirstOrThrow({ where: { user_id: anna.id, scope_type: 'customer' } });
		expect(role.is_contact).toBe(true);

		await actions.setContact(await event(admin.id, { role_id: '' }));
		expect((await testDb.user_roles.findUniqueOrThrow({ where: { id: role.id } })).is_contact).toBe(false);

		await actions.removeEditor(await event(admin.id, { role_id: role.id }));
		expect(await testDb.user_roles.count({ where: { scope_type: 'customer' } })).toBe(0);

		const audit = await testDb.audit_log.findMany({ where: { entity_id: acme.id }, orderBy: { timestamp: 'asc' } });
		expect(audit.map((a) => a.changes)).toEqual([
			{ editors: { added: 'anna', contact: 'anna' } },
			{ editors: { contact: null } },
			{ editors: { removed: 'anna' } }
		]);
	});

	it('removes the roles of a deleted scope', async () => {
		await addEditor(testDb, 'vendor', ibm.id, anna.id, true);
		await addEditor(testDb, 'customer', acme.id, anna.id, false);
		await removeScopeRoles('vendor', ibm.id);
		expect((await loadResponsibilities(anna.id)).map((r) => r.scope_type)).toEqual(['customer']);
	});
});
