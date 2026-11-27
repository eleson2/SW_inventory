/**
 * Users: login, session lookup and administration.
 *
 * The user from .env (AUTH_USERNAME / AUTH_PASSWORD) always works and is always an admin, so
 * nobody can be locked out. On login it is added to `users` (without a password hash), so the
 * audit log has a real user id for it too.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { users } from '@prisma/client';
import { db, createAuditLog } from '#lib/server/db.ts';
import { hashPassword, passwordProblem, verifyPassword } from '#lib/server/passwords.ts';

/** What every request knows about the logged-in user (`locals.user`). */
export interface SessionUser {
	id: string;
	username: string;
	display_name: string;
	is_admin: boolean;
	can_create_packages: boolean;
	/** True for the .env user: its password and rights come from .env, not from this app */
	is_env_user: boolean;
}

export interface EnvAdmin {
	username: string;
	password: string;
}

export class UserError extends Error {}

/** Constant-time string comparison (hashing first makes lengths equal). */
function safeEqual(a: string, b: string): boolean {
	return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

export const normalizeUsername = (username: string) => username.trim().toLowerCase();

function toSessionUser(user: users, envAdmin: EnvAdmin | null): SessionUser {
	return {
		id: user.id,
		username: user.username,
		display_name: user.display_name,
		is_admin: user.is_admin,
		can_create_packages: user.can_create_packages,
		is_env_user: !!envAdmin && user.username === normalizeUsername(envAdmin.username)
	};
}

/**
 * Check a login. Returns the user and its session version, or null when the username,
 * password or account is not valid (the caller does not learn which).
 */
export async function authenticate(
	usernameInput: string,
	password: string,
	envAdmin: EnvAdmin
): Promise<{ user: SessionUser; sessionVersion: number } | null> {
	const username = normalizeUsername(usernameInput);
	const envUsername = normalizeUsername(envAdmin.username);

	if (username === envUsername) {
		if (!safeEqual(password, envAdmin.password)) return null;
		const user = await db.users.upsert({
			where: { username },
			create: { username, display_name: envAdmin.username, is_admin: true, active: true, last_login_at: new Date() },
			update: { is_admin: true, active: true, last_login_at: new Date() }
		});
		return { user: toSessionUser(user, envAdmin), sessionVersion: user.session_version };
	}

	const user = await db.users.findUnique({ where: { username } });
	// verifyPassword does the same work for a missing user, so timing reveals nothing
	const ok = await verifyPassword(password, user?.password_hash);
	if (!user || !ok || !user.active) return null;
	const updated = await db.users.update({ where: { id: user.id }, data: { last_login_at: new Date() } });
	return { user: toSessionUser(updated, envAdmin), sessionVersion: updated.session_version };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The user behind a session cookie, or null when deactivated or the session was ended. */
export async function loadSessionUser(
	id: string,
	sessionVersion: number,
	envAdmin: EnvAdmin
): Promise<SessionUser | null> {
	if (!UUID.test(id)) return null; // e.g. a cookie from before user accounts
	const user = await db.users.findUnique({ where: { id } });
	if (!user || !user.active || user.session_version !== sessionVersion) return null;
	return toSessionUser(user, envAdmin);
}

// --- Administration ---

export interface UserInput {
	username: string;
	display_name: string;
	email: string | null;
	is_admin: boolean;
	can_create_packages: boolean;
	active: boolean;
}

const USERNAME = /^[a-z0-9][a-z0-9._-]{1,49}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Read and validate the user fields of a form; throws UserError. */
export function readUserForm(form: FormData): UserInput {
	const username = normalizeUsername(String(form.get('username') ?? ''));
	const display_name = String(form.get('display_name') ?? '').trim();
	const email = String(form.get('email') ?? '').trim() || null;
	if (!USERNAME.test(username)) {
		throw new UserError('Username: 2-50 characters, lowercase letters, digits, dot, dash or underscore.');
	}
	if (!display_name || display_name.length > 100) throw new UserError('Name is required (at most 100 characters).');
	if (email && (email.length > 200 || !EMAIL.test(email))) throw new UserError('Email address is not valid.');
	return {
		username,
		display_name,
		email,
		is_admin: form.get('is_admin') === 'on',
		can_create_packages: form.get('can_create_packages') === 'on',
		// Edit forms send `active_present`, so an unticked Active box means inactive; new users are active
		active: form.has('active_present') ? form.get('active') === 'on' : true
	};
}

const auditFields = (u: Pick<users, 'username' | 'display_name' | 'email' | 'is_admin' | 'can_create_packages' | 'active'>) => ({
	username: u.username,
	display_name: u.display_name,
	email: u.email,
	is_admin: u.is_admin,
	can_create_packages: u.can_create_packages,
	active: u.active
});

export async function createUser(input: UserInput, password: string, envAdmin: EnvAdmin, actorId: string) {
	if (input.username === normalizeUsername(envAdmin.username)) {
		throw new UserError(`"${input.username}" is the login from .env; choose another username.`);
	}
	if (await db.users.findUnique({ where: { username: input.username } })) {
		throw new UserError(`Username "${input.username}" is already taken.`);
	}
	const problem = passwordProblem(password, input.username);
	if (problem) throw new UserError(problem);
	const user = await db.users.create({ data: { ...input, password_hash: await hashPassword(password) } });
	await createAuditLog('user', user.id, 'create', auditFields(user), actorId);
	return user;
}

export async function updateUser(id: string, input: UserInput, envAdmin: EnvAdmin, actorId: string) {
	const existing = await db.users.findUnique({ where: { id } });
	if (!existing) throw new UserError('That user no longer exists.');
	const isEnvUser = existing.username === normalizeUsername(envAdmin.username);
	if (isEnvUser) {
		// Its name and rights come from .env; only the display name and email can change here
		input = { ...input, username: existing.username, is_admin: true, active: true };
	} else if (input.username !== existing.username) {
		if (input.username === normalizeUsername(envAdmin.username)) {
			throw new UserError(`"${input.username}" is the login from .env; choose another username.`);
		}
		if (await db.users.findUnique({ where: { username: input.username } })) {
			throw new UserError(`Username "${input.username}" is already taken.`);
		}
	}
	if (id === actorId && (!input.is_admin || !input.active)) {
		throw new UserError('You cannot remove your own admin rights or deactivate yourself.');
	}
	const user = await db.users.update({
		where: { id },
		data: {
			...input,
			// Deactivating ends the user's sessions at once (they are also refused while inactive)
			...(existing.active && !input.active && { session_version: { increment: 1 } })
		}
	});
	await createAuditLog('user', id, 'update', { before: auditFields(existing), after: auditFields(user) }, actorId);
	return user;
}

/** Set a new password (by an admin, or by the user after checking the current one); ends all sessions. */
export async function setPassword(id: string, password: string, envAdmin: EnvAdmin, actorId: string) {
	const existing = await db.users.findUnique({ where: { id } });
	if (!existing) throw new UserError('That user no longer exists.');
	if (existing.username === normalizeUsername(envAdmin.username)) {
		throw new UserError('The password of the .env login is set in .env (AUTH_PASSWORD).');
	}
	const problem = passwordProblem(password, existing.username);
	if (problem) throw new UserError(problem);
	const user = await db.users.update({
		where: { id },
		data: { password_hash: await hashPassword(password), session_version: { increment: 1 } }
	});
	await createAuditLog('user', id, 'update', { password: actorId === id ? 'changed' : 'reset' }, actorId);
	return user;
}

export async function changeOwnPassword(id: string, current: string, password: string, envAdmin: EnvAdmin) {
	const existing = await db.users.findUnique({ where: { id } });
	if (existing?.username === normalizeUsername(envAdmin.username)) {
		throw new UserError('The password of the .env login is set in .env (AUTH_PASSWORD).');
	}
	if (!existing || !(await verifyPassword(current, existing.password_hash))) {
		throw new UserError('Current password is wrong.');
	}
	if (current === password) throw new UserError('The new password must differ from the current one.');
	return setPassword(id, password, envAdmin, id);
}
