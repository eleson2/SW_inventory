<!--
	BundleItemsManager.svelte
	Edit the software levels of a vendor bundle (CARS, RSU, ...).

	Each row is a software product of the bundle's vendor with either an existing
	version, or a new version/PTF level that is created when the bundle is saved.
	A version/PTF level exists once: rows that did not change in this level keep
	pointing at the version they had in the previous level.
-->
<script lang="ts">
	import { versionName } from '#lib/utils/version-parser.ts';
	import type { BundleItem } from '#lib/schemas/bundle.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';

	interface SoftwareOption {
		id: string;
		name: string;
		vendor_id: string;
		product_code: string | null;
		versions: Array<{ id: string; version: string; ptf_level: string | null; is_current: boolean }>;
	}

	interface Props {
		items: BundleItem[];
		allSoftware: SoftwareOption[];
		vendorId: string;
		/** Bundle code (RSU2512, CARS2512) */
		bundleCode?: string;
		/** RSU levels are the PTF level of every product; CARS products have their own highest PTF */
		bundleType?: string;
		errors?: unknown;
	}

	let { items = $bindable([]), allSoftware, vendorId, bundleCode = '', bundleType = '', errors }: Props = $props();

	/** PTF level suggested for new versions */
	const suggestedPtf = $derived(bundleType === 'RSU' ? bundleCode : '');

	const NEW = '__new__';
	const selectClass =
		'flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

	const inputClass =
		'flex w-full rounded-md border border-input bg-background px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

	const vendorSoftware = $derived(allSoftware.filter((s) => s.vendor_id === vendorId));
	const visible = $derived(items.filter((item) => item._action !== 'delete'));
	const foreignCount = $derived(
		visible.filter((item) => item.software_id && !vendorSoftware.some((s) => s.id === item.software_id)).length
	);

	let bulkPtf = $state('');
	/** Rows ticked for "Set new PTF level" (the products that changed in this level) */
	let selected = $state<BundleItem[]>([]);
	const isSelected = (item: BundleItem) => selected.includes(item);
	const toggleSelected = (item: BundleItem) =>
		(selected = isSelected(item) ? selected.filter((i) => i !== item) : [...selected, item]);
	const allSelected = $derived(visible.length > 0 && visible.every(isSelected));

	const versionsOf = (softwareId: string) => allSoftware.find((s) => s.id === softwareId)?.versions ?? [];
	const isNew = (item: BundleItem) => item.new_version !== undefined;
	const versionLabel = (v: { version: string; ptf_level: string | null; is_current: boolean }) =>
		`${versionName(v)}${v.ptf_level ? ` (${v.ptf_level})` : ''}${v.is_current ? ' – current' : ''}`;

	/** The version string currently chosen for a row, existing or new */
	function currentVersion(item: BundleItem): string {
		if (isNew(item)) return item.new_version ?? '';
		return versionsOf(item.software_id).find((v) => v.id === item.software_version_id)?.version ?? '';
	}

	function setVersion(item: BundleItem, value: string) {
		if (value === NEW) {
			const latest = versionsOf(item.software_id)[0];
			item.software_version_id = '';
			item.new_version = currentVersion(item) || latest?.version || '';
			item.new_ptf_level = suggestedPtf;
		} else {
			item.software_version_id = value;
			item.new_version = undefined;
			item.new_ptf_level = undefined;
		}
	}

	function setSoftware(item: BundleItem, softwareId: string) {
		item.software_id = softwareId;
		item.new_version = undefined;
		item.new_ptf_level = undefined;
		const versions = versionsOf(softwareId);
		item.software_version_id = (versions.find((v) => v.is_current) ?? versions[0])?.id ?? '';
		if (!item.software_version_id) setVersion(item, NEW);
	}

	function addItem() {
		items.push({ software_id: '', software_version_id: '' });
	}

	function addAllVendorSoftware() {
		const present = new Set(visible.map((item) => item.software_id));
		for (const software of vendorSoftware) {
			if (present.has(software.id)) continue;
			const item: BundleItem = { software_id: '', software_version_id: '' };
			items.push(item);
			setSoftware(items[items.length - 1], software.id);
		}
	}

	function removeItem(item: BundleItem) {
		const index = items.indexOf(item);
		if (index < 0) return;
		selected = selected.filter((i) => i !== item);
		if (item.id) item._action = 'delete';
		else items.splice(index, 1);
	}

	/** Clone-then-bump: give the selected (changed) rows their version with a new PTF level */
	function applyBulkPtf() {
		const ptf = bulkPtf.trim().toUpperCase();
		if (!ptf) return;
		for (const item of selected) {
			if (!item.software_id) continue;
			const version = currentVersion(item);
			if (!version) continue;
			const existing = versionsOf(item.software_id).find(
				(v) => v.version === version && v.ptf_level?.toUpperCase() === ptf
			);
			if (existing) {
				setVersion(item, existing.id);
			} else {
				item.software_version_id = '';
				item.new_version = version;
				item.new_ptf_level = ptf;
			}
		}
		selected = [];
	}

	const itemError = (index: number): string | undefined => {
		const e = (errors as Record<number, { software_id?: string[]; software_version_id?: string[] }> | undefined)?.[
			items.indexOf(visible[index])
		];
		return e?.software_id?.[0] ?? e?.software_version_id?.[0];
	};
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div>
			<h3 class="text-lg font-semibold">Bundle Contents</h3>
			<p class="text-sm text-muted-foreground">
				Software levels in this bundle. Pick an existing version, or choose “New version/PTF…” to create it on save.
			</p>
		</div>
		<div class="flex gap-2">
			<Button type="button" size="sm" variant="outline" disabled={!vendorId} onclick={addAllVendorSoftware}>
				Add all vendor software
			</Button>
			<Button type="button" size="sm" disabled={!vendorId} onclick={addItem}>Add Item</Button>
		</div>
	</div>

	{#if !vendorId}
		<div class="border border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
			Select a vendor first.
		</div>
	{:else}
		{#if foreignCount > 0}
			<div class="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
				{foreignCount} item(s) belong to another vendor and must be removed before saving.
			</div>
		{/if}

		{#if visible.length > 0}
			<div class="flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-3">
				<div class="space-y-1">
					<label for="bulk-ptf" class="text-xs font-medium text-muted-foreground">New PTF level for selected items</label>
					<Input id="bulk-ptf" class="h-9 w-40 font-mono" placeholder={suggestedPtf || 'e.g. LU17806 or RSU2512'} bind:value={bulkPtf} />
				</div>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onclick={applyBulkPtf}
					disabled={!bulkPtf.trim() || selected.length === 0}
				>
					Apply to {selected.length} selected
				</Button>
				<span class="text-xs text-muted-foreground">
					Tick the products that changed in this level. Unticked products keep their version, so an
					unchanged version/PTF level is not stored twice. Missing levels are created on save.
				</span>
			</div>
		{/if}

		{#if visible.length === 0}
			<div class="border border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
				No items yet. Use “Add Item” or “Add all vendor software”.
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b text-left text-muted-foreground">
							<th class="py-2 pr-2 w-8">
								<input
									type="checkbox"
									aria-label="Select all items"
									checked={allSelected}
									onchange={() => (selected = allSelected ? [] : [...visible])}
								/>
							</th>
							<th class="py-2 pr-2 font-medium w-1/3">Software</th>
							<th class="py-2 pr-2 font-medium w-1/3">Version / PTF level</th>
							<th class="py-2 pr-2 font-medium">Notes</th>
							<th class="py-2"></th>
						</tr>
					</thead>
					<tbody>
						{#each visible as item, index (item)}
							{@const error = itemError(index)}
							<tr class="border-b align-top {isNew(item) ? 'bg-blue-50/50' : ''}">
								<td class="py-2 pr-2 pt-4">
									<input
										type="checkbox"
										aria-label="Select item"
										checked={isSelected(item)}
										onchange={() => toggleSelected(item)}
									/>
								</td>
								<td class="py-2 pr-2">
									<select
										class={selectClass}
										aria-label="Software"
										value={item.software_id}
										onchange={(e) => setSoftware(item, e.currentTarget.value)}
									>
										<option value="">Select software…</option>
										{#each vendorSoftware as software}
											<option value={software.id}>
												{software.name}{software.product_code ? ` [${software.product_code}]` : ''}
											</option>
										{/each}
									</select>
								</td>
								<td class="py-2 pr-2 space-y-1">
									<select
										class={selectClass}
										aria-label="Version"
										disabled={!item.software_id}
										value={isNew(item) ? NEW : item.software_version_id}
										onchange={(e) => setVersion(item, e.currentTarget.value)}
									>
										<option value="">Select version…</option>
										{#each versionsOf(item.software_id) as version}
											<option value={version.id}>{versionLabel(version)}</option>
										{/each}
										<option value={NEW}>+ New version/PTF…</option>
									</select>
									{#if isNew(item)}
										<div class="flex gap-1">
											<input class="{inputClass} h-8 text-xs" placeholder="Version, e.g. 19.0" aria-label="New version" bind:value={item.new_version} />
											<input class="{inputClass} h-8 text-xs font-mono" placeholder={bundleType === 'CARS' ? 'Highest PTF, e.g. LU17806' : 'PTF level'} aria-label="New PTF level" bind:value={item.new_ptf_level} />
										</div>
										<div class="text-xs text-blue-700">Created when the bundle is saved</div>
									{/if}
									{#if error}
										<div class="text-xs text-destructive">{error}</div>
									{/if}
								</td>
								<td class="py-2 pr-2">
									<input class="{inputClass} h-9 text-xs" placeholder="e.g. 42 PTFs" aria-label="Notes" bind:value={item.notes} />
								</td>
								<td class="py-2 text-right">
									<Button type="button" size="sm" variant="ghost" onclick={() => removeItem(item)}>Remove</Button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="text-sm text-muted-foreground">
				{visible.length} item{visible.length === 1 ? '' : 's'}
				{#if visible.some(isNew)}
					· <span class="text-blue-700">{visible.filter(isNew).length} new version(s) to create</span>
				{/if}
			</div>
		{/if}
	{/if}
</div>
