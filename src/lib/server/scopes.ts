/**
 * The permission target (`Target`, see #lib/utils/permissions.ts) of records that belong to a
 * customer or vendor. 404 when the record does not exist.
 */
import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { can, canAnywhere, type Action, type Target } from '#lib/utils/permissions.ts';
import { requireUser } from '#lib/server/permissions.ts';

/** A software product: its vendor. */
export async function softwareTarget(id: string): Promise<Target> {
	const software = await db.software.findUnique({ where: { id }, select: { vendor_id: true } });
	if (!software) error(404, 'Software not found');
	return { vendor: software.vendor_id };
}

/** An LPAR: its customer. */
export async function lparTarget(id: string): Promise<Target> {
	const lpar = await db.lpars.findUnique({ where: { id }, select: { customer_id: true } });
	if (!lpar) error(404, 'LPAR not found');
	return { customer: lpar.customer_id };
}

/** A vendor bundle: its vendor. */
export async function bundleTarget(id: string): Promise<Target> {
	const bundle = await db.vendor_bundles.findUnique({ where: { id }, select: { vendor_id: true } });
	if (!bundle) error(404, 'Bundle not found');
	return { vendor: bundle.vendor_id };
}

/**
 * Rollouts and deployments change LPARs: the user must have `action` on every LPAR's customer,
 * else 403 naming the LPARs that are not allowed.
 */
export async function requireOnLpars(locals: App.Locals, action: 'plan_rollout' | 'deploy_package', lparIds: string[]) {
	const user = requireUser(locals);
	const lpars = await db.lpars.findMany({ where: { id: { in: lparIds } }, select: { code: true, customer_id: true } });
	const denied = lpars.filter((l) => !can(user, action, { customer: l.customer_id }));
	if (denied.length > 0) {
		error(403, `You may not ${action === 'deploy_package' ? 'deploy' : 'plan rollouts'} on ${denied.map((l) => l.code).join(', ')}`);
	}
	return user;
}

/** For "new ..." pages: the user may do `action` somewhere, else 403. */
export function requireAnywhere(locals: App.Locals, action: Action, message: string) {
	const user = requireUser(locals);
	if (!canAnywhere(user, action)) error(403, message);
	return user;
}
