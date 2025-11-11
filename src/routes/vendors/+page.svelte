<script lang="ts">
	import type { PageData } from './$types';
	import type { Vendor } from '$types';
	import { goto } from '$app/navigation';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import DataTable from '$components/common/DataTable.svelte';
	import Pagination from '$components/common/Pagination.svelte';
	import InstantSearch from '$components/common/InstantSearch.svelte';
	import StatusBadge from '$components/common/StatusBadge.svelte';
	import PageHeader from '$components/common/PageHeader.svelte';
	import { useTableNavigation } from '$lib/utils/table-navigation.svelte';

	let { data }: { data: PageData } = $props();

	// Table navigation utilities
	const { handleSort, handlePageChange } = useTableNavigation();

	const columns = [
		{
			key: 'code',
			label: 'Code'
		},
		{
			key: 'name',
			label: 'Name'
		},
		{
			key: 'contact_email',
			label: 'Contact Email',
			render: (item: Vendor) => item.contact_email || '-'
		},
		{
			key: 'active',
			label: 'Status',
			render: (item: Vendor) => item.active ? 'Active' : 'Inactive'
		}
	];

	function handleRowClick(vendor: Vendor) {
		goto(`/vendors/${vendor.id}`);
	}

	// Sort handler with current sort state
	function handleSortClick(field: string) {
		handleSort(field, data.sort);
	}
</script>

<div class="space-y-6">
	<PageHeader
		title="Vendors"
		description="Track software vendors and their contact information"
	>
		{#snippet actions()}
			<Button onclick={() => goto('/vendors/new')}>Add Vendor</Button>
		{/snippet}
	</PageHeader>

	<Card class="p-6">
		<div class="mb-6">
			<InstantSearch
				placeholder="Search vendors by name or code..."
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
				resultCount={'items' in data.vendors ? {
					current: data.vendors.items.length,
					total: data.vendors.total
				} : null}
			/>
		</div>

		<DataTable
			data={'items' in data.vendors ? data.vendors.items : []}
			{columns}
			onRowClick={handleRowClick}
			onSort={handleSortClick}
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
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
						/>
					</svg>
					<h3 class="mt-2 text-sm font-semibold text-foreground">No vendors yet</h3>
					<p class="mt-1 text-sm text-muted-foreground">Get started by adding your first software vendor.</p>
					<div class="mt-6">
						<Button onclick={() => goto('/vendors/new')}>
							Add Vendor
						</Button>
					</div>
				</div>
			{/snippet}
		</DataTable>
		<Pagination
			currentPage={'page' in data.vendors ? data.vendors.page : 1}
			totalPages={'totalPages' in data.vendors ? data.vendors.totalPages : 1}
			onPageChange={handlePageChange}
		/>
	</Card>
</div>
