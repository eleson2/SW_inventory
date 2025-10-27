import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog } from '$lib/server/db';
import { createDetailLoader } from '$lib/server/route-factory';
import { redirect, fail } from '@sveltejs/kit';

export const load: PageServerLoad = createDetailLoader({
	model: db.packages,
	entityName: 'Package',
	include: {
		package_items: {
			include: {
				software: {
					include: {
						vendors: true
					}
				},
				software_version: true
			},
			orderBy: {
				order_index: 'asc'
			}
		}
	}
});

export const actions: Actions = {
	delete: async ({ params }) => {
		try {
			// Check if package exists
			const pkg = await db.packages.findUnique({
				where: { id: params.id }
			});

			if (!pkg) {
				return fail(404, { error: 'Package not found' });
			}

			// Rule 1: Cannot delete active packages
			if (pkg.active) {
				return fail(400, {
					error: 'Cannot delete active package. Please deactivate it first.'
				});
			}

			// Rule 2: Cannot delete package if installed on any LPAR
			const lparCount = await db.lpars.count({
				where: { current_package_id: params.id }
			});
			if (lparCount > 0) {
				return fail(400, {
					error: `Cannot delete package. It is installed on ${lparCount} LPAR(s).`
				});
			}

			// Safe to hard delete (cascade will delete package items)
			await db.packages.delete({
				where: { id: params.id }
			});

			await createAuditLog('package', params.id, 'delete', {
				...pkg,
				permanently_deleted: true
			});

			throw redirect(303, '/packages');
		} catch (error) {
			if (error instanceof Response) throw error;

			console.error('Error deleting package:', error);
			return fail(500, { error: 'Failed to delete package' });
		}
	}
};
