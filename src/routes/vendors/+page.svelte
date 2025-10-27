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

	let { data }: { data: PageData } = $props();

	const columns = [
		{
			key: 'code',
			label: 'Code',
			sortable: true
		},
		{
			key: 'name',
			label: 'Name',
			sortable: true
		},
		{
			key: 'contact_email',
			label: 'Contact Email',
			render: (item: Vendor) => item.contact_email || '-'
		},
		{
			key: 'active',
			label: 'Status',
			sortable: true,
			render: (item: Vendor) => item.active ? 'Active' : 'Inactive'
		}
	];

	function handleRowClick(vendor: Vendor) {
		goto(`/vendors/${vendor.id}`);
	}

	function handleSort(field: string) {
		const currentSort = data.sort;
		// Toggle direction if clicking same field, otherwise default to asc
		const direction = currentSort?.field === field && currentSort?.direction === 'asc' ? 'desc' : 'asc';

		// Build new URL with sort parameters
		const url = new URL(window.location.href);
		url.searchParams.set('sort', field);
		url.searchParams.set('direction', direction);
		url.searchParams.set('page', '1'); // Reset to first page when sorting

		goto(url.toString());
	}

	function handlePageChange(page: number) {
		const url = new URL(window.location.href);
		url.searchParams.set('page', page.toString());

		goto(url.toString());
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Vendors</h1>
			<p class="text-muted-foreground mt-2">
				Track software vendors and their contact information
			</p>
		</div>
		<Button onclick={() => goto('/vendors/new')}>
			Add Vendor
		</Button>
	</div>

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
					total: data.vendors.totalCount
				} : null}
			/>
		</div>

		<DataTable
			data={'items' in data.vendors ? data.vendors.items : []}
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
