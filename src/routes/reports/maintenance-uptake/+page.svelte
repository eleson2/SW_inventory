<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ReportFilters from '#lib/components/reports/ReportFilters.svelte';

	let { data }: { data: PageData } = $props();

	const exportUrl = $derived(`/reports/maintenance-uptake/export${page.url.search}`);
	const fmtDate = (d: Date) => new Date(d).toISOString().slice(0, 10);
	const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`);
</script>

<svelte:head>
	<title>Maintenance uptake · Reports</title>
</svelte:head>

<div class="space-y-4">
	<PageHeader title="Maintenance uptake" description="Per published RSU/CARS level: how many LPARs have reached it">
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

	<p class="text-xs text-muted-foreground">
		An LPAR reaches a level when every product of that vendor on it is at or above the level (same rule as
		<a href="/reports/maintenance-level{page.url.search}" class="text-primary hover:underline">Maintenance level per LPAR</a>).
		Only LPARs with products in the level are counted.
	</p>

	{#if data.vendors.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">
			No vendor levels to show. Import an RSU or CARS level on <a href="/bundles" class="text-primary hover:underline">Vendor bundles</a>.
		</Card>
	{:else}
		{#each data.vendors as v (v.id)}
			<section class="break-inside-avoid-page">
				<h2 class="mb-2 font-semibold">{v.name}</h2>
				<div class="overflow-auto rounded-md border print:overflow-visible">
					<table class="w-full text-sm">
						<thead class="text-left">
							<tr class="border-b">
								<th class="px-3 py-2">Level</th>
								<th class="px-3 py-2">Published</th>
								<th class="px-3 py-2 text-right">Age</th>
								<th class="px-3 py-2 text-right">LPARs reached</th>
								<th class="px-3 py-2">Uptake</th>
							</tr>
						</thead>
						<tbody>
							{#each v.levels as l (l.bundle.id)}
								<tr class="border-b">
									<td class="px-3 py-1.5 font-medium">
										<a href="/bundles/{l.bundle.id}" class="hover:underline">{l.bundle.code}</a>
									</td>
									<td class="px-3 py-1.5 tabular-nums">{fmtDate(l.bundle.release_date)}</td>
									<td class="px-3 py-1.5 text-right tabular-nums">{l.months} mo</td>
									<td class="px-3 py-1.5 text-right tabular-nums">{l.reached} of {l.lpars}</td>
									<td class="px-3 py-1.5">
										<div class="flex items-center gap-2">
											<div class="h-2 w-40 rounded bg-gray-100 print:border">
												<div class="h-2 rounded bg-slate-600" style="width: {pct(l.share)}"></div>
											</div>
											<span class="text-xs font-medium tabular-nums">{pct(l.share)}</span>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/each}
	{/if}
</div>
