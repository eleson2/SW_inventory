import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { createPageLoader } from '$lib/server/page-loader';

export const load: PageServerLoad = async ({ url }) => {
	return createPageLoader({
		model: db.software,
		dataKey: 'software',
		searchFields: ['name'], // Only search by name for software
		include: {
			vendor: true
		}
	})(url);
};
