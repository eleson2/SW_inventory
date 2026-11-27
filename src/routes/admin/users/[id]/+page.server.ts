import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { envAdmin } from '#lib/server/auth.ts';
import { requireAdmin } from '#lib/server/permissions.ts';
import { normalizeUsername, readUserForm, setPassword, updateUser, UserError } from '#lib/server/users.ts';

export const load: PageServerLoad = async ({ params }) => {
	const user = await db.users.findUnique({
		where: { id: params.id },
		select: {
			id: true,
			username: true,
			display_name: true,
			email: true,
			is_admin: true,
			can_create_packages: true,
			active: true,
			password_hash: true,
			last_login_at: true,
			created_at: true
		}
	});
	if (!user) error(404, 'User not found');
	const { password_hash, ...rest } = user;
	return {
		user: { ...rest, has_password: !!password_hash },
		isEnvUser: user.username === normalizeUsername(envAdmin.username)
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
