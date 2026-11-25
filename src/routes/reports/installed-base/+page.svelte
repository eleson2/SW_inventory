<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ReportFilters from '#lib/components/reports/ReportFilters.svelte';
	import {
		COMPARE_CHOICES,
		EMPTY_FOOTPRINT,
		MONTH_CHOICES,
		type Footprint
	} from '#lib/utils/installed-base.ts';

	let { data }: { data: PageData } = $props();

	const exportUrl = $derived(`/reports/installed-base/export${page.url.search}`);
	const points = $derived(data.base.points);
	const now = $derived(points.at(-1)!);
	const then = $derived(points.at(-1 - data.compare) ?? points[0]);

	const MEASURES: { key: keyof Footprint; label: string }[] = [
		{ key: 'lpars', label: 'LPARs' },
		{ key: 'customers', label: 'Customers' },
		{ key: 'products', label: 'Products' },
		{ key: 'releases', label: 'Releases in use' },
		{ key: 'installs', label: 'Installs' }
	];

	function setParam(key: string, value: string) {
		const params = new URLSearchParams(page.url.search);
		params.set(key, value);
		goto(`${page.url.pathname}?${params}`);
	}

	const month = (d: Date) => new Date(d).toISOString().slice(0, 7);
	const delta = (a: number, b: number) => (a === b ? '±0' : a > b ? `+${a - b}` : `−${b - a}`);
	const deltaCls = (a: number, b: number) => (a > b ? 'text-green-800' : a < b ? 'text-red-800' : 'text-muted-foreground');
	const vendorUrl = (id: string) => {
		const params = new URLSearchParams(page.url.search);
		['vendor', 'software', 'months', 'compare'].forEach((k) => params.delete(k));
		params.set('vendor', id);
		return `/reports/vendor-base?${params}`;
	};

	/** Polyline points for a 120 x 28 sparkline of installs */
	function spark(values: number[]) {
		const max = Math.max(1, ...values);
		const step = values.length > 1 ? 120 / (values.length - 1) : 0;
		return values.map((v, i) => `${(i * step).toFixed(1)},${(26 - (v / max) * 24).toFixed(1)}`).join(' ');
	}
	const series = (vendorId: string | null) =>
		points.map((p) => (vendorId ? (p.byVendor[vendorId] ?? EMPTY_FOOTPRINT) : p.total).installs);
	const share = (n: number) => (now.total.installs ? `${Math.round((n / now.total.installs) * 100)}%` : '–');
</script>

<svelte:head>
	<title>Installed base · Reports</title>
	<style>
		@media print {
			@page { size: landscape; margin: 10mm; }
		}
	</style>
</svelte:head>

<div class="space-y-4">
	<PageHeader
		title="Installed base summary"
		description="Footprint per vendor at the end of each month, from the package installed on each LPAR"
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
		<div class="mb-3 flex flex-wrap items-end gap-4 border-b pb-3 text-sm print:hidden">
			<label>
				<span class="mb-1 block text-xs font-medium text-muted-foreground">Trend over</span>
				<select class="h-9 rounded-md border border-input px-2" value={String(data.months)} onchange={(e) => setParam('months', e.currentTarget.value)}>
					{#each MONTH_CHOICES as m (m)}<option value={String(m)}>{m} months</option>{/each}
				</select>
			</label>
			<label>
				<span class="mb-1 block text-xs font-medium text-muted-foreground">Compare with</span>
				<select class="h-9 rounded-md border border-input px-2" value={String(data.compare)} onchange={(e) => setParam('compare', e.currentTarget.value)}>
					{#each COMPARE_CHOICES.filter((c) => c < data.months) as c (c)}
						<option value={String(c)}>{c === 1 ? '1 month' : `${c} months`} ago</option>
					{/each}
				</select>
			</label>
		</div>
		<ReportFilters options={data.options} scope={data.scope} keep={['months', 'compare']} />
	</Card>

	<p class="text-xs text-muted-foreground">
		Counts follow the packages installed on the LPARs (rollouts, and the audit log before them). Rollbacks and changes
		outside packages are not included; see the Installed software report (R1) for the actual state.
		Compared: {month(now.at)} with end of {month(then.at)}.
	</p>

	<div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
		{#each MEASURES as m (m.key)}
			<Card class="p-3">
				<div class="text-xs text-muted-foreground">{m.label}</div>
				<div class="text-2xl font-semibold tabular-nums">{now.total[m.key]}</div>
				<div class="text-xs tabular-nums {deltaCls(now.total[m.key], then.total[m.key])}">
					{delta(now.total[m.key], then.total[m.key])} since {month(then.at)}
				</div>
			</Card>
		{/each}
	</div>

	{#if data.base.vendors.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">No LPAR in the selection has a package installed.</Card>
	{:else}
		<div class="overflow-auto rounded-md border print:overflow-visible">
			<table class="w-full text-sm">
				<thead class="text-left">
					<tr class="border-b">
						<th class="px-3 py-2">Vendor</th>
						{#each MEASURES as m (m.key)}<th class="px-3 py-2 text-right">{m.label}</th>{/each}
						<th class="px-3 py-2 text-right">Share</th>
						<th class="px-3 py-2 text-right">Installs since {month(then.at)}</th>
						<th class="px-3 py-2">Installs, {data.months} months</th>
					</tr>
				</thead>
				<tbody>
					{#each data.base.vendors as v (v.id)}
						{@const f = now.byVendor[v.id] ?? EMPTY_FOOTPRINT}
						{@const was = then.byVendor[v.id] ?? EMPTY_FOOTPRINT}
						<tr class="border-b">
							<td class="px-3 py-1.5 font-medium">
								<a href={vendorUrl(v.id)} class="text-primary hover:underline" title="Vendor base (R3) for {v.name}">{v.name}</a>
							</td>
							{#each MEASURES as m (m.key)}<td class="px-3 py-1.5 text-right tabular-nums">{f[m.key]}</td>{/each}
							<td class="px-3 py-1.5 text-right tabular-nums">{share(f.installs)}</td>
							<td class="px-3 py-1.5 text-right tabular-nums {deltaCls(f.installs, was.installs)}">{delta(f.installs, was.installs)}</td>
							<td class="px-3 py-1.5">
								<svg width="120" height="28" viewBox="0 0 120 28" class="text-primary" aria-label="Installs per month">
									<polyline points={spark(series(v.id))} fill="none" stroke="currentColor" stroke-width="1.5" />
								</svg>
							</td>
						</tr>
					{/each}
					<tr class="font-semibold">
						<td class="px-3 py-1.5">All vendors</td>
						{#each MEASURES as m (m.key)}<td class="px-3 py-1.5 text-right tabular-nums">{now.total[m.key]}</td>{/each}
						<td class="px-3 py-1.5 text-right">100%</td>
						<td class="px-3 py-1.5 text-right tabular-nums {deltaCls(now.total.installs, then.total.installs)}">
							{delta(now.total.installs, then.total.installs)}
						</td>
						<td class="px-3 py-1.5">
							<svg width="120" height="28" viewBox="0 0 120 28" class="text-primary" aria-label="Installs per month">
								<polyline points={spark(series(null))} fill="none" stroke="currentColor" stroke-width="1.5" />
							</svg>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="text-xs text-muted-foreground">
			A customer or LPAR counts for a vendor when its package holds at least one of the vendor's products. Installs = LPAR × product.
		</p>
	{/if}
</div>
