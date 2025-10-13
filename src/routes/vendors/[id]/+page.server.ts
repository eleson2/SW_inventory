import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const vendor = await db.vendor.findUnique({
		where: { id: params.id },
		include: {
			software: {
				orderBy: {
					name: 'asc'
				}
			}
		}
	});

	if (!vendor) {
		throw error(404, 'Vendor not found');
	}

	return {
		vendor
	};
};
