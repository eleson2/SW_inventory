import type { PageServerLoad, Actions } from './$types';
import { vendorUpdateSchema } from '$schemas';
import { db } from '$lib/server/db';
import { createEditLoader, createUpdateAction } from '$lib/server/route-factory';

export const load: PageServerLoad = createEditLoader({
	model: db.vendors,
	entityName: 'Vendor'
});

export const actions: Actions = {
	default: createUpdateAction({
		schema: vendorUpdateSchema,
		model: db.vendors,
		entityType: 'vendor',
		redirectPath: '/vendors/{id}',
		extractFormData: (formData) => ({
			name: formData.get('name'),
			code: formData.get('code')?.toString().toUpperCase(),
			website: formData.get('website') || '',
			contact_email: formData.get('contact_email') || '',
			active: formData.get('active') === 'on'
		}),
		checkUnique: async (validated, id) => {
			const existing = await db.vendors.findFirst({
				where: {
					code: validated.code,
					id: { not: id }
				}
			});
			return existing
				? {
						exists: true,
						field: 'code',
						message: 'A vendor with this code already exists.'
				  }
				: null;
		}
	})
};
