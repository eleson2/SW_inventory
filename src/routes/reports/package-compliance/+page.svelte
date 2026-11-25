<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ReportFilters from '#lib/components/reports/ReportFilters.svelte';
	import type { CountedStatus } from '#lib/utils/package-compliance.ts';

	let { data }: { data: PageData } = $props();

	const report = $derived(data.report);
	const totals = $derived(report.totals);
	const exportUrl = $derived(`/reports/package-compliance/export${page.url.search}`);

	/** Same colours and marks as the installed software matrix (R1) */
	const COLUMNS: { status: CountedStatus; label: string; cls: string }[] = [
		{ status: 'match', label: 'Match', cls: '' },
		{ status: 'behind', label: '▼ Behind', cls: 'bg-amber-100 text-amber-900' },
		{ status: 'ahead', label: '▲ Ahead', cls: 'bg-blue-100 text-blue-900' },
		{ status: 'not_in_package', label: '✚ Not in package', cls: 'bg-gray-100 text-gray-700' },
		{ status: 'missing', label: '⊘ Missing', cls: 'bg-red-100 text-red-800' }
	];

	const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`);
	const barColour = (n: number) => (n === 1 ? 'bg-green-600' : n >= 0.5 ? 'bg-amber-500' : 'bg-red-500');
	/** R1 narrowed to one LPAR */
	const matrixUrl = (lpar: { id: string; customer: { id: string } }) =>
		`/reports/installed?customer=${lpar.customer.id}&lpar=${lpar.id}`;
</script>

<svelte:head>
	<title>Package compliance · Reports</title>
	<style>
		@media print {
			@page { size: landscape; margin: 10mm; }
		}
	</style>
</svelte:head>

<div class="space-y-4">
	<PageHeader
		title="Package compliance"
		description="Each LPAR against its assigned package; software outside the package counts against compliance"
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

	<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
		<Card class="p-4">
			<div class="text-xs text-muted-foreground">Overall compliance</div>
			<div class="text-2xl font-semibold tabular-nums">{pct(totals.compliance)}</div>
			<div class="text-xs text-muted-foreground">matching products over all LPARs with a package</div>
		</Card>
		<Card class="p-4">
			<div class="text-xs text-muted-foreground">Fully compliant LPARs</div>
			<div class="text-2xl font-semibold tabular-nums">{totals.fullyCompliant} of {totals.lparsWithPackage}</div>
		</Card>
		<Card class="p-4">
			<div class="text-xs text-muted-foreground">LPARs without a package</div>
			<div class="text-2xl font-semibold tabular-nums">{totals.withoutPackage}</div>
		</Card>
	</div>

	<p class="text-xs text-muted-foreground">
		Compliance = matching products ÷ (products in the package + products installed outside it). Click an LPAR to see
		its products in Installed software.
	</p>

	{#if report.rows.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">No LPARs match the filters.</Card>
	{:else}
		<div class="overflow-auto rounded-md border print:overflow-visible">
			<table class="w-full text-sm">
				<thead class="text-left">
					<tr class="border-b">
						<th class="px-3 py-2">Customer</th>
						<th class="px-3 py-2">LPAR</th>
						<th class="px-3 py-2">Package</th>
						<th class="px-3 py-2 text-right">Products</th>
						{#each COLUMNS as c (c.status)}
							<th class="px-2 py-2 text-right whitespace-nowrap">{c.label}</th>
						{/each}
						<th class="px-3 py-2">Compliance</th>
					</tr>
				</thead>
				<tbody>
					{#each report.rows as row (row.lpar.id)}
						<tr class="border-b hover:bg-accent/40">
							<td class="px-3 py-1.5">{row.lpar.customer.name}</td>
							<td class="px-3 py-1.5 font-medium">
								<a href={matrixUrl(row.lpar)} class="text-primary hover:underline" title={row.lpar.name}>{row.lpar.code}</a>
							</td>
							<td class="px-3 py-1.5 whitespace-nowrap">
								{#if row.lpar.package}
									<a href="/packages/{row.lpar.package.id}" class="hover:underline" title={row.lpar.package.name}>
										{row.lpar.package.code} {row.lpar.package.version}
									</a>
								{:else}
									<span class="italic text-muted-foreground">no package</span>
								{/if}
							</td>
							{#if row.lpar.package}
								<td class="px-3 py-1.5 text-right tabular-nums">{row.judged}</td>
								{#each COLUMNS as c (c.status)}
									{@const n = row.counts[c.status]}
									<td class="px-2 py-1.5 text-right tabular-nums">
										{#if n > 0}
											<span class="rounded px-1.5 {c.cls}">{n}</span>
										{:else}
											<span class="text-gray-300">0</span>
										{/if}
									</td>
								{/each}
								<td class="px-3 py-1.5">
									{#if row.compliance !== null}
										<div class="flex items-center gap-2">
											<div class="h-2 w-28 rounded bg-gray-100 print:border">
												<div class="h-2 rounded {barColour(row.compliance)}" style="width: {pct(row.compliance)}"></div>
											</div>
											<span class="tabular-nums text-xs font-medium">{pct(row.compliance)}</span>
										</div>
									{:else}
										<span class="text-xs text-muted-foreground">nothing to compare</span>
									{/if}
								</td>
							{:else}
								<td colspan={COLUMNS.length + 2} class="px-3 py-1.5 text-xs text-muted-foreground">
									{row.installedWithoutPackage} product{row.installedWithoutPackage === 1 ? '' : 's'} installed, no package to compare with
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
