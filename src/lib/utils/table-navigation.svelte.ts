/**
 * Table navigation composable for sorting and pagination
 *
 * Provides reusable logic for managing URL-based table sorting and pagination.
 * Uses Svelte 5 runes for reactive state management.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useTableNavigation } from '$lib/utils/table-navigation.svelte';
 *
 *   let { data } = $props();
 *   const { handleSort, handlePageChange } = useTableNavigation();
 * </script>
 *
 * <DataTable
 *   {columns}
 *   {data}
 *   onSort={handleSort}
 *   currentSort={data.sort}
 * />
 * <Pagination
 *   currentPage={data.page}
 *   totalPages={data.totalPages}
 *   onPageChange={handlePageChange}
 * />
 * ```
 */

import { goto } from '$app/navigation';

export interface SortConfig {
	field: string;
	direction: 'asc' | 'desc';
}

export interface TableNavigationOptions {
	/**
	 * Base path for navigation (defaults to current path)
	 * @example '/vendors'
	 */
	basePath?: string;

	/**
	 * Whether to reset to page 1 when sorting changes
	 * @default true
	 */
	resetPageOnSort?: boolean;

	/**
	 * Preserve specific query parameters when navigating
	 * @example ['search', 'filter']
	 */
	preserveParams?: string[];
}

/**
 * Composable for table navigation (sorting & pagination)
 *
 * Manages URL query parameters for table state in a consistent way across all list pages.
 */
export function useTableNavigation(options: TableNavigationOptions = {}) {
	const {
		basePath,
		resetPageOnSort = true,
		preserveParams = []
	} = options;

	/**
	 * Handle column sort
	 *
	 * Toggles sort direction if clicking the same field, otherwise defaults to ascending.
	 * Updates URL query parameters and navigates to new URL.
	 *
	 * @param field - Column field to sort by
	 * @param currentSort - Current sort configuration (optional, will be read from URL if not provided)
	 */
	function handleSort(field: string, currentSort?: SortConfig | null) {
		// Get current URL or use base path
		const url = basePath
			? new URL(basePath, window.location.origin)
			: new URL(window.location.href);

		// If currentSort not provided, read from URL
		if (!currentSort) {
			const sortField = url.searchParams.get('sort');
			const sortDirection = url.searchParams.get('direction') as 'asc' | 'desc' | null;

			if (sortField && sortDirection) {
				currentSort = { field: sortField, direction: sortDirection };
			}
		}

		// Toggle direction if clicking same field, otherwise default to asc
		const direction =
			currentSort?.field === field && currentSort?.direction === 'asc' ? 'desc' : 'asc';

		// Update sort parameters
		url.searchParams.set('sort', field);
		url.searchParams.set('direction', direction);

		// Reset to first page when sorting (optional)
		if (resetPageOnSort) {
			url.searchParams.set('page', '1');
		}

		// Preserve specified parameters
		preserveParams.forEach((param) => {
			const value = new URL(window.location.href).searchParams.get(param);
			if (value) {
				url.searchParams.set(param, value);
			}
		});

		goto(url.toString());
	}

	/**
	 * Handle page change
	 *
	 * Updates the page query parameter and navigates to new URL.
	 *
	 * @param page - New page number (1-indexed)
	 */
	function handlePageChange(page: number) {
		// Get current URL or use base path
		const url = basePath
			? new URL(basePath, window.location.origin)
			: new URL(window.location.href);

		// Update page parameter
		url.searchParams.set('page', page.toString());

		// Preserve specified parameters
		preserveParams.forEach((param) => {
			const value = new URL(window.location.href).searchParams.get(param);
			if (value) {
				url.searchParams.set(param, value);
			}
		});

		goto(url.toString());
	}

	/**
	 * Navigate to first page
	 */
	function goToFirstPage() {
		handlePageChange(1);
	}

	/**
	 * Navigate to last page
	 *
	 * @param totalPages - Total number of pages
	 */
	function goToLastPage(totalPages: number) {
		handlePageChange(totalPages);
	}

	/**
	 * Navigate to next page
	 *
	 * @param currentPage - Current page number
	 * @param totalPages - Total number of pages
	 */
	function goToNextPage(currentPage: number, totalPages: number) {
		if (currentPage < totalPages) {
			handlePageChange(currentPage + 1);
		}
	}

	/**
	 * Navigate to previous page
	 *
	 * @param currentPage - Current page number
	 */
	function goToPreviousPage(currentPage: number) {
		if (currentPage > 1) {
			handlePageChange(currentPage - 1);
		}
	}

	/**
	 * Clear all sort and pagination parameters
	 */
	function reset() {
		const url = basePath
			? new URL(basePath, window.location.origin)
			: new URL(window.location.href);

		url.searchParams.delete('sort');
		url.searchParams.delete('direction');
		url.searchParams.delete('page');

		goto(url.toString());
	}

	return {
		handleSort,
		handlePageChange,
		goToFirstPage,
		goToLastPage,
		goToNextPage,
		goToPreviousPage,
		reset
	};
}
