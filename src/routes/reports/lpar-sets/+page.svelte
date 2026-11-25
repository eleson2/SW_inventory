<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editing = $state<string | null>(null); // set id, or 'new'
	let confirmDelete = $state<string | null>(null);

	const byCustomer = $derived(
		data.customers
			.map((c) => ({ customer: c, lpars: data.lpars.filter((l) => l.customer_id === c.id) }))
			.filter((g) => g.lpars.length > 0)
	);
	const lparCode = (id: string) => data.lpars.find((l) => l.id === id)?.code ?? '?';
	const reportUrl = (set: PageData['sets'][number]) => {
		const lpars = data.lpars.filter((l) => set.lparIds.includes(l.id));
		const params = new URLSearchParams();
		[...new Set(lpars.map((l) => l.customer_id))].forEach((c) => params.append('customer', c));
		lpars.forEach((l) => params.append('lpar', l.id));
		params.set('set', set.id);
		return `/reports/installed?${params}`;
	};
	const afterSave = () => async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
		await update();
		if (result.type === 'success') editing = null;
	};
</script>

{#snippet setForm(set: PageData['sets'][number] | null)}
	<form method="POST" action={set ? '?/update' : '?/create'} use:enhance={afterSave} class="space-y-3 p-4 border-t">
		{#if set}<input type="hidden" name="id" value={set.id} />{/if}
		<div class="flex flex-wrap gap-3">
			<label class="text-sm">
				<span class="block text-xs font-medium text-muted-foreground mb-1">Name</span>
				<input name="name" required maxlength="100" value={set?.name ?? ''} class="h-9 w-64 rounded-md border border-input px-2" />
			</label>
			<label class="text-sm flex-1 min-w-64">
				<span class="block text-xs font-medium text-muted-foreground mb-1">Description</span>
				<input name="description" value={set?.description ?? ''} class="h-9 w-full rounded-md border border-input px-2" />
			</label>
		</div>
		<div class="space-y-1">
			{#each byCustomer as { customer, lpars } (customer.id)}
				<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
					<span class="w-40 font-medium truncate" title={customer.code}>{customer.name}</span>
					{#each lpars as lpar (lpar.id)}
						<label class="flex items-center gap-1.5" title={lpar.name}>
							<input type="checkbox" name="lpar" value={lpar.id} checked={set?.lparIds.includes(lpar.id) ?? false} />
							{lpar.code}
						</label>
					{/each}
				</div>
			{/each}
		</div>
		<div class="flex gap-2">
			<Button type="submit" size="sm">Save</Button>
			<Button size="sm" variant="ghost" onclick={() => (editing = null)}>Cancel</Button>
		</div>
	</form>
{/snippet}

<div class="space-y-6">
	<PageHeader title="LPAR sets" description="Saved selections of LPARs, usable in every report">
		{#snippet actions()}
			<Button href="/reports" variant="outline">All reports</Button>
			<Button onclick={() => (editing = 'new')}>New set</Button>
		{/snippet}
	</PageHeader>

	{#if form && 'error' in form && form.error}
		<p class="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{form.error}</p>
	{/if}
	{#if form && 'deleted' in form}
		<p class="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">Deleted “{form.deleted}”.</p>
	{/if}

	{#if editing === 'new'}
		<Card>{@render setForm(null)}</Card>
	{/if}

	{#each data.sets as set (set.id)}
		<Card>
			<div class="flex flex-wrap items-center gap-3 p-4">
				<div class="flex-1 min-w-64">
					<div class="font-semibold">{set.name}</div>
					{#if set.description}<div class="text-sm text-muted-foreground">{set.description}</div>{/if}
					<div class="text-sm mt-1">{set.lparIds.map(lparCode).sort().join(', ')}</div>
				</div>
				<Button href={reportUrl(set)} size="sm" variant="outline">Installed software</Button>
				<Button size="sm" variant="outline" onclick={() => (editing = editing === set.id ? null : set.id)}>Edit</Button>
				{#if confirmDelete === set.id}
					<form method="POST" action="?/delete" use:enhance class="flex gap-1">
						<input type="hidden" name="id" value={set.id} />
						<Button type="submit" size="sm" variant="destructive">Confirm delete</Button>
						<Button size="sm" variant="ghost" onclick={() => (confirmDelete = null)}>Keep</Button>
					</form>
				{:else}
					<Button size="sm" variant="ghost" onclick={() => (confirmDelete = set.id)}>Delete</Button>
				{/if}
			</div>
			{#if editing === set.id}{@render setForm(set)}{/if}
		</Card>
	{:else}
		{#if editing !== 'new'}
			<Card class="p-6 text-sm text-muted-foreground">
				No LPAR sets yet. Create one here, or tick LPARs in a report and choose “Save as LPAR set”.
			</Card>
		{/if}
	{/each}
</div>
