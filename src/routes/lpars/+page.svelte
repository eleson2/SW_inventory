<script lang="ts">
	import type { PageData } from './$types';
	import type { Lpar } from '$types';
	import { goto } from '$app/navigation';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import DataTable from '$components/common/DataTable.svelte';
	import Pagination from '$components/common/Pagination.svelte';
	import InstantSearch from '$components/common/InstantSearch.svelte';
	import StatusBadge from '$components/common/StatusBadge.svelte';
	import PageHeader from '$components/common/PageHeader.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import { useTableNavigation } from '$lib/utils/table-navigation.svelte';
	import { STATUS_FILTER } from '$lib/constants/filters';

	let { data }: { data: PageData } = $props();

	// Table navigation utilities
	const { handleSort: handleSortUtil, handlePageChange } = useTableNavigation();

	const customerFilterOptions = data.customers.map(c => ({
		value: c.id,
		label: c.name
	}));

	const columns = [
		{
			key: 'code',
			label: 'LPAR Code'
		},
		{
			key: 'name',
			label: 'Name'
		},
		{
			key: 'customer',
			label: 'Customer',
			render: (item: Lpar) => item.customers?.name || '-'
		},
		{
			key: 'currentPackage',
			label: 'Package Level',
			render: (item: Lpar) => {
				if (item.packages) {
					return `${item.packages.code} (${item.packages.version})`;
				}
				return '-';
			}
		},
		{
			key: 'lpar_software',
			label: 'Software Count',
			render: (item: Lpar) => item.lpar_software?.length || 0
		},
		{
			key: 'active',
			label: 'Status',
			render: (item: Lpar) => item.active ? 'Active' : 'Inactive'
		}
	];

	function handleRowClick(lpar: Lpar) {
		goto(`/lpars/${lpar.id}`);
	}

	// Sort handler with current sort state
	function handleSort(field: string) {
		handleSortUtil(field, data.sort);
	}
</script>

<div class="space-y-6">
	<PageHeader
		title="LPARs"
		description="Monitor LPAR configurations and installed software"
	>
		{#snippet actions()}
			<Button onclick={() => goto('/lpars/new')}>Add LPAR</Button>
		{/snippet}
	</PageHeader>

	<Card class="p-6">
		<div class="mb-6">
			<InstantSearch
				placeholder="Search LPARs by name or code..."
				filters={[
					{
						name: 'customer',
						label: 'Customer',
						options: customerFilterOptions
					},
					STATUS_FILTER
				]}
				resultCount={'items' in data.lpars ? {
					current: data.lpars.items.length,
					total: data.lpars.total
				} : null}
			/>
		</div>

		<DataTable
			data={'items' in data.lpars ? data.lpars.items : []}
			{columns}
			onRowClick={handleRowClick}
			onSort={handleSort}
			currentSort={data.sort}
		/>
		<Pagination
			currentPage={'page' in data.lpars ? data.lpars.page : 1}
			totalPages={'totalPages' in data.lpars ? data.lpars.totalPages : 1}
			onPageChange={handlePageChange}
		/>
	</Card>
</div>
