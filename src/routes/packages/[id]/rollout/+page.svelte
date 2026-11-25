<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { SvelteSet } from 'svelte/reactivity';
	import Breadcrumb from '#lib/components/common/Breadcrumb.svelte';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import MultiSelect from '#lib/components/reports/MultiSelect.svelte';
	import { OPEN_STAGES, ROLLOUT_STAGES, STAGE_LABEL, isOverdue, type RolloutStage } from '#lib/utils/rollout.ts';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const today = new Date();
	const STAGE_CLS: Record<RolloutStage, string> = {
		initiated: 'bg-slate-100 text-slate-800',
		planned: 'bg-blue-100 text-blue-900',
		installed: 'bg-green-100 text-green-900',
		superseded: 'bg-gray-100 text-gray-500',
		cancelled: 'bg-gray-100 text-gray-500 line-through'
	};
	const ORDER: Record<string, number> = { planned: 0, initiated: 1, installed: 2, superseded: 3, cancelled: 4 };

	const rows = $derived(
		[...data.rollouts].sort(
			(a, b) =>
				(ORDER[a.stage] ?? 9) - (ORDER[b.stage] ?? 9) ||
				(a.planned_date ? new Date(a.planned_date).getTime() : Infinity) -
					(b.planned_date ? new Date(b.planned_date).getTime() : Infinity) ||
				a.lpar.code.localeCompare(b.lpar.code)
		)
	);
	const counts = $derived(
		Object.fromEntries(ROLLOUT_STAGES.map((s) => [s, data.rollouts.filter((r) => r.stage === s).length])) as Record<
			RolloutStage,
			number
		>
	);
	const isOpen = (stage: string) => (OPEN_STAGES as string[]).includes(stage);

	/** LPARs that can get a new rollout: none yet, or only a cancelled one */
	const taken = $derived(new Set(data.rollouts.filter((r) => r.stage !== 'cancelled').map((r) => r.lpar_id)));
	const lparOptions = $derived(
		data.lpars
			.filter((l) => !taken.has(l.id))
			.map((l) => ({
				id: l.id,
				label: l.code,
				hint: l.packages ? `now ${l.packages.code} ${l.packages.version}` : 'no package',
				group: l.customers.name
			}))
	);
	let planLpars = $state<string[]>([]);

	const selected = new SvelteSet<string>();
	const openIds = $derived(rows.filter((r) => isOpen(r.stage)).map((r) => r.id));
	const allSelected = $derived(openIds.length > 0 && openIds.every((id) => selected.has(id)));
	function toggleAll() {
		if (allSelected) selected.clear();
		else openIds.forEach((id) => selected.add(id));
	}

	const fmtDate = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
	const afterSubmit = () => {
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			selected.clear();
			planLpars = [];
		};
	};
</script>

<svelte:head>
	<title>Rollout · {data.pkg.code}</title>
</svelte:head>

<div class="space-y-4">
	<Breadcrumb
		items={[
			{ label: 'Packages', href: '/packages' },
			{ label: data.pkg.code, href: `/packages/${data.pkg.id}` },
			{ label: 'Rollout' }
		]}
	/>
	<PageHeader
		title="Rollout of {data.pkg.name} ({data.pkg.version})"
		description="Lifecycle per LPAR: initiated → planned → installed → superseded, or cancelled. Installing happens by deploying the package."
	>
		{#snippet actions()}
			<span class="flex gap-2">
				<Button href="/reports/rollout?package={data.pkg.id}" variant="outline">Rollout report</Button>
				<Button href="/packages/{data.pkg.id}/deploy">Deploy package</Button>
			</span>
		{/snippet}
	</PageHeader>

	{#if form?.message}
		<div class="rounded-md border px-4 py-2 text-sm {page.status >= 400 ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'}">
			{form.message}
		</div>
	{/if}

	<div class="flex flex-wrap gap-2 text-sm">
		{#each ROLLOUT_STAGES as s (s)}
			<span class="rounded px-2 py-1 {STAGE_CLS[s]}">{STAGE_LABEL[s]}: <b class="tabular-nums">{counts[s]}</b></span>
		{/each}
	</div>

	<Card class="p-4">
		<h2 class="mb-2 font-semibold">Plan rollout</h2>
		<form method="POST" action="?/plan" use:enhance={afterSubmit} class="flex flex-wrap items-end gap-3 text-sm">
			<div class="min-w-72">
				<MultiSelect label="LPARs" options={lparOptions} bind:selected={planLpars} allText="None" emptyText="Every LPAR already has a rollout of this package" />
				{#each planLpars as id (id)}<input type="hidden" name="lpar" value={id} />{/each}
			</div>
			<label>
				<span class="mb-1 block text-xs font-medium text-muted-foreground">Planned date (optional)</span>
				<input type="date" name="planned_date" class="h-9 rounded-md border border-input px-2" />
			</label>
			<label class="grow">
				<span class="mb-1 block text-xs font-medium text-muted-foreground">Note (optional)</span>
				<input name="notes" maxlength="500" class="h-9 w-full rounded-md border border-input px-2" placeholder="e.g. change CHG0012345" />
			</label>
			<Button type="submit" disabled={planLpars.length === 0}>
				Plan for {planLpars.length} LPAR{planLpars.length === 1 ? '' : 's'}
			</Button>
		</form>
		<p class="mt-2 text-xs text-muted-foreground">Without a date the LPARs are “initiated”; with a date “planned”.</p>
	</Card>

	<Card class="p-4">
		{#if rows.length === 0}
			<p class="text-sm text-muted-foreground">No LPAR has a rollout of this package yet.</p>
		{:else}
			<form method="POST" action="?/setDate" use:enhance={afterSubmit}>
				{#each [...selected] as id (id)}<input type="hidden" name="id" value={id} />{/each}
				<div class="mb-3 flex flex-wrap items-end gap-2 text-sm">
					<span class="text-muted-foreground">{selected.size} selected:</span>
					<input type="date" name="planned_date" class="h-9 rounded-md border border-input px-2" />
					<Button type="submit" variant="outline" formaction="?/setDate" disabled={selected.size === 0}>
						Set planned date (empty clears it)
					</Button>
					<Button type="submit" variant="outline" formaction="?/cancel" disabled={selected.size === 0}>Cancel rollout</Button>
				</div>
			</form>
			<div class="overflow-auto rounded-md border">
				<table class="w-full text-sm">
					<thead class="text-left">
						<tr class="border-b">
							<th class="w-8 px-3 py-2">
								<input type="checkbox" checked={allSelected} onchange={toggleAll} disabled={openIds.length === 0} title="Select all open rollouts" />
							</th>
							<th class="px-3 py-2">Customer</th>
							<th class="px-3 py-2">LPAR</th>
							<th class="px-3 py-2">Stage</th>
							<th class="px-3 py-2">Planned</th>
							<th class="px-3 py-2">Initiated</th>
							<th class="px-3 py-2">Installed</th>
							<th class="px-3 py-2">Superseded / cancelled</th>
							<th class="px-3 py-2">Note</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as r (r.id)}
							{@const stage = r.stage as RolloutStage}
							{@const overdue = isOverdue({ stage: r.stage, planned_date: r.planned_date ? new Date(r.planned_date) : null }, today)}
							<tr class="border-b {overdue ? 'bg-red-50' : ''}">
								<td class="px-3 py-1.5">
									{#if isOpen(r.stage)}
										<input
											type="checkbox"
											checked={selected.has(r.id)}
											onchange={() => (selected.has(r.id) ? selected.delete(r.id) : selected.add(r.id))}
										/>
									{/if}
								</td>
								<td class="px-3 py-1.5">{r.lpar.customers.name}</td>
								<td class="px-3 py-1.5 font-medium">
									<a href="/lpars/{r.lpar.id}" class="text-primary hover:underline" title={r.lpar.name}>{r.lpar.code}</a>
								</td>
								<td class="px-3 py-1.5"><span class="rounded px-1.5 text-xs {STAGE_CLS[stage]}">{STAGE_LABEL[stage]}</span></td>
								<td class="px-3 py-1.5 whitespace-nowrap tabular-nums {overdue ? 'font-semibold text-red-800' : ''}">
									{fmtDate(r.planned_date)}{overdue ? ' (overdue)' : ''}
								</td>
								<td class="px-3 py-1.5 whitespace-nowrap tabular-nums">{fmtDate(r.initiated_at)}</td>
								<td class="px-3 py-1.5 whitespace-nowrap tabular-nums">{fmtDate(r.installed_at)}</td>
								<td class="px-3 py-1.5 whitespace-nowrap tabular-nums">{fmtDate(r.superseded_at ?? r.cancelled_at)}</td>
								<td class="px-3 py-1.5 text-xs">{r.notes ?? ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>
</div>
