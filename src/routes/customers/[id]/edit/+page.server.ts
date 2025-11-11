import type { PageServerLoad, Actions } from './$types';
import { customerUpdateSchema } from '$schemas';
import { db, createAuditLog, checkUniqueConstraint } from '$lib/server/db';
import { error, fail } from '@sveltejs/kit';
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

		// Check for unique code using helper
		const uniqueCheck = await checkUniqueConstraint(db.customers, 'code', form.data.code, event.params.id);
		if (uniqueCheck.exists) {
			return fail(400, {
				form: {
					...form,
					errors: { ...form.errors, code: { _errors: [uniqueCheck.error!] } }
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
					name: form.data.name,
					code: form.data.code,
					description: form.data.description || null,
					active: form.data.active ?? true
				}
			});

			// CASCADE: If customer is being deactivated, deactivate all their LPARs
			if (currentCustomer?.active && form.data.active === false) {
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
