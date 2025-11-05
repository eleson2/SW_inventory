<script lang="ts">
	import type { PageData } from './$types';
	import type { Package } from '$types';
	import { goto } from '$app/navigation';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import DataTable from '$components/common/DataTable.svelte';
	import Pagination from '$components/common/Pagination.svelte';
	import InstantSearch from '$components/common/InstantSearch.svelte';
	import PageHeader from '$components/common/PageHeader.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import { formatDate } from '$utils/date-format';
	import { useTableNavigation } from '$lib/utils/table-navigation.svelte';

	let { data }: { data: PageData } = $props();

	// Table navigation utilities
	const { handleSort: handleSortUtil, handlePageChange } = useTableNavigation();

	const columns = [
		{
			key: 'code',
			label: 'Package Code',
			sortable: true
		},
		{
			key: 'name',
			label: 'Name',
			sortable: true
		},
		{
			key: 'version',
			label: 'Version'
		},
		{
			key: 'package_items',
			label: 'Software Count',
			render: (item: Package) => item.package_items?.length || 0
		},
		{
			key: 'release_date',
			label: 'Release Date',
			sortable: true,
			render: (item: Package) => formatDate(item.release_date)
		},
		{
			key: 'active',
			label: 'Status',
			sortable: true,
			render: (item: Package) => item.active ? 'Active' : 'Inactive'
		}
	];

	function handleRowClick(pkg: Package) {
		goto(`/packages/${pkg.id}`);
	}

	// Sort handler with current sort state
	function handleSort(field: string) {
		handleSortUtil(field, data.sort);
	}
</script>

<div class="space-y-6">
	<PageHeader
		title="Software Packages"
		description="Manage software packages for coordinated deployments"
	>
		{#snippet actions()}
			<Button onclick={() => goto('/packages/new')}>Create Package</Button>
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

		<DataTable
			data={'items' in data.packages ? data.packages.items : []}
			{columns}
			onRowClick={handleRowClick}
			onSort={handleSort}
			currentSort={data.sort}
		>
			{#snippet emptyState()}
				<div class="text-center">
					<svg
						class="mx-auto h-12 w-12 text-muted-foreground"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						aria-hidden="true"
					>
						<path
							vector-effect="non-scaling-stroke"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
						></path>
					</svg>
					<h3 class="mt-2 text-sm font-semibold">No packages found</h3>
					<p class="mt-1 text-sm text-muted-foreground">Get started by creating a new package.</p>
					<div class="mt-6">
						<Button onclick={() => goto('/packages/new')}>Create Package</Button>
					</div>
				</div>
			{/snippet}
		</DataTable>

		<div class="mt-4">
			<Pagination
				currentPage={'page' in data.packages ? data.packages.page : 1}
				totalPages={'totalPages' in data.packages ? data.packages.totalPages : 1}
				onPageChange={handlePageChange}
			/>
		</div>
	</Card>
</div>
