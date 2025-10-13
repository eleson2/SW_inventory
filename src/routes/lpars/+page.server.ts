import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { createPageLoader } from '$lib/server/page-loader';

export const load: PageServerLoad = async ({ url }) => {
	return createPageLoader({
		model: db.lpar,
		dataKey: 'lpars',
		include: {
			customer: true,
			currentPackage: true,
			softwareInstalled: {
				include: {
					software: true
				}
			}
		}
	})(url);
};
