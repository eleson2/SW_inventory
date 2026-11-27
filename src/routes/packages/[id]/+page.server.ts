import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog } from '#lib/server/db.ts';
import { createDetailLoader } from '#lib/server/route-factory.ts';
import { requirePermission } from '#lib/server/permissions.ts';
import { editorActions, loadEditors, removeScopeRoles } from '#lib/server/editors.ts';
import { redirect, fail } from '@sveltejs/kit';

const loadDetail = createDetailLoader({
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
				software_version: true,
				source_bundle: {
					select: {
						id: true,
						code: true,
						items: { select: { software_id: true, software_version_id: true } }
					}
				}
			},
			orderBy: {
				order_index: 'asc'
			}
		}
	}
});

export const load: PageServerLoad = async (event) => ({
	package: (await loadDetail(event)).package,
	editors: await loadEditors('package', event.params.id, event.locals.user)
});

export const actions: Actions = {
	...editorActions('package'),

	delete: async ({ params, locals }) => {
		requirePermission(locals, 'edit_package', { package: params.id });
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
			await removeScopeRoles('package', params.id);

			await createAuditLog('package', params.id, 'delete', {
				...pkg,
				permanently_deleted: true
			});
		} catch (error) {
			console.error('Error deleting package:', error);
			return fail(500, { error: 'Failed to delete package' });
		}

		redirect(303, '/packages');
	}
};
