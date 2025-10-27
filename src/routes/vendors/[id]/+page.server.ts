import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog } from '$lib/server/db';
import { createDetailLoader } from '$lib/server/route-factory';
import { redirect, fail } from '@sveltejs/kit';

export const load: PageServerLoad = createDetailLoader({
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
		}
	}
});

export const actions: Actions = {
	delete: async ({ params }) => {
		try {
			// Check if vendor exists
			const vendor = await db.vendors.findUnique({
				where: { id: params.id },
				include: {
					software: true
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

			// Safe to hard delete
			await db.vendors.delete({
				where: { id: params.id }
			});

			await createAuditLog('vendor', params.id, 'delete', {
				...vendor,
				permanently_deleted: true
			});

			throw redirect(303, '/vendors');
		} catch (error) {
			if (error instanceof Response) throw error;

			console.error('Error deleting vendor:', error);
			return fail(500, { error: 'Failed to delete vendor' });
		}
	}
};
