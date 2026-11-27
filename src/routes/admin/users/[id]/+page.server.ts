import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { envAdmin } from '#lib/server/auth.ts';
import { requireAdmin } from '#lib/server/permissions.ts';
import { loadResponsibilities } from '#lib/server/editors.ts';
import { globalRoles, normalizeUsername, readUserForm, setPassword, updateUser, UserError } from '#lib/server/users.ts';

export const load: PageServerLoad = async ({ params }) => {
	const user = await db.users.findUnique({
		where: { id: params.id },
		select: {
			id: true,
			username: true,
			display_name: true,
			email: true,
			roles: { select: { role: true, scope_type: true } },
			active: true,
			password_hash: true,
			last_login_at: true,
			created_at: true
		}
	});
	if (!user) error(404, 'User not found');
	const { password_hash, roles, ...rest } = user;
	return {
		user: { ...rest, roles: globalRoles({ roles }), has_password: !!password_hash },
		isEnvUser: user.username === normalizeUsername(envAdmin.username),
		responsibilities: await loadResponsibilities(user.id)
	};
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const actor = requireAdmin(locals);
		const form = await request.formData();
		try {
			await updateUser(params.id, readUserForm(form), envAdmin, actor.id);
		} catch (e) {
			if (e instanceof UserError) return fail(400, { error: e.message });
			throw e;
		}
		return { saved: true };
	},

	password: async ({ request, locals, params }) => {
		const actor = requireAdmin(locals);
		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		if (password !== String(form.get('confirm') ?? '')) return fail(400, { error: 'The passwords do not match.' });
		try {
			await setPassword(params.id, password, envAdmin, actor.id);
		} catch (e) {
			if (e instanceof UserError) return fail(400, { error: e.message });
			throw e;
		}
		return { passwordSet: true };
	}
};
