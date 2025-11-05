<script lang="ts" generics="T">
	import { cn } from '$utils/cn';
	import Button from '$components/ui/Button.svelte';
	import TableSkeleton from '$components/common/TableSkeleton.svelte';
	import EmptyState from '$components/common/EmptyState.svelte';
	import { Search, X } from 'lucide-svelte';
	import type { SortOptions } from '$types';
	import type { Snippet } from 'svelte';

	type Column<T> = {
		key: keyof T | string;
		label: string;
		sortable?: boolean;
		filterable?: boolean;
		render?: (item: T) => any;
	};

	let {
		data,
		columns,
		onSort,
		currentSort,
		onRowClick,
		loading = false,
		emptyMessage = 'No data available',
		emptyState,
		showFilters = true
	}: {
		data: T[];
		columns: Column<T>[];
		onSort?: (field: string) => void;
		currentSort?: SortOptions;
		onRowClick?: (item: T) => void;
		loading?: boolean;
		emptyMessage?: string;
		emptyState?: Snippet;
		showFilters?: boolean;
	} = $props();

	// Column filters state
	let columnFilters = $state<Record<string, string>>({});

	// Filtered data based on column filters
	const filteredData = $derived(() => {
		if (!showFilters || Object.keys(columnFilters).length === 0) {
			return data;
		}

		return data.filter(item => {
			return Object.entries(columnFilters).every(([key, filterValue]) => {
				if (!filterValue) return true;

				const column = columns.find(col => col.key === key);
				if (!column) return true;

				let cellValue: any;
				if (column.render) {
					cellValue = column.render(item);
				} else {
					cellValue = item[column.key as keyof T];
				}

				// Convert to string and check if it includes the filter value (case-insensitive)
				const cellString = String(cellValue || '').toLowerCase();
				const filterString = filterValue.toLowerCase();
				return cellString.includes(filterString);
			});
		});
	});

	function handleSort(field: string) {
		if (onSort) {
			onSort(field);
		}
	}

	function getCellValue(item: T, column: Column<T>) {
		if (column.render) {
			return column.render(item);
		}
		return item[column.key as keyof T];
	}

	function clearFilter(key: string) {
		columnFilters[key] = '';
	}

	function clearAllFilters() {
		columnFilters = {};
	}

	const hasActiveFilters = $derived(Object.values(columnFilters).some(v => v));
</script>

{#if loading}
	<TableSkeleton rows={5} columns={columns.length} />
{:else}
<!-- Clear filters button -->
{#if showFilters && hasActiveFilters}
	<div class="mb-2 flex justify-end">
		<button
			onclick={clearAllFilters}
			class="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
		>
			<X class="w-3 h-3" />
			Clear all filters
		</button>
	</div>
{/if}

<!-- Mobile-responsive wrapper with horizontal scroll -->
<div class="rounded-md border overflow-x-auto">
	<table class="w-full min-w-[640px]">
		<thead>
			<!-- Header row with labels and sort buttons -->
			<tr class="border-b bg-muted/50">
				{#each columns as column}
					<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap {currentSort?.field === column.key ? 'bg-accent/50' : ''}">
						{#if (column.sortable !== false) && onSort}
							<button
								class="flex items-center gap-2 hover:text-foreground transition-colors min-h-[44px] {currentSort?.field === column.key ? 'text-foreground font-bold' : ''}"
								onclick={() => handleSort(column.key as string)}
								title={currentSort?.field === column.key
									? `Sorted ${currentSort.direction === 'asc' ? 'ascending' : 'descending'}. Click to ${currentSort.direction === 'asc' ? 'sort descending' : 'sort ascending'}`
									: 'Click to sort'}
							>
								{column.label}
								{#if currentSort?.field === column.key}
									<span class="text-base font-bold" aria-label={`Sorted ${currentSort.direction === 'asc' ? 'ascending' : 'descending'}`}>
										{currentSort.direction === 'asc' ? '▲' : '▼'}
									</span>
								{:else}
									<span class="text-xs text-muted-foreground/50">
										⇅
									</span>
								{/if}
							</button>
						{:else}
							{column.label}
						{/if}
					</th>
				{/each}
			</tr>

			<!-- Filter row -->
			{#if showFilters}
				<tr class="border-b bg-muted/30">
					{#each columns as column}
						<th class="px-4 py-2">
							{#if column.filterable !== false}
								<div class="relative">
									<input
										type="text"
										bind:value={columnFilters[column.key as string]}
										placeholder="Filter..."
										class="w-full h-8 px-2 pr-6 text-xs border border-input bg-background rounded focus:outline-none focus:ring-2 focus:ring-ring"
									/>
									{#if columnFilters[column.key as string]}
										<button
											onclick={() => clearFilter(column.key as string)}
											class="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
											title="Clear filter"
										>
											<X class="w-3 h-3" />
										</button>
									{:else}
										<Search class="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
									{/if}
								</div>
							{/if}
						</th>
					{/each}
				</tr>
			{/if}
		</thead>
		<tbody>
			{#if loading}
				<tr>
					<td colspan={columns.length} class="h-24 text-center">
						<div class="flex items-center justify-center gap-2">
							<div class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
							<span class="text-muted-foreground">Loading...</span>
						</div>
					</td>
				</tr>
			{:else if filteredData().length === 0}
				<tr>
					<td colspan={columns.length} class="p-0">
						{#if hasActiveFilters}
							<EmptyState
								title="No matches found"
								description="Try adjusting your column filters"
								showBackground={false}
							/>
						{:else if emptyState}
							<div class="py-8">
								{@render emptyState()}
							</div>
						{:else}
							<EmptyState
								title={emptyMessage}
								description="Try adjusting your filters or search terms"
								showBackground={false}
							/>
						{/if}
					</td>
				</tr>
			{:else}
				{#each filteredData() as item, index}
					<tr
						class={cn(
							'border-b transition-colors',
							index % 2 === 0 ? 'bg-background' : 'bg-muted/20',
							onRowClick && 'cursor-pointer hover:bg-accent/50'
						)}
						onclick={() => onRowClick?.(item)}
					>
						{#each columns as column}
							<td class="p-4 align-middle">
								{getCellValue(item, column)}
							</td>
						{/each}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
{/if}
