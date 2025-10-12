<script lang="ts">
	import type { PageData } from './$types';
	import type { Software } from '$types';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import DataTable from '$components/common/DataTable.svelte';
	import Pagination from '$components/common/Pagination.svelte';
	import StatusBadge from '$components/common/StatusBadge.svelte';
	import VersionDisplay from '$components/domain/VersionDisplay.svelte';

	let { data }: { data: PageData } = $props();

	const columns = [
		{
			key: 'name',
			label: 'Software Name',
			sortable: true
		},
		{
			key: 'vendor',
			label: 'Vendor',
			render: (item: Software) => item.vendor?.name || '-'
		},
		{
			key: 'currentVersion',
			label: 'Current Version',
			render: (item: Software) => {
				return VersionDisplay({ version: item.currentVersion, showBadge: true });
			}
		},
		{
			key: 'active',
			label: 'Status',
			sortable: true,
			render: (item: Software) => {
				return StatusBadge({ active: item.active });
			}
		}
	];

	function handleRowClick(software: Software) {
		window.location.href = `/software/${software.id}`;
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
			<h1 class="text-3xl font-bold tracking-tight">Software Products</h1>
			<p class="text-muted-foreground mt-2">
				Manage software products with versions and PTF levels
			</p>
		</div>
		<Button onclick={() => window.location.href = '/software/new'}>
			Add Software
		</Button>
	</div>

	<Card class="p-6">
		<DataTable
			data={data.software.items}
			{columns}
			onRowClick={handleRowClick}
			onSort={handleSort}
			currentSort={data.sort}
		/>
		<Pagination
			currentPage={data.software.page}
			totalPages={data.software.totalPages}
			onPageChange={handlePageChange}
		/>
	</Card>
</div>
