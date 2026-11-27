/**
 * Editors per customer, vendor and package: scoped `editor` roles in `user_roles`, one of which
 * may be the contact (the responsible person). Only administrators assign them; the actions
 * are mounted on each detail page (`editorActions('customer')` etc.) with `<EditorsCard>`.
 */
import { fail, type RequestEvent } from '@sveltejs/kit';
import type { Prisma } from '@prisma/client';
import { db, createAuditLog } from '#lib/server/db.ts';
import { requireAdmin } from '#lib/server/permissions.ts';
import { can, type ScopeType } from '#lib/utils/permissions.ts';

type Client = Prisma.TransactionClient | typeof db;

export interface Editor {
	/** user_roles id */
	id: string;
	user_id: string;
	username: string;
	display_name: string;
	active: boolean;
	is_contact: boolean;
}

export interface EditorsData {
	editors: Editor[];
	/** Users that can be added (admins only, else empty) */
	candidates: { id: string; username: string; display_name: string }[];
	canManage: boolean;
}

/** The editors of one customer, vendor or package (contact first), plus what the admin form needs. */
export async function loadEditors(scopeType: ScopeType, scopeId: string, viewer: App.Locals['user']): Promise<EditorsData> {
	const rows = await db.user_roles.findMany({
		where: { role: 'editor', scope_type: scopeType, scope_id: scopeId },
		include: { user: { select: { username: true, display_name: true, active: true } } }
	});
	const editors = rows
		.map((r) => ({
			id: r.id,
			user_id: r.user_id,
			username: r.user.username,
			display_name: r.user.display_name,
			active: r.user.active,
			is_contact: r.is_contact
		}))
		.sort((a, b) => Number(b.is_contact) - Number(a.is_contact) || a.display_name.localeCompare(b.display_name));
	const canManage = can(viewer, 'manage_users');
	const candidates = canManage
		? (
				await db.users.findMany({
					where: { active: true },
					select: { id: true, username: true, display_name: true },
					orderBy: { display_name: 'asc' }
				})
			).filter((u) => !editors.some((e) => e.user_id === u.id))
		: [];
	return { editors, candidates, canManage };
}

const scopeName = async (scopeType: ScopeType, id: string) => {
	const where = { where: { id }, select: { name: true } };
	const row =
		scopeType === 'customer'
			? await db.customers.findUnique(where)
			: scopeType === 'vendor'
				? await db.vendors.findUnique(where)
				: await db.packages.findUnique(where);
	return row?.name ?? null;
};

/** Make one editor the contact of the scope (clearing any other), or none. */
async function setContactIn(client: Client, scopeType: ScopeType, scopeId: string, roleId: string | null) {
	await client.user_roles.updateMany({
		where: { role: 'editor', scope_type: scopeType, scope_id: scopeId, is_contact: true, ...(roleId && { id: { not: roleId } }) },
		data: { is_contact: false }
	});
	if (roleId) await client.user_roles.update({ where: { id: roleId }, data: { is_contact: true } });
}

/** Add a user as editor (and contact) of a scope; an existing editor just gets the contact flag. */
export async function addEditor(client: Client, scopeType: ScopeType, scopeId: string, userId: string, contact: boolean) {
	const existing = await client.user_roles.findFirst({
		where: { user_id: userId, role: 'editor', scope_type: scopeType, scope_id: scopeId }
	});
	const role =
		existing ??
		(await client.user_roles.create({ data: { user_id: userId, role: 'editor', scope_type: scopeType, scope_id: scopeId } }));
	if (contact) await setContactIn(client, scopeType, scopeId, role.id);
	return role;
}

/** Remove every role on a customer, vendor or package (when it is deleted). */
export const removeScopeRoles = (scopeType: ScopeType, scopeId: string, client: Client = db) =>
	client.user_roles.deleteMany({ where: { scope_type: scopeType, scope_id: scopeId } });

/** Form actions for a detail page whose `params.id` is the scope id. */
export function editorActions(scopeType: ScopeType) {
	const audit = (scopeId: string, change: Record<string, unknown>) => createAuditLog(scopeType, scopeId, 'update', { editors: change });

	return {
		addEditor: async ({ request, locals, params }: RequestEvent) => {
			requireAdmin(locals);
			const scopeId = params.id!;
			const form = await request.formData();
			const userId = String(form.get('user_id') ?? '');
			const contact = form.get('contact') === 'on';
			const user = userId ? await db.users.findUnique({ where: { id: userId } }) : null;
			if (!user || !user.active) return fail(400, { editorError: 'Pick an active user.' });
			if (!(await scopeName(scopeType, scopeId))) return fail(404, { editorError: 'Not found.' });
			await addEditor(db, scopeType, scopeId, userId, contact);
			await audit(scopeId, { added: user.username, ...(contact && { contact: user.username }) });
			return { editorSaved: `${user.display_name} added${contact ? ' as contact' : ''}.` };
		},

		removeEditor: async ({ request, locals, params }: RequestEvent) => {
			requireAdmin(locals);
			const roleId = String((await request.formData()).get('role_id') ?? '');
			const role = await db.user_roles.findFirst({
				where: { id: roleId, role: 'editor', scope_type: scopeType, scope_id: params.id },
				include: { user: { select: { username: true, display_name: true } } }
			});
			if (!role) return fail(404, { editorError: 'That editor was already removed.' });
			await db.user_roles.delete({ where: { id: role.id } });
			await audit(params.id!, { removed: role.user.username });
			return { editorSaved: `${role.user.display_name} removed.` };
		},

		setContact: async ({ request, locals, params }: RequestEvent) => {
			requireAdmin(locals);
			const roleId = String((await request.formData()).get('role_id') ?? '') || null;
			const role = roleId
				? await db.user_roles.findFirst({
						where: { id: roleId, role: 'editor', scope_type: scopeType, scope_id: params.id },
						include: { user: { select: { username: true, display_name: true } } }
					})
				: null;
			if (roleId && !role) return fail(404, { editorError: 'That editor was removed.' });
			await setContactIn(db, scopeType, params.id!, role?.id ?? null);
			await audit(params.id!, { contact: role?.user.username ?? null });
			return { editorSaved: role ? `${role.user.display_name} is now the contact.` : 'No contact.' };
		}
	};
}

export interface Responsibility {
	id: string;
	scope_type: ScopeType;
	scope_id: string;
	name: string | null;
	is_contact: boolean;
}

/** What a user is editor of (for the user and account pages), named and sorted. */
export async function loadResponsibilities(userId: string): Promise<Responsibility[]> {
	const rows = await db.user_roles.findMany({ where: { user_id: userId, role: 'editor', scope_type: { not: null } } });
	const ids = (type: ScopeType) => rows.filter((r) => r.scope_type === type).map((r) => r.scope_id!);
	const select = { id: true, name: true } as const;
	const [customers, vendors, packages] = await Promise.all([
		db.customers.findMany({ where: { id: { in: ids('customer') } }, select }),
		db.vendors.findMany({ where: { id: { in: ids('vendor') } }, select }),
		db.packages.findMany({ where: { id: { in: ids('package') } }, select: { id: true, name: true, version: true } })
	]);
	const names = new Map<string, string>([
		...customers.map((c) => [c.id, c.name] as const),
		...vendors.map((v) => [v.id, v.name] as const),
		...packages.map((p) => [p.id, `${p.name} ${p.version}`] as const)
	]);
	const order: ScopeType[] = ['customer', 'vendor', 'package'];
	return rows
		.map((r) => ({
			id: r.id,
			scope_type: r.scope_type as ScopeType,
			scope_id: r.scope_id!,
			name: names.get(r.scope_id!) ?? null,
			is_contact: r.is_contact
		}))
		.sort((a, b) => order.indexOf(a.scope_type) - order.indexOf(b.scope_type) || (a.name ?? '').localeCompare(b.name ?? ''));
}
