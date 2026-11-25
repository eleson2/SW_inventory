import type { PageServerLoad } from './$types';
import { db } from '#lib/server/db.ts';
import { createPageLoader } from '#lib/server/page-loader.ts';
import { textContains } from '#lib/server/db-dialect.ts';

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
		sortMap: {
			vendor: (dir) => ({ vendors: { name: dir } }),
			currentVersion: (dir) => ({ current_version: { version: dir } })
		},
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
				{ name: textContains(searchTerm) },
				{ vendors: { name: textContains(searchTerm) } }
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
				filters.name = textContains(nameFilter);
			}

			const vendorFilter = url.searchParams.get('col_vendor');
			if (vendorFilter) {
				filters.vendors = { name: textContains(vendorFilter) };
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
