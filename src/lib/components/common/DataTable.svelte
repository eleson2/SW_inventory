<script lang="ts" generics="T">
	import { cn } from '$utils/cn';
	import Button from '$components/ui/Button.svelte';
	import type { SortOptions } from '$types';
	import type { Snippet } from 'svelte';

	type Column<T> = {
		key: keyof T | string;
		label: string;
		sortable?: boolean;
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
		emptyState
	}: {
		data: T[];
		columns: Column<T>[];
		onSort?: (field: string) => void;
		currentSort?: SortOptions;
		onRowClick?: (item: T) => void;
		loading?: boolean;
		emptyMessage?: string;
		emptyState?: Snippet;
	} = $props();

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
</script>

<div class="rounded-md border">
	<table class="w-full">
		<thead>
			<tr class="border-b bg-muted/50">
				{#each columns as column}
					<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
						{#if column.sortable && onSort}
							<button
								class="flex items-center gap-2 hover:text-foreground"
								onclick={() => handleSort(column.key as string)}
							>
								{column.label}
								{#if currentSort?.field === column.key}
									<span class="text-xs">
										{currentSort.direction === 'asc' ? '↑' : '↓'}
									</span>
								{/if}
							</button>
						{:else}
							{column.label}
						{/if}
					</th>
				{/each}
			</tr>
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
			{:else if data.length === 0}
				<tr>
					<td colspan={columns.length} class="h-32 text-center">
						{#if emptyState}
							<div class="flex flex-col items-center justify-center gap-2 py-8">
								{@render emptyState()}
							</div>
						{:else}
							<p class="text-muted-foreground">{emptyMessage}</p>
						{/if}
					</td>
				</tr>
			{:else}
				{#each data as item, index}
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
