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

			// Dropdown filters
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

			// Column filters
			const nameFilter = url.searchParams.get('col_name');
			if (nameFilter) {
				filters.name = { contains: nameFilter, mode: 'insensitive' };
			}

			const vendorFilter = url.searchParams.get('col_vendor');
			if (vendorFilter) {
				filters.vendors = { name: { contains: vendorFilter, mode: 'insensitive' } };
			}

			const activeFilter = url.searchParams.get('col_active');
			if (activeFilter) {
				// Convert "active"/"inactive" text to boolean
				const isActive = activeFilter.toLowerCase().includes('active');
				const isInactive = activeFilter.toLowerCase().includes('inactive');
				if (isActive && !isInactive) {
					filters.active = true;
				} else if (isInactive && !isActive) {
					filters.active = false;
				}
			}

			return filters;
		}
	})(url);

	return {
		...pageData,
		vendors
	};
};
