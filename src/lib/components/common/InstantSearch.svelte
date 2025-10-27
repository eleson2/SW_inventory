<!--
	InstantSearch.svelte
	Instant search component with debounced filtering

	Features:
	- Search as you type with configurable debounce delay
	- Support for additional filter dropdowns
	- URL parameter syncing
	- Result count display
	- Clear all filters
	- Keyboard support
	- Maintains compatibility with SearchFilter API
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Button from '$components/ui/Button.svelte';
	import { cn } from '$utils/cn';

	interface Filter {
		name: string;
		label: string;
		options: { value: string; label: string }[];
	}

	let {
		placeholder = 'Search...',
		filters = [],
		searchParam = 'search',
		resultCount,
		debounceMs = 400
	}: {
		placeholder?: string;
		filters?: Filter[];
		searchParam?: string;
		resultCount?: { current: number; total: number } | null;
		debounceMs?: number;
	} = $props();

	// Initialize from URL on mount
	const initialUrlParams = $page.url.searchParams;
	let searchValue = $state(initialUrlParams.get(searchParam) || '');
	let filterValues = $state<Record<string, string>>(
		filters.reduce((acc, filter) => {
			acc[filter.name] = initialUrlParams.get(filter.name) || '';
			return acc;
		}, {} as Record<string, string>)
	);
	let searchInput: HTMLInputElement | undefined = $state();
	let debounceTimeout: ReturnType<typeof setTimeout> | null = $state(null);
	let shouldRefocus = $state(false);

	// Listen for browser back/forward navigation
	$effect(() => {
		if (typeof window !== 'undefined') {
			const handlePopState = () => {
				const urlParams = new URLSearchParams(window.location.search);
				searchValue = urlParams.get(searchParam) || '';
				filters.forEach((filter) => {
					filterValues[filter.name] = urlParams.get(filter.name) || '';
				});
			};

			window.addEventListener('popstate', handlePopState);
			return () => window.removeEventListener('popstate', handlePopState);
		}
	});

	function updateUrl() {
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

		// Mark that we should refocus after navigation
		shouldRefocus = true;

		// Navigate with options to preserve focus and avoid cluttering history
		goto(url.toString(), {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}

	function handleSearchInput() {
		// Clear existing timeout
		if (debounceTimeout) {
			clearTimeout(debounceTimeout);
		}

		// Set new timeout for debounced search
		debounceTimeout = setTimeout(() => {
			updateUrl();
		}, debounceMs);
	}

	function handleFilterChange() {
		// Filters update immediately without debounce
		updateUrl();
	}

	function handleClear() {
		searchValue = '';
		filterValues = {};
		const url = new URL(window.location.href);
		url.searchParams.delete(searchParam);
		filters.forEach((filter) => {
			url.searchParams.delete(filter.name);
		});
		url.searchParams.set('page', '1');
		goto(url.toString(), {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && searchValue) {
			e.preventDefault();
			searchValue = '';
			handleSearchInput();
			searchInput?.focus();
		}
	}

	const hasActiveFilters = $derived(
		searchValue.trim() !== '' || Object.values(filterValues).some((v) => v !== '')
	);

	// Refocus input after navigation if needed
	$effect(() => {
		if (shouldRefocus && searchInput) {
			// Use microtask to ensure DOM has updated
			queueMicrotask(() => {
				searchInput?.focus();
				// Restore cursor to end of input
				if (searchInput) {
					searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
				}
				shouldRefocus = false;
			});
		}
	});
</script>

<div class="space-y-4">
	<div class="flex flex-wrap gap-3">
		<!-- Search Input -->
		<div class="flex-1 min-w-[250px]">
			<div class="relative">
				<input
					bind:this={searchInput}
					bind:value={searchValue}
					{placeholder}
					oninput={handleSearchInput}
					onkeydown={handleKeydown}
					type="text"
					class={cn(
						'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground',
						'ring-offset-background',
						'placeholder:text-muted-foreground',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
						'pr-8'
					)}
				/>
				{#if searchValue}
					<button
						type="button"
						onclick={() => {
							searchValue = '';
							handleSearchInput();
							searchInput?.focus();
						}}
						class="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
						aria-label="Clear search"
						title="Clear search (Esc)"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				{/if}
			</div>
		</div>

		<!-- Filter Dropdowns -->
		{#each filters as filter}
			<div class="min-w-[150px]">
				<select
					bind:value={filterValues[filter.name]}
					onchange={handleFilterChange}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<option value="">{filter.label}</option>
					{#each filter.options as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>
		{/each}

		<!-- Clear Button -->
		{#if hasActiveFilters}
			<div>
				<Button onclick={handleClear} variant="outline" class="h-10">
					Clear
				</Button>
			</div>
		{/if}
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
