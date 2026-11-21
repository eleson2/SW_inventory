import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	checkCredentials,
	clearFailedLogins,
	loginRetryAfter,
	recordFailedLogin,
	safeRedirectTarget,
	setSessionCookie
} from '#lib/server/auth.ts';

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

		if (!checkCredentials(username, password)) {
			recordFailedLogin(clientKey);
			return fail(400, { username, message: 'Invalid username or password' });
		}

		clearFailedLogins(clientKey);
		setSessionCookie(cookies, url, username);
		redirect(303, safeRedirectTarget(url.searchParams.get('redirectTo')));
	}
};
