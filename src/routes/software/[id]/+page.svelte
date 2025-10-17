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
			<Button variant="outline" onclick={() => (showCloneDialog = true)}>
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
						{#if software.vendors}
							<a href="/vendors/{software.vendors.id}" class="text-primary hover:underline">
								{software.vendors.name}
							</a>
						{:else}
							-
						{/if}
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
				{#if software.current_version}
					<VersionDisplay
						version={{
							version: software.current_version.version,
							ptfLevel: software.current_version.ptf_level ?? undefined
						}}
						showBadge={true}
					/>
					<div class="text-sm text-muted-foreground mt-2">
						Released: {formatDateTime(new Date(software.current_version.release_date))}
					</div>
					{#if software.current_version.end_of_support}
						<div class="text-sm text-muted-foreground">
							Support ends: {formatDateTime(new Date(software.current_version.end_of_support))}
						</div>
					{/if}
				{:else}
					<p class="text-sm text-muted-foreground">No current version set</p>
				{/if}
				<div class="flex items-center gap-2 text-sm text-muted-foreground mt-4">
					<span>Last updated: {formatDateTime(new Date(software.updated_at))}</span>
				</div>
			</div>
		</Card>
	</div>

	<Card class="p-6">
		<h2 class="text-xl font-semibold mb-4">Version History</h2>
		{#if software.versions.length === 0}
			<p class="text-sm text-muted-foreground text-center py-8">No version history available</p>
		{:else}
			<div class="space-y-3">
				{#each software.versions as version}
					<div class="flex items-center justify-between p-4 border rounded-lg">
						<div class="flex-1">
							<div class="flex items-center gap-3">
								<VersionDisplay
									version={{
										version: version.version,
										ptfLevel: version.ptf_level ?? undefined
									}}
									showBadge={true}
								/>
								{#if version.is_current}
									<Badge variant="default">Current</Badge>
								{/if}
							</div>
							{#if version.release_notes}
								<div class="text-sm text-muted-foreground mt-2">
									{version.release_notes}
								</div>
							{/if}
						</div>
						<div class="text-right">
							<div class="text-sm text-muted-foreground">
								{formatDateTime(new Date(version.release_date))}
							</div>
							{#if version.end_of_support}
								<div class="text-xs text-muted-foreground mt-1">
									EOS: {formatDateTime(new Date(version.end_of_support))}
								</div>
							{/if}
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
		{ name: 'name', label: 'Software Name', required: true, placeholder: 'Enter software name' },
		{ name: 'description', label: 'Description', placeholder: 'Enter description (optional)' }
	]}
	initialValues={{
		name: `${software.name} - copy`,
		description: software.description || ''
	}}
	preview={{
		'Current Vendor': software.vendors?.name || 'Unknown',
		'Current Version': software.current_version?.version || 'N/A',
		'Current PTF Level': software.current_version?.ptf_level || 'N/A',
		'Version History Count': software.versions.length
	}}
	onClone={handleClone}
	loading={cloning}
/>
