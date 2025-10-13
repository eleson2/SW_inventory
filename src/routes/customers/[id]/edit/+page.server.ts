import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { customerUpdateSchema } from '$schemas';
import { db, createAuditLog } from '$lib/server/db';
import { z } from 'zod';

export const load: PageServerLoad = async ({ params }) => {
	const customer = await db.customer.findUnique({
		where: { id: params.id }
	});

	if (!customer) {
		throw error(404, 'Customer not found');
	}

	return {
		customer
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const formData = await request.formData();
		const data = {
			name: formData.get('name'),
			code: formData.get('code')?.toString().toUpperCase(),
			description: formData.get('description'),
			active: formData.get('active') === 'on'
		};

		try {
			// Validate the form data
			const validated = customerUpdateSchema.parse(data);

			// Check if code already exists (excluding current customer)
			const existing = await db.customer.findFirst({
				where: {
					code: validated.code,
					id: { not: params.id }
				}
			});

			if (existing) {
				return fail(400, {
					errors: { code: ['Customer code already exists'] },
					message: 'A customer with this code already exists.'
				});
			}

			// Fetch old values for audit
			const oldCustomer = await db.customer.findUnique({
				where: { id: params.id }
			});

			// Update customer in database
			const customer = await db.customer.update({
				where: { id: params.id },
				data: validated
			});

			// Create audit log with changes
			await createAuditLog('customer', customer.id, 'update', {
				old: oldCustomer,
				new: customer
			});

			// Redirect to customer detail
			throw redirect(303, `/customers/${customer.id}`);
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
