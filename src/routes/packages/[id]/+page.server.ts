import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { createDetailLoader } from '$lib/server/route-factory';

export const load: PageServerLoad = createDetailLoader({
	model: db.packages,
	entityName: 'Package',
	include: {
		package_items: {
			include: {
				software: {
					include: {
						vendors: true
					}
				}
			},
			orderBy: {
				order_index: 'asc'
			}
		}
	}
});
