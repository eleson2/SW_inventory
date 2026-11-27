/**
 * Roles and permissions: what a user may do (role) and where (scope).
 *
 * A user holds role assignments (`user_roles`): a global one (no scope) applies everywhere, a
 * scoped one to one customer, vendor or package. Each role lists the actions it allows; pages
 * ask `can(user, action, target)` and never look at roles directly. The target says which
 * scopes the thing being changed belongs to (an LPAR: its customer; a package item: its package
 * and the product's vendor), so a role on any of them counts.
 *
 * Pure and shared by server and pages (pages use it only to hide what the server would refuse).
 */

export const SCOPE_TYPES = ['customer', 'vendor', 'package'] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];

/** Everything the app checks. */
export type Action = 'manage_users' | 'create_package';

interface RoleDefinition {
	label: string;
	description: string;
	/** Where it can be assigned: null = global */
	scopes: readonly (ScopeType | null)[];
	actions: readonly Action[] | 'all';
}

export const ROLES = {
	admin: {
		label: 'Administrator',
		description: 'can change everything, including users',
		scopes: [null],
		actions: 'all'
	},
	package_creator: {
		label: 'Can create packages',
		description: 'new packages, also from bundles or by cloning',
		scopes: [null],
		actions: ['create_package']
	}
} as const satisfies Record<string, RoleDefinition>;

export type RoleName = keyof typeof ROLES;

export const ROLE_NAMES = Object.keys(ROLES) as RoleName[];

/** Roles that can be held globally (the checkboxes on the user page). */
export const GLOBAL_ROLES = ROLE_NAMES.filter((r) => (ROLES[r].scopes as readonly (ScopeType | null)[]).includes(null));

export const isRoleName = (value: unknown): value is RoleName =>
	typeof value === 'string' && Object.hasOwn(ROLES, value);

export interface RoleAssignment {
	role: string;
	scope_type: string | null;
	scope_id: string | null;
	is_contact: boolean;
}

/** The scopes a target belongs to; leave out what does not apply. */
export type Target = Partial<Record<ScopeType, string | null | undefined>>;

const allows = (role: string, action: Action) => {
	if (!isRoleName(role)) return false; // unknown (e.g. removed) roles grant nothing
	const actions: RoleDefinition['actions'] = ROLES[role].actions;
	return actions === 'all' || actions.includes(action);
};

/** May this user do `action` on `target`? No user: no. */
export function can(user: { roles: readonly RoleAssignment[] } | null | undefined, action: Action, target: Target = {}): boolean {
	if (!user) return false;
	return user.roles.some((a) => {
		if (!allows(a.role, action)) return false;
		if (a.scope_type === null) return true;
		const id = target[a.scope_type as ScopeType];
		return !!id && id === a.scope_id;
	});
}

/** Does the user hold this role globally? For display; checks use `can()`. */
export const hasGlobalRole = (user: { roles: readonly RoleAssignment[] }, role: RoleName) =>
	user.roles.some((a) => a.role === role && a.scope_type === null);
