import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { createDetailLoader } from '$lib/server/route-factory';

export const load: PageServerLoad = createDetailLoader({
	model: db.software,
	entityName: 'Software',
	include: {
		vendors: true,
		current_version: true,
		versions: {
			orderBy: {
				release_date: 'desc'
			}
		}
	}
});
