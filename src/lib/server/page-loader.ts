/**
 * Generic page loader utilities for list pages
 * Consolidates duplicate pagination and sorting logic
 */
import type { SortOptions } from '#lib/types/index.ts';
import { db, getPaginated } from './db';
import { textContains } from '#lib/server/db-dialect.ts';

export interface PageLoaderOptions<T = any, K extends string = string> {
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
	dataKey: K;
	/** Additional filter function to build custom where clauses */
	filterBuilder?: (url: URL) => Record<string, any>;
	/** Custom search builder for complex searches (e.g., searching relations) */
	searchBuilder?: (searchTerm: string) => Record<string, any>;
	/**
	 * Column keys that are not scalar fields of the model (relations, counts), mapped to a
	 * Prisma orderBy, e.g. `{ customer: (dir) => ({ customers: { name: dir } }) }`.
	 */
	sortMap?: Record<string, (direction: 'asc' | 'desc') => Record<string, any>>;
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
/** One page of rows; items are untyped because the model delegate is passed in dynamically */
export type PaginatedData = Awaited<ReturnType<typeof getPaginated>>;

export function createPageLoader<T = any, K extends string = string>(options: PageLoaderOptions<T, K>) {
	const {
		model,
		defaultSortField = 'name',
		defaultSortDirection = 'asc',
		defaultPageSize = 20,
		searchFields = ['name', 'code'],
		include,
		dataKey,
		filterBuilder,
		searchBuilder,
		sortMap = {}
	} = options;

	return async (url: URL) => {
		// Parse query parameters
		const page = parseInt(url.searchParams.get('page') || '1');
		const pageSize = parseInt(url.searchParams.get('pageSize') || String(defaultPageSize));
		const requestedSort = url.searchParams.get('sort') || defaultSortField;
		const requestedDirection = url.searchParams.get('direction');
		const sortDirection: 'asc' | 'desc' =
			requestedDirection === 'asc' || requestedDirection === 'desc' ? requestedDirection : defaultSortDirection;
		// Only sort on a mapped key or a scalar field of the model; anything else (a display-only
		// column key, a hand-edited URL) would make Prisma throw, so fall back to the default.
		const sortField = requestedSort in sortMap || isScalarField(model, requestedSort)
			? requestedSort
			: defaultSortField;
		const orderBy = sortField in sortMap ? sortMap[sortField](sortDirection) : { [sortField]: sortDirection };
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
						[field]: textContains(search)
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
			orderBy,
			include
		);

		const sort: SortOptions = {
			field: sortField,
			direction: sortDirection
		};

		// Computed keys widen to string; restore the literal data key for the page's types
		return { [dataKey]: data, sort } as { [P in K]: PaginatedData } & { sort: SortOptions };
	};
}

/** True when `field` is a scalar field of the Prisma model delegate (`delegate.fields`). */
function isScalarField(model: any, field: string): boolean {
	return Boolean(model?.fields && Object.prototype.hasOwnProperty.call(model.fields, field));
}
