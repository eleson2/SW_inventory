<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ReportFilters from '#lib/components/reports/ReportFilters.svelte';
	import type { MatrixCell, MatrixStatus } from '#lib/utils/installed-matrix.ts';
	import { EOS_WARNING_MONTHS } from '#lib/utils/end-of-support.ts';

	let { data }: { data: PageData } = $props();

	/**
	 * Customer-facing wording: no internal notes, no rollback reasons. One statement per
	 * customer in scope, each starting on a new page when printed.
	 */
	const STATUS: Record<MatrixStatus, { text: string; cls: string }> = {
		match: { text: 'As planned', cls: 'text-green-800' },
		behind: { text: 'Update planned', cls: 'text-amber-800' },
		ahead: { text: 'Newer than planned', cls: 'text-blue-800' },
		not_in_package: { text: 'Outside the standard package', cls: 'text-gray-700' },
		missing: { text: 'Planned, not yet installed', cls: 'text-red-800' },
		no_package: { text: '', cls: '' }
	};

	const today = new Date().toISOString().slice(0, 10);
	const fmtDate = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
	const ver = (v: { version: string; ptf_level: string | null } | null) =>
		v ? [v.version, v.ptf_level].filter(Boolean).join(' ') : '';

	const statements = $derived.by(() => {
		const matrix = data.matrix;
		if (!matrix) return [];
		const customers = data.options.customers.filter((c) => matrix.lpars.some((l) => l.customer.id === c.id));
		return customers.map((customer) => {
			const lpars = matrix.lpars.filter((l) => l.customer.id === customer.id);
			const ids = new Set(lpars.map((l) => l.id));
			const vendors = matrix.vendors
				.map((v) => ({
					vendor: v.vendor,
					rows: v.rows
						.map((row) => ({
							software: row.software,
							cells: lpars.flatMap((l) => (row.cells[l.id] ? [{ lpar: l, cell: row.cells[l.id] as MatrixCell }] : []))
						}))
						.filter((r) => r.cells.length > 0)
				}))
				.filter((v) => v.rows.length > 0);
			const changes = data.changes.filter((c) => ids.has(c.lpar_id));
			const ending = data.endOfSupport
				.map((e) => ({ ...e, codes: e.lpars.filter((l) => l.customerId === customer.id).map((l) => l.code) }))
				.filter((e) => e.codes.length > 0);
			return { customer, lpars, vendors, changes, ending };
		});
	});

	const lparCode = (id: string) => data.matrix?.lpars.find((l) => l.id === id)?.code ?? '';
	const softwareName = (id: string) => data.options.software.find((s) => s.id === id)?.name ?? '';

	let since = $state(page.url.searchParams.get('since') ?? '');
	function applySince() {
		const params = new URLSearchParams(page.url.search);
		if (since) params.set('since', since);
		else params.delete('since');
		goto(`${page.url.pathname}?${params}`);
	}
</script>

<svelte:head>
	<title>Customer software statement · Reports</title>
	<style>
		@media print {
			@page { size: portrait; margin: 14mm; }
		}
	</style>
</svelte:head>

<div class="space-y-4">
	<div class="print:hidden space-y-4">
		<PageHeader title="Customer software statement" description="What is installed for a customer, ready to print or save as PDF">
			{#snippet actions()}
				<span class="flex gap-2">
					<Button href="/reports" variant="outline">All reports</Button>
					<Button variant="outline" disabled={statements.length === 0} onclick={() => window.print()}>Print / PDF</Button>
				</span>
			{/snippet}
		</PageHeader>

		<Card class="p-4">
			<ReportFilters options={data.options} scope={data.scope} keep={['since']} />
		</Card>

		<div class="flex flex-wrap items-end gap-2 text-sm">
			<label>
				<span class="block text-xs font-medium text-muted-foreground mb-1">Changes since</span>
				<input type="date" class="h-9 rounded-md border border-input px-2" bind:value={since} />
			</label>
			<Button variant="outline" onclick={applySince} disabled={since === (page.url.searchParams.get('since') ?? '')}>
				Update
			</Button>
			<span class="text-muted-foreground">Showing changes since {data.since}.</span>
		</div>
	</div>

	{#if !data.matrix}
		<Card class="p-6 text-sm text-muted-foreground print:hidden">
			Choose one or more customers. Each gets its own statement, starting on a new page when printed.
		</Card>
	{:else if statements.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">No LPARs match the filters.</Card>
	{/if}

	{#each statements as s, i (s.customer.id)}
		<article
			class="rounded-md border bg-white p-6 space-y-5 text-sm print:border-0 print:p-0 {i < statements.length - 1
				? 'break-after-page'
				: ''}"
		>
			<header class="flex items-start justify-between border-b pb-3">
				<div>
					<div class="text-xs uppercase tracking-wide text-muted-foreground">Software statement</div>
					<h2 class="text-xl font-semibold">{s.customer.name}</h2>
				</div>
				<div class="text-right text-xs text-muted-foreground">
					<div>Date: {today}</div>
					<div>Customer: {s.customer.code}</div>
				</div>
			</header>

			<section>
				<h3 class="mb-1 font-semibold">Systems covered</h3>
				<table class="w-full">
					<thead class="text-left text-xs text-muted-foreground">
						<tr><th class="py-1 pr-3">LPAR</th><th class="py-1 pr-3">Name</th><th class="py-1">Software package</th></tr>
					</thead>
					<tbody>
						{#each s.lpars as lpar (lpar.id)}
							<tr class="border-t">
								<td class="py-1 pr-3 font-medium">{lpar.code}</td>
								<td class="py-1 pr-3">{lpar.name}</td>
								<td class="py-1">{lpar.package ? `${lpar.package.name} (${lpar.package.version})` : '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>

			{#each s.vendors as v (v.vendor.id)}
				<section class="break-inside-avoid-page">
					<h3 class="mb-1 font-semibold">{v.vendor.name}</h3>
					<table class="w-full">
						<thead class="text-left text-xs text-muted-foreground">
							<tr>
								<th class="py-1 pr-3 w-1/4">Product</th>
								<th class="py-1 pr-3">LPAR</th>
								<th class="py-1 pr-3">Version</th>
								<th class="py-1 pr-3">PTF level</th>
								<th class="py-1 pr-3">Installed</th>
								<th class="py-1">Status</th>
							</tr>
						</thead>
						<tbody>
							{#each v.rows as row (row.software.id)}
								{#each row.cells as { lpar, cell }, j (lpar.id)}
									<tr class={j === 0 ? 'border-t' : ''}>
										{#if j === 0}<td class="py-1 pr-3 align-top" rowspan={row.cells.length}>{row.software.name}</td>{/if}
										<td class="py-1 pr-3">{lpar.code}</td>
										{#if cell.installed}
											<td class="py-1 pr-3">{cell.installed.version}</td>
											<td class="py-1 pr-3">{cell.installed.ptf_level ?? ''}</td>
											<td class="py-1 pr-3">{fmtDate(cell.installed.installed_date)}</td>
										{:else}
											<td class="py-1 pr-3 text-muted-foreground" colspan="3">not installed</td>
										{/if}
										<td class="py-1 {STATUS[cell.status].cls}">
											{STATUS[cell.status].text}
											{#if (cell.status === 'behind' || cell.status === 'missing') && cell.expected}
												<span class="text-muted-foreground">({ver(cell.expected)})</span>
											{/if}
										</td>
									</tr>
								{/each}
							{/each}
						</tbody>
					</table>
				</section>
			{:else}
				<p class="text-muted-foreground">No software recorded for these systems.</p>
			{/each}

			<section class="break-inside-avoid-page">
				<h3 class="mb-1 font-semibold">End of vendor support</h3>
				{#if s.ending.length === 0}
					<p class="text-muted-foreground">No installed release reaches end of vendor support within {EOS_WARNING_MONTHS} months.</p>
				{:else}
					<p class="mb-1 text-muted-foreground">
						Releases on your systems whose vendor support has ended or ends within {EOS_WARNING_MONTHS} months.
					</p>
					<table class="w-full">
						<thead class="text-left text-xs text-muted-foreground">
							<tr>
								<th class="py-1 pr-3">Product</th>
								<th class="py-1 pr-3">Release</th>
								<th class="py-1 pr-3">Support ends</th>
								<th class="py-1 pr-3">Systems</th>
								<th class="py-1">Newer release</th>
							</tr>
						</thead>
						<tbody>
							{#each s.ending as e (`${e.product}|${e.release}`)}
								<tr class="border-t">
									<td class="py-1 pr-3">{e.product}</td>
									<td class="py-1 pr-3">{e.release}</td>
									<td class="py-1 pr-3 font-medium {e.past ? 'text-red-800' : 'text-amber-800'}">
										{fmtDate(e.endOfSupport)}{e.past ? ' (ended)' : ''}
									</td>
									<td class="py-1 pr-3">{e.codes.join(', ')}</td>
									<td class="py-1">{e.newerRelease ?? ''}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</section>

			<section class="break-inside-avoid-page">
				<h3 class="mb-1 font-semibold">Changes since {data.since}</h3>
				{#if s.changes.length === 0}
					<p class="text-muted-foreground">No changes in this period.</p>
				{:else}
					<table class="w-full">
						<thead class="text-left text-xs text-muted-foreground">
							<tr><th class="py-1 pr-3">Date</th><th class="py-1 pr-3">LPAR</th><th class="py-1 pr-3">Product</th><th class="py-1">Change</th></tr>
						</thead>
						<tbody>
							{#each s.changes as c (`${c.lpar_id}|${c.software_id}`)}
								{@const now = ver(c)}
								{@const before = ver({ version: c.previous_version ?? '', ptf_level: c.previous_ptf_level })}
								<tr class="border-t">
									<td class="py-1 pr-3">{fmtDate(c.date)}</td>
									<td class="py-1 pr-3">{lparCode(c.lpar_id)}</td>
									<td class="py-1 pr-3">{softwareName(c.software_id)}</td>
									<td class="py-1">
										{#if c.kind === 'rolled_back'}
											Returned to {now}{before ? ` (from ${before})` : ''}
										{:else if before}
											Updated from {before} to {now}
										{:else}
											Installed {now}
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</section>
		</article>
	{/each}
</div>
