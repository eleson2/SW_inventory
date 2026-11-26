<script lang="ts">
	/**
	 * Filter bar shared by all reports. Choose customers -> their LPARs are selected -> narrow
	 * in the LPARs dropdown or remove chips on the scope line, which always shows the selection. "Only LPARs running" ticks the LPARs that have a product. A saved LPAR set
	 * restores customers + ticks. Apply writes the scope to the URL (see report-scope.ts).
	 */
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Button from '#lib/components/ui/Button.svelte';
	import MultiSelect from './MultiSelect.svelte';
	import type { ReportFilterOptions, ReportScope } from '#lib/server/report-scope.ts';
	import { UNCLASSIFIED } from '#lib/utils/software-category.ts';
	import { ENVIRONMENTS, ENVIRONMENT_LABEL, NO_ENVIRONMENT } from '#lib/utils/environment.ts';

	let {
		options,
		scope,
		keep = []
	}: {
		options: ReportFilterOptions;
		scope: ReportScope;
		/** Report-specific URL params that Apply keeps (e.g. "since"); Reset drops them */
		keep?: string[];
	} = $props();

	const lparsOf = (customerIds: string[]) => options.lpars.filter((l) => customerIds.includes(l.customer_id));

	let customers = $state<string[]>(untrack(() => scope.customerIds));
	let ticked = $state<string[]>(
		untrack(() => (scope.lparIds.length ? scope.lparIds : lparsOf(scope.customerIds).map((l) => l.id)))
	);
	let vendors = $state<string[]>(untrack(() => scope.vendorIds));
	let software = $state<string[]>(untrack(() => scope.softwareIds));
	let categories = $state<string[]>(untrack(() => scope.categoryIds));
	let environments = $state<string[]>(untrack(() => scope.environments));
	const environmentOptions = [
		...ENVIRONMENTS.map((e) => ({ id: e, label: e, hint: ENVIRONMENT_LABEL[e] })),
		{ id: NO_ENVIRONMENT, label: 'Not set' }
	];
	let running = $state('');
	let setId = $state(untrack(() => scope.setId ?? ''));
	let saving = $state(false);
	let setName = $state('');

	const customerOptions = $derived(options.customers.map((c) => ({ id: c.id, label: c.name, hint: c.code })));
	const vendorOptions = $derived(options.vendors.map((v) => ({ id: v.id, label: v.name, hint: v.code })));
	const softwareOptions = $derived(
		options.software
			.filter((s) => vendors.length === 0 || vendors.includes(s.vendor_id))
			.filter((s) => categories.length === 0 || categories.includes(s.category_id ?? UNCLASSIFIED))
			.map((s) => ({ id: s.id, label: s.name, hint: options.vendors.find((v) => v.id === s.vendor_id)?.code }))
	);
	const categoryOptions = $derived([
		...options.categories.map((c) => ({ id: c.id, label: c.name })),
		{ id: UNCLASSIFIED, label: 'Unclassified' }
	]);
	const groups = $derived(
		options.customers
			.filter((c) => customers.includes(c.id))
			.map((c) => ({ customer: c, lpars: options.lpars.filter((l) => l.customer_id === c.id) }))
	);
	const lparOptions = $derived(
		(customers.length ? lparsOf(customers) : options.lpars).map((l) => ({
			id: l.id,
			label: l.code,
			hint: l.name,
			group: options.customers.find((c) => c.id === l.customer_id)?.name
		}))
	);
	const selectedSet = $derived(options.sets.find((s) => s.id === setId));
	/** The ticks still equal the chosen set (otherwise it is an ad-hoc selection) */
	const matchesSet = $derived(
		!!selectedSet && selectedSet.lparIds.length === ticked.length && selectedSet.lparIds.every((id) => ticked.includes(id))
	);

	function onCustomersChange(next: string[]) {
		const added = next.filter((id) => !customers.includes(id));
		const keep = ticked.filter((id) => next.includes(options.lpars.find((l) => l.id === id)?.customer_id ?? ''));
		ticked = [...keep, ...lparsOf(added).map((l) => l.id)];
		customers = next;
	}

	function onRunningChange() {
		if (!running) return;
		const runs = options.lpars.filter((l) => l.softwareIds.includes(running));
		if (customers.length === 0) customers = [...new Set(runs.map((l) => l.customer_id))];
		ticked = runs.filter((l) => customers.includes(l.customer_id)).map((l) => l.id);
	}

	function onSetChange() {
		const set = options.sets.find((s) => s.id === setId);
		if (!set) return;
		const lpars = options.lpars.filter((l) => set.lparIds.includes(l.id));
		customers = [...new Set(lpars.map((l) => l.customer_id))];
		ticked = lpars.map((l) => l.id);
		running = '';
	}

	function toggleLpar(id: string) {
		ticked = ticked.includes(id) ? ticked.filter((t) => t !== id) : [...ticked, id];
	}

	/** LPARs picked without choosing customers first bring their customers along */
	function onLparsChange(next: string[]) {
		const owners = options.lpars.filter((l) => next.includes(l.id)).map((l) => l.customer_id);
		customers = [...new Set([...customers, ...owners])];
		ticked = next;
	}

	function scopeParams() {
		const params = new URLSearchParams();
		customers.forEach((id) => params.append('customer', id));
		const all = lparsOf(customers).map((l) => l.id);
		if (customers.length && ticked.length !== all.length) ticked.forEach((id) => params.append('lpar', id));
		vendors.forEach((id) => params.append('vendor', id));
		software.forEach((id) => params.append('software', id));
		categories.forEach((id) => params.append('category', id));
		environments.forEach((e) => params.append('env', e));
		if (matchesSet) params.set('set', setId);
		for (const key of keep) page.url.searchParams.getAll(key).forEach((v) => params.append(key, v));
		return params;
	}

	/** Customers chosen but every LPAR removed: the URL would mean "all LPARs", so block Apply */
	const empty = $derived(customers.length > 0 && ticked.length === 0);
	/** Filters changed since the report was loaded */
	const dirty = $derived(scopeParams().toString() !== page.url.searchParams.toString());

	function apply() {
		goto(`${page.url.pathname}?${scopeParams()}`);
	}
	function reset() {
		goto(page.url.pathname);
	}
</script>

<div class="space-y-3">
	<div class="flex flex-wrap items-end gap-3 print:hidden">
		<MultiSelect label="Customers" options={customerOptions} selected={customers} allText="All customers" onchange={onCustomersChange} />
		<MultiSelect
			label="LPARs"
			options={lparOptions}
			selected={ticked}
			allText={customers.length ? 'None' : 'All LPARs'}
			onchange={onLparsChange}
		/>
		<label class="text-sm">
			<span class="block text-xs font-medium text-muted-foreground mb-1">Only LPARs running</span>
			<select class="h-9 w-48 rounded-md border border-input bg-background px-2 text-sm" bind:value={running} onchange={onRunningChange}>
				<option value="">—</option>
				{#each options.software as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
			</select>
		</label>
		<MultiSelect label="Environments" options={environmentOptions} bind:selected={environments} allText="All environments" />
		<MultiSelect label="Vendors" options={vendorOptions} bind:selected={vendors} allText="All vendors" />
		<MultiSelect label="Categories" options={categoryOptions} bind:selected={categories} allText="All categories" />
		<MultiSelect label="Products" options={softwareOptions} bind:selected={software} allText="All products" />
		<label class="text-sm">
			<span class="block text-xs font-medium text-muted-foreground mb-1">LPAR set</span>
			<select class="h-9 w-48 rounded-md border border-input bg-background px-2 text-sm" bind:value={setId} onchange={onSetChange}>
				<option value="">—</option>
				{#each options.sets as s (s.id)}<option value={s.id}>{s.name} ({s.lparIds.length})</option>{/each}
			</select>
		</label>
		<div class="flex gap-2">
			<Button onclick={apply} disabled={empty} class={dirty && !empty ? 'ring-2 ring-amber-400 ring-offset-1' : ''}>Apply</Button>
			<Button variant="outline" onclick={reset}>Reset</Button>
		</div>
	</div>

	<!-- Scope line: always shows exactly which LPARs the report covers -->
	<div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
		<span class="font-medium">Scope:</span>
		{#if groups.length === 0}
			<span class="text-muted-foreground">all {options.lpars.length} LPARs</span>
		{:else}
			{#each groups as { customer, lpars } (customer.id)}
				{@const chosen = lpars.filter((l) => ticked.includes(l.id))}
				<span class="inline-flex flex-wrap items-center gap-1">
					<span class="text-muted-foreground" title={customer.code}>{customer.name}:</span>
					{#each chosen as lpar (lpar.id)}
						<span class="inline-flex items-center rounded-full border bg-gray-50 pl-2 pr-1 text-xs" title={lpar.name}>
							{lpar.code}
							<button
								type="button"
								class="ml-0.5 rounded-full px-1 print:hidden text-muted-foreground hover:bg-gray-200 hover:text-foreground"
								aria-label="Remove {lpar.code}"
								onclick={() => toggleLpar(lpar.id)}>✕</button
							>
						</span>
					{:else}
						<span class="text-xs text-muted-foreground italic">no LPARs</span>
					{/each}
				</span>
			{/each}
			<span class="text-muted-foreground">· {ticked.length} LPAR{ticked.length === 1 ? '' : 's'}</span>
		{/if}
		{#if environments.length}
			<span class="text-muted-foreground">· only {environments.map((e) => (e === NO_ENVIRONMENT ? 'not set' : e)).join(', ')}</span>
		{/if}
		{#if empty}
			<span class="text-xs text-red-700 print:hidden">Pick at least one LPAR</span>
		{:else if dirty}
			<span class="text-xs text-amber-700 print:hidden">Changed: Apply to update the report</span>
		{/if}
		<span class="ml-auto flex items-center gap-2 print:hidden">
			{#if saving}
				<form method="POST" action="/reports/lpar-sets?/create" class="flex items-center gap-2">
					{#each ticked as id (id)}<input type="hidden" name="lpar" value={id} />{/each}
					<input type="hidden" name="redirectTo" value={`${page.url.pathname}?${scopeParams()}`} />
					<input
						name="name"
						required
						maxlength="100"
						placeholder="Set name, e.g. IMS LPARs"
						class="h-8 w-56 rounded border border-input px-2"
						bind:value={setName}
					/>
					<Button type="submit" size="sm" disabled={!setName.trim() || ticked.length === 0}>Save</Button>
					<Button size="sm" variant="ghost" onclick={() => (saving = false)}>Cancel</Button>
				</form>
			{:else}
				<Button size="sm" variant="outline" disabled={ticked.length === 0} onclick={() => (saving = true)}>
					Save as LPAR set…
				</Button>
				<a href="/reports/lpar-sets" class="text-primary hover:underline">Manage sets</a>
			{/if}
		</span>
	</div>
</div>
