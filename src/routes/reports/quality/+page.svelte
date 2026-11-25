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
	const exportUrl = $derived(`/reports/quality/export${page.url.search}`);

	let from = $state('');
	let to = $state('');
	// Follow the period in the URL (also after Back/Forward)
	$effect.pre(() => {
		from = data.from;
		to = data.to;
	});
	let showEach = $state(false);

	function applyPeriod() {
		const params = new URLSearchParams(page.url.search);
		params.set('from', from);
		params.set('to', to);
		goto(`${page.url.pathname}?${params}`);
	}

	const fmtDate = (d: Date) => new Date(d).toISOString().slice(0, 10);
	const level = (v: string | null, p: string | null) => [v, p].filter(Boolean).join(' ') || '?';
</script>

<svelte:head>
	<title>Quality record · Reports</title>
	<style>
		@media print {
			@page { size: landscape; margin: 10mm; }
		}
	</style>
</svelte:head>

<div class="space-y-4">
	<PageHeader title="Quality record" description="Rollbacks per vendor and product in a chosen period">
		{#snippet actions()}
			<span class="print:hidden flex gap-2">
				<Button href="/reports" variant="outline">All reports</Button>
				<Button href={exportUrl} variant="outline">CSV</Button>
				<Button variant="outline" onclick={() => window.print()}>Print</Button>
			</span>
		{/snippet}
	</PageHeader>

	<Card class="p-4 print:border-0 print:p-0 print:shadow-none">
		<ReportFilters options={data.options} scope={data.scope} keep={['from', 'to']} />
		<div class="mt-3 flex flex-wrap items-end gap-2 border-t pt-3 text-sm print:hidden">
			<label>
				<span class="mb-1 block text-xs font-medium text-muted-foreground">From</span>
				<input type="date" class="h-9 rounded-md border border-input px-2" bind:value={from} max={to} />
			</label>
			<label>
				<span class="mb-1 block text-xs font-medium text-muted-foreground">To</span>
				<input type="date" class="h-9 rounded-md border border-input px-2" bind:value={to} min={from} />
			</label>
			<Button variant="outline" onclick={applyPeriod} disabled={!from || !to || (from === data.from && to === data.to)}>
				Apply period
			</Button>
		</div>
		<p class="mt-2 text-sm">Period: {data.from} to {data.to}</p>
	</Card>

	<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
		<Card class="p-4">
			<div class="text-xs text-muted-foreground">Rollbacks</div>
			<div class="text-2xl font-semibold tabular-nums">{report.totals.rollbacks}</div>
		</Card>
		<Card class="p-4">
			<div class="text-xs text-muted-foreground">Products rolled back</div>
			<div class="text-2xl font-semibold tabular-nums">{report.totals.products}</div>
		</Card>
		<Card class="p-4">
			<div class="text-xs text-muted-foreground">LPARs affected</div>
			<div class="text-2xl font-semibold tabular-nums">{report.totals.lpars}</div>
		</Card>
	</div>

	{#if report.rows.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">No rollbacks in this period for the selected LPARs and software.</Card>
	{:else}
		<label class="flex items-center gap-1.5 text-sm print:hidden">
			<input type="checkbox" bind:checked={showEach} /> Show each rollback (always shown when printed)
		</label>
		<div class="overflow-auto rounded-md border print:overflow-visible">
			<table class="w-full text-sm">
				<thead class="text-left">
					<tr class="border-b">
						<th class="px-3 py-2">Vendor</th>
						<th class="px-3 py-2">Product</th>
						<th class="px-3 py-2 text-right">Rollbacks</th>
						<th class="px-3 py-2 text-right">LPARs</th>
						<th class="px-3 py-2 text-right">Customers</th>
						<th class="px-3 py-2">Latest</th>
						<th class="px-3 py-2">Latest reason</th>
					</tr>
				</thead>
				<tbody>
					{#each report.rows as row (row.software.id)}
						<tr class="border-b align-top font-medium">
							<td class="px-3 py-1.5">{row.software.vendor.name}</td>
							<td class="px-3 py-1.5">
								<a href="/software/{row.software.id}" class="hover:underline">{row.software.name}</a>
							</td>
							<td class="px-3 py-1.5 text-right tabular-nums">{row.rollbacks}</td>
							<td class="px-3 py-1.5 text-right tabular-nums">{row.lparCount}</td>
							<td class="px-3 py-1.5 text-right tabular-nums">{row.customerCount}</td>
							<td class="px-3 py-1.5 whitespace-nowrap tabular-nums">{fmtDate(row.latest)}</td>
							<td class="px-3 py-1.5 font-normal">{row.events[0].reason ?? ''}</td>
						</tr>
						{#each row.events as e, i (i)}
							<tr class="border-b bg-gray-50 text-xs {showEach ? '' : 'hidden print:table-row'}">
								<td></td>
								<td class="px-3 py-1 whitespace-nowrap tabular-nums">{fmtDate(e.at)}</td>
								<td colspan="3" class="px-3 py-1">{e.lpar.code} <span class="text-muted-foreground">({e.lpar.customer.name})</span></td>
								<td class="px-3 py-1 whitespace-nowrap">{level(e.from_version, e.from_ptf)} → {level(e.to_version, e.to_ptf)}</td>
								<td class="px-3 py-1">{e.reason ?? ''}</td>
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
