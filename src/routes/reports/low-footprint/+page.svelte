<script lang="ts">
	import type { PageData } from './$types';
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ReportFilters from '#lib/components/reports/ReportFilters.svelte';
	import { MAX_LPARS_LIMIT, environmentText, footprintReasons } from '#lib/utils/low-footprint.ts';

	let { data }: { data: PageData } = $props();

	const report = $derived(data.report);
	const exportUrl = $derived(`/reports/low-footprint/export${page.url.search}`);
	// Editable copy of the limit; follows the URL after Set
	let max = $state(untrack(() => data.report.maxLpars));
	$effect(() => {
		max = data.report.maxLpars;
	});

	function applyMax() {
		const params = new URLSearchParams(page.url.search);
		params.set('max', String(max));
		goto(`${page.url.pathname}?${params}`);
	}
	const whereUsed = (softwareId: string) => {
		const params = new URLSearchParams(page.url.search);
		params.delete('max');
		params.set('product', softwareId);
		return `/reports/where-used?${params}`;
	};
	const fmtDate = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
	const notSet = $derived(data.options.lpars.filter((l) => !l.environment).length);
</script>

<svelte:head>
	<title>Low-footprint products · Reports</title>
</svelte:head>

<div class="space-y-4">
	<PageHeader
		title="Low-footprint products"
		description="Products installed on few LPARs or only on test/dev: candidates to drop or consolidate"
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
		<form
			class="mb-3 flex flex-wrap items-end gap-2 border-b pb-3 text-sm print:hidden"
			onsubmit={(e) => {
				e.preventDefault();
				applyMax();
			}}
		>
			<label>
				<span class="mb-1 block text-xs font-medium text-muted-foreground">Few LPARs = at most</span>
				<input type="number" min="1" max={MAX_LPARS_LIMIT} bind:value={max} class="h-9 w-20 rounded-md border border-input px-2" />
			</label>
			<Button type="submit" variant="outline" disabled={!max || max === report.maxLpars}>Set</Button>
		</form>
		<ReportFilters options={data.options} scope={data.scope} keep={['max']} />
	</Card>

	<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
		<Card class="p-3">
			<div class="text-xs text-muted-foreground">On ≤ {report.maxLpars} LPAR{report.maxLpars === 1 ? '' : 's'}</div>
			<div class="text-2xl font-semibold tabular-nums">{report.rows.filter((r) => r.fewLpars).length}</div>
			<div class="text-xs text-muted-foreground">of {report.installedProducts} installed products</div>
		</Card>
		<Card class="p-3">
			<div class="text-xs text-muted-foreground">Only on test/dev</div>
			<div class="text-2xl font-semibold tabular-nums">{report.rows.filter((r) => r.nonProdOnly).length}</div>
		</Card>
		<Card class="p-3">
			<div class="text-xs text-muted-foreground">Not installed anywhere</div>
			<div class="text-2xl font-semibold tabular-nums">{report.notInstalled.length}</div>
		</Card>
	</div>

	{#if notSet > 0}
		<p class="text-xs text-muted-foreground">
			{notSet} LPAR{notSet === 1 ? ' has' : 's have'} no environment, so "test/dev only" may be incomplete. Set it on the LPAR's edit page.
		</p>
	{/if}

	{#if report.rows.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">No installed product is on {report.maxLpars} LPAR{report.maxLpars === 1 ? '' : 's'} or fewer, or only on test/dev.</Card>
	{:else}
		<div class="overflow-auto rounded-md border print:overflow-visible">
			<table class="w-full text-sm">
				<thead class="text-left">
					<tr class="border-b">
						<th class="px-3 py-2">Product</th>
						<th class="px-3 py-2">Vendor</th>
						<th class="px-3 py-2">Category</th>
						<th class="px-3 py-2 text-right">LPARs</th>
						<th class="px-3 py-2 text-right">Customers</th>
						<th class="px-3 py-2">Environments</th>
						<th class="px-3 py-2">Last installed / changed</th>
						<th class="px-3 py-2">Why listed</th>
					</tr>
				</thead>
				<tbody>
					{#each report.rows as r (r.software.id)}
						<tr class="border-b">
							<td class="px-3 py-1.5">
								<a href={whereUsed(r.software.id)} class="font-medium text-primary hover:underline">{r.software.name}</a>
							</td>
							<td class="px-3 py-1.5">{r.software.vendor.name}</td>
							<td class="px-3 py-1.5 {r.software.category ? '' : 'text-muted-foreground'}">{r.software.category?.name ?? 'Unclassified'}</td>
							<td class="px-3 py-1.5 text-right tabular-nums">{r.lpars}</td>
							<td class="px-3 py-1.5 text-right tabular-nums">{r.customers}</td>
							<td class="px-3 py-1.5 whitespace-nowrap">{environmentText(r.environments)}</td>
							<td class="px-3 py-1.5 whitespace-nowrap tabular-nums">{fmtDate(r.lastChange)}</td>
							<td class="px-3 py-1.5">
								{#each footprintReasons(r, report.maxLpars) as reason (reason)}
									<span
										class="mr-1 inline-block rounded px-1.5 text-xs {reason.startsWith('Overlaps')
											? 'bg-amber-100 text-amber-900'
											: reason === 'Test/dev only'
												? 'bg-blue-100 text-blue-900'
												: 'bg-gray-100 text-gray-800'}">{reason}</span
									>
								{/each}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="text-xs text-muted-foreground">
			"Overlaps (V3)": another vendor's product of the same category is installed too; see
			<a href="/reports/overlap{page.url.search}" class="text-primary hover:underline">Overlapping products</a>.
		</p>
	{/if}

	{#if report.notInstalled.length > 0}
		<Card class="p-4 break-inside-avoid">
			<h2 class="mb-1 font-semibold">Not installed anywhere</h2>
			<p class="mb-3 text-xs text-muted-foreground">
				Active products in the catalogue that no LPAR in the selection runs. Those in a package may be on their way; the rest may be licensed for nothing.
			</p>
			<table class="w-full text-sm">
				<thead class="text-left">
					<tr class="border-b">
						<th class="px-3 py-2">Product</th>
						<th class="px-3 py-2">Vendor</th>
						<th class="px-3 py-2">Category</th>
						<th class="px-3 py-2 text-right">In active packages</th>
					</tr>
				</thead>
				<tbody>
					{#each report.notInstalled as n (n.software.id)}
						<tr class="border-b last:border-b-0">
							<td class="px-3 py-1.5">
								<a href="/software/{n.software.id}" class="font-medium text-primary hover:underline">{n.software.name}</a>
							</td>
							<td class="px-3 py-1.5">{n.software.vendor.name}</td>
							<td class="px-3 py-1.5 {n.software.category ? '' : 'text-muted-foreground'}">{n.software.category?.name ?? 'Unclassified'}</td>
							<td class="px-3 py-1.5 text-right tabular-nums">{n.packages || '–'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</Card>
	{/if}
</div>
