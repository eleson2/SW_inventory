<script lang="ts">
	import type { PageData } from './$types';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import StatusBadge from '$components/common/StatusBadge.svelte';
	import CloneDialog from '$components/common/CloneDialog.svelte';
	import VersionDisplay from '$components/domain/VersionDisplay.svelte';
	import { formatDateTime } from '$utils/date-format';
	import { createCloneHandler } from '$utils/clone-handler';

	let { data }: { data: PageData } = $props();
	const { vendor } = data;

	let showCloneDialog = $state(false);
	let cloning = $state(false);

	const handleClone = async (formData: Record<string, string>) => {
		cloning = true;
		try {
			const cloneHandler = createCloneHandler({
				entityType: 'vendor',
				sourceId: vendor.id,
				redirectPath: (id) => `/vendors/${id}`,
				errorMessage: 'Failed to clone vendor'
			});
			await cloneHandler(formData);
		} finally {
			cloning = false;
			showCloneDialog = false;
		}
	};
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">{vendor.name}</h1>
			<p class="text-muted-foreground mt-2">Vendor Details and Software Products</p>
		</div>
		<div class="flex gap-2">
			<Button onclick={() => showCloneDialog = true}>
				Clone Vendor
			</Button>
			<Button variant="outline" onclick={() => window.location.href = `/vendors/${vendor.id}/edit`}>
				Edit
			</Button>
			<Button variant="outline" onclick={() => window.history.back()}>
				Back
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
						{#if vendor.contactEmail}
							<a href="mailto:{vendor.contactEmail}" class="text-primary hover:underline">
								{vendor.contactEmail}
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
						{vendor.software.filter(sw => sw.active).length}
					</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Created</dt>
					<dd class="text-sm mt-1">{formatDateTime(vendor.createdAt)}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Last Updated</dt>
					<dd class="text-sm mt-1">{formatDateTime(vendor.updatedAt)}</dd>
				</div>
			</dl>
		</Card>
	</div>

	<Card class="p-6">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-xl font-semibold">Software Products</h2>
			<Button size="sm" onclick={() => window.location.href = '/software/new'}>
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
								<VersionDisplay
									version={{
										version: software.currentVersion,
										ptfLevel: software.currentPtfLevel ?? undefined
									}}
									showBadge={true}
								/>
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

<CloneDialog
	bind:open={showCloneDialog}
	title="Clone Vendor"
	entityType="Vendor"
	sourceName={vendor.name}
	fields={[
		{ name: 'name', label: 'New Vendor Name', required: true, placeholder: 'Enter new vendor name' },
		{ name: 'code', label: 'New Vendor Code', required: true, placeholder: 'e.g., VENDOR-02' }
	]}
	preview={{
		code: vendor.code,
		website: vendor.website || 'N/A',
		'software count': vendor.software.length,
		active: vendor.active ? 'Yes' : 'No'
	}}
	onClone={handleClone}
	loading={cloning}
/>
