<!--
	BundlePicker.svelte
	Copy items from one or more vendor bundles (Broadcom CARS, IBM RSU, ...) into a package.
	Items are copied: they stay editable in PackageItemsManager and remember their source bundle.
-->
<script lang="ts">
	import type { PackageItem } from '#lib/schemas/package.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { mergeBundlesIntoItems, type MergeResult } from '#lib/utils/bundle-merge.ts';
	import { formatDate } from '#lib/utils/date-format.ts';

	interface PickerBundle {
		id: string;
		code: string;
		name: string;
		bundle_type: string;
		release_date: Date | string;
		vendors: { id: string; name: string };
		items: Array<{
			software_id: string;
			software_version_id: string;
			software?: { name: string } | null;
			software_version?: { version: string } | null;
		}>;
	}

	interface Props {
		items: PackageItem[];
		bundles: PickerBundle[];
		/** Software with versions, to know the release of the package's current rows */
		allSoftware?: Array<{ versions: Array<{ id: string; version: string }> }>;
	}

	let { items = $bindable([]), bundles, allSoftware = [] }: Props = $props();

	const versionOf = (versionId: string) =>
		allSoftware.flatMap((s) => s.versions).find((v) => v.id === versionId)?.version;

	let selected = $state<string[]>([]);
	let lastResult = $state<(MergeResult & { codes: string[] }) | null>(null);
	let expanded = $state(false);
	/** Upgrade software already in the package to the bundle's highest release */
	let latestOnly = $state(false);

	const byVendor = $derived.by(() => {
		const groups = new Map<string, { vendor: string; bundles: PickerBundle[] }>();
		for (const bundle of bundles) {
			const group = groups.get(bundle.vendors.id) ?? { vendor: bundle.vendors.name, bundles: [] };
			group.bundles.push(bundle);
			groups.set(bundle.vendors.id, group);
		}
		return [...groups.values()];
	});

	const codeById = (id: string) => bundles.find((b) => b.id === id)?.code;

	/** Apply the selected bundles, in the order they appear in the list. */
	export function applySelected() {
		const chosen = bundles.filter((b) => selected.includes(b.id));
		if (chosen.length === 0) return;
		const result = mergeBundlesIntoItems(items, chosen, { bundleCodeById: codeById, versionOf, latestOnly });
		items = result.items;
		lastResult = { ...result, codes: chosen.map((b) => b.code) };
		selected = [];
	}

	function toggle(id: string) {
		selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-lg font-semibold">Add from Vendor Bundles</h3>
			<p class="text-sm text-muted-foreground">
				Copy the software levels of one or more vendor bundles (e.g. Broadcom CARS, IBM RSU) into this
				package. Copied items can be adjusted or removed below.
			</p>
		</div>
		<Button type="button" size="sm" variant="outline" onclick={() => (expanded = !expanded)}>
			{expanded ? 'Hide bundles' : `Show bundles (${bundles.length})`}
		</Button>
	</div>

	{#if expanded}
		{#if bundles.length === 0}
			<div class="border border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
				No active vendor bundles. <a href="/bundles/new" class="text-primary hover:underline">Create one</a>
				or import a bundle CSV on the <a href="/import" class="text-primary hover:underline">Import</a> page.
			</div>
		{:else}
			<div class="grid gap-4 md:grid-cols-2">
				{#each byVendor as group}
					<div class="border rounded-lg p-3">
						<div class="text-sm font-semibold mb-2">{group.vendor}</div>
						<div class="space-y-1 max-h-64 overflow-y-auto">
							{#each group.bundles as bundle (bundle.id)}
								<label class="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent cursor-pointer">
									<input
										type="checkbox"
										checked={selected.includes(bundle.id)}
										onchange={() => toggle(bundle.id)}
									/>
									<span class="font-mono">{bundle.code}</span>
									<span class="text-muted-foreground truncate">{bundle.name}</span>
									<span class="ml-auto text-xs text-muted-foreground whitespace-nowrap">
										{formatDate(new Date(bundle.release_date))} · {bundle.items.length} items
									</span>
								</label>
							{/each}
						</div>
					</div>
				{/each}
			</div>
			<label class="flex items-center gap-2 text-sm cursor-pointer w-fit">
				<input type="checkbox" bind:checked={latestOnly} />
				Latest release only
				<span class="text-xs text-muted-foreground">
					(software already in the package is upgraded to the bundle's highest release, e.g. Db2 12 → 13)
				</span>
			</label>
			<div class="flex items-center gap-3">
				<Button type="button" size="sm" disabled={selected.length === 0} onclick={applySelected}>
					Add {selected.length || ''} selected bundle{selected.length === 1 ? '' : 's'} to package
				</Button>
				<span class="text-xs text-muted-foreground">
					{latestOnly
						? "Every product gets the bundle's highest release."
						: "Software already in the package moves to the bundle's level of the same release; new software gets the bundle's highest release."}
					Bundles are applied top to bottom.
				</span>
			</div>
		{/if}
	{/if}

	{#if lastResult}
		<div class="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
			<div>
				Applied {lastResult.codes.join(', ')}: <strong>{lastResult.added}</strong> added,
				<strong>{lastResult.replaced}</strong> version(s) replaced,
				{lastResult.unchanged} already at that level.
			</div>
			{#if lastResult.keptRelease.length > 0}
				<div class="mt-2 text-amber-800">
					Kept as is, the bundle does not contain the package's release:
					<ul class="list-disc pl-5 space-y-0.5">
						{#each lastResult.keptRelease as kept}
							<li>{kept.softwareName} {kept.release ?? ''} (not in {kept.bundleCode})</li>
						{/each}
					</ul>
				</div>
			{/if}
			{#if lastResult.conflicts.length > 0}
				<ul class="mt-2 list-disc pl-5 space-y-0.5">
					{#each lastResult.conflicts as conflict}
						<li>
							{conflict.softwareName}: now from <Badge variant="secondary" class="text-xs">{conflict.bundleCode}</Badge>
							(was {conflict.replacedSource ?? 'set manually'})
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>
