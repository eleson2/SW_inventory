import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	clearFailedLogins,
	envAdmin,
	loginRetryAfter,
	recordFailedLogin,
	safeRedirectTarget,
	setSessionCookie
} from '#lib/server/auth.ts';
import { authenticate } from '#lib/server/users.ts';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeRedirectTarget(url.searchParams.get('redirectTo')));
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const clientKey = getClientAddress();

		const retryAfter = loginRetryAfter(clientKey);
		if (retryAfter > 0) {
			return fail(429, {
				username,
				message: `Too many failed attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`
			});
		}

		const login = await authenticate(username, password, envAdmin);
		if (!login) {
			recordFailedLogin(clientKey);
			return fail(400, { username, message: 'Invalid username or password' });
		}

		clearFailedLogins(clientKey);
		setSessionCookie(cookies, url, login.user.id, login.sessionVersion);
		redirect(303, safeRedirectTarget(url.searchParams.get('redirectTo')));
	}
};
