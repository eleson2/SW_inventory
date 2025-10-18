<!--
	SearchableSelect.svelte
	Searchable dropdown component with filter capability

	Features:
	- Type to search/filter items
	- Keyboard navigation (up/down arrows, enter to select, escape to close)
	- Click outside to close
	- Clear button
	- Accessibility support
-->
<script lang="ts">
	interface Item {
		[key: string]: any;
	}

	interface Props {
		items: Item[];
		displayField: string;
		valueField: string;
		secondaryField?: string;
		placeholder?: string;
		value?: string;
		onSelect: (value: string) => void;
		disabled?: boolean;
	}

	let {
		items,
		displayField,
		valueField,
		secondaryField,
		placeholder = 'Search...',
		value = $bindable(''),
		onSelect,
		disabled = false
	}: Props = $props();

	let searchTerm = $state('');
	let isOpen = $state(false);
	let highlightedIndex = $state(0);
	let inputElement = $state<HTMLInputElement>();
	let dropdownElement = $state<HTMLDivElement>();

	// Filter items based on search term
	const filteredItems = $derived(
		searchTerm.trim() === ''
			? items
			: items.filter((item) => {
					const displayValue = item[displayField]?.toLowerCase() || '';
					const secondaryValue = secondaryField ? item[secondaryField]?.toLowerCase() || '' : '';
					const search = searchTerm.toLowerCase();
					return displayValue.includes(search) || secondaryValue.includes(search);
			  })
	);

	// Get display text for selected value
	const selectedItem = $derived(items.find((item) => item[valueField] === value));
	const displayText = $derived(
		selectedItem
			? secondaryField
				? `${selectedItem[displayField]} (${selectedItem[secondaryField]})`
				: selectedItem[displayField]
			: ''
	);

	function handleInputClick() {
		if (disabled) return;
		isOpen = !isOpen;
		if (isOpen) {
			searchTerm = '';
			highlightedIndex = 0;
		}
	}

	function handleInputFocus() {
		if (disabled) return;
		isOpen = true;
		searchTerm = '';
		highlightedIndex = 0;
	}

	function selectItem(item: Item) {
		value = item[valueField];
		onSelect(item[valueField]);
		isOpen = false;
		searchTerm = '';
		inputElement?.blur();
	}

	function clearSelection() {
		value = '';
		onSelect('');
		searchTerm = '';
		isOpen = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (disabled) return;

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				if (!isOpen) {
					isOpen = true;
				} else {
					highlightedIndex = Math.min(highlightedIndex + 1, filteredItems.length - 1);
					scrollToHighlighted();
				}
				break;

			case 'ArrowUp':
				event.preventDefault();
				if (isOpen) {
					highlightedIndex = Math.max(highlightedIndex - 1, 0);
					scrollToHighlighted();
				}
				break;

			case 'Enter':
				event.preventDefault();
				if (isOpen && filteredItems.length > 0) {
					selectItem(filteredItems[highlightedIndex]);
				}
				break;

			case 'Escape':
				event.preventDefault();
				isOpen = false;
				searchTerm = '';
				inputElement?.blur();
				break;

			case 'Tab':
				isOpen = false;
				break;
		}
	}

	function scrollToHighlighted() {
		if (!dropdownElement) return;
		const highlightedElement = dropdownElement.querySelector(`[data-index="${highlightedIndex}"]`);
		if (highlightedElement) {
			highlightedElement.scrollIntoView({ block: 'nearest' });
		}
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as Node;
		if (
			inputElement &&
			!inputElement.contains(target) &&
			dropdownElement &&
			!dropdownElement.contains(target)
		) {
			isOpen = false;
			searchTerm = '';
		}
	}

	$effect(() => {
		if (typeof window !== 'undefined') {
			document.addEventListener('click', handleClickOutside);
			return () => {
				document.removeEventListener('click', handleClickOutside);
			};
		}
	});
</script>

<div class="relative w-full">
	<div class="relative">
		<input
			bind:this={inputElement}
			type="text"
			value={isOpen ? searchTerm : displayText}
			oninput={(e) => {
				searchTerm = e.currentTarget.value;
				highlightedIndex = 0;
			}}
			onclick={handleInputClick}
			onfocus={handleInputFocus}
			onkeydown={handleKeydown}
			{placeholder}
			{disabled}
			class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-20"
			role="combobox"
			aria-expanded={isOpen}
			aria-haspopup="listbox"
			aria-controls="searchable-dropdown"
		/>

		<div class="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
			{#if value && !disabled}
				<button
					type="button"
					onclick={(e) => {
						e.stopPropagation();
						clearSelection();
					}}
					class="p-1 hover:bg-accent rounded"
					aria-label="Clear selection"
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

			<button
				type="button"
				onclick={(e) => {
					e.stopPropagation();
					handleInputClick();
				}}
				class="p-1 hover:bg-accent rounded"
				aria-label="Toggle dropdown"
				{disabled}
			>
				<svg
					class="w-4 h-4 transition-transform {isOpen ? 'rotate-180' : ''}"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</button>
		</div>
	</div>

	{#if isOpen}
		<div
			bind:this={dropdownElement}
			id="searchable-dropdown"
			class="absolute z-50 w-full mt-1 bg-background border border-input rounded-md shadow-lg max-h-60 overflow-auto"
			role="listbox"
		>
			{#if filteredItems.length === 0}
				<div class="px-3 py-2 text-sm text-muted-foreground text-center">No items found</div>
			{:else}
				{#each filteredItems as item, index}
					<button
						type="button"
						data-index={index}
						onclick={() => selectItem(item)}
						onmouseenter={() => (highlightedIndex = index)}
						class="w-full px-3 py-2 text-left hover:bg-accent cursor-pointer {highlightedIndex ===
						index
							? 'bg-accent'
							: ''}"
						role="option"
						aria-selected={value === item[valueField]}
					>
						<div class="flex items-center justify-between gap-2">
							<div class="flex-1 min-w-0">
								<div class="text-sm font-medium truncate">{item[displayField]}</div>
								{#if secondaryField && item[secondaryField]}
									<div class="text-xs text-muted-foreground truncate">
										{item[secondaryField]}
									</div>
								{/if}
							</div>
							{#if value === item[valueField]}
								<svg class="w-4 h-4 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
									<path
										fill-rule="evenodd"
										d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
										clip-rule="evenodd"
									/>
								</svg>
							{/if}
						</div>
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>
