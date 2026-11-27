import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { envAdmin, setSessionCookie } from '#lib/server/auth.ts';
import { requireUser } from '#lib/server/permissions.ts';
import { changeOwnPassword, UserError } from '#lib/server/users.ts';

export const load: PageServerLoad = ({ locals }) => {
	const user = requireUser(locals);
	return { isEnvUser: user.is_env_user };
};

export const actions: Actions = {
	password: async ({ request, locals, cookies, url }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		if (password !== String(form.get('confirm') ?? '')) return fail(400, { error: 'The new passwords do not match.' });
		try {
			const updated = await changeOwnPassword(user.id, String(form.get('current') ?? ''), password, envAdmin);
			// Other sessions end; keep this one with the new session version
			setSessionCookie(cookies, url, updated.id, updated.session_version);
		} catch (e) {
			if (e instanceof UserError) return fail(400, { error: e.message });
			throw e;
		}
		return { passwordSet: true };
	}
};
