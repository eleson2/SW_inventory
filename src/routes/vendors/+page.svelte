<script lang="ts">
	import type { PageData } from './$types';
	import type { Vendor } from '$types';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import DataTable from '$components/common/DataTable.svelte';
	import Pagination from '$components/common/Pagination.svelte';
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
			key: 'contactEmail',
			label: 'Contact Email',
			render: (item: Vendor) => item.contactEmail || '-'
		},
		{
			key: 'active',
			label: 'Status',
			sortable: true,
			render: (item: Vendor) => {
				return StatusBadge({ active: item.active });
			}
		}
	];

	function handleRowClick(vendor: Vendor) {
		window.location.href = `/vendors/${vendor.id}`;
	}

	function handleSort(field: string) {
		console.log('Sort by:', field);
	}

	function handlePageChange(page: number) {
		console.log('Go to page:', page);
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
		<Button onclick={() => window.location.href = '/vendors/new'}>
			Add Vendor
		</Button>
	</div>

	<Card class="p-6">
		<DataTable
			data={data.vendors.items}
			{columns}
			onRowClick={handleRowClick}
			onSort={handleSort}
			currentSort={data.sort}
		/>
		<Pagination
			currentPage={data.vendors.page}
			totalPages={data.vendors.totalPages}
			onPageChange={handlePageChange}
		/>
	</Card>
</div>
