import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { customerSchema } from '$schemas';
import { db, createAuditLog } from '$lib/server/db';
import { z } from 'zod';

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const data = {
			name: formData.get('name'),
			code: formData.get('code')?.toString().toUpperCase(), // Ensure uppercase
			description: formData.get('description'),
			active: formData.get('active') === 'on'
		};

		try {
			// Validate the form data
			const validated = customerSchema.parse(data);

			// Check if code already exists
			const existing = await db.customer.findUnique({
				where: { code: validated.code }
			});

			if (existing) {
				return fail(400, {
					errors: { code: ['Customer code already exists'] },
					message: 'A customer with this code already exists.'
				});
			}

			// Create customer in database
			const customer = await db.customer.create({
				data: validated
			});

			// Create audit log
			await createAuditLog('customer', customer.id, 'create', { customer });

			// Redirect to customers list
			throw redirect(303, '/customers');
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
