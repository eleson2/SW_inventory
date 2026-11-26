<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import {
		EVENT_LABEL,
		SOURCE_LABEL,
		versionText,
		type HistoryEvent,
		type HistorySource
	} from '#lib/utils/install-history.ts';

	let { data }: { data: PageData } = $props();

	let product = $state('');
	let on = $state(untrack(() => data.on));
	const today = new Date().toISOString().slice(0, 10);
	function showOn() {
		goto(on ? `?on=${on}` : '?');
	}
	let hidePtf = $state(false);

	const products = $derived(
		[...new Map(data.events.map((e) => [e.software.id, e.software])).values()].sort((a, b) => a.name.localeCompare(b.name))
	);
	const shown = $derived(
		data.events.filter((e) => (!product || e.software.id === product) && (!hidePtf || e.event !== 'ptf'))
	);
	const reconstructed = $derived(data.events.some((e) => e.reconstructed));

	const fmt = (d: Date | string) => new Date(d).toISOString().slice(0, 16).replace('T', ' ');
	const eventClass: Record<string, string> = {
		install: 'bg-green-100 text-green-900',
		upgrade: 'bg-blue-100 text-blue-900',
		ptf: 'bg-gray-100 text-gray-800',
		downgrade: 'bg-amber-100 text-amber-900',
		rollback: 'bg-red-100 text-red-900',
		remove: 'bg-gray-200 text-gray-700'
	};
</script>

<svelte:head>
	<title>Install history · {data.lpar.code}</title>
</svelte:head>

<div class="space-y-4">
	<PageHeader title="Install history: {data.lpar.code}" description="{data.lpar.name} · {data.lpar.customers.name}">
		{#snippet actions()}
			<span class="print:hidden flex gap-2">
				<Button href="/lpars/{data.lpar.id}" variant="outline">Back to LPAR</Button>
				<Button variant="outline" onclick={() => window.print()}>Print</Button>
			</span>
		{/snippet}
	</PageHeader>

	<Card class="p-4 text-sm">
		<form
			class="flex flex-wrap items-end gap-2 print:hidden"
			onsubmit={(e) => {
				e.preventDefault();
				showOn();
			}}
		>
			<label>
				<span class="mb-1 block text-xs font-medium text-muted-foreground">Show what was installed on</span>
				<input type="date" max={today} bind:value={on} class="h-9 rounded-md border border-input px-2" />
			</label>
			<Button type="submit" variant="outline" disabled={on === data.on}>Show</Button>
			{#if data.on}
				<Button variant="ghost" onclick={() => ((on = ''), showOn())}>Clear</Button>
				<a href="/reports/installed?lpar={data.lpar.id}&asof={data.on}" class="ml-auto self-center text-primary hover:underline">
					Open in Installed software (R1) as of {data.on}
				</a>
			{/if}
		</form>
		{#if data.installedOn}
			<h2 class="mt-3 mb-1 font-semibold">Installed on {data.on} (end of day)</h2>
			{#if data.installedOn.length === 0}
				<p class="text-muted-foreground">Nothing recorded as installed on this LPAR then.</p>
			{:else}
				<table class="w-full">
					<thead class="text-left text-xs text-muted-foreground">
						<tr class="border-b">
							<th class="py-1 pr-3">Product</th>
							<th class="py-1 pr-3">Vendor</th>
							<th class="py-1 pr-3">Version</th>
							<th class="py-1">Installed</th>
						</tr>
					</thead>
					<tbody>
						{#each data.installedOn as i (i.software.id)}
							<tr class="border-b last:border-b-0">
								<td class="py-1 pr-3 font-medium">{i.software.name}</td>
								<td class="py-1 pr-3">{i.software.vendor}</td>
								<td class="py-1 pr-3 whitespace-nowrap">
									{versionText(i.version, i.ptf_level)}
									{#if i.rolledBack}<span class="ml-1 rounded bg-red-100 px-1.5 text-xs text-red-900">rolled back</span>{/if}
								</td>
								<td class="py-1 tabular-nums">{fmt(i.installed).slice(0, 10)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		{/if}
	</Card>

	<Card class="flex flex-wrap items-end gap-5 p-4 text-sm print:hidden">
		<label>
			<span class="mb-1 block text-xs font-medium text-muted-foreground">Product</span>
			<select bind:value={product} class="h-9 rounded-md border border-input px-2">
				<option value="">All products ({products.length})</option>
				{#each products as p (p.id)}
					<option value={p.id}>{p.name}</option>
				{/each}
			</select>
		</label>
		<label class="flex h-9 items-center gap-2">
			<input type="checkbox" bind:checked={hidePtf} />
			Hide PTF-only changes
		</label>
		<span class="ml-auto self-center text-muted-foreground">{shown.length} of {data.events.length} events</span>
	</Card>

	{#if shown.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">No changes recorded.</Card>
	{:else}
		<div class="overflow-auto rounded-md border print:overflow-visible">
			<table class="w-full text-sm">
				<thead class="text-left">
					<tr class="border-b">
						<th class="px-3 py-2">When</th>
						<th class="px-3 py-2">Product</th>
						<th class="px-3 py-2">Change</th>
						<th class="px-3 py-2">From</th>
						<th class="px-3 py-2">To</th>
						<th class="px-3 py-2">Through</th>
						<th class="px-3 py-2">Reason</th>
					</tr>
				</thead>
				<tbody>
					{#each shown as e (e.id)}
						<tr class="border-b last:border-b-0 {e.reconstructed ? 'text-muted-foreground' : ''}">
							<td class="px-3 py-1.5 whitespace-nowrap tabular-nums">
								{fmt(e.occurred_at)}{#if e.reconstructed}<span title="Rebuilt from data recorded before the history existed; the date may be approximate"> *</span>{/if}
							</td>
							<td class="px-3 py-1.5">
								<span class="font-medium text-foreground">{e.software.name}</span>
								<span class="block text-xs text-muted-foreground">{e.software.vendors.name}</span>
							</td>
							<td class="px-3 py-1.5">
								<span class="inline-block rounded px-1.5 text-xs {eventClass[e.event] ?? ''}">
									{EVENT_LABEL[e.event as HistoryEvent] ?? e.event}
								</span>
							</td>
							<td class="px-3 py-1.5 whitespace-nowrap">{versionText(e.from_version, e.from_ptf_level) || '–'}</td>
							<td class="px-3 py-1.5 whitespace-nowrap">{versionText(e.to_version, e.to_ptf_level) || '–'}</td>
							<td class="px-3 py-1.5">
								{SOURCE_LABEL[e.source as HistorySource] ?? e.source}
								{#if e.package}
									<a href="/packages/{e.package.id}" class="block text-xs text-primary hover:underline">{e.package.code} {e.package.version}</a>
								{/if}
							</td>
							<td class="px-3 py-1.5">{e.reason ?? ''}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if reconstructed}
			<p class="text-xs text-muted-foreground">
				* Rebuilt from what was recorded before the install history existed (install date, previous version,
				rollbacks); the date may be approximate and earlier changes are not known.
			</p>
		{/if}
	{/if}
</div>
