<script lang="ts">
	import type { PageData } from './$types';
	import type { Package } from '$types';
	import { goto } from '$app/navigation';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import Pagination from '$components/common/Pagination.svelte';
	import InstantSearch from '$components/common/InstantSearch.svelte';
	import PageHeader from '$components/common/PageHeader.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import { formatDate } from '$utils/date-format';
	import { cn } from '$utils/cn';

	let { data }: { data: PageData } = $props();

	const packages = $derived('items' in data.packages ? data.packages.items : []);

	function handleSort(field: string) {
		const currentSort = data.sort;
		const direction =
			currentSort?.field === field && currentSort?.direction === 'asc' ? 'desc' : 'asc';

		const url = new URL(window.location.href);
		url.searchParams.set('sort', field);
		url.searchParams.set('direction', direction);
		url.searchParams.set('page', '1');

		goto(url.toString());
	}

	function handlePageChange(page: number) {
		const url = new URL(window.location.href);
		url.searchParams.set('page', page.toString());

		goto(url.toString());
	}
</script>

<div class="space-y-6">
	<PageHeader
		title="Software Packages"
		description="Manage software packages for coordinated deployments"
	>
		{#snippet actions()}
			<a href="/packages/new" data-sveltekit-reload class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
				Create Package
			</a>
		{/snippet}
	</PageHeader>

	<Card class="p-6">
		<div class="mb-6">
			<InstantSearch
				placeholder="Search packages by name or code..."
				filters={[
					{
						name: 'status',
						label: 'Status',
						options: [
							{ value: 'active', label: 'Active' },
							{ value: 'inactive', label: 'Inactive' }
						]
					}
				]}
				resultCount={'items' in data.packages ? {
					current: data.packages.items.length,
					total: data.packages.totalCount
				} : null}
			/>
		</div>

		<div class="rounded-md border">
			<table class="w-full">
				<thead>
					<tr class="border-b bg-muted/50">
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground {data.sort?.field === 'code' ? 'bg-accent/50' : ''}">
							<button
								class="flex items-center gap-2 hover:text-foreground transition-colors {data.sort?.field === 'code' ? 'text-foreground font-bold' : ''}"
								onclick={() => handleSort('code')}
								title={data.sort?.field === 'code'
									? `Sorted ${data.sort.direction === 'asc' ? 'ascending' : 'descending'}. Click to ${data.sort.direction === 'asc' ? 'sort descending' : 'sort ascending'}`
									: 'Click to sort'}
							>
								Package Code
								{#if data.sort?.field === 'code'}
									<span class="text-base font-bold">
										{data.sort.direction === 'asc' ? '▲' : '▼'}
									</span>
								{/if}
							</button>
						</th>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground {data.sort?.field === 'name' ? 'bg-accent/50' : ''}">
							<button
								class="flex items-center gap-2 hover:text-foreground transition-colors {data.sort?.field === 'name' ? 'text-foreground font-bold' : ''}"
								onclick={() => handleSort('name')}
								title={data.sort?.field === 'name'
									? `Sorted ${data.sort.direction === 'asc' ? 'ascending' : 'descending'}. Click to ${data.sort.direction === 'asc' ? 'sort descending' : 'sort ascending'}`
									: 'Click to sort'}
							>
								Name
								{#if data.sort?.field === 'name'}
									<span class="text-base font-bold">
										{data.sort.direction === 'asc' ? '▲' : '▼'}
									</span>
								{/if}
							</button>
						</th>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
							Version
						</th>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
							Software Count
						</th>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground {data.sort?.field === 'releaseDate' ? 'bg-accent/50' : ''}">
							<button
								class="flex items-center gap-2 hover:text-foreground transition-colors {data.sort?.field === 'releaseDate' ? 'text-foreground font-bold' : ''}"
								onclick={() => handleSort('releaseDate')}
								title={data.sort?.field === 'releaseDate'
									? `Sorted ${data.sort.direction === 'asc' ? 'ascending' : 'descending'}. Click to ${data.sort.direction === 'asc' ? 'sort descending' : 'sort ascending'}`
									: 'Click to sort'}
							>
								Release Date
								{#if data.sort?.field === 'releaseDate'}
									<span class="text-base font-bold">
										{data.sort.direction === 'asc' ? '▲' : '▼'}
									</span>
								{/if}
							</button>
						</th>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground {data.sort?.field === 'active' ? 'bg-accent/50' : ''}">
							<button
								class="flex items-center gap-2 hover:text-foreground transition-colors {data.sort?.field === 'active' ? 'text-foreground font-bold' : ''}"
								onclick={() => handleSort('active')}
								title={data.sort?.field === 'active'
									? `Sorted ${data.sort.direction === 'asc' ? 'ascending' : 'descending'}. Click to ${data.sort.direction === 'asc' ? 'sort descending' : 'sort ascending'}`
									: 'Click to sort'}
							>
								Status
								{#if data.sort?.field === 'active'}
									<span class="text-base font-bold">
										{data.sort.direction === 'asc' ? '▲' : '▼'}
									</span>
								{/if}
							</button>
						</th>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
							Actions
						</th>
					</tr>
				</thead>
				<tbody>
					{#if packages.length === 0}
						<tr>
							<td colspan="7" class="h-32 text-center">
								<p class="text-muted-foreground">No packages found</p>
							</td>
						</tr>
					{:else}
						{#each packages as pkg, index}
							<tr
								class={cn(
									'border-b transition-colors',
									index % 2 === 0 ? 'bg-background' : 'bg-muted/20',
									'hover:bg-accent/50'
								)}
							>
								<td
									class="p-4 align-middle cursor-pointer"
									onclick={() => goto(`/packages/${pkg.id}`)}
								>
									{pkg.code}
								</td>
								<td
									class="p-4 align-middle cursor-pointer"
									onclick={() => goto(`/packages/${pkg.id}`)}
								>
									{pkg.name}
								</td>
								<td
									class="p-4 align-middle cursor-pointer"
									onclick={() => goto(`/packages/${pkg.id}`)}
								>
									{pkg.version}
								</td>
								<td
									class="p-4 align-middle cursor-pointer"
									onclick={() => goto(`/packages/${pkg.id}`)}
								>
									{pkg.package_items?.length || 0}
								</td>
								<td
									class="p-4 align-middle cursor-pointer"
									onclick={() => goto(`/packages/${pkg.id}`)}
								>
									{formatDate(pkg.release_date)}
								</td>
								<td
									class="p-4 align-middle cursor-pointer"
									onclick={() => goto(`/packages/${pkg.id}`)}
								>
									<Badge variant={pkg.active ? 'default' : 'secondary'}>
										{pkg.active ? 'Active' : 'Inactive'}
									</Badge>
								</td>
								<td class="p-4 align-middle">
									<div class="flex gap-2">
										<Button
											variant="outline"
											size="sm"
											onclick={(e) => {
												e.stopPropagation();
												goto(`/packages/${pkg.id}/deploy`);
											}}
										>
											Deploy
										</Button>
									</div>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>

		<div class="mt-4">
			<Pagination
				currentPage={'page' in data.packages ? data.packages.page : 1}
				totalPages={'totalPages' in data.packages ? data.packages.totalPages : 1}
				onPageChange={handlePageChange}
			/>
		</div>
	</Card>
</div>
