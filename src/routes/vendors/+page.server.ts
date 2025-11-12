import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { createPageLoader } from '$lib/server/page-loader';
import { createStatusFilter } from '$lib/server/filter-builders';

export const load: PageServerLoad = async ({ url }) => {
	return createPageLoader({
		model: db.vendors,
		dataKey: 'vendors',
		filterBuilder: createStatusFilter
	})(url);
};
