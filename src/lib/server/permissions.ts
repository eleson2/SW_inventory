/**
 * Server-side permission checks for load functions and form actions. The rules themselves
 * (roles, actions, scopes) are in `#lib/utils/permissions.ts`.
 */
import { error } from '@sveltejs/kit';
import { can, type Action, type Target } from '#lib/utils/permissions.ts';

/** The logged-in user, or 401. */
export function requireUser(locals: App.Locals) {
	if (!locals.user) error(401, 'Authentication required');
	return locals.user;
}

const DENIED: Record<Action, string> = {
	manage_users: 'Only administrators can do this',
	create_package: 'You are not allowed to create packages'
};

/** The logged-in user when allowed to do `action` on `target`, else 403. */
export function requirePermission(locals: App.Locals, action: Action, target: Target = {}) {
	const user = requireUser(locals);
	if (!can(user, action, target)) error(403, DENIED[action]);
	return user;
}

/** The logged-in user when an administrator (may manage users), else 403. */
export const requireAdmin = (locals: App.Locals) => requirePermission(locals, 'manage_users');
