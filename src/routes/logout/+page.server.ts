import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { clearSessionCookie } from '#lib/server/auth.ts';

// Logging out is a POST (form in the header); a plain GET just goes home
export const load: PageServerLoad = () => {
	redirect(303, '/');
};

export const actions: Actions = {
	default: ({ cookies }) => {
		clearSessionCookie(cookies);
		redirect(303, '/login');
	}
};
