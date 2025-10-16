import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { createDetailLoader } from '$lib/server/route-factory';

export const load: PageServerLoad = createDetailLoader({
	model: db.customers,
	entityName: 'Customer',
	include: {
		lpars: {
			include: {
				packages: true,
				lpar_software: true
			}
		}
	}
});
