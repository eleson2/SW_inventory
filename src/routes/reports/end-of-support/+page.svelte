<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ReportFilters from '#lib/components/reports/ReportFilters.svelte';
	import { EOS_WARNING_MONTHS, type EosStatus } from '#lib/utils/end-of-support.ts';

	let { data }: { data: PageData } = $props();

	let showUnknown = $state(true);
	/** V5 support-date exposure: the same rows per vendor */
	let byVendor = $state(page.url.searchParams.get('group') === 'vendor');

	const report = $derived(data.report);
	const rows = $derived(showUnknown ? report.rows : report.rows.filter((r) => r.status !== 'unknown'));
	const exportUrl = $derived(`/reports/end-of-support/export${page.url.search}`);
	const groups = $derived.by(() => {
		if (!byVendor) return [{ vendor: null, rows, atRisk: 0 }];
		const map = new Map<string, { vendor: (typeof rows)[number]['software']['vendor']; rows: typeof rows }>();
		for (const row of rows) {
			const v = row.software.vendor;
			let g = map.get(v.id);
			if (!g) map.set(v.id, (g = { vendor: v, rows: [] }));
			g.rows.push(row);
		}
		return [...map.values()]
			.map((g) => ({ ...g, atRisk: g.rows.filter((r) => r.status === 'past' || r.status === 'soon').length }))
			.sort((a, b) => b.atRisk - a.atRisk || a.vendor.name.localeCompare(b.vendor.name));
	});

	const STATUS: Record<EosStatus, { label: string; tile: string; row: string; badge: string }> = {
		past: { label: 'Out of support', tile: 'border-red-300 bg-red-50 text-red-900', row: 'bg-red-50', badge: 'bg-red-100 text-red-800' },
		soon: {
			label: `Ends within ${EOS_WARNING_MONTHS} months`,
			tile: 'border-amber-300 bg-amber-50 text-amber-900',
			row: 'bg-amber-50',
			badge: 'bg-amber-100 text-amber-900'
		},
		later: { label: `Supported beyond ${EOS_WARNING_MONTHS} months`, tile: '', row: '', badge: 'bg-green-100 text-green-800' },
		unknown: { label: 'No date recorded', tile: '', row: '', badge: 'bg-gray-100 text-gray-600' }
	};
	const TILES: EosStatus[] = ['past', 'soon', 'later', 'unknown'];

	const fmtDate = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
	function remaining(months: number | null) {
		if (months === null) return '';
		if (months < 0) return `ended ${-months} month${months === -1 ? '' : 's'} ago`;
		if (months === 0) return 'this month';
		return `in ${months} month${months === 1 ? '' : 's'}`;
	}
	const MAX_CODES = 6;
</script>

<svelte:head>
	<title>End-of-support horizon · Reports</title>
	<style>
		@media print {
			@page { size: landscape; margin: 10mm; }
		}
	</style>
</svelte:head>

<div class="space-y-4">
	<PageHeader
		title="End-of-support horizon"
		description="Installed releases by end-of-support date; out of support and ending within {EOS_WARNING_MONTHS} months highlighted"
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

	<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
		{#each TILES as s (s)}
			<div class="rounded-md border p-4 {STATUS[s].tile}">
				<div class="text-xs">{STATUS[s].label}</div>
				<div class="text-2xl font-semibold tabular-nums">{report.counts[s]}</div>
				<div class="text-xs opacity-75">installed release{report.counts[s] === 1 ? '' : 's'}</div>
			</div>
		{/each}
	</div>
	{#if report.lparsAtRisk > 0}
		<p class="text-sm">
			<span class="font-medium">{report.lparsAtRisk} LPAR{report.lparsAtRisk === 1 ? '' : 's'}</span>
			run a release that is out of support or ends within {EOS_WARNING_MONTHS} months.
		</p>
	{/if}
	{#if report.counts.unknown > 0}
		<p class="text-sm text-muted-foreground print:hidden">
			{report.counts.unknown} installed release{report.counts.unknown === 1 ? ' has' : 's have'} no end-of-support date.
			Set it with “Set date” below, on the software’s Add version page, or with the
			<code>end_of_support</code> column of a bundle CSV import.
		</p>
	{/if}

	<div class="flex flex-wrap gap-4 text-sm print:hidden">
		<label class="flex items-center gap-1.5">
			<input type="checkbox" bind:checked={showUnknown} /> Show releases without a date
		</label>
		<label class="flex items-center gap-1.5">
			<input type="checkbox" bind:checked={byVendor} /> Group by vendor
		</label>
	</div>

	{#if rows.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">No installed releases match the filters.</Card>
	{:else}
		<div class="overflow-auto rounded-md border print:overflow-visible">
			<table class="w-full text-sm">
				<thead class="bg-white text-left">
					<tr class="border-b">
						<th class="px-3 py-2">Product</th>
						<th class="px-3 py-2">Release</th>
						<th class="px-3 py-2">End of support</th>
						<th class="px-3 py-2">Remaining</th>
						<th class="px-3 py-2">LPARs</th>
						<th class="px-3 py-2 text-right">Customers</th>
						<th class="px-3 py-2">Newer release</th>
					</tr>
				</thead>
				<tbody>
					{#each groups as g (g.vendor?.id ?? 'all')}
					{#if g.vendor}
						<tr class="border-b bg-gray-100">
							<td colspan="7" class="px-3 py-1.5 font-semibold">
								{g.vendor.name}
								<span class="ml-2 text-xs font-normal text-muted-foreground">
									{g.rows.length} release{g.rows.length === 1 ? '' : 's'}{g.atRisk ? `, ${g.atRisk} out of support or ending within ${EOS_WARNING_MONTHS} months` : ''}
								</span>
							</td>
						</tr>
					{/if}
					{#each g.rows as row (`${row.software.id}|${row.release}`)}
						<tr class="border-b align-top {STATUS[row.status].row}">
							<td class="px-3 py-1.5">
								<a href="/software/{row.software.id}" class="hover:underline">{row.software.name}</a>
								<div class="text-xs text-muted-foreground">{row.software.vendor.name}</div>
							</td>
							<td class="px-3 py-1.5 whitespace-nowrap">{row.release}</td>
							<td class="px-3 py-1.5 whitespace-nowrap">
								{#if row.endOfSupport}
									<span class="font-semibold tabular-nums">{fmtDate(row.endOfSupport)}</span>
									<span class="ml-1 rounded px-1.5 text-xs {STATUS[row.status].badge}">{STATUS[row.status].label.toLowerCase()}</span>
								{:else}
									<span class="text-muted-foreground">no date</span>
									<a href="/software/{row.software.id}/edit" class="ml-1 text-xs text-primary hover:underline print:hidden">Set date</a>
								{/if}
							</td>
							<td class="px-3 py-1.5 whitespace-nowrap">{remaining(row.monthsLeft)}</td>
							<td class="px-3 py-1.5" title={row.lpars.map((l) => `${l.code} (${l.customer.name})`).join('\n')}>
								<span class="font-medium tabular-nums">{row.lpars.length}</span>
								<span class="text-xs text-muted-foreground">
									{row.lpars.slice(0, MAX_CODES).map((l) => l.code).join(', ')}{row.lpars.length > MAX_CODES
										? ` +${row.lpars.length - MAX_CODES}`
										: ''}
								</span>
							</td>
							<td class="px-3 py-1.5 text-right tabular-nums">{row.customerCount}</td>
							<td class="px-3 py-1.5 whitespace-nowrap">{row.newerRelease ?? ''}</td>
						</tr>
					{/each}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
