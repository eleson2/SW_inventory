<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ReportFilters from '#lib/components/reports/ReportFilters.svelte';
	import type { MatrixCell, MatrixStatus } from '#lib/utils/installed-matrix.ts';

	let { data }: { data: PageData } = $props();

	let onlyDifferences = $state(false);
	let showPtf = $state(false);

	const lpars = $derived(data.matrix.lpars);
	const customerGroups = $derived.by(() => {
		const groups: { customer: (typeof lpars)[number]['customer']; count: number }[] = [];
		for (const l of lpars) {
			const last = groups.at(-1);
			if (last && last.customer.id === l.customer.id) last.count++;
			else groups.push({ customer: l.customer, count: 1 });
		}
		return groups;
	});
	const vendors = $derived(
		data.matrix.vendors
			.map((v) => ({ ...v, rows: onlyDifferences ? v.rows.filter((r) => r.differs) : v.rows }))
			.filter((v) => v.rows.length > 0)
	);
	const productCount = $derived(vendors.reduce((n, v) => n + v.rows.length, 0));
	const counts = $derived.by(() => {
		const c: Partial<Record<MatrixStatus, number>> = {};
		for (const v of data.matrix.vendors)
			for (const r of v.rows) for (const cell of Object.values(r.cells)) c[cell.status] = (c[cell.status] ?? 0) + 1;
		return c;
	});
	const setName = $derived(data.options.sets.find((s) => s.id === data.scope.setId)?.name);
	const scopeText = $derived.by(() => {
		const names = data.options.customers.filter((c) => data.scope.customerIds.includes(c.id)).map((c) => c.name);
		const who = setName ? `Set “${setName}”` : names.length ? names.join(', ') : 'All customers';
		return `${who} · ${lpars.length} LPAR${lpars.length === 1 ? '' : 's'} · ${productCount} product${productCount === 1 ? '' : 's'}`;
	});
	const exportUrl = $derived(`/reports/installed/export${page.url.search}`);

	const STATUS: Record<MatrixStatus, { cls: string; mark: string; text: string }> = {
		match: { cls: '', mark: '', text: 'Matches the package' },
		behind: { cls: 'bg-amber-100 text-amber-900', mark: '▼', text: 'Behind the package' },
		ahead: { cls: 'bg-blue-100 text-blue-900', mark: '▲', text: 'Ahead of the package' },
		not_in_package: { cls: 'bg-gray-100 text-gray-600', mark: '✚', text: 'Installed, not in the package' },
		missing: { cls: 'bg-red-100 text-red-800', mark: '⊘', text: 'In the package, not installed' },
		no_package: { cls: '', mark: '', text: 'LPAR has no package' }
	};
	const LEGEND: MatrixStatus[] = ['behind', 'ahead', 'not_in_package', 'missing'];

	const fmtDate = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
	const ver = (v: { version: string; ptf_level: string | null } | null) =>
		v ? [v.version, v.ptf_level].filter(Boolean).join(' ') : '';

	function tooltip(cell: MatrixCell) {
		const lines = [STATUS[cell.status].text];
		if (cell.installed) lines.push(`Installed: ${ver(cell.installed)} (${fmtDate(cell.installed.installed_date)})`);
		if (cell.expected) lines.push(`Package: ${ver(cell.expected)}`);
		if (cell.installed?.rolled_back) lines.push(`Rolled back: ${cell.installed.rollback_reason ?? 'no reason given'}`);
		return lines.join('\n');
	}
</script>

<svelte:head>
	<title>Installed software · Reports</title>
	<style>
		@media print {
			@page { size: landscape; margin: 10mm; }
		}
	</style>
</svelte:head>

<div class="space-y-4">
	<PageHeader title="Installed software" description={scopeText}>
		{#snippet actions()}
			<span class="print:hidden flex gap-2">
				<Button href="/reports" variant="outline">All reports</Button>
				<Button href={exportUrl} variant="outline">CSV</Button>
				<Button variant="outline" onclick={() => window.print()}>Print</Button>
			</span>
		{/snippet}
	</PageHeader>

	<Card class="p-4 print:border-0 print:p-0 print:shadow-none">
		<ReportFilters asOf options={data.options} scope={data.scope} />
	</Card>

	<div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
		<label class="flex items-center gap-1.5 print:hidden">
			<input type="checkbox" bind:checked={onlyDifferences} /> Only differences
		</label>
		<label class="flex items-center gap-1.5 print:hidden">
			<input type="checkbox" bind:checked={showPtf} /> Show PTF level
		</label>
		<span class="text-muted-foreground">Compared with each LPAR's package:</span>
		{#each LEGEND as s (s)}
			<span class="inline-flex items-center gap-1">
				<span class="rounded px-1.5 {STATUS[s].cls}">{STATUS[s].mark}</span>{STATUS[s].text.toLowerCase()} ({counts[s] ?? 0})
			</span>
		{/each}
		<span class="inline-flex items-center gap-1"><span class="px-1">↺</span>rolled back</span>
	</div>

	{#if lpars.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">No LPARs match the filters.</Card>
	{:else if vendors.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">
			{onlyDifferences ? 'No differences: every product matches its package.' : 'No software installed or expected on these LPARs.'}
		</Card>
	{:else}
		<div class="overflow-auto max-h-[75vh] rounded-md border print:max-h-none print:overflow-visible">
			<table class="text-xs border-separate border-spacing-0">
				<thead class="sticky top-0 z-20 bg-white">
					<tr>
						<th rowspan="3" class="sticky left-0 z-30 bg-white border-b border-r px-3 py-2 text-left align-bottom text-sm">Product</th>
						{#each customerGroups as g (g.customer.id)}
							<th colspan={g.count} class="border-b border-r px-2 py-1 text-left font-semibold" title={g.customer.code}>
								{g.customer.name}
							</th>
						{/each}
					</tr>
					<tr>
						{#each lpars as lpar (lpar.id)}
							<th class="border-r px-2 pt-1 text-left font-semibold whitespace-nowrap">
								<a href="/lpars/{lpar.id}" class="hover:underline" title={lpar.name}>{lpar.code}</a>
							</th>
						{/each}
					</tr>
					<tr>
						{#each lpars as lpar (lpar.id)}
							<th class="border-b border-r px-2 pb-1 text-left font-normal text-muted-foreground whitespace-nowrap">
								{#if lpar.package}
									<a href="/packages/{lpar.package.id}" class="hover:underline" title={lpar.package.name}>
										{lpar.package.code} {lpar.package.version}
									</a>
								{:else}
									<span class="italic">no package</span>
								{/if}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each vendors as group (group.vendor.id)}
						<tr>
							<th
								colspan={lpars.length + 1}
								class="sticky left-0 bg-muted/60 bg-gray-50 border-b px-3 py-1 text-left text-sm font-semibold"
							>
								{group.vendor.name}
							</th>
						</tr>
						{#each group.rows as row (row.software.id)}
							<tr class="hover:bg-accent/40">
								<th class="sticky left-0 z-10 bg-white border-b border-r px-3 py-1 text-left font-normal whitespace-nowrap">
									<a href="/software/{row.software.id}" class="hover:underline text-sm">{row.software.name}</a>
									{#if row.software.product_code}
										<span class="ml-1 text-muted-foreground">{row.software.product_code}</span>
									{/if}
								</th>
								{#each lpars as lpar (lpar.id)}
									{@const cell = row.cells[lpar.id]}
									{#if cell}
										{@const shown = cell.installed ?? cell.expected}
										<td class="border-b border-r px-2 py-1 whitespace-nowrap {STATUS[cell.status].cls}" title={tooltip(cell)}>
											{#if STATUS[cell.status].mark}<span class="mr-0.5" aria-hidden="true">{STATUS[cell.status].mark}</span>{/if}
											<span class={cell.status === 'missing' ? 'line-through decoration-red-400' : ''}>{shown?.version}</span>
											{#if cell.installed?.rolled_back}<span class="ml-0.5" aria-label="rolled back">↺</span>{/if}
											{#if showPtf && shown?.ptf_level}<div class="text-[10px] opacity-75">{shown.ptf_level}</div>{/if}
											<span class="sr-only">{STATUS[cell.status].text}</span>
										</td>
									{:else}
										<td class="border-b border-r px-2 py-1 text-center text-gray-300">—</td>
									{/if}
								{/each}
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
