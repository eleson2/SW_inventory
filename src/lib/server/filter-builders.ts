/**
 * Reusable filter builder utilities for server-side page loaders
 * These functions help construct Prisma where clauses from URL parameters
 */

/**
 * Creates a filter for active/inactive status from URL parameter
 * Expects URL parameter: ?status=active or ?status=inactive
 *
 * @param url - The URL object containing search parameters
 * @returns Prisma filter object for active field
 *
 * @example
 * filterBuilder: (url) => createStatusFilter(url)
 *
 * @example
 * filterBuilder: (url) => ({
 *   ...createStatusFilter(url),
 *   ...otherFilters
 * })
 */
export function createStatusFilter(url: URL): Record<string, any> {
	const filters: Record<string, any> = {};
	const status = url.searchParams.get('status');

	if (status === 'active') {
		filters.active = true;
	} else if (status === 'inactive') {
		filters.active = false;
	}

	return filters;
}

/**
 * Creates a filter for column-based filtering from URL parameters
 * Expects URL parameters like: ?col_name=searchterm&col_active=active
 *
 * @param url - The URL object containing search parameters
 * @param columns - Array of column keys that should be filterable
 * @param config - Optional configuration for specific columns
 * @returns Prisma filter object
 *
 * @example
 * filterBuilder: (url) => createColumnFilters(url, ['name', 'code', 'active'])
 */
export function createColumnFilters(
	url: URL,
	columns: string[],
	config?: {
		booleanColumns?: string[];
		relationColumns?: Record<string, string>; // e.g., { vendor: 'vendors.name' }
	}
): Record<string, any> {
	const filters: Record<string, any> = {};

	columns.forEach((column) => {
		const filterValue = url.searchParams.get(`col_${column}`);
		if (!filterValue) return;

		// Handle boolean columns (like active/inactive)
		if (config?.booleanColumns?.includes(column)) {
			const isActive = filterValue.toLowerCase().includes('active');
			const isInactive = filterValue.toLowerCase().includes('inactive');
			if (isActive && !isInactive) {
				filters[column] = true;
			} else if (isInactive && !isActive) {
				filters[column] = false;
			}
			return;
		}

		// Handle relation columns
		const relationPath = config?.relationColumns?.[column];
		if (relationPath) {
			const [relation, field] = relationPath.split('.');
			filters[relation] = { [field]: { contains: filterValue, mode: 'insensitive' } };
			return;
		}

		// Default: case-insensitive string search
		filters[column] = { contains: filterValue, mode: 'insensitive' };
	});

	return filters;
}

/**
 * Combines multiple filter objects into a single object
 * Useful when you need to apply multiple filter types
 *
 * @param filterFns - Array of filter functions that take URL and return filters
 * @returns A function that combines all filters
 *
 * @example
 * filterBuilder: combineFilters([
 *   createStatusFilter,
 *   (url) => createColumnFilters(url, ['name', 'code'])
 * ])
 */
export function combineFilters(
	...filterFns: Array<(url: URL) => Record<string, any>>
): (url: URL) => Record<string, any> {
	return (url: URL) => {
		return filterFns.reduce((acc, fn) => {
			return { ...acc, ...fn(url) };
		}, {});
	};
}
