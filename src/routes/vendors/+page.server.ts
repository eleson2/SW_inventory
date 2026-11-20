import type { PageServerLoad } from './$types';
import { db } from '#lib/server/db.ts';
import { createPageLoader } from '#lib/server/page-loader.ts';
import { createStatusFilter } from '#lib/server/filter-builders.ts';

export const load: PageServerLoad = async ({ url }) => {
	return createPageLoader({
		model: db.vendors,
		dataKey: 'vendors',
		filterBuilder: createStatusFilter
	})(url);
};
