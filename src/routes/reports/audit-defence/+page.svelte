<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ReportFilters from '#lib/components/reports/ReportFilters.svelte';
	import { versionText } from '#lib/utils/install-history.ts';

	let { data }: { data: PageData } = $props();

	const report = $derived(data.report);
	const exportUrl = $derived(`/reports/audit-defence/export${page.url.search}`);
	const reportDate = $derived(
		(data.scope.asOf ? new Date(data.scope.asOf) : new Date()).toISOString().slice(0, 10)
	);

	function setParam(key: string, value: string | null) {
		const params = new URLSearchParams(page.url.search);
		if (value) params.set(key, value);
		else params.delete(key);
		goto(`${page.url.pathname}?${params}`);
	}
	const fmt = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
</script>

<svelte:head>
	<title>Vendor audit defence · Reports</title>
</svelte:head>

<div class="space-y-4">
	<PageHeader title="Vendor audit defence" description="Proof of where each product is installed, and since when">
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
				<input type="checkbox" checked={data.showRemoved} onchange={(e) => setParam('removed', e.currentTarget.checked ? null : '0')} />
				Also earlier installs that were removed
			</label>
			<span class="text-muted-foreground">Tip: choose one vendor under Vendors for the audit you are answering.</span>
		</div>
		<ReportFilters asOf options={data.options} scope={data.scope} keep={['removed']} />
	</Card>

	<p class="text-sm">
		<span class="font-medium">Installed base as of {reportDate}</span>
		<span class="text-muted-foreground">
			· {plural(report.totals.products, 'product')}, {plural(report.totals.installs, 'install')} on {plural(report.totals.lpars, 'LPAR')}
		</span>
	</p>

	{#if report.vendors.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">No installed products for the selection.</Card>
	{/if}

	{#each report.vendors as v (v.vendor.id)}
		<section class="space-y-3 break-inside-avoid">
			<h2 class="text-lg font-semibold">
				{v.vendor.name}
				<span class="text-sm font-normal text-muted-foreground">
					{plural(v.products.filter((p) => p.installs.length).length, 'product')} on {plural(v.lpars, 'LPAR')}
				</span>
			</h2>
			{#each v.products.filter((p) => p.installs.length || data.showRemoved) as p (p.software.id)}
				<Card class="overflow-hidden p-0 break-inside-avoid">
					<div class="flex flex-wrap items-baseline gap-x-3 border-b bg-gray-50 px-4 py-2 print:bg-white">
						<h3 class="font-semibold">{p.software.name}</h3>
						{#if p.software.product_code}<span class="text-xs text-muted-foreground">{p.software.product_code}</span>{/if}
						<span class="text-sm text-muted-foreground">
							{plural(p.lpars, 'LPAR')}, {plural(p.customers, 'customer')}{#if p.releases.length} · releases {p.releases.join(', ')}{/if}
						</span>
					</div>
					{#if p.installs.length}
						<table class="w-full text-sm">
							<thead class="text-left text-xs text-muted-foreground">
								<tr class="border-b">
									<th class="px-3 py-1.5">Customer</th>
									<th class="px-3 py-1.5">LPAR</th>
									<th class="px-3 py-1.5">Env.</th>
									<th class="px-3 py-1.5">Release / PTF level</th>
									<th class="px-3 py-1.5">Installed since</th>
									<th class="px-3 py-1.5">On this release since</th>
									<th class="px-3 py-1.5">Last change</th>
								</tr>
							</thead>
							<tbody>
								{#each p.installs as i (i.lpar.id)}
									<tr class="border-b last:border-b-0">
										<td class="px-3 py-1">{i.lpar.customer.name}</td>
										<td class="px-3 py-1 font-medium" title={i.lpar.name}>
											<a href="/lpars/{i.lpar.id}/history" class="hover:underline">{i.lpar.code}</a>
										</td>
										<td class="px-3 py-1 text-muted-foreground">{i.lpar.environment ?? ''}</td>
										<td class="px-3 py-1 whitespace-nowrap">{versionText(i.version, i.ptf_level)}</td>
										<td class="px-3 py-1 tabular-nums whitespace-nowrap">
											{fmt(i.installedSince)}{#if i.rebuilt}<span
													class="text-muted-foreground"
													title="Rebuilt from data recorded before the install history existed: the product was there at least since this date">
													*</span
												>{/if}
										</td>
										<td class="px-3 py-1 tabular-nums">{fmt(i.releaseSince)}</td>
										<td class="px-3 py-1 tabular-nums">{fmt(i.lastChange)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
					{#if data.showRemoved && p.removed.length}
						<div class="border-t px-4 py-2 text-xs">
							<span class="font-medium">Removed earlier:</span>
							{p.removed
								.map((r) => `${r.lpar.code} (${r.lpar.customer.name}) ${versionText(r.version, r.ptf_level)}, ${fmt(r.from)} – ${fmt(r.to)}`)
								.join('; ')}
						</div>
					{/if}
				</Card>
			{/each}
		</section>
	{/each}

	<div class="space-y-1 text-xs text-muted-foreground">
		{#if report.totals.rebuilt > 0}
			<p>
				* {plural(report.totals.rebuilt, 'install date')} rebuilt from data recorded before the install history existed: the
				product was installed at least since that date, possibly earlier.
			</p>
		{/if}
		<p>Licence entitlements (what each customer may run) come with licences and contracts (D4).</p>
	</div>
</div>
