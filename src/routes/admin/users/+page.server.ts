import type { PageServerLoad } from './$types';
import { db } from '#lib/server/db.ts';
import { envAdmin } from '#lib/server/auth.ts';
import { globalRoles, normalizeUsername } from '#lib/server/users.ts';

export const load: PageServerLoad = async () => {
	const users = await db.users.findMany({
		orderBy: [{ active: 'desc' }, { username: 'asc' }],
		select: {
			id: true,
			username: true,
			display_name: true,
			email: true,
			roles: { select: { role: true, scope_type: true } },
			active: true,
			last_login_at: true
		}
	});
	return {
		users: users.map(({ roles, ...user }) => ({ ...user, roles: globalRoles({ roles }) })),
		envUsername: normalizeUsername(envAdmin.username)
	};
};
