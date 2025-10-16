import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { createDetailLoader } from '$lib/server/route-factory';

export const load: PageServerLoad = createDetailLoader({
	model: db.vendors,
	entityName: 'Vendor',
	include: {
		software: {
			include: {
				current_version: true
			},
			orderBy: {
				name: 'asc'
			}
		}
	}
});
