import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { vendorUpdateSchema } from '$schemas';
import { db, createAuditLog } from '$lib/server/db';
import { z } from 'zod';

export const load: PageServerLoad = async ({ params }) => {
	const vendor = await db.vendor.findUnique({
		where: { id: params.id }
	});

	if (!vendor) {
		throw error(404, 'Vendor not found');
	}

	return {
		vendor
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const formData = await request.formData();
		const data = {
			name: formData.get('name'),
			code: formData.get('code')?.toString().toUpperCase(),
			website: formData.get('website') || '',
			contactEmail: formData.get('contactEmail') || '',
			active: formData.get('active') === 'on'
		};

		try {
			// Validate the form data
			const validated = vendorUpdateSchema.parse(data);

			// Check if code already exists (excluding current vendor)
			const existing = await db.vendor.findFirst({
				where: {
					code: validated.code,
					id: { not: params.id }
				}
			});

			if (existing) {
				return fail(400, {
					errors: { code: ['Vendor code already exists'] },
					message: 'A vendor with this code already exists.'
				});
			}

			// Fetch old values for audit
			const oldVendor = await db.vendor.findUnique({
				where: { id: params.id }
			});

			// Update vendor in database
			const vendor = await db.vendor.update({
				where: { id: params.id },
				data: validated
			});

			// Create audit log with changes
			await createAuditLog('vendor', vendor.id, 'update', {
				old: oldVendor,
				new: vendor
			});

			// Redirect to vendor detail
			throw redirect(303, `/vendors/${vendor.id}`);
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
