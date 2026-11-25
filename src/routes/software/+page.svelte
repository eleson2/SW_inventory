<script lang="ts">
	import type { PageData } from './$types';
	import type { Software } from '#lib/types/index.ts';
	import { goto } from '$app/navigation';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import DataTable from '#lib/components/common/DataTable.svelte';
	import Pagination from '#lib/components/common/Pagination.svelte';
	import InstantSearch from '#lib/components/common/InstantSearch.svelte';
	import StatusBadge from '#lib/components/common/StatusBadge.svelte';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import VersionDisplay from '#lib/components/domain/VersionDisplay.svelte';
	import { useTableNavigation } from '#lib/utils/table-navigation.svelte.ts';
	import { STATUS_FILTER } from '#lib/constants/filters.ts';
	import { UNCLASSIFIED } from '#lib/utils/software-category.ts';

	let { data }: { data: PageData } = $props();

	// Table navigation utilities
	const { handleSort: handleSortUtil, handlePageChange } = useTableNavigation();

	const vendorFilterOptions = $derived(data.vendors.map(v => ({
		value: v.id,
		label: v.name
	})));

	const categoryFilterOptions = $derived([
		...data.categories.map((c) => ({ value: c.id, label: c.name })),
		{ value: UNCLASSIFIED, label: 'Unclassified' }
	]);

	const columns = [
		{
			key: 'name',
			label: 'Software Name'
		},
		{
			key: 'vendor',
			label: 'Vendor',
			render: (item: Software) => item.vendors?.name || '-'
		},
		{
			key: 'category',
			label: 'Category',
			render: (item: Software & { category?: { name: string } | null }) => item.category?.name ?? 'Unclassified'
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
			render: (item: Software) => item.active ? 'Active' : 'Inactive'
		}
	];

	function handleRowClick(software: Software) {
		goto(`/software/${software.id}`);
	}

	// Sort handler with current sort state
	function handleSort(field: string) {
		handleSortUtil(field, data.sort);
	}
</script>

<div class="space-y-6">
	<PageHeader
		title="Software Products"
		description="Manage software products with versions and PTF levels"
	>
		{#snippet actions()}
			<span class="flex gap-2">
				<Button href="/software/categories" variant="outline">Categories</Button>
				<Button onclick={() => goto('/software/new')}>Add Software</Button>
			</span>
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
						name: 'category',
						label: 'Category',
						options: categoryFilterOptions
					},
					STATUS_FILTER
				]}
				resultCount={'items' in data.software ? {
					current: data.software.items.length,
					total: data.software.total
				} : null}
			/>
		</div>

		<DataTable
			data={'items' in data.software ? data.software.items : []}
			{columns}
			onRowClick={handleRowClick}
			onSort={handleSort}
			currentSort={data.sort}
			showFilters={true}
		/>
		<Pagination
			currentPage={'page' in data.software ? data.software.page : 1}
			totalPages={'totalPages' in data.software ? data.software.totalPages : 1}
			onPageChange={handlePageChange}
		/>
	</Card>
</div>
