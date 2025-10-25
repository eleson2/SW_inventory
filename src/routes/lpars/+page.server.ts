import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { createPageLoader } from '$lib/server/page-loader';

export const load: PageServerLoad = async ({ url }) => {
	// Get all customers for filter dropdown
	const customers = await db.customers.findMany({
		where: { active: true },
		select: { id: true, name: true },
		orderBy: { name: 'asc' }
	});

	const pageData = await createPageLoader({
		model: db.lpars,
		dataKey: 'lpars',
		include: {
			customers: true, // Relation field name from schema
			packages: true, // Relation field name from schema (current package)
			lpar_software: { // Relation field name from schema
				include: {
					software: true
				}
			}
		},
		filterBuilder: (url) => {
			const filters: Record<string, any> = {};

			const status = url.searchParams.get('status');
			if (status === 'active') {
				filters.active = true;
			} else if (status === 'inactive') {
				filters.active = false;
			}

			const customerId = url.searchParams.get('customer');
			if (customerId) {
				filters.customer_id = customerId;
			}

			return filters;
		}
	})(url);

	return {
		...pageData,
		customers
	};
};
