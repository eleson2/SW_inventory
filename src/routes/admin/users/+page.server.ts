import type { PageServerLoad } from './$types';
import { db } from '#lib/server/db.ts';
import { envAdmin } from '#lib/server/auth.ts';
import { normalizeUsername } from '#lib/server/users.ts';

export const load: PageServerLoad = async () => {
	const users = await db.users.findMany({
		orderBy: [{ active: 'desc' }, { username: 'asc' }],
		select: {
			id: true,
			username: true,
			display_name: true,
			email: true,
			is_admin: true,
			can_create_packages: true,
			active: true,
			last_login_at: true
		}
	});
	return { users, envUsername: normalizeUsername(envAdmin.username) };
};
