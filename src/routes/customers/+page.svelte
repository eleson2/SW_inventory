<script lang="ts">
	import type { PageData } from './$types';
	import type { Customer } from '$types';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import DataTable from '$components/common/DataTable.svelte';
	import Pagination from '$components/common/Pagination.svelte';
	import StatusBadge from '$components/common/StatusBadge.svelte';
	import { formatDate } from '$utils/date-format';

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
			key: 'description',
			label: 'Description',
			render: (item: Customer) => item.description || '-'
		},
		{
			key: 'active',
			label: 'Status',
			sortable: true,
			render: (item: Customer) => item.active ? 'Active' : 'Inactive'
		},
		{
			key: 'created_at',
			label: 'Created',
			sortable: true,
			render: (item: Customer) => formatDate(item.created_at)
		}
	];

	function handleRowClick(customer: Customer) {
		window.location.href = `/customers/${customer.id}`;
	}

	function handleSort(field: string) {
		// TODO: Implement sorting
		console.log('Sort by:', field);
	}

	function handlePageChange(page: number) {
		// TODO: Implement pagination
		console.log('Go to page:', page);
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Customers</h1>
			<p class="text-muted-foreground mt-2">
				Manage customer information in multi-tenant environment
			</p>
		</div>
		<Button onclick={() => window.location.href = '/customers/new'}>
			Add Customer
		</Button>
	</div>

	<Card class="p-6">
		<DataTable
			data={data.customers.items}
			{columns}
			onRowClick={handleRowClick}
			onSort={handleSort}
			currentSort={data.sort}
		/>
		<Pagination
			currentPage={data.customers.page}
			totalPages={data.customers.totalPages}
			onPageChange={handlePageChange}
		/>
	</Card>
</div>
