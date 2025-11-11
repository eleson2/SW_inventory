import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { createPageLoader } from '$lib/server/page-loader';

export const load: PageServerLoad = async ({ url }) => {
	// Get all vendors for filter dropdown
	const vendors = await db.vendors.findMany({
		where: { active: true },
		select: { id: true, name: true },
		orderBy: { name: 'asc' }
	});

	const pageData = await createPageLoader({
		model: db.software,
		dataKey: 'software',
		include: {
			vendors: {
				select: {
					id: true,
					name: true,
					code: true
				}
			}, // Relation field name from schema
			current_version: true // Include current version details
		},
		searchBuilder: (searchTerm) => ({
			OR: [
				{ name: { contains: searchTerm, mode: 'insensitive' } },
				{ vendors: { name: { contains: searchTerm, mode: 'insensitive' } } }
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

			const vendorId = url.searchParams.get('vendor');
			if (vendorId) {
				filters.vendor_id = vendorId;
			}

			return filters;
		}
	})(url);

	return {
		...pageData,
		vendors
	};
};
