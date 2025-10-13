import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { vendorSchema } from '$schemas';
import { db, createAuditLog } from '$lib/server/db';
import { z } from 'zod';

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const data = {
			name: formData.get('name'),
			code: formData.get('code')?.toString().toUpperCase(), // Ensure uppercase
			website: formData.get('website') || '',
			contactEmail: formData.get('contactEmail') || '',
			active: formData.get('active') === 'on'
		};

		try {
			// Validate the form data
			const validated = vendorSchema.parse(data);

			// Check if code already exists
			const existing = await db.vendor.findUnique({
				where: { code: validated.code }
			});

			if (existing) {
				return fail(400, {
					errors: { code: ['Vendor code already exists'] },
					message: 'A vendor with this code already exists.'
				});
			}

			// Create vendor in database
			const vendor = await db.vendor.create({
				data: validated
			});

			// Create audit log
			await createAuditLog('vendor', vendor.id, 'create', { vendor });

			// Redirect to vendors list
			throw redirect(303, '/vendors');
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errors = error.flatten().fieldErrors;
				return fail(400, {
					errors,
					message: 'Validation failed. Please check the form.'
				});
			}
			throw error;
		}
	}
};
