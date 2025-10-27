<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import StatusBadge from '$components/common/StatusBadge.svelte';
	import DeleteButton from '$components/common/DeleteButton.svelte';
	import Breadcrumb from '$components/common/Breadcrumb.svelte';
	import VersionDisplay from '$components/domain/VersionDisplay.svelte';
	import { formatDateTime } from '$utils/date-format';

	let { data }: { data: PageData } = $props();
	const { vendor } = data;

	const breadcrumbItems = [
		{ label: 'Home', href: '/' },
		{ label: 'Vendors', href: '/vendors' },
		{ label: vendor.name }
	];
</script>

<div class="space-y-6">
	<!-- Breadcrumb Navigation -->
	<Breadcrumb items={breadcrumbItems} />

	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">{vendor.name}</h1>
			<p class="text-muted-foreground mt-2">Vendor Details and Software Products</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" onclick={() => goto(`/vendors/${vendor.id}/edit`)}>
				Edit
			</Button>
			<DeleteButton
				entityName="Vendor"
				entityId={vendor.id}
				entityLabel={vendor.name}
				variant="destructive"
			/>
			<Button variant="outline" onclick={() => goto('/vendors')}>
				Back to List
			</Button>
		</div>
	</div>

	<div class="grid gap-6 md:grid-cols-2">
		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Basic Information</h2>
			<dl class="space-y-3">
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Vendor Code</dt>
					<dd class="text-sm mt-1 font-mono">{vendor.code}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Website</dt>
					<dd class="text-sm mt-1">
						{#if vendor.website}
							<a href={vendor.website} target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
								{vendor.website}
							</a>
						{:else}
							-
						{/if}
					</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Contact Email</dt>
					<dd class="text-sm mt-1">
						{#if vendor.contact_email}
							<a href="mailto:{vendor.contact_email}" class="text-primary hover:underline">
								{vendor.contact_email}
							</a>
						{:else}
							-
						{/if}
					</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Status</dt>
					<dd class="mt-1">
						<StatusBadge active={vendor.active} />
					</dd>
				</div>
			</dl>
		</Card>

		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Statistics</h2>
			<dl class="space-y-3">
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Total Software Products</dt>
					<dd class="text-2xl font-bold mt-1">{vendor.software.length}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Active Products</dt>
					<dd class="text-2xl font-bold mt-1">
						{vendor.software.filter((sw: { active: boolean }) => sw.active).length}
					</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Created</dt>
					<dd class="text-sm mt-1">{formatDateTime(new Date(vendor.created_at))}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Last Updated</dt>
					<dd class="text-sm mt-1">{formatDateTime(new Date(vendor.updated_at))}</dd>
				</div>
			</dl>
		</Card>
	</div>

	<Card class="p-6">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-xl font-semibold">Software Products</h2>
			<Button size="sm" onclick={() => window.location.href = `/software/new?vendor_id=${vendor.id}`}>
				Add Software
			</Button>
		</div>

		{#if vendor.software.length === 0}
			<p class="text-sm text-muted-foreground text-center py-8">No software products from this vendor</p>
		{:else}
			<div class="space-y-3">
				{#each vendor.software as software}
					<div class="flex items-center justify-between p-4 border rounded-lg">
						<div class="flex-1">
							<div class="font-medium">
								<a href="/software/{software.id}" class="text-primary hover:underline">
									{software.name}
								</a>
							</div>
							<div class="flex items-center gap-3 mt-1">
								{#if software.current_version}
									<VersionDisplay
										version={{
											version: software.current_version.version,
											ptfLevel: software.current_version.ptf_level ?? undefined
										}}
										showBadge={true}
									/>
								{:else}
									<span class="text-xs text-muted-foreground">No version set</span>
								{/if}
								{#if software.description}
									<span class="text-sm text-muted-foreground">
										{software.description.substring(0, 100)}{software.description.length > 100 ? '...' : ''}
									</span>
								{/if}
							</div>
						</div>
						<div class="flex items-center gap-2">
							<StatusBadge active={software.active} />
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Card>
</div>
