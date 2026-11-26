<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ReportFilters from '#lib/components/reports/ReportFilters.svelte';

	let { data }: { data: PageData } = $props();

	const report = $derived(data.report);
	const exportUrl = $derived(`/reports/overlap/export${page.url.search}`);
	const lparById = $derived(new Map(report.lpars.map((l) => [l.id, l])));

	function setParam(key: string, value: string | null) {
		const params = new URLSearchParams(page.url.search);
		if (value) params.set(key, value);
		else params.delete(key);
		goto(`${page.url.pathname}?${params}`);
	}
	const whereUsed = (softwareId: string) => {
		const params = new URLSearchParams(page.url.search);
		['same', 'view'].forEach((k) => params.delete(k));
		params.set('product', softwareId);
		return `/reports/where-used?${params}`;
	};
	const pct = (n: number) => `${Math.round(n * 100)}%`;
	const lparsOf = (ids: string[]) =>
		ids
			.map((id) => lparById.get(id)!)
			.sort((a, b) => a.customer.name.localeCompare(b.customer.name) || a.code.localeCompare(b.code));
	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
</script>

<svelte:head>
	<title>Overlapping products · Reports</title>
</svelte:head>

<div class="space-y-4">
	<PageHeader
		title="Overlapping products"
		description="Installed products of the same category from different vendors: candidates for consolidation and negotiation"
	>
		{#snippet actions()}
			<span class="print:hidden flex gap-2">
				<Button href="/reports" variant="outline">All reports</Button>
				<Button href={exportUrl} variant="outline">CSV</Button>
				<Button variant="outline" onclick={() => window.print()}>Print</Button>
			</span>
		{/snippet}
	</PageHeader>

	<Card class="p-4 print:border-0 print:p-0 print:shadow-none">
		<div class="mb-3 flex flex-wrap items-center gap-5 border-b pb-3 text-sm print:hidden">
			<label class="flex items-center gap-2">
				<input type="checkbox" checked={data.sameVendor} onchange={(e) => setParam('same', e.currentTarget.checked ? '1' : null)} />
				Also products of the same vendor
			</label>
			<label class="flex items-center gap-2">
				<input type="checkbox" checked={data.perLpar} onchange={(e) => setParam('view', e.currentTarget.checked ? 'lpar' : null)} />
				Per LPAR
			</label>
		</div>
		<ReportFilters options={data.options} scope={data.scope} keep={['same', 'view']} />
	</Card>

	<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
		<Card class="p-3">
			<div class="text-xs text-muted-foreground">Categories with overlap</div>
			<div class="text-2xl font-semibold tabular-nums">{report.categories.length}</div>
		</Card>
		<Card class="p-3">
			<div class="text-xs text-muted-foreground">Products involved</div>
			<div class="text-2xl font-semibold tabular-nums">{report.productsInvolved}</div>
		</Card>
		<Card class="p-3">
			<div class="text-xs text-muted-foreground">LPARs running overlapping products side by side</div>
			<div class="text-2xl font-semibold tabular-nums">{report.lparsWithOverlap}</div>
		</Card>
	</div>

	{#if report.categories.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">
			No category has installed products from {data.sameVendor ? 'more than one product' : 'more than one vendor'} in the selection.
		</Card>
	{/if}

	{#each report.categories as c (c.category.id)}
		<Card class="p-0 overflow-hidden break-inside-avoid">
			<div class="flex flex-wrap items-baseline gap-x-3 border-b bg-gray-50 px-4 py-2">
				<h2 class="font-semibold">{c.category.name}</h2>
				<span class="text-sm text-muted-foreground">
					{plural(c.products.length, 'product')} from {plural(c.vendors, 'vendor')} on {plural(c.lparIds.length, 'LPAR')}
				</span>
				{#if c.sideBySide.length}
					<span class="text-sm font-medium text-amber-800">{c.sideBySide.length} side by side</span>
				{/if}
			</div>
			{#if data.perLpar}
				<div class="overflow-auto">
					<table class="w-full text-sm">
						<thead class="text-left">
							<tr class="border-b">
								<th class="px-3 py-2">Customer</th>
								<th class="px-3 py-2">LPAR</th>
								{#each c.products as p (p.software.id)}
									<th class="px-3 py-2 text-center" title={p.software.vendor.name}>
										{p.software.name}<span class="block text-xs font-normal text-muted-foreground">{p.software.vendor.code}</span>
									</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each lparsOf(c.lparIds) as l (l.id)}
								{@const both = c.sideBySide.includes(l.id)}
								<tr class="border-b {both ? 'bg-amber-50' : ''}">
									<td class="px-3 py-1.5">{l.customer.name}</td>
									<td class="px-3 py-1.5 font-medium" title={l.name}>{l.code}</td>
									{#each c.products as p (p.software.id)}
										<td class="px-3 py-1.5 text-center">{p.lparIds.includes(l.id) ? '✓' : ''}</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<table class="w-full text-sm">
					<thead class="text-left">
						<tr class="border-b">
							<th class="px-3 py-2">Product</th>
							<th class="px-3 py-2">Vendor</th>
							<th class="px-3 py-2 text-right">LPARs</th>
							<th class="px-3 py-2 text-right">Customers</th>
							<th class="px-3 py-2 text-right">Share of the category's LPARs</th>
							<th class="px-3 py-2">Also on the same LPARs</th>
						</tr>
					</thead>
					<tbody>
						{#each c.products as p (p.software.id)}
							<tr class="border-b last:border-b-0">
								<td class="px-3 py-1.5">
									<a href={whereUsed(p.software.id)} class="font-medium text-primary hover:underline">{p.software.name}</a>
								</td>
								<td class="px-3 py-1.5">{p.software.vendor.name}</td>
								<td class="px-3 py-1.5 text-right tabular-nums">{p.lparIds.length}</td>
								<td class="px-3 py-1.5 text-right tabular-nums">{p.customers}</td>
								<td class="px-3 py-1.5 text-right tabular-nums">{pct(p.share)}</td>
								<td class="px-3 py-1.5 {p.alsoOn.length ? 'text-amber-800' : 'text-muted-foreground'}">
									{#if p.alsoOn.length}
										{p.alsoOn.map((o) => `${o.software.name} (${plural(o.lpars, 'LPAR')})`).join(', ')}
									{:else}—{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</Card>
	{/each}

	{#if report.unclassified > 0}
		<p class="text-xs text-muted-foreground">
			{plural(report.unclassified, 'installed product')} without a category {report.unclassified === 1 ? 'is' : 'are'} not included.
			<a href="/software/categories" class="text-primary hover:underline print:hidden">Classify products</a>
		</p>
	{/if}
</div>
