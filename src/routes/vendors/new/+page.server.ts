import type { Actions } from './$types';
import { vendorSchema } from '$schemas';
import { db } from '$lib/server/db';
import { createCreateAction } from '$lib/server/route-factory';

export const actions: Actions = {
	default: createCreateAction({
		schema: vendorSchema,
		model: db.vendors,
		entityType: 'vendor',
		redirectPath: '/vendors',
		extractFormData: (formData) => ({
			name: formData.get('name'),
			code: formData.get('code')?.toString().toUpperCase(),
			website: formData.get('website') || '',
			contact_email: formData.get('contact_email') || '',
			active: formData.get('active') === 'on'
		}),
		checkUnique: async (validated) => {
			const existing = await db.vendors.findUnique({
				where: { code: validated.code }
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
