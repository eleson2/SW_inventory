<script lang="ts">
	import type { PageData } from './$types';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import StatusBadge from '$components/common/StatusBadge.svelte';
	import VersionDisplay from '$components/domain/VersionDisplay.svelte';
	import CloneDialog from '$components/common/CloneDialog.svelte';
	import { formatDateTime } from '$utils/date-format';
	import { createCloneHandler } from '$utils/clone-handler';

	let { data }: { data: PageData } = $props();
	const { software } = data;

	let showCloneDialog = $state(false);
	let cloning = $state(false);

	// Parse version history from JSONB
	const versionHistory = Array.isArray(software.versionHistory)
		? (software.versionHistory as any[])
		: [];

	const handleClone = async (formData: Record<string, string>) => {
		cloning = true;
		try {
			const cloneHandler = createCloneHandler({
				entityType: 'software',
				sourceId: software.id,
				redirectPath: (id) => `/software/${id}`,
				errorMessage: 'Failed to clone software'
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
			<h1 class="text-3xl font-bold tracking-tight">{software.name}</h1>
			<p class="text-muted-foreground mt-2">Software Product Details</p>
		</div>
		<div class="flex gap-2">
			<Button onclick={() => window.location.href = `/software/${software.id}/version`}>
				New Version
			</Button>
			<Button variant="outline" onclick={() => showCloneDialog = true}>
				Clone Software
			</Button>
			<Button variant="outline" onclick={() => window.location.href = `/software/${software.id}/edit`}>
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
					<dt class="text-sm font-medium text-muted-foreground">Vendor</dt>
					<dd class="text-sm mt-1">
						<a href="/vendors/{software.vendor.id}" class="text-primary hover:underline">
							{software.vendor.name}
						</a>
					</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Description</dt>
					<dd class="text-sm mt-1">{software.description || '-'}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Status</dt>
					<dd class="mt-1">
						<StatusBadge active={software.active} />
					</dd>
				</div>
			</dl>
		</Card>

		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Current Version</h2>
			<div class="space-y-3">
				<VersionDisplay
					version={{
						version: software.currentVersion,
						ptfLevel: software.currentPtfLevel ?? undefined
					}}
					showBadge={true}
				/>
				<div class="flex items-center gap-2 text-sm text-muted-foreground mt-4">
					<span>Last updated: {formatDateTime(software.updatedAt)}</span>
				</div>
			</div>
		</Card>
	</div>

	<Card class="p-6">
		<h2 class="text-xl font-semibold mb-4">Version History</h2>
		{#if versionHistory.length === 0}
			<p class="text-sm text-muted-foreground text-center py-8">No version history available</p>
		{:else}
			<div class="space-y-3">
				{#each versionHistory as version}
					<div class="flex items-center justify-between p-4 border rounded-lg">
						<div class="flex-1">
							<VersionDisplay
								version={{
									version: version.version,
									ptfLevel: version.ptfLevel
								}}
								showBadge={true}
							/>
						</div>
						<div class="text-xs text-muted-foreground">
							{version.date ? formatDateTime(new Date(version.date)) : 'Unknown date'}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Card>
</div>

<CloneDialog
	bind:open={showCloneDialog}
	title="Clone Software Product"
	entityType="Software"
	sourceName={software.name}
	fields={[
		{ name: 'name', label: 'New Software Name', required: true, placeholder: 'Enter new software name' }
	]}
	preview={{
		vendor: software.vendor.name,
		version: software.currentVersion,
		ptfLevel: software.currentPtfLevel || 'N/A',
		'version history': versionHistory.length
	}}
	onClone={handleClone}
	loading={cloning}
/>
