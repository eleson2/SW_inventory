<script lang="ts">
	/**
	 * Dropdown with a search box and a checkbox per option. Empty selection = "all" (allText).
	 * Options with a `group` are shown under group headings with All / None per group.
	 */
	type Option = { id: string; label: string; hint?: string; group?: string };

	let {
		label,
		options,
		selected = $bindable([]),
		allText = 'All',
		emptyText = 'No options',
		disabled = false,
		onchange
	}: {
		label: string;
		options: Option[];
		selected?: string[];
		allText?: string;
		emptyText?: string;
		disabled?: boolean;
		onchange?: (selected: string[]) => void;
	} = $props();

	let open = $state(false);
	let query = $state('');
	let root: HTMLDivElement;

	const visible = $derived(
		query.trim()
			? options.filter((o) =>
					`${o.label} ${o.hint ?? ''} ${o.group ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())
				)
			: options
	);
	const groups = $derived.by(() => {
		const out: { name: string; options: Option[] }[] = [];
		for (const o of visible) {
			const name = o.group ?? '';
			const last = out.at(-1);
			if (last && last.name === name) last.options.push(o);
			else out.push({ name, options: [o] });
		}
		return out;
	});
	const summary = $derived.by(() => {
		if (selected.length === 0) return allText;
		if (selected.length <= 2) {
			return options.filter((o) => selected.includes(o.id)).map((o) => o.label).join(', ');
		}
		return `${selected.length} selected`;
	});

	function set(next: string[]) {
		selected = next;
		onchange?.(selected);
	}
	const toggle = (id: string) => set(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
	const setGroup = (ids: string[], on: boolean) =>
		set(on ? [...new Set([...selected, ...ids])] : selected.filter((s) => !ids.includes(s)));

	function onWindowClick(e: MouseEvent) {
		if (open && root && !root.contains(e.target as Node)) open = false;
	}
</script>

<svelte:window onclick={onWindowClick} onkeydown={(e) => e.key === 'Escape' && (open = false)} />

<div class="relative" bind:this={root}>
	<span class="block text-xs font-medium text-muted-foreground mb-1">{label}</span>
	<button
		type="button"
		class="flex h-9 w-56 items-center justify-between rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
		aria-haspopup="listbox"
		aria-expanded={open}
		{disabled}
		onclick={() => (open = !open)}
	>
		<span class="truncate {selected.length ? '' : 'text-muted-foreground'}">{summary}</span>
		<span aria-hidden="true" class="ml-2 text-muted-foreground">▾</span>
	</button>
	{#if open}
		<div class="absolute z-40 mt-1 w-80 rounded-md border bg-white shadow-lg">
			<div class="p-2 border-b flex gap-2">
				<input class="h-8 flex-1 rounded border border-input px-2 text-sm" placeholder="Search…" bind:value={query} />
				{#if selected.length}
					<button type="button" class="text-xs text-primary hover:underline" onclick={() => set([])}>Clear</button>
				{/if}
			</div>
			<ul class="max-h-80 overflow-auto py-1" role="listbox" aria-multiselectable="true" aria-label={label}>
				{#each groups as group (group.name)}
					{#if group.name}
						{@const ids = group.options.map((o) => o.id)}
						<li class="flex items-center justify-between bg-gray-50 px-3 py-1 text-xs font-semibold" role="presentation">
							{group.name}
							<span class="font-normal">
								<button type="button" class="text-primary hover:underline" onclick={() => setGroup(ids, true)}>All</button>
								·
								<button type="button" class="text-primary hover:underline" onclick={() => setGroup(ids, false)}>None</button>
							</span>
						</li>
					{/if}
					{#each group.options as option (option.id)}
						<li>
							<label class="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent cursor-pointer">
								<input type="checkbox" checked={selected.includes(option.id)} onchange={() => toggle(option.id)} />
								<span class="truncate">{option.label}</span>
								{#if option.hint}<span class="ml-auto text-xs text-muted-foreground truncate">{option.hint}</span>{/if}
							</label>
						</li>
					{/each}
				{:else}
					<li class="px-3 py-2 text-sm text-muted-foreground">{query ? 'No matches' : emptyText}</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
