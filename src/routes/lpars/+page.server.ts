import type { PageServerLoad } from './$types';
import { db } from '#lib/server/db.ts';
import { createPageLoader } from '#lib/server/page-loader.ts';
import { textContains } from '#lib/server/db-dialect.ts';

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
		sortMap: {
			customer: (dir) => ({ customers: { name: dir } }),
			currentPackage: (dir) => ({ packages: { code: dir } }),
			lpar_software: (dir) => ({ lpar_software: { _count: dir } })
		},
		include: {
			customers: {
				select: {
					id: true,
					name: true,
					code: true
				}
			},
			packages: {
				select: {
					id: true,
					name: true,
					code: true,
					version: true
				}
			},
			lpar_software: {
				select: {
					id: true,
					software_id: true,
					current_version: true,
					current_ptf_level: true,
					rolled_back: true,
					software: {
						select: {
							id: true,
							name: true
						}
					}
				},
				take: 10, // Limit to first 10 for list display
				orderBy: {
					installed_date: 'desc'
				}
			}
		},
		searchBuilder: (searchTerm) => ({
			OR: [
				{ name: textContains(searchTerm) },
				{ code: textContains(searchTerm) },
				{ customers: { name: textContains(searchTerm) } }
			]
		}),
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
