<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Input from '$components/ui/Input.svelte';
	import Button from '$components/ui/Button.svelte';
	import { onMount } from 'svelte';

	interface Filter {
		name: string;
		label: string;
		options: { value: string; label: string }[];
	}

	let {
		placeholder = 'Search...',
		filters = [],
		searchParam = 'search',
		resultCount
	}: {
		placeholder?: string;
		filters?: Filter[];
		searchParam?: string;
		resultCount?: { current: number; total: number } | null;
	} = $props();

	let searchValue = $state('');
	let filterValues = $state<Record<string, string>>({});
	let searchInput: HTMLInputElement | undefined = $state();

	// Initialize from URL params
	onMount(() => {
		const urlParams = new URLSearchParams(window.location.search);
		searchValue = urlParams.get(searchParam) || '';
		filters.forEach(filter => {
			filterValues[filter.name] = urlParams.get(filter.name) || '';
		});
	});

	function handleSearch() {
		const url = new URL(window.location.href);

		// Update search parameter
		if (searchValue.trim()) {
			url.searchParams.set(searchParam, searchValue.trim());
		} else {
			url.searchParams.delete(searchParam);
		}

		// Update filter parameters
		Object.entries(filterValues).forEach(([key, value]) => {
			if (value) {
				url.searchParams.set(key, value);
			} else {
				url.searchParams.delete(key);
			}
		});

		// Reset to first page
		url.searchParams.set('page', '1');

		goto(url.toString());
	}

	function handleClear() {
		searchValue = '';
		filterValues = {};
		const url = new URL(window.location.href);
		url.searchParams.delete(searchParam);
		filters.forEach(filter => {
			url.searchParams.delete(filter.name);
		});
		url.searchParams.set('page', '1');
		goto(url.toString());
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handleSearch();
		}
	}

	const hasActiveFilters = $derived(
		searchValue.trim() !== '' || Object.values(filterValues).some(v => v !== '')
	);
</script>

<div class="space-y-4">
	<div class="flex flex-wrap gap-3">
		<!-- Search Input -->
		<div class="flex-1 min-w-[250px]">
			<Input
				bind:this={searchInput}
				bind:value={searchValue}
				{placeholder}
				onkeydown={handleKeydown}
				class="w-full"
			/>
		</div>

		<!-- Filter Dropdowns -->
		{#each filters as filter}
			<div class="min-w-[150px]">
				<select
					bind:value={filterValues[filter.name]}
					onchange={handleSearch}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<option value="">{filter.label}</option>
					{#each filter.options as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>
		{/each}

		<!-- Action Buttons -->
		<div class="flex gap-2">
			<Button onclick={handleSearch} variant="default">
				Search
			</Button>
			{#if hasActiveFilters}
				<Button onclick={handleClear} variant="outline">
					Clear
				</Button>
			{/if}
		</div>
	</div>

	<!-- Results Count -->
	{#if resultCount}
		<div class="text-sm text-muted-foreground">
			{#if resultCount.current < resultCount.total}
				Showing {resultCount.current} of {resultCount.total} results
			{:else}
				{resultCount.total} result{resultCount.total !== 1 ? 's' : ''} found
			{/if}
		</div>
	{/if}
</div>
