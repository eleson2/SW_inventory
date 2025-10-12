import type { PageServerLoad } from './$types';
import type { SortOptions } from '$types';
import { db, getPaginated } from '$lib/server/db';

export const load: PageServerLoad = async ({ url }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
	const sortField = url.searchParams.get('sort') || 'releaseDate';
	const sortDirection = (url.searchParams.get('direction') || 'desc') as 'asc' | 'desc';
	const search = url.searchParams.get('search') || '';

	// Build where clause for search
	const where = search
		? {
				OR: [
					{ name: { contains: search, mode: 'insensitive' as const } },
					{ code: { contains: search, mode: 'insensitive' as const } }
				]
		  }
		: {};

	// Get paginated packages from database with items
	const packages = await getPaginated(
		db.package,
		page,
		pageSize,
		where,
		{ [sortField]: sortDirection },
		{ items: true } // Include package items
	);

	const sort: SortOptions = {
		field: sortField,
		direction: sortDirection
	};

	return {
		packages,
		sort
	};
};
