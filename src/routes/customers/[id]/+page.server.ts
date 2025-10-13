import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const customer = await db.customer.findUnique({
		where: { id: params.id },
		include: {
			lpars: {
				include: {
					currentPackage: true,
					softwareInstalled: true
				}
			}
		}
	});

	if (!customer) {
		throw error(404, 'Customer not found');
	}

	return {
		customer
	};
};
