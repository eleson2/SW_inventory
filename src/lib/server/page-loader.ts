/**
 * Generic page loader utilities for list pages
 * Consolidates duplicate pagination and sorting logic
 */
import type { SortOptions } from '$types';
import { db, getPaginated } from './db';

export interface PageLoaderOptions<T = any> {
	/** The Prisma model delegate to query (e.g., db.customer, db.vendor) */
	model: any;
	/** Default sort field (defaults to 'name') */
	defaultSortField?: string;
	/** Default sort direction (defaults to 'asc') */
	defaultSortDirection?: 'asc' | 'desc';
	/** Default page size (defaults to 20) */
	defaultPageSize?: number;
	/** Fields to search in (defaults to ['name', 'code']) */
	searchFields?: string[];
	/** Relations to include in the query */
	include?: Record<string, any>;
	/** Return key for the data (e.g., 'customers', 'vendors') */
	dataKey: string;
	/** Additional filter function to build custom where clauses */
	filterBuilder?: (url: URL) => Record<string, any>;
	/** Custom search builder for complex searches (e.g., searching relations) */
	searchBuilder?: (searchTerm: string) => Record<string, any>;
}

/**
 * Generic page loader for list pages with pagination, sorting, and search
 *
 * @example
 * // In customers/+page.server.ts
 * export const load: PageServerLoad = async ({ url }) => {
 *   return createPageLoader({
 *     model: db.customer,
 *     dataKey: 'customers'
 *   })(url);
 * };
 *
 * @example
 * // With custom options
 * export const load: PageServerLoad = async ({ url }) => {
 *   return createPageLoader({
 *     model: db.lpar,
 *     dataKey: 'lpars',
 *     defaultSortField: 'code',
 *     include: {
 *       customer: true,
 *       currentPackage: true,
 *       softwareInstalled: {
 *         include: { software: true }
 *       }
 *     }
 *   })(url);
 * };
 */
export function createPageLoader<T = any>(options: PageLoaderOptions<T>) {
	const {
		model,
		defaultSortField = 'name',
		defaultSortDirection = 'asc',
		defaultPageSize = 20,
		searchFields = ['name', 'code'],
		include,
		dataKey,
		filterBuilder,
		searchBuilder
	} = options;

	return async (url: URL) => {
		// Parse query parameters
		const page = parseInt(url.searchParams.get('page') || '1');
		const pageSize = parseInt(url.searchParams.get('pageSize') || String(defaultPageSize));
		const sortField = url.searchParams.get('sort') || defaultSortField;
		const sortDirection = (url.searchParams.get('direction') || defaultSortDirection) as 'asc' | 'desc';
		const search = url.searchParams.get('search') || '';

		// Build where clause
		const whereConditions: any[] = [];

		// Add search filter
		if (search) {
			if (searchBuilder) {
				// Use custom search builder for complex searches
				whereConditions.push(searchBuilder(search));
			} else {
				// Use default field-based search
				whereConditions.push({
					OR: searchFields.map(field => ({
						[field]: { contains: search, mode: 'insensitive' as const }
					}))
				});
			}
		}

		// Add custom filters (including column filters via filterBuilder)
		if (filterBuilder) {
			const customFilters = filterBuilder(url);
			if (Object.keys(customFilters).length > 0) {
				whereConditions.push(customFilters);
			}
		}

		// Combine all conditions with AND
		const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

		// Get paginated data from database
		const data = await getPaginated(
			model,
			page,
			pageSize,
			where,
			{ [sortField]: sortDirection },
			include
		);

		const sort: SortOptions = {
			field: sortField,
			direction: sortDirection
		};

		return {
			[dataKey]: data,
			sort
		};
	};
}
