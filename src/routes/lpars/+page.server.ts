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
				OR: [
					{ name: { contains: search, mode: 'insensitive' as const } },
					{ code: { contains: search, mode: 'insensitive' as const } }
				]
		  }
		: {};

	// Get paginated LPARs from database with relations
	const lpars = await getPaginated(
		db.lpar,
		page,
		pageSize,
		where,
		{ [sortField]: sortDirection },
		{
			customer: true,
			currentPackage: true,
			softwareInstalled: {
				include: {
					software: true
				}
			}
		}
	);

	const sort: SortOptions = {
		field: sortField,
		direction: sortDirection
	};

	return {
		lpars,
		sort
	};
};
