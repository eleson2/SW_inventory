<script lang="ts">
	import type { PageData } from './$types';
	import type { BundleListRow } from './+page.server.ts';
	import { goto } from '$app/navigation';
	import { can, canAnywhere } from '#lib/utils/permissions.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import DataTable from '#lib/components/common/DataTable.svelte';
	import Pagination from '#lib/components/common/Pagination.svelte';
	import InstantSearch from '#lib/components/common/InstantSearch.svelte';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import { useTableNavigation } from '#lib/utils/table-navigation.svelte.ts';
	import { STATUS_FILTER } from '#lib/constants/filters.ts';
	import { BUNDLE_TYPES } from '#lib/schemas/bundle.ts';
	import { formatDate } from '#lib/utils/date-format.ts';

	let { data }: { data: PageData } = $props();

	type BundleRow = BundleListRow;

	const { handleSort, handlePageChange } = useTableNavigation();

	const columns = [
		{ key: 'code', label: 'Code' },
		{ key: 'name', label: 'Name' },
		{ key: 'vendor', label: 'Vendor', sortable: false, render: (item: BundleRow) => item.vendors?.name ?? '-' },
		{ key: 'bundle_type', label: 'Type' },
		{ key: 'release_date', label: 'Released', render: (item: BundleRow) => formatDate(item.release_date) },
		{ key: 'items', label: 'Items', sortable: false, render: (item: BundleRow) => String(item._count.items) },
		{ key: 'active', label: 'Status', render: (item: BundleRow) => (item.active ? 'Active' : 'Inactive') }
	];

	const bundles = $derived(data.bundles.items);
</script>

<div class="space-y-6">
	<PageHeader
		title="Vendor Bundles"
		description="Vendor maintenance levels (Broadcom CARS, IBM RSU, ...) used to build packages"
	>
		{#snippet actions()}
			<Button variant="outline" onclick={() => goto('/import')}>Import CSV</Button>
			{#if canAnywhere(data.user, 'edit_bundle')}
				<Button onclick={() => goto('/bundles/new')}>Add Bundle</Button>
			{/if}
		{/snippet}
	</PageHeader>

	<Card class="p-6">
		<div class="mb-6">
			<InstantSearch
				placeholder="Search bundles by code, name or vendor..."
				filters={[
					{ name: 'vendor', label: 'Vendor', options: data.vendors.map((v) => ({ value: v.id, label: v.name })) },
					{ name: 'type', label: 'Type', options: BUNDLE_TYPES.map((t) => ({ value: t, label: t })) },
					STATUS_FILTER
				]}
				resultCount={{ current: data.bundles.items.length, total: data.bundles.total }}
			/>
		</div>

		<DataTable
			data={bundles}
			{columns}
			onRowClick={(bundle: BundleRow) => goto(`/bundles/${bundle.id}`)}
			onSort={(field: string) => handleSort(field, data.sort)}
			currentSort={data.sort}
		>
			{#snippet emptyState()}
				<div class="text-center">
					<h3 class="mt-2 text-sm font-semibold text-foreground">No vendor bundles yet</h3>
					<p class="mt-1 text-sm text-muted-foreground">
						Add a bundle such as CARS2511 or RSU2511, or import one from a CSV file.
					</p>
					<div class="mt-6 flex justify-center gap-2">
						<Button variant="outline" onclick={() => goto('/import')}>Import CSV</Button>
						{#if canAnywhere(data.user, 'edit_bundle')}
							<Button onclick={() => goto('/bundles/new')}>Add Bundle</Button>
						{/if}
					</div>
				</div>
			{/snippet}
		</DataTable>
		<Pagination
			currentPage={data.bundles.page}
			totalPages={data.bundles.totalPages}
			onPageChange={handlePageChange}
		/>
	</Card>
</div>
