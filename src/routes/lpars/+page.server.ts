import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { createPageLoader } from '$lib/server/page-loader';

export const load: PageServerLoad = async ({ url }) => {
	return createPageLoader({
		model: db.lpars,
		dataKey: 'lpars',
		include: {
			customers: true, // Relation field name from schema
			packages: true, // Relation field name from schema (current package)
			lpar_software: { // Relation field name from schema
				include: {
					software: true
				}
			}
		}
	})(url);
};
