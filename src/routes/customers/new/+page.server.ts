import type { PageServerLoad, Actions } from './$types';
import { customerSchema } from '$schemas';
import { db, createAuditLog } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { CustomerFormData, SuperForm } from '$lib/types/superforms';

// Load all customers for clone dropdown
export const load: PageServerLoad = async () => {
	// Initialize Superforms with default values
	const form = await superValidate({ description: '', active: true }, zod(customerSchema)) as SuperForm<typeof customerSchema>;

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
	const form = await superValidate(event, zod(customerSchema)) as SuperForm<typeof customerSchema>;

		if (!form.valid) {
			return fail(400, { form });
		}

		// Type-safe form data access
		const formData = form.data as CustomerFormData;

		// Check for unique code
		const existing = await db.customers.findUnique({
			where: { code: formData.code }
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
					name: formData.name,
					code: formData.code,
					description: formData.description || null,
					active: formData.active
				}
			});

			// Create audit log
			await createAuditLog('customer', customer.id, 'create', customer);

			// Redirect to customers list
			redirect(303, '/customers');
		} catch (error) {
			console.error('Error creating customer:', error);
			return fail(500, { form });
		}
	}
};
