<script lang="ts">
	import type { PageData } from './$types';
	import type { Software } from '$types';
	import { goto } from '$app/navigation';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import DataTable from '$components/common/DataTable.svelte';
	import Pagination from '$components/common/Pagination.svelte';
	import InstantSearch from '$components/common/InstantSearch.svelte';
	import StatusBadge from '$components/common/StatusBadge.svelte';
	import PageHeader from '$components/common/PageHeader.svelte';
	import VersionDisplay from '$components/domain/VersionDisplay.svelte';

	let { data }: { data: PageData } = $props();

	const vendorFilterOptions = data.vendors.map(v => ({
		value: v.id,
		label: v.name
	}));

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
	<PageHeader
		title="Software Products"
		description="Manage software products with versions and PTF levels"
	>
		{#snippet actions()}
			<Button onclick={() => goto('/software/new')}>Add Software</Button>
		{/snippet}
	</PageHeader>

	<Card class="p-6">
		<div class="mb-6">
			<InstantSearch
				placeholder="Search software by name..."
				filters={[
					{
						name: 'vendor',
						label: 'Vendor',
						options: vendorFilterOptions
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
				resultCount={'items' in data.software ? {
					current: data.software.items.length,
					total: data.software.totalCount
				} : null}
			/>
		</div>

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
