<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ReportFilters from '#lib/components/reports/ReportFilters.svelte';

	let { data }: { data: PageData } = $props();

	let perCustomer = $state(false);

	const totals = $derived(data.base.totals);
	const customers = $derived(data.base.customers);
	const pct = (n: number) => `${Math.round(n * 100)}%`;
	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

	const scopeText = $derived.by(() => {
		const vendors = data.options.vendors.filter((v) => data.scope.vendorIds.includes(v.id)).map((v) => v.name);
		const custs = data.options.customers.filter((c) => data.scope.customerIds.includes(c.id)).map((c) => c.name);
		const set = data.options.sets.find((s) => s.id === data.scope.setId)?.name;
		return [
			vendors.length ? vendors.join(', ') : 'All vendors',
			set ? `set “${set}”` : custs.length ? custs.join(', ') : 'all customers'
		].join(' · ');
	});
	const exportUrl = $derived(`/reports/vendor-base/export${page.url.search}`);
	const tiles = $derived([
		{ label: 'Products installed', value: String(totals.products) },
		{ label: 'LPARs running them', value: String(totals.lpars) },
		{ label: 'Customers', value: String(totals.customers) },
		{
			label: 'Installs on the current release',
			value: totals.installs ? pct(totals.onCurrent / totals.installs) : '–',
			hint: `${totals.onCurrent} of ${totals.installs}`
		}
	]);
	const ptfText = (r: { oldest: string | null; newest: string | null }) =>
		!r.oldest ? '' : r.oldest === r.newest ? r.oldest : `${r.oldest} – ${r.newest}`;
</script>

<svelte:head>
	<title>Vendor installed base · Reports</title>
	<style>
		@media print {
			@page { size: landscape; margin: 10mm; }
		}
	</style>
</svelte:head>

<div class="space-y-4">
	<PageHeader title="Vendor installed base" description={scopeText}>
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

	<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
		{#each tiles as tile (tile.label)}
			<Card class="p-4">
				<div class="text-xs text-muted-foreground">{tile.label}</div>
				<div class="text-2xl font-semibold tabular-nums">{tile.value}</div>
				{#if tile.hint}<div class="text-xs text-muted-foreground">{tile.hint}</div>{/if}
			</Card>
		{/each}
	</div>

	<label class="flex items-center gap-1.5 text-sm print:hidden">
		<input type="checkbox" bind:checked={perCustomer} /> Per customer
	</label>

	{#if data.base.vendors.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">No installed software matches the filters.</Card>
	{:else}
		<div class="overflow-auto max-h-[75vh] rounded-md border print:max-h-none print:overflow-visible">
			<table class="w-full text-sm border-separate border-spacing-0">
				<thead class="sticky top-0 z-20 bg-white text-left">
					<tr>
						<th class="sticky left-0 z-30 bg-white border-b border-r px-3 py-2">Product</th>
						<th class="border-b px-3 py-2">Release</th>
						{#if perCustomer}
							{#each customers as c (c.id)}
								<th class="border-b px-2 py-2 text-right whitespace-nowrap" title={c.code}>{c.name}</th>
							{/each}
							<th class="border-b border-l px-3 py-2 text-right">Total</th>
						{:else}
							<th class="border-b px-3 py-2 text-right">LPARs</th>
							<th class="border-b px-3 py-2 text-right">Customers</th>
							<th class="border-b px-3 py-2">Share of the product's LPARs</th>
							<th class="border-b px-3 py-2">PTF levels</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each data.base.vendors as group (group.vendor.id)}
						<tr>
							<th
								colspan={perCustomer ? customers.length + 3 : 6}
								class="sticky left-0 bg-gray-50 border-b px-3 py-1 text-left font-semibold"
							>
								{group.vendor.name}
								<span class="font-normal text-muted-foreground">· {plural(group.products.length, 'product')}</span>
							</th>
						</tr>
						{#each group.products as product (product.software.id)}
							{#each product.releases as r, i (r.release)}
								<tr class="hover:bg-accent/40 align-top">
									{#if i === 0}
										<th
											rowspan={product.releases.length}
											class="sticky left-0 z-10 bg-white border-b border-r px-3 py-1.5 text-left font-normal"
										>
											<a href="/software/{product.software.id}" class="hover:underline">{product.software.name}</a>
											{#if product.software.product_code}
												<span class="ml-1 text-xs text-muted-foreground">{product.software.product_code}</span>
											{/if}
											<div class="text-xs text-muted-foreground">
												{plural(product.lparCount, 'LPAR')} · {plural(product.customerCount, 'customer')}
											</div>
										</th>
									{/if}
									<td class="border-b px-3 py-1.5 whitespace-nowrap">
										{r.release}
										{#if r.isCurrent}
											<span class="ml-1 rounded bg-green-100 px-1.5 text-xs text-green-800">current</span>
										{/if}
									</td>
									{#if perCustomer}
										{#each customers as c (c.id)}
											{@const cell = r.byCustomer[c.id]}
											<td
												class="border-b px-2 py-1.5 text-right tabular-nums {cell ? '' : 'text-gray-300'}"
												title={cell ? `${cell.lparCodes.join(', ')}${ptfText(cell) ? `\nPTF ${ptfText(cell)}` : ''}` : ''}
											>
												{cell ? cell.lparCodes.length : '·'}
											</td>
										{/each}
										<td class="border-b border-l px-3 py-1.5 text-right font-medium tabular-nums">{r.lparCount}</td>
									{:else}
										<td class="border-b px-3 py-1.5 text-right tabular-nums" title={r.lparCodes.join(', ')}>{r.lparCount}</td>
										<td class="border-b px-3 py-1.5 text-right tabular-nums">{r.customerCount}</td>
										<td class="border-b px-3 py-1.5">
											<div class="flex items-center gap-2">
												<div class="h-2 w-32 rounded bg-gray-100 print:border">
													<div class="h-2 rounded {r.isCurrent ? 'bg-green-600' : 'bg-gray-400'}" style="width: {pct(r.share)}"></div>
												</div>
												<span class="tabular-nums text-xs">{pct(r.share)}</span>
											</div>
										</td>
										<td class="border-b px-3 py-1.5 whitespace-nowrap text-xs">{ptfText(r)}</td>
									{/if}
								</tr>
							{/each}
						{/each}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
