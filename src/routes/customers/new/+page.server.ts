import type { PageServerLoad, Actions } from './$types';
import { customerSchema } from '$schemas';
import { db, createAuditLog } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

// Load all customers for clone dropdown
export const load: PageServerLoad = async () => {
	// Initialize Superforms with default values
	// @ts-expect-error - Superforms type inference issue with Zod validators
	const form = await superValidate({ description: '', active: true }, zod(customerSchema));

	const allCustomers = await db.customers.findMany({
		where: { active: true },
		orderBy: { name: 'asc' },
		select: {
			id: true,
			name: true,
			code: true,
			description: true,
			active: true
		}
	});

	return {
		form,
		allCustomers
	};
};

export const actions: Actions = {
	default: async (event) => {
		// Use Superforms to validate form data
		// @ts-expect-error - Superforms type inference issue with Zod validators
		const form = await superValidate(event, zod(customerSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		// Check for unique code
		const existing = await db.customers.findUnique({
			// @ts-expect-error - Type inference from Zod schema
			where: { code: form.data.code }
		});

		if (existing) {
			return fail(400, {
				form: {
					...form,
					errors: { ...form.errors, code: { _errors: ['A customer with this code already exists.'] } }
				}
			});
		}

		try {
			// Create customer
			const customer = await db.customers.create({
				data: {
					// @ts-ignore - Type inference from Zod schema
					name: form.data.name,
					// @ts-ignore
					code: form.data.code,
					// @ts-ignore
					description: form.data.description || null,
					// @ts-ignore
					active: form.data.active
				}
			});

			// Create audit log
			await createAuditLog('customer', customer.id, 'create', customer);

			// Return success - client will handle redirect via onUpdated
			return { form };
		} catch (error) {
			console.error('Error creating customer:', error);
			return fail(500, { form });
		}
	}
};
