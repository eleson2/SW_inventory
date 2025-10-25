<script lang="ts">
	import type { PageData } from './$types';
	import type { Lpar } from '$types';
	import { goto } from '$app/navigation';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import DataTable from '$components/common/DataTable.svelte';
	import Pagination from '$components/common/Pagination.svelte';
	import SearchFilter from '$components/common/SearchFilter.svelte';
	import StatusBadge from '$components/common/StatusBadge.svelte';
	import Badge from '$components/ui/Badge.svelte';

	let { data }: { data: PageData } = $props();

	const customerFilterOptions = data.customers.map(c => ({
		value: c.id,
		label: c.name
	}));

	const columns = [
		{
			key: 'code',
			label: 'LPAR Code',
			sortable: true
		},
		{
			key: 'name',
			label: 'Name',
			sortable: true
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
			sortable: true,
			render: (item: Lpar) => item.active ? 'Active' : 'Inactive'
		}
	];

	function handleRowClick(lpar: Lpar) {
		goto(`/lpars/${lpar.id}`);
	}

	function handleSort(field: string) {
		const currentSort = data.sort;
		const direction = currentSort?.field === field && currentSort?.direction === 'asc' ? 'desc' : 'asc';

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
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">LPARs</h1>
			<p class="text-muted-foreground mt-2">
				Monitor LPAR configurations and installed software
			</p>
		</div>
		<Button onclick={() => goto('/lpars/new')}>
			Add LPAR
		</Button>
	</div>

	<Card class="p-6">
		<div class="mb-6">
			<SearchFilter
				placeholder="Search LPARs by name or code..."
				filters={[
					{
						name: 'customer',
						label: 'Customer',
						options: customerFilterOptions
					},
					{
						name: 'status',
						label: 'Status',
						options: [
							{ value: 'active', label: 'Active' },
							{ value: 'inactive', label: 'Inactive' }
						]
					}
				]}
				resultCount={'items' in data.lpars ? {
					current: data.lpars.items.length,
					total: data.lpars.totalCount
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
