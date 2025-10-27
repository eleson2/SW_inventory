import type { PageServerLoad, Actions } from './$types';
import { customerUpdateSchema } from '$schemas';
import { db, createAuditLog } from '$lib/server/db';
import { error, fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

export const load: PageServerLoad = async ({ params }) => {
	const customer = await db.customers.findUnique({
		where: { id: params.id }
	});

	if (!customer) {
		throw error(404, 'Customer not found');
	}

	// @ts-expect-error - Superforms type inference issue with Zod validators
	const form = await superValidate(customer, zod(customerUpdateSchema));

	return { form, customer };
};

export const actions: Actions = {
	default: async (event) => {
		// @ts-expect-error - Superforms type inference issue with Zod validators
		const form = await superValidate(event, zod(customerUpdateSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		const existing = await db.customers.findFirst({
			where: {
				// @ts-expect-error - Type inference from Zod schema
				code: form.data.code,
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
			const customer = await db.customers.update({
				where: { id: event.params.id },
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

			await createAuditLog('customer', customer.id, 'update', customer);

			throw redirect(303, '/customers');
		} catch (err) {
			if (err instanceof Response) throw err;

			console.error('Error updating customer:', err);
			return fail(500, { form });
		}
	}
};
