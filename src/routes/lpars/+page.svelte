<script lang="ts">
	import type { PageData } from './$types';
	import type { Lpar } from '$types';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import DataTable from '$components/common/DataTable.svelte';
	import Pagination from '$components/common/Pagination.svelte';
	import StatusBadge from '$components/common/StatusBadge.svelte';
	import Badge from '$components/ui/Badge.svelte';

	let { data }: { data: PageData } = $props();

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
			render: (item: Lpar) => item.customer?.name || '-'
		},
		{
			key: 'currentPackage',
			label: 'Package Level',
			render: (item: Lpar) => {
				if (item.currentPackage) {
					return Badge({
						variant: 'default',
						children: () => `${item.currentPackage.code} (${item.currentPackage.version})`
					});
				}
				return '-';
			}
		},
		{
			key: 'softwareInstalled',
			label: 'Software Count',
			render: (item: Lpar) => item.softwareInstalled.length
		},
		{
			key: 'active',
			label: 'Status',
			sortable: true,
			render: (item: Lpar) => {
				return StatusBadge({ active: item.active });
			}
		}
	];

	function handleRowClick(lpar: Lpar) {
		window.location.href = `/lpars/${lpar.id}`;
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
			<h1 class="text-3xl font-bold tracking-tight">LPARs</h1>
			<p class="text-muted-foreground mt-2">
				Monitor LPAR configurations and installed software
			</p>
		</div>
		<Button onclick={() => window.location.href = '/lpars/new'}>
			Add LPAR
		</Button>
	</div>

	<Card class="p-6">
		<DataTable
			data={data.lpars.items}
			{columns}
			onRowClick={handleRowClick}
			onSort={handleSort}
			currentSort={data.sort}
		/>
		<Pagination
			currentPage={data.lpars.page}
			totalPages={data.lpars.totalPages}
			onPageChange={handlePageChange}
		/>
	</Card>
</div>
