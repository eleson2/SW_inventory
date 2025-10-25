<script lang="ts" generics="T extends { id: string }">
	import Button from '$components/ui/Button.svelte';

	interface Props {
		available: T[];
		selected: T[];
		getLabel: (item: T) => string;
		getSubLabel?: (item: T) => string;
		getStatusIcon?: (item: T) => string;
		getStatusColor?: (item: T) => string;
		groupBy?: (item: T) => string;
		availableTitle?: string;
		selectedTitle?: string;
	}

	let {
		available = $bindable([]),
		selected = $bindable([]),
		getLabel,
		getSubLabel,
		getStatusIcon,
		getStatusColor,
		groupBy,
		availableTitle = 'Available Items',
		selectedTitle = 'Selected Items'
	}: Props = $props();

	let searchAvailable = $state('');
	let searchSelected = $state('');
	let selectedAvailable = $state<Set<string>>(new Set());
	let selectedFromSelected = $state<Set<string>>(new Set());

	// Filter available items by search
	const filteredAvailable = $derived(
		available.filter((item) => {
			const label = getLabel(item).toLowerCase();
			const subLabel = getSubLabel?.(item)?.toLowerCase() || '';
			const search = searchAvailable.toLowerCase();
			return label.includes(search) || subLabel.includes(search);
		})
	);

	// Filter selected items by search
	const filteredSelected = $derived(
		selected.filter((item) => {
			const label = getLabel(item).toLowerCase();
			const subLabel = getSubLabel?.(item)?.toLowerCase() || '';
			const search = searchSelected.toLowerCase();
			return label.includes(search) || subLabel.includes(search);
		})
	);

	// Group available items if groupBy function provided
	const groupedAvailable = $derived(() => {
		if (!groupBy) return null;

		const groups = new Map<string, T[]>();
		filteredAvailable.forEach((item) => {
			const group = groupBy(item);
			if (!groups.has(group)) {
				groups.set(group, []);
			}
			groups.get(group)!.push(item);
		});
		return groups;
	});

	function moveToSelected() {
		const toMove = available.filter((item) => selectedAvailable.has(item.id));
		available = available.filter((item) => !selectedAvailable.has(item.id));
		selected = [...selected, ...toMove];
		selectedAvailable.clear();
	}

	function moveToAvailable() {
		const toMove = selected.filter((item) => selectedFromSelected.has(item.id));
		selected = selected.filter((item) => !selectedFromSelected.has(item.id));
		available = [...available, ...toMove];
		selectedFromSelected.clear();
	}

	function selectAll() {
		selectedAvailable = new Set(filteredAvailable.map((item) => item.id));
	}

	function clearAvailable() {
		selectedAvailable.clear();
	}

	function clearSelected() {
		selectedFromSelected.clear();
	}

	function toggleAvailableItem(id: string) {
		if (selectedAvailable.has(id)) {
			selectedAvailable.delete(id);
		} else {
			selectedAvailable.add(id);
		}
		selectedAvailable = selectedAvailable;
	}

	function toggleSelectedItem(id: string) {
		if (selectedFromSelected.has(id)) {
			selectedFromSelected.delete(id);
		} else {
			selectedFromSelected.add(id);
		}
		selectedFromSelected = selectedFromSelected;
	}

	function selectGroup(groupName: string) {
		const groupItems = groupedAvailable()?.get(groupName) || [];
		groupItems.forEach((item) => selectedAvailable.add(item.id));
		selectedAvailable = selectedAvailable;
	}
</script>

<div class="grid grid-cols-[1fr_auto_1fr] gap-4">
	<!-- Available Items -->
	<div class="flex flex-col space-y-2">
		<div class="flex items-center justify-between">
			<h3 class="font-semibold text-foreground">
				{availableTitle} ({filteredAvailable.length})
			</h3>
			<div class="flex gap-2">
				<Button variant="ghost" size="sm" onclick={selectAll}>Select All</Button>
				<Button variant="ghost" size="sm" onclick={clearAvailable}>Clear</Button>
			</div>
		</div>

		<input
			type="text"
			bind:value={searchAvailable}
			placeholder="Search..."
			class="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		/>

		<div
			class="flex-1 overflow-y-auto rounded-md border border-input bg-background"
			style="min-height: 400px; max-height: 500px;"
		>
			{#if groupedAvailable()}
				<!-- Grouped view -->
				{#each [...groupedAvailable()!.entries()] as [groupName, items]}
					<div class="border-b border-input">
						<button
							class="w-full px-3 py-2 text-left font-medium text-sm bg-muted hover:bg-muted/80 flex items-center justify-between"
							onclick={() => selectGroup(groupName)}
						>
							<span>{groupName} ({items.length})</span>
							<span class="text-xs text-muted-foreground">Select All</span>
						</button>
						{#each items as item}
							<button
								class="w-full px-4 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 border-b border-input/50"
								class:bg-accent={selectedAvailable.has(item.id)}
								onclick={() => toggleAvailableItem(item.id)}
							>
								<input
									type="checkbox"
									checked={selectedAvailable.has(item.id)}
									class="rounded border-input"
									onclick={(e) => e.stopPropagation()}
								/>
								<div class="flex-1">
									<div class="font-medium">{getLabel(item)}</div>
									{#if getSubLabel}
										<div class="text-xs text-muted-foreground">{getSubLabel(item)}</div>
									{/if}
								</div>
								{#if getStatusIcon && getStatusColor}
									<span class={getStatusColor(item)}>{getStatusIcon(item)}</span>
								{/if}
							</button>
						{/each}
					</div>
				{/each}
			{:else}
				<!-- Flat view -->
				{#each filteredAvailable as item}
					<button
						class="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 border-b border-input/50"
						class:bg-accent={selectedAvailable.has(item.id)}
						onclick={() => toggleAvailableItem(item.id)}
					>
						<input
							type="checkbox"
							checked={selectedAvailable.has(item.id)}
							class="rounded border-input"
							onclick={(e) => e.stopPropagation()}
						/>
						<div class="flex-1">
							<div class="font-medium">{getLabel(item)}</div>
							{#if getSubLabel}
								<div class="text-xs text-muted-foreground">{getSubLabel(item)}</div>
							{/if}
						</div>
						{#if getStatusIcon && getStatusColor}
							<span class={getStatusColor(item)}>{getStatusIcon(item)}</span>
						{/if}
					</button>
				{/each}
			{/if}
		</div>
	</div>

	<!-- Move Buttons -->
	<div class="flex flex-col items-center justify-center gap-2">
		<Button
			variant="outline"
			size="sm"
			onclick={moveToSelected}
			disabled={selectedAvailable.size === 0}
			title="Move selected to right"
		>
			→
		</Button>
		<Button
			variant="outline"
			size="sm"
			onclick={moveToAvailable}
			disabled={selectedFromSelected.size === 0}
			title="Move selected to left"
		>
			←
		</Button>
	</div>

	<!-- Selected Items -->
	<div class="flex flex-col space-y-2">
		<div class="flex items-center justify-between">
			<h3 class="font-semibold text-foreground">
				{selectedTitle} ({selected.length})
			</h3>
			<Button variant="ghost" size="sm" onclick={clearSelected}>Clear</Button>
		</div>

		<input
			type="text"
			bind:value={searchSelected}
			placeholder="Search..."
			class="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		/>

		<div
			class="flex-1 overflow-y-auto rounded-md border border-input bg-background"
			style="min-height: 400px; max-height: 500px;"
		>
			{#if filteredSelected.length === 0}
				<div class="flex items-center justify-center h-full text-muted-foreground text-sm">
					No items selected
				</div>
			{:else}
				{#each filteredSelected as item}
					<button
						class="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 border-b border-input/50"
						class:bg-accent={selectedFromSelected.has(item.id)}
						onclick={() => toggleSelectedItem(item.id)}
					>
						<input
							type="checkbox"
							checked={selectedFromSelected.has(item.id)}
							class="rounded border-input"
							onclick={(e) => e.stopPropagation()}
						/>
						<div class="flex-1">
							<div class="font-medium">{getLabel(item)}</div>
							{#if getSubLabel}
								<div class="text-xs text-muted-foreground">{getSubLabel(item)}</div>
							{/if}
						</div>
						{#if getStatusIcon && getStatusColor}
							<span class={getStatusColor(item)}>{getStatusIcon(item)}</span>
						{/if}
					</button>
				{/each}
			{/if}
		</div>
	</div>
</div>
