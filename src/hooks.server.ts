import type { Handle } from '@sveltejs/kit/hooks';
import { error, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { SESSION_COOKIE, envAdmin, verifySessionToken } from '#lib/server/auth.ts';
import { ensureLegacyRolesMigrated, loadSessionUser } from '#lib/server/users.ts';
import { can } from '#lib/utils/permissions.ts';

/** Routes reachable without logging in. */
const PUBLIC_PATHS = ['/login'];

export const handle: Handle = async ({ event, resolve }) => {
	// make prisma available on event.locals.prisma for all server routes
	event.locals.prisma = db;
	// Phase-1 rights flags -> user_roles, once per process (before anyone's rights are read)
	await ensureLegacyRolesMigrated();
	const session = verifySessionToken(event.cookies.get(SESSION_COOKIE));
	event.locals.user = session ? await loadSessionUser(session.userId, session.sessionVersion, envAdmin) : null;

	const path = event.url.pathname;
	const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

	if (!event.locals.user && !isPublic) {
		if (path.startsWith('/api/')) {
			error(401, 'Authentication required');
		}
		redirect(303, `/login?redirectTo=${encodeURIComponent(path + event.url.search)}`);
	}

	// User administration; the actions check again (requireAdmin)
	if (path === '/admin' || path.startsWith('/admin/')) {
		if (!can(event.locals.user, 'manage_users')) error(403, 'Only administrators can manage users');
	}

	const response = await resolve(event);
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'same-origin');
	return response;
};
