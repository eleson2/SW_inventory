import type { PageServerLoad, Actions } from './$types';
import { customerSchema } from '$schemas';
import { db } from '$lib/server/db';
import { createCreateAction } from '$lib/server/route-factory';

// Load all customers for clone dropdown
export const load: PageServerLoad = async () => {
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
		allCustomers
	};
};

export const actions: Actions = {
	default: createCreateAction({
		schema: customerSchema,
		model: db.customers,
		entityType: 'customer',
		redirectPath: '/customers',
		extractFormData: (formData) => ({
			name: formData.get('name'),
			code: formData.get('code')?.toString().toUpperCase(),
			description: formData.get('description'),
			active: formData.get('active') === 'on'
		}),
		checkUnique: async (validated) => {
			const existing = await db.customers.findUnique({
				where: { code: validated.code }
			});
			return existing
				? {
						exists: true,
						field: 'code',
						message: 'A customer with this code already exists.'
				  }
				: null;
		}
	})
};
