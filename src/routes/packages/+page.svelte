<script lang="ts">
	import type { PageData } from './$types';
	import type { Package } from '$types';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import DataTable from '$components/common/DataTable.svelte';
	import Pagination from '$components/common/Pagination.svelte';
	import StatusBadge from '$components/common/StatusBadge.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import { formatDate } from '$utils/date-format';

	let { data }: { data: PageData } = $props();

	const columns = [
		{
			key: 'code',
			label: 'Package Code',
			sortable: true
		},
		{
			key: 'name',
			label: 'Name',
			sortable: true
		},
		{
			key: 'version',
			label: 'Version',
			render: (item: Package) => item.version
		},
		{
			key: 'items',
			label: 'Software Count',
			render: (item: Package) => item.package_items?.length || 0
		},
		{
			key: 'releaseDate',
			label: 'Release Date',
			sortable: true,
			render: (item: Package) => formatDate(item.release_date)
		},
		{
			key: 'active',
			label: 'Status',
			sortable: true,
			render: (item: Package) => item.active ? 'Active' : 'Inactive'
		}
	];

	function handleRowClick(pkg: Package) {
		window.location.href = `/packages/${pkg.id}`;
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
			<h1 class="text-3xl font-bold tracking-tight">Software Packages</h1>
			<p class="text-muted-foreground mt-2">
				Manage software packages for coordinated deployments
			</p>
		</div>
		<Button onclick={() => window.location.href = '/packages/new'}>
			Create Package
		</Button>
	</div>

	<Card class="p-6">
		<DataTable
			data={'items' in data.packages ? data.packages.items : []}
			{columns}
			onRowClick={handleRowClick}
			onSort={handleSort}
			currentSort={data.sort}
		/>
		<Pagination
			currentPage={'page' in data.packages ? data.packages.page : 1}
			totalPages={'totalPages' in data.packages ? data.packages.totalPages : 1}
			onPageChange={handlePageChange}
		/>
	</Card>
</div>
