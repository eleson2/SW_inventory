import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const pkg = await db.package.findUnique({
		where: { id: params.id },
		include: {
			items: {
				include: {
					software: {
						include: {
							vendor: true
						}
					}
				},
				orderBy: {
					orderIndex: 'asc'
				}
			}
		}
	});

	if (!pkg) {
		throw error(404, 'Package not found');
	}

	return {
		package: pkg
	};
};
