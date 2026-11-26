<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import { SvelteSet } from 'svelte/reactivity';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ReportFilters from '#lib/components/reports/ReportFilters.svelte';
	import { CURRENCIES, type Currency, type CurrencyCounts } from '#lib/utils/inventory-reports.ts';

	let { data }: { data: PageData } = $props();

	const report = $derived(data.report);
	const exportUrl = $derived(`/reports/currency/export${page.url.search}`);
	const open = new SvelteSet<string>();
	let printAll = $state(true);

	const KIND: Record<Currency, { label: string; bar: string; text: string }> = {
		current: { label: 'Current with package', bar: 'bg-green-600', text: 'text-green-800' },
		behind: { label: 'Behind package', bar: 'bg-amber-500', text: 'text-amber-800' },
		outside: { label: 'Outside package', bar: 'bg-gray-400', text: 'text-gray-700' },
		out_of_support: { label: 'Out of support', bar: 'bg-red-600', text: 'text-red-800' }
	};
	const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`);
	const share = (c: CurrencyCounts, k: Currency) => (c.installed ? (c.counts[k] / c.installed) * 100 : 0);
	const toggle = (id: string) => (open.has(id) ? open.delete(id) : open.add(id));
</script>

<svelte:head>
	<title>Currency score · Reports</title>
</svelte:head>

{#snippet bar(c: CurrencyCounts)}
	<div class="flex items-center gap-2">
		<div class="flex h-3 w-48 overflow-hidden rounded bg-gray-100 print:border">
			{#each CURRENCIES as k (k)}
				<div class={KIND[k].bar} style="width: {share(c, k)}%" title="{KIND[k].label}: {c.counts[k]}"></div>
			{/each}
		</div>
		<span class="w-10 text-right text-sm font-semibold tabular-nums">{pct(c.score)}</span>
	</div>
{/snippet}

<div class="space-y-4">
	<PageHeader title="Currency score" description="Share of installed products current with the LPAR's package, behind, outside it and out of support">
		{#snippet actions()}
			<span class="print:hidden flex gap-2">
				<Button href="/reports" variant="outline">All reports</Button>
				<Button href={exportUrl} variant="outline">CSV</Button>
				<Button variant="outline" onclick={() => window.print()}>Print</Button>
			</span>
		{/snippet}
	</PageHeader>

	<Card class="p-4 print:border-0 print:p-0 print:shadow-none">
		<ReportFilters asOf options={data.options} scope={data.scope} />
	</Card>

	<div class="grid grid-cols-2 gap-3 md:grid-cols-5">
		<Card class="p-4">
			<div class="text-xs text-muted-foreground">Score (current)</div>
			<div class="text-2xl font-semibold tabular-nums">{pct(report.total.score)}</div>
			<div class="text-xs text-muted-foreground">of {report.total.installed} installed</div>
		</Card>
		{#each CURRENCIES as k (k)}
			<Card class="p-4">
				<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
					<span class="inline-block h-2.5 w-2.5 rounded-sm {KIND[k].bar}"></span>{KIND[k].label}
				</div>
				<div class="text-2xl font-semibold tabular-nums {KIND[k].text}">{report.total.counts[k]}</div>
			</Card>
		{/each}
	</div>
	<p class="text-xs text-muted-foreground">
		Score = installed products matching (or ahead of) the LPAR's package ÷ all installed products. Out of support
		(the release's end-of-support date has passed) counts first, whatever the package says. LPARs without a package:
		everything is outside package.
	</p>

	{#if report.customers.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">No LPARs match the filters.</Card>
	{:else}
		<label class="flex items-center gap-1.5 text-sm print:hidden">
			<input type="checkbox" bind:checked={printAll} /> Print every customer's LPARs
		</label>
		<div class="overflow-auto rounded-md border print:overflow-visible">
			<table class="w-full text-sm">
				<thead class="text-left">
					<tr class="border-b">
						<th class="px-3 py-2">Customer / LPAR</th>
						<th class="px-3 py-2 text-right">Installed</th>
						{#each CURRENCIES as k (k)}
							<th class="px-2 py-2 text-right whitespace-nowrap">{KIND[k].label}</th>
						{/each}
						<th class="px-3 py-2">Score</th>
					</tr>
				</thead>
				<tbody>
					{#each report.customers as c (c.customer.id)}
						<tr class="border-b font-medium hover:bg-accent/40">
							<td class="px-3 py-1.5">
								<button type="button" class="hover:underline print:no-underline" onclick={() => toggle(c.customer.id)}>
									<span class="inline-block w-4 text-muted-foreground print:hidden">{open.has(c.customer.id) ? '▾' : '▸'}</span>{c.customer.name}
								</button>
								<span class="text-xs font-normal text-muted-foreground">{c.lpars.length} LPAR{c.lpars.length === 1 ? '' : 's'}</span>
							</td>
							<td class="px-3 py-1.5 text-right tabular-nums">{c.installed}</td>
							{#each CURRENCIES as k (k)}
								<td class="px-2 py-1.5 text-right tabular-nums {c.counts[k] ? KIND[k].text : 'text-gray-300'}">{c.counts[k]}</td>
							{/each}
							<td class="px-3 py-1.5">{@render bar(c)}</td>
						</tr>
						{#each c.lpars as l (l.lpar.id)}
							<tr
								class="border-b bg-gray-50 text-xs {open.has(c.customer.id) ? '' : 'hidden'} {printAll ? 'print:table-row' : ''}"
							>
								<td class="py-1 pl-10 pr-3">
									<a href="/reports/installed?customer={c.customer.id}&lpar={l.lpar.id}" class="text-primary hover:underline">{l.lpar.code}</a>
									<span class="text-muted-foreground">{l.lpar.package ? `${l.lpar.package.code} ${l.lpar.package.version}` : 'no package'}</span>
								</td>
								<td class="px-3 py-1 text-right tabular-nums">{l.installed}</td>
								{#each CURRENCIES as k (k)}
									<td class="px-2 py-1 text-right tabular-nums {l.counts[k] ? KIND[k].text : 'text-gray-300'}">{l.counts[k]}</td>
								{/each}
								<td class="px-3 py-1">{@render bar(l)}</td>
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
