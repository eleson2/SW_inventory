<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ReportFilters from '#lib/components/reports/ReportFilters.svelte';
	import { OPEN_ROLLBACK_FLAG_DAYS } from '#lib/utils/rollbacks.ts';

	let { data }: { data: PageData } = $props();

	const rows = $derived(data.rows);
	const flagged = $derived(rows.filter((r) => r.flagged).length);
	const exportUrl = $derived(`/reports/open-rollbacks/export${page.url.search}`);

	const fmtDate = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : 'unknown');
	const level = (v: string | null, p: string | null) => [v, p].filter(Boolean).join(' ') || '?';
</script>

<svelte:head>
	<title>Open rollbacks · Reports</title>
	<style>
		@media print {
			@page { size: landscape; margin: 10mm; }
		}
	</style>
</svelte:head>

<div class="space-y-4">
	<PageHeader title="Open rollbacks" description="Rolled-back software not reapplied yet, oldest first">
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

	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		<Card class="p-4">
			<div class="text-xs text-muted-foreground">Open rollbacks</div>
			<div class="text-2xl font-semibold tabular-nums">{rows.length}</div>
		</Card>
		<div class="rounded-md border p-4 {flagged > 0 ? 'border-red-300 bg-red-50 text-red-900' : ''}">
			<div class="text-xs">Open longer than {OPEN_ROLLBACK_FLAG_DAYS} days</div>
			<div class="text-2xl font-semibold tabular-nums">{flagged}</div>
		</div>
	</div>

	{#if rows.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">No open rollbacks for the selected LPARs and software.</Card>
	{:else}
		<div class="overflow-auto rounded-md border print:overflow-visible">
			<table class="w-full text-sm">
				<thead class="text-left">
					<tr class="border-b">
						<th class="px-3 py-2">Rolled back</th>
						<th class="px-3 py-2 text-right">Days open</th>
						<th class="px-3 py-2">Customer</th>
						<th class="px-3 py-2">LPAR</th>
						<th class="px-3 py-2">Product</th>
						<th class="px-3 py-2">Rolled back from</th>
						<th class="px-3 py-2">Running now</th>
						<th class="px-3 py-2">Reason</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as r (`${r.lpar.id}|${r.software.id}`)}
						<tr class="border-b align-top {r.flagged ? 'bg-red-50' : ''}">
							<td class="px-3 py-1.5 whitespace-nowrap tabular-nums">{fmtDate(r.at)}</td>
							<td class="px-3 py-1.5 text-right tabular-nums">
								{#if r.ageDays !== null}
									<span class={r.flagged ? 'font-semibold text-red-800' : ''}>{r.ageDays}</span>
								{/if}
							</td>
							<td class="px-3 py-1.5">{r.lpar.customer.name}</td>
							<td class="px-3 py-1.5 font-medium">
								<a href="/lpars/{r.lpar.id}" class="text-primary hover:underline">{r.lpar.code}</a>
							</td>
							<td class="px-3 py-1.5">
								{r.software.name}
								<div class="text-xs text-muted-foreground">{r.software.vendor.name}</div>
							</td>
							<td class="px-3 py-1.5 whitespace-nowrap">{level(r.from_version, r.from_ptf)}</td>
							<td class="px-3 py-1.5 whitespace-nowrap">{level(r.to_version, r.to_ptf)}</td>
							<td class="px-3 py-1.5">{r.reason ?? ''}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
