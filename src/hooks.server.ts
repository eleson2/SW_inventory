import type { Handle } from '@sveltejs/kit/hooks';
import { error, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { SESSION_COOKIE, verifySessionToken } from '#lib/server/auth.ts';

/** Routes reachable without logging in. */
const PUBLIC_PATHS = ['/login'];

export const handle: Handle = async ({ event, resolve }) => {
	// make prisma available on event.locals.prisma for all server routes
	event.locals.prisma = db;
	event.locals.user = verifySessionToken(event.cookies.get(SESSION_COOKIE));

	const path = event.url.pathname;
	const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

	if (!event.locals.user && !isPublic) {
		if (path.startsWith('/api/')) {
			error(401, 'Authentication required');
		}
		redirect(303, `/login?redirectTo=${encodeURIComponent(path + event.url.search)}`);
	}

	const response = await resolve(event);
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'same-origin');
	return response;
};
