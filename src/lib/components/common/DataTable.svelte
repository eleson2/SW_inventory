<script lang="ts" generics="T">
	import { cn } from '$utils/cn';
	import Button from '$components/ui/Button.svelte';
	import type { SortOptions } from '$types';

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
		emptyMessage = 'No data available'
	}: {
		data: T[];
		columns: Column<T>[];
		onSort?: (field: string) => void;
		currentSort?: SortOptions;
		onRowClick?: (item: T) => void;
		loading?: boolean;
		emptyMessage?: string;
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
						Loading...
					</td>
				</tr>
			{:else if data.length === 0}
				<tr>
					<td colspan={columns.length} class="h-24 text-center text-muted-foreground">
						{emptyMessage}
					</td>
				</tr>
			{:else}
				{#each data as item}
					<tr
						class={cn(
							'border-b transition-colors',
							onRowClick && 'cursor-pointer hover:bg-muted/50'
						)}
						onclick={() => onRowClick?.(item)}
					>
						{#each columns as column}
							<td class="p-4 align-middle">
								{@render getCellValue(item, column)}
							</td>
						{/each}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
