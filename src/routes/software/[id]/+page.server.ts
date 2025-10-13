import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const software = await db.software.findUnique({
		where: { id: params.id },
		include: {
			vendor: true
		}
	});

	if (!software) {
		throw error(404, 'Software not found');
	}

	return {
		software
	};
};
