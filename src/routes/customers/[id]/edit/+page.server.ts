import type { PageServerLoad, Actions } from './$types';
import { customerUpdateSchema } from '$schemas';
import { db } from '$lib/server/db';
import { createEditLoader, createUpdateAction } from '$lib/server/route-factory';

export const load: PageServerLoad = createEditLoader({
	model: db.customers,
	entityName: 'Customer'
});

export const actions: Actions = {
	default: createUpdateAction({
		schema: customerUpdateSchema,
		model: db.customers,
		entityType: 'customer',
		redirectPath: '/customers/{id}',
		extractFormData: (formData) => ({
			name: formData.get('name'),
			code: formData.get('code')?.toString().toUpperCase(),
			description: formData.get('description'),
			active: formData.get('active') === 'on'
		}),
		checkUnique: async (validated, id) => {
			const existing = await db.customers.findFirst({
				where: {
					code: validated.code,
					id: { not: id }
				}
			});
			return existing
				? {
						exists: true,
						field: 'code',
						message: 'A customer with this code already exists.'
				  }
				: null;
		}
	})
};
