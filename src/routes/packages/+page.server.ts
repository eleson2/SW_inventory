import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { createPageLoader } from '$lib/server/page-loader';

export const load: PageServerLoad = async ({ url }) => {
	return createPageLoader({
		model: db.packages,
		dataKey: 'packages',
		defaultSortField: 'release_date',
		defaultSortDirection: 'desc',
		include: {
			package_items: true // Relation field name from schema
		},
		filterBuilder: (url) => {
			const filters: Record<string, any> = {};
			const status = url.searchParams.get('status');
			if (status === 'active') {
				filters.active = true;
			} else if (status === 'inactive') {
				filters.active = false;
			}
			return filters;
		}
	})(url);
};
