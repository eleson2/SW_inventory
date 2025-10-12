import type { PageServerLoad } from './$types';
import type { SortOptions } from '$types';
import { db, getPaginated } from '$lib/server/db';

export const load: PageServerLoad = async ({ url }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
	const sortField = url.searchParams.get('sort') || 'name';
	const sortDirection = (url.searchParams.get('direction') || 'asc') as 'asc' | 'desc';
	const search = url.searchParams.get('search') || '';

	// Build where clause for search
	const where = search
		? {
				name: { contains: search, mode: 'insensitive' as const }
		  }
		: {};

	// Get paginated software from database with vendor relation
	const software = await getPaginated(
		db.software,
		page,
		pageSize,
		where,
		{ [sortField]: sortDirection },
		{ vendor: true } // Include vendor information
	);

	const sort: SortOptions = {
		field: sortField,
		direction: sortDirection
	};

	return {
		software,
		sort
	};
};
