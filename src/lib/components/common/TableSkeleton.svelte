<!--
	TableSkeleton.svelte
	Skeleton loading state for tables

	Usage:
	<TableSkeleton rows={5} columns={4} />
-->
<script lang="ts">
	import Skeleton from '$components/ui/Skeleton.svelte';

	interface Props {
		rows?: number;
		columns?: number;
	}

	let { rows = 5, columns = 4 }: Props = $props();
</script>

<div class="rounded-md border">
	<table class="w-full">
		<thead>
			<tr class="border-b bg-muted/50">
				{#each Array(columns) as _, i}
					<th class="h-12 px-4 text-left align-middle">
						<Skeleton class="h-4 w-24" />
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each Array(rows) as _, rowIndex}
				<tr class="border-b transition-colors {rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/20'}">
					{#each Array(columns) as _, colIndex}
						<td class="p-4 align-middle">
							<Skeleton class="h-4 w-{colIndex === 0 ? '32' : colIndex === columns - 1 ? '16' : '24'}" />
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
