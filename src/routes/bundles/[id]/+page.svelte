<script lang="ts">
	import { versionName } from '#lib/utils/version-parser.ts';
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import StatusBadge from '#lib/components/common/StatusBadge.svelte';
	import DeleteButton from '#lib/components/common/DeleteButton.svelte';
	import Breadcrumb from '#lib/components/common/Breadcrumb.svelte';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import { formatDate, formatDateTime } from '#lib/utils/date-format.ts';

	let { data }: { data: PageData } = $props();
	const { bundle, packages } = $derived(data);
</script>

<div class="space-y-6">
	<Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Vendor Bundles', href: '/bundles' }, { label: bundle.code }]} />

	<PageHeader title="{bundle.code} – {bundle.name}" description="{bundle.vendors.name} maintenance bundle">
		{#snippet actions()}
			<Button onclick={() => goto(`/packages/new?bundles=${bundle.id}`)} disabled={bundle.items.length === 0}>
				Create Package
			</Button>
			<Button variant="outline" onclick={() => goto(`/bundles/new?clone=${bundle.id}`)}>Clone as Next Level</Button>
			<Button variant="outline" onclick={() => goto(`/bundles/${bundle.id}/edit`)}>Edit</Button>
			<DeleteButton entityName="Bundle" entityId={bundle.id} entityLabel={bundle.code} variant="destructive" />
		{/snippet}
	</PageHeader>

	<div class="grid gap-6 md:grid-cols-2">
		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Bundle Information</h2>
			<dl class="space-y-3">
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Vendor</dt>
					<dd class="text-sm mt-1">
						<a href="/vendors/{bundle.vendors.id}" class="text-primary hover:underline">{bundle.vendors.name}</a>
					</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Type</dt>
					<dd class="mt-1"><Badge variant="secondary">{bundle.bundle_type}</Badge></dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Release Date</dt>
					<dd class="text-sm mt-1">{formatDate(bundle.release_date)}</dd>
				</div>
				{#if bundle.source_url}
					<div>
						<dt class="text-sm font-medium text-muted-foreground">Source</dt>
						<dd class="text-sm mt-1 break-all">
							<a href={bundle.source_url} target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">{bundle.source_url}</a>
						</dd>
					</div>
				{/if}
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Description</dt>
					<dd class="text-sm mt-1 whitespace-pre-line">{bundle.description || '-'}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Status</dt>
					<dd class="mt-1"><StatusBadge active={bundle.active} /></dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Last Updated</dt>
					<dd class="text-sm mt-1">{formatDateTime(bundle.updated_at)}</dd>
				</div>
			</dl>
		</Card>

		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Used in Packages</h2>
			{#if packages.length === 0}
				<p class="text-sm text-muted-foreground">No package has been built from this bundle yet.</p>
			{:else}
				<ul class="space-y-2">
					{#each packages as pkg}
						<li class="flex items-center justify-between text-sm">
							<a href="/packages/{pkg.id}" class="text-primary hover:underline">{pkg.name}</a>
							<span class="text-muted-foreground">
								{pkg.code} {pkg.version} · {pkg._count.package_items} item(s) from this bundle
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</Card>
	</div>

	<Card class="p-6">
		<h2 class="text-xl font-semibold mb-4">Contents ({bundle.items.length})</h2>
		{#if bundle.items.length === 0}
			<p class="text-sm text-muted-foreground text-center py-8">This bundle has no items.</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b text-left text-muted-foreground">
							<th class="py-2 pr-4 font-medium">Software</th>
							<th class="py-2 pr-4 font-medium">Product Code</th>
							<th class="py-2 pr-4 font-medium">Version</th>
							<th class="py-2 pr-4 font-medium">PTF Level</th>
							<th class="py-2 font-medium">Notes</th>
						</tr>
					</thead>
					<tbody>
						{#each bundle.items as item}
							<tr class="border-b">
								<td class="py-2 pr-4">
									<a href="/software/{item.software.id}" class="text-primary hover:underline">{item.software.name}</a>
								</td>
								<td class="py-2 pr-4 font-mono text-xs">{item.software.product_code ?? '-'}</td>
								<td class="py-2 pr-4">
									{versionName(item.software_version)}
									{#if item.software_version.is_current}
										<Badge variant="outline" class="ml-1 text-xs">current</Badge>
									{/if}
								</td>
								<td class="py-2 pr-4 font-mono">{item.software_version.ptf_level ?? '-'}</td>
								<td class="py-2 text-muted-foreground">{item.notes ?? ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>
</div>
