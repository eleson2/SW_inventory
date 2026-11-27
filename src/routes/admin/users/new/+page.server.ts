import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { envAdmin } from '#lib/server/auth.ts';
import { requireAdmin } from '#lib/server/permissions.ts';
import { createUser, readUserForm, UserError } from '#lib/server/users.ts';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const actor = requireAdmin(locals);
		const form = await request.formData();
		let id: string;
		try {
			const user = await createUser(readUserForm(form), String(form.get('password') ?? ''), envAdmin, actor.id);
			id = user.id;
		} catch (e) {
			if (e instanceof UserError) return fail(400, { error: e.message, values: Object.fromEntries(form) });
			throw e;
		}
		redirect(303, `/admin/users/${id}`);
	}
};
