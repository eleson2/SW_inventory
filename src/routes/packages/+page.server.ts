import type { PageServerLoad } from './$types';
import { db } from '#lib/server/db.ts';
import { createPageLoader } from '#lib/server/page-loader.ts';
import { createStatusFilter } from '#lib/server/filter-builders.ts';

export const load: PageServerLoad = async ({ url }) => {
	return createPageLoader({
		model: db.packages,
		dataKey: 'packages',
		defaultSortField: 'release_date',
		defaultSortDirection: 'desc',
		include: {
			package_items: true // Relation field name from schema
		},
		filterBuilder: createStatusFilter
	})(url);
};
