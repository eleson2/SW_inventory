import type { PageServerLoad, Actions } from './$types';
import { customerSchema } from '$schemas';
import { db, createAuditLog, checkUniqueConstraint } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import { serverValidate } from '$lib/utils/superforms';

// Load all customers for clone dropdown
export const load: PageServerLoad = async () => {
	// Initialize Superforms with default values
	const form = await serverValidate({ description: '', active: true }, customerSchema);

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
	const form = await serverValidate(event, customerSchema);

		if (!form.valid) {
			return fail(400, { form });
		}

		// Check for unique code using helper
		const uniqueCheck = await checkUniqueConstraint(db.customers, 'code', form.data.code);
		if (uniqueCheck.exists) {
			return fail(400, {
				form: {
					...form,
					errors: { ...form.errors, code: { _errors: [uniqueCheck.error!] } }
				}
			});
		}

		try {
			// Create customer
			const customer = await db.customers.create({
				data: {
					name: form.data.name,
					code: form.data.code,
					description: form.data.description || null,
					active: form.data.active
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
