<script lang="ts">
	import type { PageData } from './$types';
	import type { Customer } from '$types';
	import { goto } from '$app/navigation';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import DataTable from '$components/common/DataTable.svelte';
	import Pagination from '$components/common/Pagination.svelte';
	import InstantSearch from '$components/common/InstantSearch.svelte';
	import StatusBadge from '$components/common/StatusBadge.svelte';
	import PageHeader from '$components/common/PageHeader.svelte';
	import { formatDate } from '$utils/date-format';
	import { useTableNavigation } from '$lib/utils/table-navigation.svelte';

	let { data }: { data: PageData } = $props();

	// Table navigation utilities
	const { handleSort: handleSortUtil, handlePageChange } = useTableNavigation();

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
		goto(`/customers/${customer.id}`);
	}

	// Sort handler with current sort state
	function handleSort(field: string) {
		handleSortUtil(field, data.sort);
	}
</script>

<div class="space-y-6">
	<PageHeader
		title="Customers"
		description="Manage customer information in multi-tenant environment"
	>
		{#snippet actions()}
			<Button onclick={() => goto('/customers/new')}>Add Customer</Button>
		{/snippet}
	</PageHeader>

	<Card class="p-6">
		<div class="mb-6">
			<InstantSearch
				placeholder="Search customers by name or code..."
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
				resultCount={'items' in data.customers ? {
					current: data.customers.items.length,
					total: data.customers.totalCount
				} : null}
			/>
		</div>

		<DataTable
			data={'items' in data.customers ? data.customers.items : []}
			{columns}
			onRowClick={handleRowClick}
			onSort={handleSort}
			currentSort={data.sort}
		/>
		<Pagination
			currentPage={'page' in data.customers ? data.customers.page : 1}
			totalPages={'totalPages' in data.customers ? data.customers.totalPages : 1}
			onPageChange={handlePageChange}
		/>
	</Card>
</div>
