<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ReportFilters from '#lib/components/reports/ReportFilters.svelte';

	let { data }: { data: PageData } = $props();

	const rows = $derived(data.rows);
	const exportUrl = $derived(`/reports/version-sprawl/export${page.url.search}`);
	const whereUsed = (softwareId: string) => {
		const params = new URLSearchParams(page.url.search);
		params.set('product', softwareId);
		return `/reports/where-used?${params}`;
	};
	/** Shades for the spread bar, most-used level darkest */
	const SHADES = ['bg-slate-700', 'bg-slate-500', 'bg-slate-400', 'bg-slate-300', 'bg-slate-200'];
</script>

<svelte:head>
	<title>Version sprawl · Reports</title>
</svelte:head>

<div class="space-y-4">
	<PageHeader title="Version sprawl" description="Distinct releases and PTF levels per product, most levels first">
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

	{#if rows.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">No installed software matches the filters.</Card>
	{:else}
		<p class="text-xs text-muted-foreground">
			The bar shows how the LPARs spread over the levels; hover a segment for the level. Click a product for where it is used.
		</p>
		<div class="overflow-auto rounded-md border print:overflow-visible">
			<table class="w-full text-sm">
				<thead class="text-left">
					<tr class="border-b">
						<th class="px-3 py-2">Vendor</th>
						<th class="px-3 py-2">Product</th>
						<th class="px-3 py-2 text-right">Releases</th>
						<th class="px-3 py-2 text-right">Levels</th>
						<th class="px-3 py-2 text-right">LPARs</th>
						<th class="px-3 py-2">Spread</th>
						<th class="px-3 py-2">Oldest</th>
						<th class="px-3 py-2">Newest</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as r (r.software.id)}
						<tr class="border-b {r.levels.length > 1 ? '' : 'text-muted-foreground'}">
							<td class="px-3 py-1.5">{r.software.vendor.name}</td>
							<td class="px-3 py-1.5">
								<a href={whereUsed(r.software.id)} class="font-medium text-primary hover:underline">{r.software.name}</a>
							</td>
							<td class="px-3 py-1.5 text-right tabular-nums">{r.releases}</td>
							<td class="px-3 py-1.5 text-right tabular-nums font-semibold">{r.levels.length}</td>
							<td class="px-3 py-1.5 text-right tabular-nums">{r.lpars}</td>
							<td class="px-3 py-1.5">
								<div class="flex h-3 w-40 overflow-hidden rounded print:border">
									{#each r.levels as l, i (`${l.release}|${l.ptf}`)}
										<div
											class="{SHADES[Math.min(i, SHADES.length - 1)]} border-r border-white last:border-r-0"
											style="width: {(l.lpars / r.lpars) * 100}%"
											title="{l.release}{l.ptf ? ` ${l.ptf}` : ''}: {l.lpars} LPAR{l.lpars === 1 ? '' : 's'}"
										></div>
									{/each}
								</div>
							</td>
							<td class="px-3 py-1.5 whitespace-nowrap">{r.oldest}</td>
							<td class="px-3 py-1.5 whitespace-nowrap">{r.newest}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
