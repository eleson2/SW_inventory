<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ReportFilters from '#lib/components/reports/ReportFilters.svelte';
	import { ROLLOUT_STAGES, STAGE_LABEL, type RolloutStage } from '#lib/utils/rollout.ts';

	let { data }: { data: PageData } = $props();

	let showClosed = $state(false);
	const exportUrl = $derived(`/reports/rollout/export${page.url.search}`);

	const STAGE: Record<RolloutStage, { bar: string; badge: string }> = {
		initiated: { bar: 'bg-slate-300', badge: 'bg-slate-100 text-slate-800' },
		planned: { bar: 'bg-blue-400', badge: 'bg-blue-100 text-blue-900' },
		installed: { bar: 'bg-green-600', badge: 'bg-green-100 text-green-900' },
		superseded: { bar: 'bg-green-300', badge: 'bg-gray-100 text-gray-500' },
		cancelled: { bar: 'bg-gray-200', badge: 'bg-gray-100 text-gray-500 line-through' }
	};
	/** Bar order: done first */
	const BAR: RolloutStage[] = ['installed', 'superseded', 'planned', 'initiated'];

	function pickPackage(id: string) {
		const params = new URLSearchParams(page.url.search);
		params.delete('package');
		if (id) params.set('package', id);
		goto(`${page.url.pathname}?${params}`);
	}

	const fmtDate = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
	const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`);
	const visible = (stage: RolloutStage) => showClosed || (stage !== 'superseded' && stage !== 'cancelled');
</script>

<svelte:head>
	<title>Rollout progress · Reports</title>
	<style>
		@media print {
			@page { size: landscape; margin: 10mm; }
		}
	</style>
</svelte:head>

<div class="space-y-4">
	<PageHeader title="Rollout progress" description="Per package: the lifecycle stage on each target LPAR">
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
				<span class="mb-1 block text-xs font-medium text-muted-foreground">Package</span>
				<select class="h-9 min-w-64 rounded-md border border-input px-2" value={data.packageIds[0] ?? ''} onchange={(e) => pickPackage(e.currentTarget.value)}>
					<option value="">All packages with a rollout</option>
					{#each data.packages as p (p.id)}
						<option value={p.id}>{p.code} {p.version} – {p.name}</option>
					{/each}
				</select>
			</label>
			<label class="flex items-center gap-1.5 pb-2">
				<input type="checkbox" bind:checked={showClosed} /> Show superseded and cancelled
			</label>
		</div>
		<ReportFilters options={data.options} scope={data.scope} keep={['package']} />
	</Card>

	{#if data.groups.length === 0}
		<Card class="p-6 text-sm text-muted-foreground">
			No rollouts for the selected LPARs. Plan one from a package's <b>Rollout</b> page.
		</Card>
	{/if}

	{#each data.groups as g (g.package.id)}
		{@const targets = g.rows.length - g.counts.cancelled}
		<section class="space-y-2 break-inside-avoid-page">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="text-lg font-semibold">
					<a href="/packages/{g.package.id}/rollout" class="hover:underline">{g.package.code} {g.package.version}</a>
					<span class="text-sm font-normal text-muted-foreground">{g.package.name} · released {fmtDate(g.package.release_date)}</span>
				</h2>
				<div class="flex flex-wrap gap-1.5 text-xs">
					{#each ROLLOUT_STAGES as s (s)}
						{#if g.counts[s]}<span class="rounded px-1.5 {STAGE[s].badge}">{STAGE_LABEL[s]} {g.counts[s]}</span>{/if}
					{/each}
					{#if g.overdue}<span class="rounded bg-red-100 px-1.5 font-medium text-red-800">{g.overdue} overdue</span>{/if}
				</div>
			</div>
			<div class="flex items-center gap-3">
				<div class="flex h-3 w-full max-w-xl overflow-hidden rounded bg-gray-100 print:border">
					{#each BAR as s (s)}
						<div class={STAGE[s].bar} style="width: {targets ? (g.counts[s] / targets) * 100 : 0}%" title="{STAGE_LABEL[s]}: {g.counts[s]}"></div>
					{/each}
				</div>
				<span class="text-sm whitespace-nowrap">
					<b class="tabular-nums">{pct(g.progress)}</b> installed
					<span class="text-muted-foreground">({g.counts.installed + g.counts.superseded} of {targets})</span>
				</span>
			</div>

			<div class="overflow-auto rounded-md border print:overflow-visible">
				<table class="w-full text-sm">
					<thead class="text-left">
						<tr class="border-b">
							<th class="px-3 py-2">Customer</th>
							<th class="px-3 py-2">LPAR</th>
							<th class="px-3 py-2">Stage</th>
							<th class="px-3 py-2">Planned</th>
							<th class="px-3 py-2">Installed</th>
							<th class="px-3 py-2">Compliance</th>
							<th class="px-3 py-2">Note</th>
						</tr>
					</thead>
					<tbody>
						{#each g.rows.filter((r) => visible(r.stage)) as r (r.id)}
							<tr class="border-b {r.overdue ? 'bg-red-50' : ''}">
								<td class="px-3 py-1.5">{r.lpar.customer.name}</td>
								<td class="px-3 py-1.5 font-medium">
									<a href="/reports/installed?customer={r.lpar.customer.id}&lpar={r.lpar.id}" class="text-primary hover:underline" title={r.lpar.name}>{r.lpar.code}</a>
								</td>
								<td class="px-3 py-1.5"><span class="rounded px-1.5 text-xs {STAGE[r.stage].badge}">{STAGE_LABEL[r.stage]}</span></td>
								<td class="px-3 py-1.5 whitespace-nowrap tabular-nums {r.overdue ? 'font-semibold text-red-800' : ''}">
									{fmtDate(r.planned_date)}{r.overdue ? ' (overdue)' : ''}
								</td>
								<td class="px-3 py-1.5 whitespace-nowrap tabular-nums">
									{fmtDate(r.installed_at)}
									{#if r.superseded_at}<span class="text-xs text-muted-foreground">superseded {fmtDate(r.superseded_at)}</span>{/if}
								</td>
								<td class="px-3 py-1.5 tabular-nums">
									{#if r.compliance !== null}
										<span class={r.compliance === 1 ? 'text-green-800' : 'font-medium text-amber-800'}>{pct(r.compliance)}</span>
									{/if}
								</td>
								<td class="px-3 py-1.5 text-xs">{r.notes ?? ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/each}
</div>
