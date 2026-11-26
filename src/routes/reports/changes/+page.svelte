<script lang="ts">
	import type { PageData } from './$types';
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ReportFilters from '#lib/components/reports/ReportFilters.svelte';
	import { CUSTOMER_EVENT_LABEL, changeText, periodPresets } from '#lib/utils/change-history.ts';
	import { EVENT_LABEL, HISTORY_EVENTS, SOURCE_LABEL, type HistoryEvent, type HistorySource } from '#lib/utils/install-history.ts';

	let { data }: { data: PageData } = $props();

	const report = $derived(data.report);
	const exportUrl = $derived(`/reports/changes/export${page.url.search}`);
	const presets = periodPresets();
	let from = $state(untrack(() => data.from));
	let to = $state(untrack(() => data.to));
	$effect(() => {
		from = data.from;
		to = data.to;
	});

	function setParams(changes: Record<string, string | null>) {
		const params = new URLSearchParams(page.url.search);
		for (const [k, v] of Object.entries(changes)) {
			if (v) params.set(k, v);
			else params.delete(k);
		}
		goto(`${page.url.pathname}?${params}`);
	}
	const label = (e: string) =>
		(data.customerView ? CUSTOMER_EVENT_LABEL : EVENT_LABEL)[e as HistoryEvent] ?? e;
	const fmt = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
	const eventClass: Record<string, string> = {
		install: 'bg-green-100 text-green-900',
		upgrade: 'bg-blue-100 text-blue-900',
		ptf: 'bg-gray-100 text-gray-800',
		downgrade: 'bg-amber-100 text-amber-900',
		rollback: 'bg-red-100 text-red-900',
		remove: 'bg-gray-200 text-gray-700'
	};
	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
</script>

<svelte:head>
	<title>Change history · Reports</title>
</svelte:head>

<div class="space-y-4">
	<PageHeader
		title="Change history"
		description="What changed on the LPARs in a period: deployments, upgrades, maintenance, rollbacks and removals"
	>
		{#snippet actions()}
			<span class="print:hidden flex gap-2">
				<Button href="/reports" variant="outline">All reports</Button>
				<Button href={exportUrl} variant="outline">CSV</Button>
				<Button variant="outline" onclick={() => window.print()}>Print</Button>
			</span>
		{/snippet}
	</PageHeader>

	<Card class="p-4 print:hidden">
		<div class="mb-3 flex flex-wrap items-end gap-3 border-b pb-3 text-sm">
			<label>
				<span class="mb-1 block text-xs font-medium text-muted-foreground">From</span>
				<input type="date" class="h-9 rounded-md border border-input px-2" bind:value={from} max={to} />
			</label>
			<label>
				<span class="mb-1 block text-xs font-medium text-muted-foreground">To</span>
				<input type="date" class="h-9 rounded-md border border-input px-2" bind:value={to} min={from} />
			</label>
			<Button variant="outline" onclick={() => setParams({ from, to })} disabled={!from || !to || (from === data.from && to === data.to)}>
				Set period
			</Button>
			<span class="flex flex-wrap gap-1">
				{#each presets as p (p.label)}
					<button
						type="button"
						class="rounded-full border px-2.5 py-1 text-xs hover:bg-gray-50 {p.from === data.from && p.to === data.to
							? 'border-primary bg-primary/10'
							: ''}"
						onclick={() => setParams({ from: p.from, to: p.to })}>{p.label}</button
					>
				{/each}
			</span>
			<label class="ml-auto flex items-center gap-2">
				<input type="checkbox" checked={data.hidePtf} onchange={(e) => setParams({ ptf: e.currentTarget.checked ? '0' : null })} />
				Hide PTF-only changes
			</label>
			<label class="flex items-center gap-2" title="Customer wording, without rollback reasons or internal sources">
				<input
					type="checkbox"
					checked={data.customerView}
					onchange={(e) => setParams({ view: e.currentTarget.checked ? 'customer' : null })}
				/>
				Customer view
			</label>
		</div>
		<ReportFilters options={data.options} scope={data.scope} keep={['from', 'to', 'ptf', 'view']} />
	</Card>

	<p class="text-sm">
		<span class="font-medium">Period: {data.from} to {data.to}</span>
		{#if data.hidePtf}<span class="text-muted-foreground"> · PTF-only changes hidden</span>{/if}
	</p>

	{#if !data.customerView}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4 print:hidden">
			<Card class="p-3">
				<div class="text-xs text-muted-foreground">Changes</div>
				<div class="text-2xl font-semibold tabular-nums">{report.totals.changes}</div>
				<div class="text-xs text-muted-foreground">
					{HISTORY_EVENTS.filter((e) => report.totals.byEvent[e])
						.map((e) => `${report.totals.byEvent[e]} ${EVENT_LABEL[e].toLowerCase()}`)
						.join(', ')}
				</div>
			</Card>
			<Card class="p-3">
				<div class="text-xs text-muted-foreground">LPARs changed</div>
				<div class="text-2xl font-semibold tabular-nums">{report.totals.lpars}</div>
			</Card>
			<Card class="p-3">
				<div class="text-xs text-muted-foreground">Products changed</div>
				<div class="text-2xl font-semibold tabular-nums">{report.totals.products}</div>
			</Card>
			<Card class="p-3">
				<div class="text-xs text-muted-foreground">Rollbacks</div>
				<div class="text-2xl font-semibold tabular-nums {report.totals.rollbacks ? 'text-red-700' : ''}">{report.totals.rollbacks}</div>
			</Card>
		</div>
	{/if}

	{#if report.customers.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">No changes in this period for the selection.</Card>
	{/if}

	{#each report.customers as c, i (c.customer.id)}
		<article
			class="rounded-md border bg-white text-sm print:border-0 {data.customerView && i < report.customers.length - 1
				? 'break-after-page'
				: ''}"
		>
			<header class="flex flex-wrap items-baseline justify-between gap-2 border-b bg-gray-50 px-4 py-2 print:bg-white">
				<div>
					{#if data.customerView}<div class="text-xs uppercase tracking-wide text-muted-foreground">Change report</div>{/if}
					<h2 class="text-lg font-semibold">{c.customer.name}</h2>
				</div>
				<div class="text-xs text-muted-foreground">
					{data.from} to {data.to} · {plural(c.changes, 'change')} on {plural(c.lpars.length, 'LPAR')}
				</div>
			</header>
			<div class="space-y-3 p-4">
				{#each c.lpars as l (l.lpar.id)}
					<section class="break-inside-avoid">
						<h3 class="mb-1 font-semibold">
							{#if data.customerView}{l.lpar.code}{:else}<a href="/lpars/{l.lpar.id}/history" class="hover:underline">{l.lpar.code}</a>{/if}
							<span class="font-normal text-muted-foreground">{l.lpar.name}</span>
						</h3>
						<table class="w-full">
							<thead class="text-left text-xs text-muted-foreground">
								<tr class="border-b">
									<th class="py-1 pr-3 w-24">Date</th>
									<th class="py-1 pr-3">Product</th>
									<th class="py-1 pr-3">Change</th>
									<th class="py-1 pr-3">Version</th>
									<th class="py-1 pr-3">{data.customerView ? 'Package' : 'Through'}</th>
									{#if !data.customerView}<th class="py-1">Reason</th>{/if}
								</tr>
							</thead>
							<tbody>
								{#each l.events as e (e.id)}
									<tr class="border-b last:border-b-0 align-top">
										<td class="py-1 pr-3 tabular-nums whitespace-nowrap">
											{fmt(e.occurred_at)}{#if e.reconstructed && !data.customerView}<span
													class="text-muted-foreground"
													title="Rebuilt from data recorded before the install history existed; the date may be approximate"
												>
													*</span
												>{/if}
										</td>
										<td class="py-1 pr-3">
											<span class="font-medium">{e.software.name}</span>
											<span class="block text-xs text-muted-foreground">{e.software.vendor.name}</span>
										</td>
										<td class="py-1 pr-3">
											{#if data.customerView}
												{label(e.event)}
											{:else}
												<span class="inline-block rounded px-1.5 text-xs {eventClass[e.event] ?? ''}">{label(e.event)}</span>
											{/if}
										</td>
										<td class="py-1 pr-3 whitespace-nowrap">{changeText(e)}</td>
										<td class="py-1 pr-3">
											{#if !data.customerView}{SOURCE_LABEL[e.source as HistorySource] ?? e.source}{/if}
											{#if e.package}
												<span class="block text-xs {data.customerView ? '' : 'text-muted-foreground'}">{e.package.code} {e.package.version}</span>
											{/if}
										</td>
										{#if !data.customerView}<td class="py-1">{e.reason ?? ''}</td>{/if}
									</tr>
								{/each}
							</tbody>
						</table>
					</section>
				{/each}
			</div>
		</article>
	{/each}

	{#if report.reconstructed > 0 && !data.customerView}
		<p class="text-xs text-muted-foreground">
			* {plural(report.reconstructed, 'change')} rebuilt from data recorded before the install history existed; dates may be
			approximate and earlier changes may be missing.
		</p>
	{/if}
</div>
