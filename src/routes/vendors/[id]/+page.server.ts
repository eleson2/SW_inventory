import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog } from '#lib/server/db.ts';
import { createDetailLoader } from '#lib/server/route-factory.ts';
import { requirePermission } from '#lib/server/permissions.ts';
import { editorActions, loadEditors, removeScopeRoles } from '#lib/server/editors.ts';
import { redirect, fail } from '@sveltejs/kit';

const loadDetail = createDetailLoader({
	model: db.vendors,
	entityName: 'Vendor',
	include: {
		software: {
			include: {
				current_version: true
			},
			orderBy: {
				name: 'asc'
			}
		},
		bundles: {
			select: {
				id: true,
				code: true,
				name: true,
				release_date: true,
				active: true,
				_count: { select: { items: true } }
			},
			orderBy: { release_date: 'desc' }
		}
	}
});

export const load: PageServerLoad = async (event) => ({
	vendor: (await loadDetail(event)).vendor,
	editors: await loadEditors('vendor', event.params.id, event.locals.user)
});

export const actions: Actions = {
	...editorActions('vendor'),

	delete: async ({ params, locals }) => {
		requirePermission(locals, 'manage_vendors');
		try {
			// Check if vendor exists
			const vendor = await db.vendors.findUnique({
				where: { id: params.id },
				include: {
					software: true,
					_count: { select: { bundles: true } }
				}
			});

			if (!vendor) {
				return fail(404, { error: 'Vendor not found' });
			}

			// Rule 1: Cannot delete active vendors
			if (vendor.active) {
				return fail(400, {
					error: 'Cannot delete active vendor. Please deactivate it first.'
				});
			}

			// Rule 2: Cannot delete vendor with software products
			if (vendor.software && vendor.software.length > 0) {
				return fail(400, {
					error: `Cannot delete vendor with ${vendor.software.length} software product(s). Please remove or reassign the software first.`
				});
			}

			// Rule 3: Cannot delete vendor with maintenance bundles
			if (vendor._count.bundles > 0) {
				return fail(400, {
					error: `Cannot delete vendor with ${vendor._count.bundles} bundle(s). Please delete the bundles first.`
				});
			}

			// Safe to hard delete
			await db.vendors.delete({
				where: { id: params.id }
			});
			await removeScopeRoles('vendor', params.id);

			await createAuditLog('vendor', params.id, 'delete', {
				...vendor,
				permanently_deleted: true
			});
		} catch (error) {
			console.error('Error deleting vendor:', error);
			return fail(500, { error: 'Failed to delete vendor' });
		}

		redirect(303, '/vendors');
	}
};
