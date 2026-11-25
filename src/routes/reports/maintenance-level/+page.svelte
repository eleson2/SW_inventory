<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ReportFilters from '#lib/components/reports/ReportFilters.svelte';
	import { LEVEL_FRESH_MONTHS, LEVEL_STALE_MONTHS, type LevelAge } from '#lib/utils/maintenance-level.ts';

	let { data }: { data: PageData } = $props();

	const report = $derived(data.report);
	const exportUrl = $derived(`/reports/maintenance-level/export${page.url.search}`);

	const AGE: Record<LevelAge, string> = {
		fresh: 'bg-green-100 text-green-900',
		aging: 'bg-amber-100 text-amber-900',
		stale: 'bg-red-100 text-red-800',
		below: 'bg-red-200 text-red-900'
	};
	const fmtDate = (d: Date) => new Date(d).toISOString().slice(0, 10);
	const matrixUrl = (lpar: { id: string; customer: { id: string } }) =>
		`/reports/installed?customer=${lpar.customer.id}&lpar=${lpar.id}`;
</script>

<svelte:head>
	<title>Maintenance level per LPAR · Reports</title>
	<style>
		@media print {
			@page { size: landscape; margin: 10mm; }
		}
	</style>
</svelte:head>

<div class="space-y-4">
	<PageHeader
		title="Maintenance level per LPAR"
		description="Per vendor, the newest maintenance level (RSU, CARS) that every product on the LPAR reaches, and its age"
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
		<ReportFilters options={data.options} scope={data.scope} />
	</Card>

	{#if report.vendors.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">
			No vendor levels to compare with. Import an RSU or CARS level on <a href="/bundles" class="text-primary hover:underline">Vendor bundles</a>.
		</Card>
	{:else}
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{#each report.vendors as v (v.id)}
				<div class="rounded-md border p-4 {v.staleLpars > 0 ? 'border-red-300 bg-red-50 text-red-900' : ''}">
					<div class="text-xs">{v.name}: LPARs over {LEVEL_STALE_MONTHS} months behind</div>
					<div class="text-2xl font-semibold tabular-nums">{v.staleLpars}</div>
					<div class="text-xs opacity-75">newest level {v.latest.code} ({fmtDate(v.latest.release_date)})</div>
				</div>
			{/each}
		</div>

		<p class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
			Age of the level:
			<span class="rounded px-1.5 {AGE.fresh}">under {LEVEL_FRESH_MONTHS} months</span>
			<span class="rounded px-1.5 {AGE.aging}">{LEVEL_FRESH_MONTHS}–{LEVEL_STALE_MONTHS} months</span>
			<span class="rounded px-1.5 {AGE.stale}">over {LEVEL_STALE_MONTHS} months</span>
			<span class="rounded px-1.5 {AGE.below}">below oldest known level</span>
			· Hover a cell for the products below the newest level.
		</p>

		<div class="overflow-auto rounded-md border print:overflow-visible">
			<table class="w-full text-sm">
				<thead class="text-left">
					<tr class="border-b">
						<th class="px-3 py-2">Customer</th>
						<th class="px-3 py-2">LPAR</th>
						{#each report.vendors as v (v.id)}
							<th class="px-3 py-2">{v.name}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each report.rows as row (row.lpar.id)}
						<tr class="border-b hover:bg-accent/40">
							<td class="px-3 py-1.5">{row.lpar.customer.name}</td>
							<td class="px-3 py-1.5 font-medium">
								<a href={matrixUrl(row.lpar)} class="text-primary hover:underline" title={row.lpar.name}>{row.lpar.code}</a>
							</td>
							{#each report.vendors as v (v.id)}
								{@const cell = row.cells[v.id]}
								<td class="px-3 py-1.5 whitespace-nowrap">
									{#if !cell}
										<span class="text-gray-300">–</span>
									{:else}
										<span
											class="rounded px-1.5 py-0.5 {AGE[cell.age]}"
											title={cell.behindLatest.length
												? `Below ${v.latest.code}: ${cell.behindLatest.join(', ')}`
												: `All ${cell.products} product(s) at ${v.latest.code}`}
										>
											{#if cell.bundle}
												<span class="font-medium">{cell.bundle.code}</span> · {cell.months} mo
											{:else}
												below oldest known level
											{/if}
										</span>
										{#if cell.behindLatest.length}
											<span class="ml-1 text-xs text-muted-foreground">{cell.behindLatest.length} behind</span>
										{/if}
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
