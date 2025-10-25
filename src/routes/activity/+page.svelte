<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Card from '$components/ui/Card.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import Button from '$components/ui/Button.svelte';
	import Pagination from '$components/common/Pagination.svelte';
	import { formatDistanceToNow } from 'date-fns';

	let { data } = $props();

	// Action type color mapping
	function getActionColor(action: string): 'default' | 'success' | 'warning' | 'danger' {
		switch (action.toLowerCase()) {
			case 'create':
				return 'success';
			case 'update':
				return 'default';
			case 'delete':
				return 'danger';
			case 'rollback':
				return 'warning';
			default:
				return 'default';
		}
	}

	// Format entity type for display
	function formatEntityType(type: string): string {
		return type
			.split('_')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	// Format changes JSON for display
	function formatChanges(changes: any): string {
		if (!changes) return 'No changes recorded';

		try {
			const changeObj = typeof changes === 'string' ? JSON.parse(changes) : changes;
			const entries = Object.entries(changeObj);

			if (entries.length === 0) return 'No changes recorded';

			return entries
				.map(([key, value]: [string, any]) => {
					if (typeof value === 'object' && value !== null) {
						if ('from' in value && 'to' in value) {
							return `${key}: "${value.from}" → "${value.to}"`;
						}
						return `${key}: ${JSON.stringify(value)}`;
					}
					return `${key}: ${value}`;
				})
				.join(', ');
		} catch (e) {
			return JSON.stringify(changes);
		}
	}

	// Handle filter changes
	function updateFilter(key: string, value: string) {
		const params = new URLSearchParams($page.url.searchParams);
		if (value) {
			params.set(key, value);
		} else {
			params.delete(key);
		}
		params.set('page', '1'); // Reset to first page
		goto(`?${params.toString()}`);
	}

	// Clear all filters
	function clearFilters() {
		goto('/activity');
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Activity Log</h1>
			<p class="text-muted-foreground mt-1">
				Track all changes and actions across the system
			</p>
		</div>
	</div>

	<!-- Filters -->
	<Card>
		<div class="flex flex-col md:flex-row gap-4 items-start md:items-end">
			<div class="flex-1 space-y-2">
				<label for="entity_type" class="text-sm font-medium">Entity Type</label>
				<select
					id="entity_type"
					class="w-full px-3 py-2 border rounded-md bg-background min-h-[44px]"
					value={data.filters.currentEntityType || ''}
					onchange={(e) => updateFilter('entity_type', e.currentTarget.value)}
				>
					<option value="">All Types</option>
					{#each data.filters.entityTypes as type}
						<option value={type}>{formatEntityType(type)}</option>
					{/each}
				</select>
			</div>

			<div class="flex-1 space-y-2">
				<label for="action" class="text-sm font-medium">Action</label>
				<select
					id="action"
					class="w-full px-3 py-2 border rounded-md bg-background min-h-[44px]"
					value={data.filters.currentAction || ''}
					onchange={(e) => updateFilter('action', e.currentTarget.value)}
				>
					<option value="">All Actions</option>
					{#each data.filters.actions as actionType}
						<option value={actionType}>{actionType.toUpperCase()}</option>
					{/each}
				</select>
			</div>

			{#if data.filters.currentEntityType || data.filters.currentAction}
				<Button variant="outline" onclick={clearFilters} class="min-h-[44px]">
					Clear Filters
				</Button>
			{/if}
		</div>
	</Card>

	<!-- Activity Log Table -->
	<Card>
		{#if data.logs.length === 0}
			<div class="text-center py-12">
				<p class="text-muted-foreground">No activity log entries found.</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full min-w-[640px]">
					<thead>
						<tr class="border-b">
							<th class="text-left p-4 font-medium whitespace-nowrap">Timestamp</th>
							<th class="text-left p-4 font-medium whitespace-nowrap">Entity Type</th>
							<th class="text-left p-4 font-medium whitespace-nowrap">Action</th>
							<th class="text-left p-4 font-medium">Changes</th>
							<th class="text-left p-4 font-medium whitespace-nowrap">Entity ID</th>
						</tr>
					</thead>
					<tbody>
						{#each data.logs as log, index}
							<tr class="border-b transition-colors {index % 2 === 0 ? 'bg-background' : 'bg-muted/20'} hover:bg-accent/50">
								<td class="p-4 align-middle">
									<div class="flex flex-col">
										<span class="text-sm font-medium">
											{new Date(log.timestamp).toLocaleString()}
										</span>
										<span class="text-xs text-muted-foreground">
											{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
										</span>
									</div>
								</td>
								<td class="p-4 align-middle">
									<Badge variant="outline">
										{formatEntityType(log.entity_type)}
									</Badge>
								</td>
								<td class="p-4 align-middle">
									<Badge variant={getActionColor(log.action)}>
										{log.action.toUpperCase()}
									</Badge>
								</td>
								<td class="p-4 align-middle">
									<div class="max-w-md">
										<details class="group">
											<summary class="cursor-pointer text-sm text-muted-foreground hover:text-foreground list-none">
												<span class="group-open:hidden">Show changes...</span>
												<span class="hidden group-open:inline">Hide changes</span>
											</summary>
											<div class="mt-2 p-3 bg-muted/50 rounded text-xs font-mono whitespace-pre-wrap break-all">
												{formatChanges(log.changes)}
											</div>
										</details>
									</div>
								</td>
								<td class="p-4 align-middle">
									<code class="text-xs bg-muted px-2 py-1 rounded">
										{log.entity_id.substring(0, 8)}...
									</code>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			{#if data.pagination.totalPages > 1}
				<div class="mt-4 border-t pt-4">
					<Pagination
						currentPage={data.pagination.page}
						totalPages={data.pagination.totalPages}
						onPageChange={(newPage) => {
							const params = new URLSearchParams($page.url.searchParams);
							params.set('page', newPage.toString());
							goto(`?${params.toString()}`);
						}}
					/>
				</div>
			{/if}
		{/if}
	</Card>

	<!-- Summary Stats -->
	<Card>
		<div class="text-sm text-muted-foreground">
			<p>
				Showing {data.logs.length} of {data.pagination.total} total entries
				{#if data.filters.currentEntityType || data.filters.currentAction}
					(filtered)
				{/if}
			</p>
		</div>
	</Card>
</div>
