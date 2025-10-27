import type { PageServerLoad, Actions } from './$types';
import { db, createAuditLog } from '$lib/server/db';
import { createDetailLoader } from '$lib/server/route-factory';
import { redirect, fail } from '@sveltejs/kit';

export const load: PageServerLoad = createDetailLoader({
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

export const actions: Actions = {
	delete: async ({ params }) => {
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

			await createAuditLog('customer', params.id, 'delete', {
				...customer,
				permanently_deleted: true
			});

			throw redirect(303, '/customers');
		} catch (error) {
			if (error instanceof Response) throw error;

			console.error('Error deleting customer:', error);
			return fail(500, { error: 'Failed to delete customer' });
		}
	}
};
