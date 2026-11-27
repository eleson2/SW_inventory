/**
 * Users: login, session lookup and administration.
 *
 * The user from .env (AUTH_USERNAME / AUTH_PASSWORD) always works and is always an admin, so
 * nobody can be locked out. On login it is added to `users` (without a password hash), so the
 * audit log has a real user id for it too.
 *
 * Rights are role assignments (`user_roles`, see `#lib/utils/permissions.ts`). This module
 * manages the global ones; scoped ones (per customer, vendor, package) are kept when a user is
 * edited here.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { users, user_roles } from '@prisma/client';
import { db, createAuditLog } from '#lib/server/db.ts';
import { hashPassword, passwordProblem, verifyPassword } from '#lib/server/passwords.ts';
import { GLOBAL_ROLES, isRoleName, type RoleAssignment, type RoleName } from '#lib/utils/permissions.ts';

/** What every request knows about the logged-in user (`locals.user`). */
export interface SessionUser {
	id: string;
	username: string;
	display_name: string;
	/** Role assignments; ask `can(user, action, target)` from `#lib/utils/permissions.ts` */
	roles: RoleAssignment[];
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

type UserWithRoles = users & { roles: user_roles[] };
const withRoles = { roles: true } as const;

const toAssignment = (r: user_roles): RoleAssignment => ({
	role: r.role,
	scope_type: r.scope_type,
	scope_id: r.scope_id,
	is_contact: r.is_contact
});

const isGlobalAdmin = (user: UserWithRoles) => user.roles.some((r) => r.role === 'admin' && r.scope_type === null);

function toSessionUser(user: UserWithRoles, envAdmin: EnvAdmin | null): SessionUser {
	return {
		id: user.id,
		username: user.username,
		display_name: user.display_name,
		roles: user.roles.map(toAssignment),
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
		let user = await db.users.upsert({
			where: { username },
			create: {
				username,
				display_name: envAdmin.username,
				active: true,
				last_login_at: new Date(),
				roles: { create: { role: 'admin' } }
			},
			update: { active: true, last_login_at: new Date() },
			include: withRoles
		});
		if (!isGlobalAdmin(user)) {
			user = await db.users.update({
				where: { id: user.id },
				data: { roles: { create: { role: 'admin' } } },
				include: withRoles
			});
		}
		return { user: toSessionUser(user, envAdmin), sessionVersion: user.session_version };
	}

	const user = await db.users.findUnique({ where: { username } });
	// verifyPassword does the same work for a missing user, so timing reveals nothing
	const ok = await verifyPassword(password, user?.password_hash);
	if (!user || !ok || !user.active) return null;
	const updated = await db.users.update({
		where: { id: user.id },
		data: { last_login_at: new Date() },
		include: withRoles
	});
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
	const user = await db.users.findUnique({ where: { id }, include: withRoles });
	if (!user || !user.active || user.session_version !== sessionVersion) return null;
	return toSessionUser(user, envAdmin);
}

// --- Administration ---

export interface UserInput {
	username: string;
	display_name: string;
	email: string | null;
	/** Global roles; scoped ones are managed separately */
	roles: RoleName[];
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
	const ticked = form.getAll('role');
	return {
		username,
		display_name,
		email,
		roles: GLOBAL_ROLES.filter((r) => ticked.includes(r)),
		// Edit forms send `active_present`, so an unticked Active box means inactive; new users are active
		active: form.has('active_present') ? form.get('active') === 'on' : true
	};
}

/** The user's global roles, sorted (for the admin pages and the audit log). */
export const globalRoles = (user: { roles: Pick<user_roles, 'role' | 'scope_type'>[] }): RoleName[] =>
	user.roles
		.filter((r) => r.scope_type === null && isRoleName(r.role))
		.map((r) => r.role as RoleName)
		.sort();

const auditFields = (u: UserWithRoles) => ({
	username: u.username,
	display_name: u.display_name,
	email: u.email,
	roles: globalRoles(u),
	active: u.active
});

/** The `users` columns of the input. */
const userColumns = ({ roles: _roles, ...columns }: UserInput) => columns;

export async function createUser(input: UserInput, password: string, envAdmin: EnvAdmin, actorId: string) {
	if (input.username === normalizeUsername(envAdmin.username)) {
		throw new UserError(`"${input.username}" is the login from .env; choose another username.`);
	}
	if (await db.users.findUnique({ where: { username: input.username } })) {
		throw new UserError(`Username "${input.username}" is already taken.`);
	}
	const problem = passwordProblem(password, input.username);
	if (problem) throw new UserError(problem);
	const user = await db.users.create({
		data: {
			...userColumns(input),
			password_hash: await hashPassword(password),
			roles: { create: input.roles.map((role) => ({ role })) }
		},
		include: withRoles
	});
	await createAuditLog('user', user.id, 'create', auditFields(user), actorId);
	return user;
}

export async function updateUser(id: string, input: UserInput, envAdmin: EnvAdmin, actorId: string) {
	const existing = await db.users.findUnique({ where: { id }, include: withRoles });
	if (!existing) throw new UserError('That user no longer exists.');
	const isEnvUser = existing.username === normalizeUsername(envAdmin.username);
	if (isEnvUser) {
		// Its name and admin role come from .env; display name, email and other roles can change here
		input = {
			...input,
			username: existing.username,
			roles: input.roles.includes('admin') ? input.roles : [...input.roles, 'admin'],
			active: true
		};
	} else if (input.username !== existing.username) {
		if (input.username === normalizeUsername(envAdmin.username)) {
			throw new UserError(`"${input.username}" is the login from .env; choose another username.`);
		}
		if (await db.users.findUnique({ where: { username: input.username } })) {
			throw new UserError(`Username "${input.username}" is already taken.`);
		}
	}
	if (id === actorId && (!input.roles.includes('admin') || !input.active)) {
		throw new UserError('You cannot remove your own admin rights or deactivate yourself.');
	}
	const user = await db.users.update({
		where: { id },
		data: {
			...userColumns(input),
			// Global roles are replaced; scoped ones (customer, vendor, package) are kept
			roles: {
				deleteMany: { scope_type: null },
				create: input.roles.map((role) => ({ role }))
			},
			// Deactivating ends the user's sessions at once (they are also refused while inactive)
			...(existing.active && !input.active && { session_version: { increment: 1 } })
		},
		include: withRoles
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

// --- Conversion from roles phase 1 ---

/**
 * Turn the phase-1 flags (`users.is_admin`, `users.can_create_packages`) into global roles and
 * clear them. Idempotent; runs once per server start (`hooks.server.ts`), so databases and
 * backups from before user_roles need no manual step. Returns the number of users converted.
 */
export async function migrateLegacyRoles(): Promise<number> {
	const legacy = await db.users.findMany({
		where: { OR: [{ is_admin: true }, { can_create_packages: true }] },
		include: withRoles
	});
	for (const user of legacy) {
		const wanted: RoleName[] = [];
		if (user.is_admin) wanted.push('admin');
		if (user.can_create_packages) wanted.push('package_creator');
		const missing = wanted.filter((role) => !user.roles.some((r) => r.role === role && r.scope_type === null));
		await db.users.update({
			where: { id: user.id },
			data: {
				is_admin: false,
				can_create_packages: false,
				roles: { create: missing.map((role) => ({ role })) }
			}
		});
	}
	return legacy.length;
}

let legacyConversion: Promise<number> | null = null;

/** `migrateLegacyRoles()` once per process; tried again on the next request if it failed. */
export function ensureLegacyRolesMigrated(): Promise<number> {
	legacyConversion ??= migrateLegacyRoles().catch((e: unknown) => {
		legacyConversion = null;
		throw e;
	});
	return legacyConversion;
}
