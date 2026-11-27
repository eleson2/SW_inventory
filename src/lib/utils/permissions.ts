/**
 * Roles and permissions: what a user may do (role) and where (scope).
 *
 * A user holds role assignments (`user_roles`): a global one (no scope) applies everywhere, a
 * scoped one to one customer, vendor or package. Each role lists the actions it allows; pages
 * ask `can(user, action, target)` and never look at roles directly. The target says which
 * scopes the thing being changed belongs to (an LPAR: its customer; a rollout: the LPAR's
 * customer and the package), so a role on any of them counts.
 *
 * Pure and shared by server and pages (pages use it only to hide what the server would refuse).
 */

export const SCOPE_TYPES = ['customer', 'vendor', 'package'] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];

export const isScopeType = (value: unknown): value is ScopeType =>
	typeof value === 'string' && (SCOPE_TYPES as readonly string[]).includes(value);

/**
 * Everything the app checks, with the scope(s) its target carries:
 * - global only: manage_users, manage_customers (create/delete), manage_vendors (create/delete),
 *   manage_categories, import_data (bulk import of vendors/customers/products/LPARs), create_package
 * - { customer }: edit_customer, and everything that changes an LPAR of it: edit_lpar
 *   (create/edit/delete/rollback), plan_rollout and deploy_package (per LPAR: its customer).
 *   LPARs are changed only by editors of their customer, and by admins.
 * - { vendor }: edit_vendor, edit_software (products and versions), edit_bundle
 * - { package }: edit_package (edit/delete)
 */
export type Action =
	| 'manage_users'
	| 'manage_customers'
	| 'manage_vendors'
	| 'manage_categories'
	| 'import_data'
	| 'create_package'
	| 'edit_customer'
	| 'edit_lpar'
	| 'edit_vendor'
	| 'edit_software'
	| 'edit_bundle'
	| 'edit_package'
	| 'plan_rollout'
	| 'deploy_package';

interface RoleDefinition {
	/** Label and description when held globally (user page checkboxes, badges) */
	label: string;
	description: string;
	/** Where it can be assigned: null = global */
	scopes: readonly (ScopeType | null)[];
	actions: readonly Action[] | 'all';
	/** Actions granted only when assigned to a scope, not when held globally */
	scopedOnly?: readonly Action[];
}

/** The scope type a scoped role must be assigned to for the action (global-only actions: none). */
const ACTION_SCOPE: Partial<Record<Action, ScopeType>> = {
	edit_customer: 'customer',
	edit_lpar: 'customer',
	plan_rollout: 'customer',
	deploy_package: 'customer',
	edit_vendor: 'vendor',
	edit_software: 'vendor',
	edit_bundle: 'vendor',
	edit_package: 'package'
};

/** Changing an LPAR: only editors of its customer (and admins). */
const LPAR_ACTIONS = ['edit_lpar', 'plan_rollout', 'deploy_package'] as const satisfies readonly Action[];

export const ROLES = {
	admin: {
		label: 'Administrator',
		description: 'can change everything, including users',
		scopes: [null],
		actions: 'all'
	},
	editor: {
		label: 'Editor (everything)',
		description:
			'changes all customers, vendors, software, bundles and packages, but not LPARs (only editors of their customer) and not users. Editors of one customer, vendor or package are assigned on its page',
		scopes: [null, 'customer', 'vendor', 'package'],
		actions: ['edit_customer', 'edit_vendor', 'edit_software', 'edit_bundle', 'edit_package', ...LPAR_ACTIONS],
		scopedOnly: LPAR_ACTIONS
	},
	package_creator: {
		label: 'Can create packages',
		description: 'new packages, also from bundles or by cloning; the creator becomes the package contact',
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

type UserLike = { roles: readonly RoleAssignment[] } | null | undefined;

/** The scopes a target belongs to; leave out what does not apply. */
export type Target = Partial<Record<ScopeType, string | null | undefined>>;

/** Does this assignment's role grant the action (at its own scope level)? */
const allows = (a: RoleAssignment, action: Action) => {
	if (!isRoleName(a.role)) return false; // unknown (e.g. removed) roles grant nothing
	const role: RoleDefinition = ROLES[a.role];
	if (a.scope_type === null && role.scopedOnly?.includes(action)) return false;
	if (a.scope_type !== null && ACTION_SCOPE[action] !== a.scope_type) return false; // e.g. a package editor cannot deploy
	return role.actions === 'all' || role.actions.includes(action);
};

/** May this user do `action` on `target`? No user: no. */
export function can(user: UserLike, action: Action, target: Target = {}): boolean {
	if (!user) return false;
	return user.roles.some((a) => {
		if (!allows(a, action)) return false;
		if (a.scope_type === null) return true;
		const id = target[a.scope_type as ScopeType];
		return !!id && id === a.scope_id;
	});
}

/** May the user do `action` somewhere (globally or on any scope)? For "New ..." buttons and pages. */
export function canAnywhere(user: UserLike, action: Action): boolean {
	return !!user && user.roles.some((a) => allows(a, action));
}

/**
 * The ids of `scopeType` on which the user may do `action`: 'all' when held globally, else the
 * scoped ids (possibly none). For narrowing pickers, e.g. the customers an LPAR can be created for.
 */
export function allowedScopeIds(user: UserLike, action: Action, scopeType: ScopeType): 'all' | string[] {
	if (!user) return [];
	const granting = user.roles.filter((a) => allows(a, action));
	if (granting.some((a) => a.scope_type === null)) return 'all';
	return granting.filter((a) => a.scope_type === scopeType && a.scope_id).map((a) => a.scope_id!);
}

/** Keep the items whose `scopeType` id the user may act on. */
export function filterAllowed<T>(user: UserLike, action: Action, scopeType: ScopeType, items: T[], idOf: (item: T) => string): T[] {
	const ids = allowedScopeIds(user, action, scopeType);
	return ids === 'all' ? items : items.filter((item) => ids.includes(idOf(item)));
}

/** Does the user hold this role globally? For display; checks use `can()`. */
export const hasGlobalRole = (user: { roles: readonly RoleAssignment[] }, role: RoleName) =>
	user.roles.some((a) => a.role === role && a.scope_type === null);
