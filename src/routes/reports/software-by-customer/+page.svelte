<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import Badge from '$components/ui/Badge.svelte';

	let { data }: { data: PageData } = $props();

	// Multi-select state for customers
	let selectedCustomers = $state<Set<string>>(new Set(data.selectedCustomerIds));
	let showCustomerDropdown = $state(false);

	function toggleCustomer(customerId: string) {
		const newSelected = new Set(selectedCustomers);
		if (newSelected.has(customerId)) {
			newSelected.delete(customerId);
		} else {
			newSelected.add(customerId);
		}
		selectedCustomers = newSelected;
	}

	function applyFilters() {
		const url = new URL(window.location.href);
		// Clear existing customer params
		url.searchParams.delete('customer');
		// Add selected customers
		selectedCustomers.forEach((id) => {
			url.searchParams.append('customer', id);
		});
		goto(url.toString());
	}

	function clearFilters() {
		selectedCustomers = new Set();
		const url = new URL(window.location.href);
		url.searchParams.delete('customer');
		goto(url.toString());
	}

	async function exportCSV() {
		const url = new URL(window.location.href);
		url.pathname = '/reports/software-by-customer';
		url.searchParams.set('_action', 'export');

		const response = await fetch(url.toString(), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		});

		if (response.ok) {
			const blob = await response.blob();
			const downloadUrl = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = downloadUrl;
			a.download = `software-by-customer-${new Date().toISOString().split('T')[0]}.csv`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(downloadUrl);
			document.body.removeChild(a);
		}
	}

	const selectedCustomerNames = $derived(
		data.customers
			.filter((c) => selectedCustomers.has(c.id))
			.map((c) => c.name)
	);

	const hasFilters = $derived(selectedCustomers.size > 0);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Software by Customer Report</h1>
			<p class="text-muted-foreground mt-2">
				View software installations across customer LPARs
			</p>
		</div>
		<Button onclick={exportCSV} variant="outline" disabled={data.reportData.length === 0}>
			<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
				/>
			</svg>
			Export CSV
		</Button>
	</div>

	<Card class="p-6">
		<div class="space-y-4">
			<!-- Filters -->
			<div class="flex flex-wrap gap-3 items-start">
				<!-- Customer Multi-Select -->
				<div class="relative min-w-[300px]">
					<button
						type="button"
						onclick={() => (showCustomerDropdown = !showCustomerDropdown)}
						class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<span class="text-muted-foreground">
							{selectedCustomers.size === 0
								? 'Select Customers...'
								: `${selectedCustomers.size} customer${selectedCustomers.size !== 1 ? 's' : ''} selected`}
						</span>
						<svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>

					{#if showCustomerDropdown}
						<div
							class="absolute z-10 mt-1 w-full rounded-md border border-input bg-background shadow-lg max-h-60 overflow-auto"
						>
							{#each data.customers as customer}
								<label
									class="flex items-center px-3 py-2 hover:bg-accent cursor-pointer"
								>
									<input
										type="checkbox"
										checked={selectedCustomers.has(customer.id)}
										onchange={() => toggleCustomer(customer.id)}
										class="mr-2"
									/>
									<span class="text-sm">{customer.name}</span>
								</label>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Apply Filters Button -->
				<Button onclick={applyFilters}>Apply Filters</Button>

				<!-- Clear Button -->
				{#if hasFilters}
					<Button onclick={clearFilters} variant="outline">Clear</Button>
				{/if}
			</div>

			<!-- Active Filters Display -->
			{#if selectedCustomerNames.length > 0}
				<div class="flex flex-wrap gap-2">
					<span class="text-sm text-muted-foreground">Filtered by:</span>
					{#each selectedCustomerNames as name}
						<Badge variant="secondary">{name}</Badge>
					{/each}
				</div>
			{/if}

			<!-- Results Count -->
			<div class="text-sm text-muted-foreground">
				{data.reportData.length} result{data.reportData.length !== 1 ? 's' : ''} found
			</div>
		</div>
	</Card>

	<!-- Report Data -->
	{#if data.reportData.length > 0}
		<Card class="overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="bg-muted/50 border-b">
						<tr>
							<th class="px-4 py-3 text-left text-sm font-medium">Customer</th>
							<th class="px-4 py-3 text-left text-sm font-medium">Software</th>
							<th class="px-4 py-3 text-left text-sm font-medium">Vendor</th>
							<th class="px-4 py-3 text-left text-sm font-medium">Version</th>
							<th class="px-4 py-3 text-left text-sm font-medium">PTF Level</th>
							<th class="px-4 py-3 text-left text-sm font-medium">LPAR Count</th>
							<th class="px-4 py-3 text-left text-sm font-medium">Release Date</th>
							<th class="px-4 py-3 text-left text-sm font-medium">Status</th>
						</tr>
					</thead>
					<tbody class="divide-y">
						{#each data.reportData as row}
							<tr class="hover:bg-muted/20 transition-colors">
								<td class="px-4 py-3 text-sm">
									<div class="font-medium">{row.customer_name}</div>
									<div class="text-muted-foreground text-xs">{row.customer_code}</div>
								</td>
								<td class="px-4 py-3 text-sm">
									<div class="font-medium">{row.software_name}</div>
								</td>
								<td class="px-4 py-3 text-sm">
									<div class="font-medium">{row.vendor_name}</div>
									<div class="text-muted-foreground text-xs">{row.vendor_code}</div>
								</td>
								<td class="px-4 py-3 text-sm font-mono">{row.version}</td>
								<td class="px-4 py-3 text-sm font-mono">
									{row.ptf_level || '-'}
								</td>
								<td class="px-4 py-3 text-sm text-center">
									<Badge variant="secondary">{row.lpar_count}</Badge>
								</td>
								<td class="px-4 py-3 text-sm">
									{row.release_date
										? new Date(row.release_date).toLocaleDateString()
										: '-'}
								</td>
								<td class="px-4 py-3 text-sm">
									{#if row.has_rollbacks}
										<Badge variant="destructive">Has Rollbacks</Badge>
									{:else}
										<Badge variant="default">Active</Badge>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Card>
	{:else}
		<Card class="p-12 text-center">
			<div class="text-muted-foreground">
				<svg
					class="w-12 h-12 mx-auto mb-4 text-muted-foreground/50"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
				<p class="text-lg font-medium">No data available</p>
				<p class="text-sm mt-2">
					{#if !hasFilters}
						No software installations found in the system.
					{:else}
						Try adjusting your filters to see more results.
					{/if}
				</p>
			</div>
		</Card>
	{/if}
</div>

<!-- Click outside handler to close dropdown -->
<svelte:window
	onclick={(e) => {
		const target = e.target as HTMLElement;
		if (!target.closest('.relative')) {
			showCustomerDropdown = false;
		}
	}}
/>
