<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { SvelteMap } from 'svelte/reactivity';
	import Breadcrumb from '#lib/components/common/Breadcrumb.svelte';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { CATEGORY_NAME_MAX } from '#lib/utils/software-category.ts';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editing = $state<string | null>(null); // category id, or 'new'
	let confirmDelete = $state<string | null>(null);

	// Bulk classify: the category picked per product, compared with the saved one
	const picked = new SvelteMap<string, string>();
	const valueOf = (s: PageData['software'][number]) => picked.get(s.id) ?? s.category_id ?? '';
	const changed = $derived(data.software.filter((s) => valueOf(s) !== (s.category_id ?? '')).length);
	const unclassified = $derived(data.software.filter((s) => !s.category_id).length);
	let onlyUnclassified = $state(false);
	let vendor = $state('');
	const vendors = $derived([...new Map(data.software.map((s) => [s.vendors.id, s.vendors.name]))]);
	const shown = (s: PageData['software'][number]) =>
		(!onlyUnclassified || !s.category_id) && (!vendor || s.vendors.id === vendor);

	const afterSave = () => async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
		await update();
		if (result.type === 'success') {
			editing = null;
			confirmDelete = null;
			picked.clear();
		}
	};
</script>

<svelte:head>
	<title>Software categories</title>
</svelte:head>

{#snippet categoryForm(c: PageData['categories'][number] | null)}
	<form method="POST" action={c ? '?/update' : '?/create'} use:enhance={afterSave} class="flex flex-wrap items-end gap-2 text-sm">
		{#if c}<input type="hidden" name="id" value={c.id} />{/if}
		<label>
			<span class="mb-1 block text-xs font-medium text-muted-foreground">Name</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input name="name" required maxlength={CATEGORY_NAME_MAX} value={c?.name ?? ''} autofocus class="h-9 w-56 rounded-md border border-input px-2" />
		</label>
		<label class="min-w-64 grow">
			<span class="mb-1 block text-xs font-medium text-muted-foreground">Description (optional)</span>
			<input name="description" maxlength="500" value={c?.description ?? ''} class="h-9 w-full rounded-md border border-input px-2" />
		</label>
		<Button type="submit" size="sm">Save</Button>
		<Button size="sm" variant="ghost" onclick={() => (editing = null)}>Cancel</Button>
	</form>
{/snippet}

<div class="space-y-4">
	<Breadcrumb items={[{ label: 'Software', href: '/software' }, { label: 'Categories' }]} />
	<PageHeader
		title="Software categories"
		description="What each product does, one category per product. Reports can filter on it; V3 finds products of the same category on one LPAR."
	/>

	{#if form?.message || form?.error}
		<div class="rounded-md border px-4 py-2 text-sm {page.status >= 400 ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'}">
			{form.message ?? form.error}
		</div>
	{/if}

	{#if !data.canManage}
		<p class="text-sm text-muted-foreground">Only administrators can change categories and classify products.</p>
	{/if}

	<Card class="p-4">
		<fieldset disabled={!data.canManage}>
		<div class="mb-3 flex items-center justify-between">
			<h2 class="font-semibold">Categories</h2>
			{#if editing !== 'new'}<Button size="sm" variant="outline" onclick={() => (editing = 'new')}>Add category</Button>{/if}
		</div>
		{#if editing === 'new'}<div class="mb-3">{@render categoryForm(null)}</div>{/if}

		{#if data.categories.length === 0}
			<div class="space-y-2 text-sm">
				<p class="text-muted-foreground">No categories yet. Start with the common mainframe functions and adjust them:</p>
				<p>{data.suggested.join(' · ')}</p>
				<form method="POST" action="?/addSuggested" use:enhance={afterSave}>
					<Button type="submit" size="sm">Add these {data.suggested.length} categories</Button>
				</form>
			</div>
		{:else}
			<table class="w-full text-sm">
				<thead class="text-left">
					<tr class="border-b">
						<th class="px-3 py-2">Name</th>
						<th class="px-3 py-2">Description</th>
						<th class="px-3 py-2 text-right">Products</th>
						<th class="px-3 py-2"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.categories as c (c.id)}
						<tr class="border-b">
							{#if editing === c.id}
								<td colspan="4" class="px-3 py-2">{@render categoryForm(c)}</td>
							{:else}
								<td class="px-3 py-1.5 font-medium">
									<a href="/software?category={c.id}" class="text-primary hover:underline">{c.name}</a>
								</td>
								<td class="px-3 py-1.5 text-muted-foreground">{c.description ?? ''}</td>
								<td class="px-3 py-1.5 text-right tabular-nums">{c.products}</td>
								<td class="px-3 py-1.5 text-right whitespace-nowrap">
									{#if confirmDelete === c.id}
										<form method="POST" action="?/delete" use:enhance={afterSave} class="inline-flex items-center gap-2">
											<input type="hidden" name="id" value={c.id} />
											<span class="text-xs">
												Delete{c.products ? `; ${c.products} product${c.products === 1 ? '' : 's'} become unclassified` : ''}?
											</span>
											<Button type="submit" size="sm" variant="destructive">Delete</Button>
											<Button size="sm" variant="ghost" onclick={() => (confirmDelete = null)}>Keep</Button>
										</form>
									{:else}
										<Button size="sm" variant="ghost" onclick={() => (editing = c.id)}>Edit</Button>
										<Button size="sm" variant="ghost" onclick={() => (confirmDelete = c.id)}>Delete</Button>
									{/if}
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
		</fieldset>
	</Card>

	<Card class="p-4">
		<fieldset disabled={!data.canManage}>
		<form method="POST" action="?/classify" use:enhance={afterSave}>
			<div class="mb-3 flex flex-wrap items-end gap-4 text-sm">
				<h2 class="mr-auto font-semibold">
					Classify products
					<span class="ml-2 text-xs font-normal text-muted-foreground">{unclassified} of {data.software.length} unclassified</span>
				</h2>
				<label>
					<span class="mb-1 block text-xs font-medium text-muted-foreground">Vendor</span>
					<select bind:value={vendor} class="h-9 rounded-md border border-input px-2">
						<option value="">All vendors</option>
						{#each vendors as [id, name] (id)}<option value={id}>{name}</option>{/each}
					</select>
				</label>
				<label class="flex h-9 items-center gap-2">
					<input type="checkbox" bind:checked={onlyUnclassified} /> Only unclassified
				</label>
				<Button type="submit" disabled={changed === 0}>
					Save {changed || ''} change{changed === 1 ? '' : 's'}
				</Button>
			</div>
			{#if data.categories.length === 0}
				<p class="text-sm text-muted-foreground">Add categories first.</p>
			{:else}
				<div class="overflow-auto rounded-md border">
					<table class="w-full text-sm">
						<thead class="text-left">
							<tr class="border-b">
								<th class="px-3 py-2">Vendor</th>
								<th class="px-3 py-2">Product</th>
								<th class="px-3 py-2">Product code</th>
								<th class="px-3 py-2">Category</th>
							</tr>
						</thead>
						<tbody>
							{#each data.software as s (s.id)}
								{@const dirty = valueOf(s) !== (s.category_id ?? '')}
								<tr class="border-b {dirty ? 'bg-amber-50' : ''}" hidden={!shown(s)}>
									<td class="px-3 py-1">{s.vendors.name}</td>
									<td class="px-3 py-1 font-medium">
										<a href="/software/{s.id}" class="text-primary hover:underline">{s.name}</a>
									</td>
									<td class="px-3 py-1 font-mono text-xs">{s.product_code ?? ''}</td>
									<td class="px-3 py-1">
										<select
											name="cat.{s.id}"
											value={valueOf(s)}
											onchange={(e) => picked.set(s.id, e.currentTarget.value)}
											class="h-8 w-60 rounded-md border border-input px-2 {valueOf(s) ? '' : 'text-muted-foreground'}"
										>
											<option value="">Unclassified</option>
											{#each data.categories as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
										</select>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</form>
		</fieldset>
	</Card>
</div>
