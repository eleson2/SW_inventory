<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ReportFilters from '#lib/components/reports/ReportFilters.svelte';
	import type { MatrixStatus } from '#lib/utils/installed-matrix.ts';

	let { data }: { data: PageData } = $props();

	const report = $derived(data.report);
	const rows = $derived(data.release ? report.rows.filter((r) => r.release === data.release) : report.rows);
	const lparCount = $derived(new Set(rows.map((r) => r.lpar.id)).size);
	const customerCount = $derived(new Set(rows.map((r) => r.lpar.customer.id)).size);
	const exportUrl = $derived(`/reports/where-used/export${page.url.search}`);

	/** Products grouped by vendor for the picker */
	const productGroups = $derived(
		data.options.vendors
			.map((v) => ({ vendor: v, software: data.options.software.filter((s) => s.vendor_id === v.id) }))
			.filter((g) => g.software.length > 0)
	);

	function navigate(product: string, release: string) {
		const params = new URLSearchParams(page.url.search);
		params.delete('product');
		params.delete('release');
		if (product) params.set('product', product);
		if (release) params.set('release', release);
		goto(`${page.url.pathname}?${params}`);
	}

	/** Same colours and marks as the installed software matrix (R1) */
	const STATUS: Record<MatrixStatus, { label: string; cls: string }> = {
		match: { label: 'matches package', cls: 'bg-green-100 text-green-900' },
		behind: { label: '▼ behind package', cls: 'bg-amber-100 text-amber-900' },
		ahead: { label: '▲ ahead of package', cls: 'bg-blue-100 text-blue-900' },
		not_in_package: { label: '✚ not in package', cls: 'bg-gray-100 text-gray-700' },
		missing: { label: '⊘ missing', cls: 'bg-red-100 text-red-800' },
		no_package: { label: 'no package', cls: 'text-muted-foreground' }
	};
	const fmtDate = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
</script>

<svelte:head>
	<title>Where used · Reports</title>
	<style>
		@media print {
			@page { size: landscape; margin: 10mm; }
		}
	</style>
</svelte:head>

<div class="space-y-4">
	<PageHeader title="Where used" description="Every LPAR running a product, by release and PTF level">
		{#snippet actions()}
			<span class="print:hidden flex gap-2">
				<Button href="/reports" variant="outline">All reports</Button>
				<Button href={exportUrl} variant="outline" disabled={rows.length === 0}>CSV</Button>
				<Button variant="outline" onclick={() => window.print()}>Print</Button>
			</span>
		{/snippet}
	</PageHeader>

	<Card class="p-4 print:border-0 print:p-0 print:shadow-none">
		<div class="mb-3 flex flex-wrap items-end gap-3 border-b pb-3 text-sm print:hidden">
			<label>
				<span class="mb-1 block text-xs font-medium text-muted-foreground">Product</span>
				<select
					class="h-9 min-w-64 rounded-md border border-input px-2"
					value={data.products[0] ?? ''}
					onchange={(e) => navigate(e.currentTarget.value, '')}
				>
					<option value="">Pick a product…</option>
					{#each productGroups as g (g.vendor.id)}
						<optgroup label={g.vendor.name}>
							{#each g.software as s (s.id)}
								<option value={s.id}>{s.name}</option>
							{/each}
						</optgroup>
					{/each}
				</select>
			</label>
			{#if report.releases.length > 1}
				<label>
					<span class="mb-1 block text-xs font-medium text-muted-foreground">Release</span>
					<select
						class="h-9 rounded-md border border-input px-2"
						value={data.release}
						onchange={(e) => navigate(data.products[0] ?? '', e.currentTarget.value)}
					>
						<option value="">All releases</option>
						{#each report.releases as r (`${r.software.id}|${r.release}`)}
							<option value={r.release}>{r.release} ({r.count})</option>
						{/each}
					</select>
				</label>
			{/if}
		</div>
		<ReportFilters asOf options={data.options} scope={data.scope} keep={['product', 'release']} />
	</Card>

	{#if data.products.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">Pick a product to see every LPAR running it.</Card>
	{:else if rows.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">No LPAR in the selection runs this product.</Card>
	{:else}
		<div class="grid grid-cols-1 gap-3 md:grid-cols-3">
			<Card class="p-4">
				<div class="text-xs text-muted-foreground">{rows[0].software.name}{data.release ? ` ${data.release}` : ''}</div>
				<div class="text-2xl font-semibold tabular-nums">{lparCount} LPAR{lparCount === 1 ? '' : 's'}</div>
				<div class="text-xs text-muted-foreground">at {customerCount} customer{customerCount === 1 ? '' : 's'}</div>
			</Card>
			<Card class="p-4 md:col-span-2">
				<div class="mb-1 text-xs text-muted-foreground">LPARs per release and PTF level</div>
				<div class="flex flex-wrap gap-x-6 gap-y-1 text-sm">
					{#each report.releases.filter((r) => !data.release || r.release === data.release) as r (`${r.software.id}|${r.release}`)}
						<div>
							<span class="font-medium">{r.release}</span>
							<span class="tabular-nums">{r.count}</span>
							<span class="text-xs text-muted-foreground">
								({r.ptfs.map((p) => `${p.ptf ?? 'no PTF'}: ${p.count}`).join(', ')})
							</span>
						</div>
					{/each}
				</div>
			</Card>
		</div>

		<div class="overflow-auto rounded-md border print:overflow-visible">
			<table class="w-full text-sm">
				<thead class="text-left">
					<tr class="border-b">
						<th class="px-3 py-2">Release</th>
						<th class="px-3 py-2">PTF level</th>
						<th class="px-3 py-2">Customer</th>
						<th class="px-3 py-2">LPAR</th>
						<th class="px-3 py-2">Installed</th>
						<th class="px-3 py-2">Against its package</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as r (`${r.lpar.id}|${r.software.id}`)}
						<tr class="border-b">
							<td class="px-3 py-1.5 whitespace-nowrap font-medium">{r.release}</td>
							<td class="px-3 py-1.5 whitespace-nowrap">{r.ptf ?? ''}</td>
							<td class="px-3 py-1.5">{r.lpar.customer.name}</td>
							<td class="px-3 py-1.5 font-medium">
								<a href="/lpars/{r.lpar.id}" class="text-primary hover:underline" title={r.lpar.name}>{r.lpar.code}</a>
							</td>
							<td class="px-3 py-1.5 whitespace-nowrap tabular-nums">{fmtDate(r.installedDate)}</td>
							<td class="px-3 py-1.5 whitespace-nowrap">
								<span class="rounded px-1.5 text-xs {STATUS[r.status].cls}">{STATUS[r.status].label}</span>
								{#if r.lpar.package}
									<span class="text-xs text-muted-foreground">{r.lpar.package.code}</span>
								{/if}
								{#if r.rolledBack}
									<span class="ml-1 rounded bg-red-100 px-1.5 text-xs text-red-800">rolled back</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
