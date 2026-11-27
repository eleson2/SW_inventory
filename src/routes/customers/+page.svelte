<script lang="ts">
	import type { PageData } from './$types';
	import type { Customer } from '#lib/types/index.ts';
	import { goto } from '$app/navigation';
	import { can, canAnywhere } from '#lib/utils/permissions.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import DataTable from '#lib/components/common/DataTable.svelte';
	import Pagination from '#lib/components/common/Pagination.svelte';
	import InstantSearch from '#lib/components/common/InstantSearch.svelte';
	import StatusBadge from '#lib/components/common/StatusBadge.svelte';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import { formatDate } from '#lib/utils/date-format.ts';
	import { useTableNavigation } from '#lib/utils/table-navigation.svelte.ts';
	import { STATUS_FILTER } from '#lib/constants/filters.ts';

	let { data }: { data: PageData } = $props();

	// Table navigation utilities
	const { handleSort: handleSortUtil, handlePageChange } = useTableNavigation();

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
			key: 'description',
			label: 'Description',
			render: (item: Customer) => item.description || '-'
		},
		{
			key: 'active',
			label: 'Status',
			render: (item: Customer) => item.active ? 'Active' : 'Inactive'
		},
		{
			key: 'created_at',
			label: 'Created',
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
			{#if can(data.user, 'manage_customers')}
				<Button onclick={() => goto('/customers/new')}>Add Customer</Button>
			{/if}
		{/snippet}
	</PageHeader>

	<Card class="p-6">
		<div class="mb-6">
			<InstantSearch
				placeholder="Search customers by name or code..."
				filters={[STATUS_FILTER]}
				resultCount={'items' in data.customers ? {
					current: data.customers.items.length,
					total: data.customers.total
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
