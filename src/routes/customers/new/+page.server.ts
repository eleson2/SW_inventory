import type { PageServerLoad, Actions } from './$types';
import { customerSchema } from '#lib/schemas/index.ts';
import { db } from '#lib/server/db.ts';
import { serverValidate } from '#lib/utils/superforms.ts';
import { createFormAction } from '#lib/server/form-actions.ts';
import { requirePermission } from '#lib/server/permissions.ts';

// Load all customers for clone dropdown
export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'manage_customers');
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

const create = createFormAction({
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
});

export const actions: Actions = {
	default: async (event) => {
		requirePermission(event.locals, 'manage_customers');
		return create(event);
	}
};
