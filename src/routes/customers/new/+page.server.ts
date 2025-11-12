import type { PageServerLoad, Actions } from './$types';
import { customerSchema } from '$schemas';
import { db } from '$lib/server/db';
import { serverValidate } from '$lib/utils/superforms';
import { createFormAction } from '$lib/server/form-actions';

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
	default: createFormAction({
		schema: customerSchema,
		model: db.customers,
		entityType: 'customer',
		redirectPath: () => '/customers',
		transform: (data) => ({
			name: data.name,
			code: data.code,
			description: data.description || null,
			active: data.active
		})
	})
};
