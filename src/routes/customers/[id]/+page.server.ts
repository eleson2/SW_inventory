import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog } from '#lib/server/db.ts';
import { createDetailLoader } from '#lib/server/route-factory.ts';
import { requirePermission } from '#lib/server/permissions.ts';
import { editorActions, loadEditors, removeScopeRoles } from '#lib/server/editors.ts';
import { redirect, fail } from '@sveltejs/kit';

const loadDetail = createDetailLoader({
	model: db.customers,
	entityName: 'Customer',
	include: {
		lpars: {
			include: {
				packages: true,
				lpar_software: true
			}
		}
	}
});

export const load: PageServerLoad = async (event) => ({
	customer: (await loadDetail(event)).customer,
	editors: await loadEditors('customer', event.params.id, event.locals.user)
});

export const actions: Actions = {
	...editorActions('customer'),

	delete: async ({ params, locals }) => {
		requirePermission(locals, 'manage_customers');
		try {
			// Check if customer exists
			const customer = await db.customers.findUnique({
				where: { id: params.id },
				include: {
					lpars: true
				}
			});

			if (!customer) {
				return fail(404, { error: 'Customer not found' });
			}

			// Rule 1: Cannot delete active customers
			if (customer.active) {
				return fail(400, {
					error: 'Cannot delete active customer. Please deactivate it first.'
				});
			}

			// Rule 2: Cannot delete customer with LPARs
			if (customer.lpars && customer.lpars.length > 0) {
				return fail(400, {
					error: `Cannot delete customer with ${customer.lpars.length} LPAR(s). Please remove or reassign the LPARs first.`
				});
			}

			// Safe to hard delete
			await db.customers.delete({
				where: { id: params.id }
			});
			await removeScopeRoles('customer', params.id);

			await createAuditLog('customer', params.id, 'delete', {
				...customer,
				permanently_deleted: true
			});
		} catch (error) {
			console.error('Error deleting customer:', error);
			return fail(500, { error: 'Failed to delete customer' });
		}

		redirect(303, '/customers');
	}
};
