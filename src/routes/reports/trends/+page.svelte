<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ReportFilters from '#lib/components/reports/ReportFilters.svelte';
	import TrendLine from '#lib/components/reports/TrendLine.svelte';
	import CurrencyBars from '#lib/components/reports/CurrencyBars.svelte';
	import { MONTH_CHOICES } from '#lib/utils/installed-base.ts';
	import type { TrendGroupBy, TrendMetrics } from '#lib/utils/trends.ts';

	let { data }: { data: PageData } = $props();

	const report = $derived(data.report);
	const exportUrl = $derived(`/reports/trends/export${page.url.search}`);
	const labels = $derived(report.points.map((p) => new Date(p.at).toISOString().slice(0, 7)));
	const rebuilt = $derived(report.points.map((p) => p.rebuilt));
	const anyRebuilt = $derived(rebuilt.some(Boolean));
	/** Compare now with 3 months back (or the first month) */
	const back = $derived(Math.max(0, report.points.length - 4));
	const groups = $derived(data.groupBy === 'total' ? [] : report[data.groupBy]);

	type Measure = { key: string; label: string; get: (m: TrendMetrics) => number | null; format?: (v: number) => string; higherIsBetter?: boolean };
	const pct = (v: number) => `${Math.round(v * 100)}%`;
	const BASE: Measure[] = [
		{ key: 'lpars', label: 'LPARs', get: (m) => m.lpars },
		{ key: 'customers', label: 'Customers', get: (m) => m.customers },
		{ key: 'products', label: 'Products', get: (m) => m.products },
		{ key: 'releases', label: 'Releases in use', get: (m) => m.releases },
		{ key: 'installs', label: 'Installs', get: (m) => m.installs }
	];
	const CURRENCY: Measure[] = [
		{ key: 'share', label: 'Current with package', get: (m) => m.currentShare, format: pct, higherIsBetter: true },
		{ key: 'behind', label: 'Behind package', get: (m) => m.currency.behind, higherIsBetter: false },
		{ key: 'outside', label: 'Outside package', get: (m) => m.currency.outside, higherIsBetter: false },
		{ key: 'oos', label: 'Out of support', get: (m) => m.currency.out_of_support, higherIsBetter: false }
	];
	const SPRAWL: Measure[] = [
		{ key: 'multi', label: 'Products on more than one release', get: (m) => m.multiRelease, higherIsBetter: false },
		{ key: 'avg', label: 'Releases per product', get: (m) => m.avgReleases, format: (v) => v.toFixed(2), higherIsBetter: false },
		{ key: 'ptf', label: 'Distinct PTF levels', get: (m) => m.ptfLevels, higherIsBetter: false }
	];

	function setParam(key: string, value: string | null) {
		const params = new URLSearchParams(page.url.search);
		if (value) params.set(key, value);
		else params.delete(key);
		goto(`${page.url.pathname}?${params}`);
	}
	const show = (m: Measure, v: number | null) => (v === null ? '–' : (m.format ?? String)(v));
	function delta(m: Measure, values: TrendMetrics[]) {
		const a = m.get(values.at(-1)!);
		const b = m.get(values[back]);
		if (a === null || b === null) return { text: '', cls: '' };
		const diff = a - b;
		const text =
			Math.abs(diff) < 1e-9
				? '±0'
				: m.format === pct
					? `${diff > 0 ? '+' : '−'}${Math.abs(Math.round(diff * 100))} pts`
					: `${diff > 0 ? '+' : '−'}${m.format ? m.format(Math.abs(diff)) : Math.abs(diff)}`;
		const good = m.higherIsBetter === undefined ? null : diff > 0 === m.higherIsBetter;
		return { text, cls: Math.abs(diff) < 1e-9 || good === null ? 'text-muted-foreground' : good ? 'text-green-800' : 'text-red-800' };
	}
	const GROUP_LABEL: Record<TrendGroupBy, string> = { total: 'Total', vendor: 'By vendor', customer: 'By customer' };
	const sinceLabel = $derived(labels[back]);
</script>

<svelte:head>
	<title>Trends · Reports</title>
</svelte:head>

{#snippet monthTable(measures: Measure[], values: TrendMetrics[])}
	<div class="overflow-x-auto">
		<table class="w-full text-xs tabular-nums">
			<thead class="text-muted-foreground">
				<tr class="border-b">
					<th class="py-1 pr-3 text-left font-medium">Month end</th>
					{#each labels as l, i (l)}
						<th class="px-1.5 py-1 text-right font-medium {rebuilt[i] ? 'bg-gray-50' : ''}">{l.slice(2)}{rebuilt[i] ? '*' : ''}</th>
					{/each}
					<th class="pl-3 py-1 text-right font-medium">vs {sinceLabel}</th>
				</tr>
			</thead>
			<tbody>
				{#each measures as m (m.key)}
					{@const d = delta(m, values)}
					<tr class="border-b last:border-b-0">
						<td class="py-1 pr-3 whitespace-nowrap">{m.label}</td>
						{#each values as v, i (i)}
							<td class="px-1.5 py-1 text-right {rebuilt[i] ? 'bg-gray-50 text-muted-foreground' : ''}">{show(m, m.get(v))}</td>
						{/each}
						<td class="pl-3 py-1 text-right whitespace-nowrap {d.cls}">{d.text}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/snippet}

{#snippet groupTable(measures: Measure[], spark: Measure)}
	<div class="overflow-x-auto">
		<table class="w-full text-sm tabular-nums">
			<thead class="text-xs text-muted-foreground">
				<tr class="border-b text-right">
					<th class="py-1.5 pr-3 text-left font-medium">{data.groupBy === 'vendor' ? 'Vendor' : 'Customer'}</th>
					{#each measures as m (m.key)}
						<th class="px-2 py-1.5 font-medium">{m.label}</th>
						<th class="px-2 py-1.5 font-medium">vs {sinceLabel}</th>
					{/each}
					<th class="pl-3 py-1.5 text-left font-medium">{spark.label}, {labels[0]} – {labels.at(-1)}</th>
				</tr>
			</thead>
			<tbody>
				{#each groups as g (g.key)}
					<tr class="border-b last:border-b-0 text-right align-middle">
						<td class="py-1 pr-3 text-left font-medium">{g.label}</td>
						{#each measures as m (m.key)}
							{@const d = delta(m, g.values)}
							<td class="px-2 py-1">{show(m, m.get(g.values.at(-1)!))}</td>
							<td class="px-2 py-1 text-xs {d.cls}">{d.text}</td>
						{/each}
						<td class="pl-3 py-1 text-left w-48">
							<TrendLine values={g.values.map(spark.get)} {labels} {rebuilt} format={spark.format} title="{g.label}: {spark.label}" />
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/snippet}

<div class="space-y-4">
	<PageHeader title="Trends" description="Installed base, currency and version sprawl at each month end, from the install history">
		{#snippet actions()}
			<span class="print:hidden flex gap-2">
				<Button href="/reports" variant="outline">All reports</Button>
				<Button href={exportUrl} variant="outline">CSV</Button>
				<Button variant="outline" onclick={() => window.print()}>Print</Button>
			</span>
		{/snippet}
	</PageHeader>

	<Card class="p-4 print:hidden">
		<div class="mb-3 flex flex-wrap items-center gap-5 border-b pb-3 text-sm">
			<span class="flex items-center gap-1">
				<span class="mr-1 text-muted-foreground">Months</span>
				{#each MONTH_CHOICES as m (m)}
					<button
						type="button"
						class="rounded-full border px-2.5 py-1 text-xs {data.months === m ? 'border-primary bg-primary/10' : 'hover:bg-gray-50'}"
						onclick={() => setParam('months', m === 12 ? null : String(m))}>{m}</button
					>
				{/each}
			</span>
			<span class="flex items-center gap-1">
				<span class="mr-1 text-muted-foreground">Show</span>
				{#each ['total', 'vendor', 'customer'] as const as g (g)}
					<button
						type="button"
						class="rounded-full border px-2.5 py-1 text-xs {data.groupBy === g ? 'border-primary bg-primary/10' : 'hover:bg-gray-50'}"
						onclick={() => setParam('group', g === 'total' ? null : g)}>{GROUP_LABEL[g]}</button
					>
				{/each}
			</span>
		</div>
		<ReportFilters options={data.options} scope={data.scope} keep={['months', 'group']} />
	</Card>

	{#if anyRebuilt}
		<p class="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-muted-foreground">
			Shaded months (*) are before the install history started recording
			{#if data.options.historyStart}({new Date(data.options.historyStart).toISOString().slice(0, 10)}){/if}: they rest on
			history rebuilt from install dates, so earlier changes may be missing and the line is flatter than it was.
		</p>
	{/if}

	<Card class="space-y-3 p-4">
		<h2 class="text-lg font-semibold">Installed base</h2>
		{#if data.groupBy === 'total'}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
				{#each BASE as m (m.key)}
					<div>
						<div class="text-xs text-muted-foreground">{m.label}</div>
						<div class="text-xl font-semibold tabular-nums">{show(m, m.get(report.total.at(-1)!))}</div>
						<TrendLine values={report.total.map(m.get)} {labels} {rebuilt} title={m.label} />
					</div>
				{/each}
			</div>
			{@render monthTable(BASE, report.total)}
		{:else}
			{@render groupTable(BASE.filter((m) => m.key !== 'customers' || data.groupBy === 'vendor'), BASE[4])}
		{/if}
	</Card>

	<Card class="space-y-3 p-4">
		<div>
			<h2 class="text-lg font-semibold">Currency</h2>
			<p class="text-xs text-muted-foreground">
				Same rules as the currency score (C5): each install compared with the package the LPAR had at the month end; out of
				support counts first.
			</p>
		</div>
		{#if data.groupBy === 'total'}
			<CurrencyBars months={report.total} {labels} {rebuilt} />
			{@render monthTable(CURRENCY, report.total)}
		{:else}
			{@render groupTable(CURRENCY, CURRENCY[0])}
		{/if}
	</Card>

	<Card class="space-y-3 p-4">
		<div>
			<h2 class="text-lg font-semibold">Version sprawl</h2>
			<p class="text-xs text-muted-foreground">Same rules as version sprawl (R4): releases and release + PTF levels in use per product.</p>
		</div>
		{#if data.groupBy === 'total'}
			<div class="grid gap-4 sm:grid-cols-3">
				{#each SPRAWL as m (m.key)}
					<div>
						<div class="text-xs text-muted-foreground">{m.label}</div>
						<div class="text-xl font-semibold tabular-nums">{show(m, m.get(report.total.at(-1)!))}</div>
						<TrendLine values={report.total.map(m.get)} {labels} {rebuilt} format={m.format} title={m.label} />
					</div>
				{/each}
			</div>
			{@render monthTable(SPRAWL, report.total)}
		{:else}
			{@render groupTable(SPRAWL, SPRAWL[2])}
		{/if}
	</Card>

	<p class="text-xs text-muted-foreground">
		Not historized, so today's values are used for every month: package contents, end-of-support dates (compared with each
		month end), names, categories, LPAR customer and environment. The last point is today. Changes outside packages count
		here (unlike the installed base summary V1).
	</p>
</div>
