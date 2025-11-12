/**
 * Common filter configurations for InstantSearch component
 * These can be reused across multiple listing pages
 */

/**
 * Standard active/inactive status filter
 * Use this for any entity with an 'active' boolean field
 */
export const STATUS_FILTER = {
	name: 'status',
	label: 'Status',
	options: [
		{ value: 'active', label: 'Active' },
		{ value: 'inactive', label: 'Inactive' }
	]
};

/**
 * Boolean yes/no filter
 * Generic filter for any boolean field
 */
export const BOOLEAN_FILTER = (name: string, label: string) => ({
	name,
	label,
	options: [
		{ value: 'true', label: 'Yes' },
		{ value: 'false', label: 'No' }
	]
});

/**
 * Creates a filter for a relation field
 * @param name - The filter parameter name
 * @param label - Display label for the filter
 * @param options - Array of { value, label } options
 */
export const createRelationFilter = (
	name: string,
	label: string,
	options: Array<{ value: string; label: string }>
) => ({
	name,
	label,
	options
});
