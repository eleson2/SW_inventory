<script lang="ts">
	import type { PageData } from './$types';
	import type { Software } from '$types';
	import { goto } from '$app/navigation';
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
			render: (item: Software) => item.vendors?.name || '-'
		},
		{
			key: 'currentVersion',
			label: 'Current Version',
			render: (item: Software & { current_version?: { version: string; ptf_level: string | null } }) => {
				if (item.current_version) {
					const version = item.current_version.version;
					const ptf = item.current_version.ptf_level;
					return ptf ? `${version} (${ptf})` : version;
				}
				return 'No version';
			}
		},
		{
			key: 'active',
			label: 'Status',
			sortable: true,
			render: (item: Software) => item.active ? 'Active' : 'Inactive'
		}
	];

	function handleRowClick(software: Software) {
		goto(`/software/${software.id}`);
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
			<h1 class="text-3xl font-bold tracking-tight">Software Products</h1>
			<p class="text-muted-foreground mt-2">
				Manage software products with versions and PTF levels
			</p>
		</div>
		<Button onclick={() => goto('/software/new')}>
			Add Software
		</Button>
	</div>

	<Card class="p-6">
		<DataTable
			data={'items' in data.software ? data.software.items : []}
			{columns}
			onRowClick={handleRowClick}
			onSort={handleSort}
			currentSort={data.sort}
		/>
		<Pagination
			currentPage={'page' in data.software ? data.software.page : 1}
			totalPages={'totalPages' in data.software ? data.software.totalPages : 1}
			onPageChange={handlePageChange}
		/>
	</Card>
</div>
