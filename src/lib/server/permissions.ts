/**
 * Who may change what. Phase 1: administrators only; editor lists per customer, vendor and
 * package come next.
 */
import { error } from '@sveltejs/kit';

/** The logged-in user, or 401. */
export function requireUser(locals: App.Locals) {
	if (!locals.user) error(401, 'Authentication required');
	return locals.user;
}

/** The logged-in user when an administrator, else 403. */
export function requireAdmin(locals: App.Locals) {
	const user = requireUser(locals);
	if (!user.is_admin) error(403, 'Only administrators can do this');
	return user;
}
