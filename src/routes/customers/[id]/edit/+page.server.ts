import type { PageServerLoad, Actions } from './$types';
import { customerUpdateSchema } from '$schemas';
import { db, createAuditLog } from '$lib/server/db';
import { error, fail, redirect } from '@sveltejs/kit';
import { zod } from 'sveltekit-superforms/adapters';
import type { CustomerUpdateFormData } from '$lib/types/superforms';
import { serverValidate } from '$lib/utils/superforms';

export const load: PageServerLoad = async ({ params }) => {
	const customer = await db.customers.findUnique({
		where: { id: params.id }
	});

	if (!customer) {
		throw error(404, 'Customer not found');
	}

	const form = await serverValidate(customer, customerUpdateSchema);

	return { form, customer };
};

export const actions: Actions = {
	default: async (event) => {
	const form = await serverValidate(event, customerUpdateSchema);

		if (!form.valid) {
			return fail(400, { form });
		}

		// Type-safe form data access
		const formData = form.data as CustomerUpdateFormData;

		const existing = await db.customers.findFirst({
			where: {
				code: formData.code,
				id: { not: event.params.id }
			}
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
			// Get current customer state
			const currentCustomer = await db.customers.findUnique({
				where: { id: event.params.id }
			});

			const customer = await db.customers.update({
				where: { id: event.params.id },
				data: {
					name: formData.name,
					code: formData.code,
					description: formData.description || null,
					active: formData.active ?? true
				}
			});

			// CASCADE: If customer is being deactivated, deactivate all their LPARs
			if (currentCustomer?.active && formData.active === false) {
				await db.lpars.updateMany({
					where: { customer_id: customer.id },
					data: { active: false, updated_at: new Date() }
				});
			}

			await createAuditLog('customer', customer.id, 'update', customer);

			// Return success - client will handle redirect via onUpdated
			return { form };
		} catch (err) {
			console.error('Error updating customer:', err);
			return fail(500, { form });
		}
	}
};
