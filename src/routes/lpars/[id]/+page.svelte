<script lang="ts">
	import type { PageData } from './$types';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import StatusBadge from '$components/common/StatusBadge.svelte';
	import VersionDisplay from '$components/domain/VersionDisplay.svelte';
	import CloneDialog from '$components/common/CloneDialog.svelte';
	import RollbackDialog from '$components/common/RollbackDialog.svelte';
	import { formatDateTime } from '$utils/date-format';
	import { createCloneHandler } from '$utils/clone-handler';

	let { data }: { data: PageData } = $props();
	const { lpar, compatibility } = data;

	let showCloneDialog = $state(false);
	let cloning = $state(false);
	let showRollbackDialog = $state(false);
	let selectedSoftware = $state<any>(null);

	const handleClone = async (formData: Record<string, string>) => {
		cloning = true;
		try {
			const cloneHandler = createCloneHandler({
				entityType: 'lpar',
				sourceId: lpar.id,
				redirectPath: (id) => `/lpars/${id}`,
				errorMessage: 'Failed to clone LPAR'
			});
			await cloneHandler(formData);
		} finally {
			cloning = false;
			showCloneDialog = false;
		}
	};

	const openRollbackDialog = (software: any) => {
		selectedSoftware = software;
		showRollbackDialog = true;
	};
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">{lpar.name}</h1>
			<p class="text-muted-foreground mt-2">LPAR Details and Configuration</p>
		</div>
		<div class="flex gap-2">
			<Button onclick={() => showCloneDialog = true}>
				Clone LPAR
			</Button>
			<Button variant="outline" onclick={() => window.location.href = `/lpars/${lpar.id}/edit`}>
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
					<dt class="text-sm font-medium text-muted-foreground">LPAR Code</dt>
					<dd class="text-sm mt-1 font-mono">{lpar.code}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Customer</dt>
					<dd class="text-sm mt-1">
						{#if lpar.customers}
							<a href="/customers/{lpar.customers.id}" class="text-primary hover:underline">
								{lpar.customers.name}
							</a>
						{:else}
							-
						{/if}
					</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Description</dt>
					<dd class="text-sm mt-1">{lpar.description || '-'}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Status</dt>
					<dd class="mt-1">
						<StatusBadge active={lpar.active} />
					</dd>
				</div>
			</dl>
		</Card>

		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Package Information</h2>
			{#if lpar.packages}
				<dl class="space-y-3">
					<div>
						<dt class="text-sm font-medium text-muted-foreground">Current Package</dt>
						<dd class="text-sm mt-1">
							<a href="/packages/{lpar.packages.id}" class="text-primary hover:underline">
								{lpar.packages.name}
							</a>
						</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-muted-foreground">Package Code</dt>
						<dd class="mt-1">
							<Badge variant="outline">{lpar.packages.code}</Badge>
						</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-muted-foreground">Package Version</dt>
						<dd class="mt-1">
							<Badge>{lpar.packages.version}</Badge>
						</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-muted-foreground">Compatibility Score</dt>
						<dd class="text-sm mt-1">
							<div class="flex items-center gap-2">
								<div class="flex-1 bg-muted rounded-full h-2">
									<div
										class="bg-primary h-2 rounded-full transition-all"
										style="width: {compatibility}%"
									></div>
								</div>
								<span class="text-sm font-medium">{compatibility}%</span>
							</div>
						</dd>
					</div>
				</dl>
			{:else}
				<p class="text-sm text-muted-foreground">No package assigned</p>
			{/if}
		</Card>
	</div>

	<Card class="p-6">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-xl font-semibold">Installed Software</h2>
			<Button size="sm" onclick={() => window.location.href = `/lpars/${lpar.id}/edit`}>
				Manage Software
			</Button>
		</div>

		{#if lpar.lpar_software.length === 0}
			<p class="text-sm text-muted-foreground text-center py-8">No software installed</p>
		{:else}
			<div class="space-y-3">
				{#each lpar.lpar_software as software}
					<div class="flex items-center justify-between p-4 border rounded-lg">
						<div class="flex-1">
							<div class="font-medium">
								{software.software?.name || `Software ${software.software_id}`}
							</div>
							<div class="flex items-center gap-3 mt-1">
								<VersionDisplay version={{ version: software.current_version, ptfLevel: software.current_ptf_level || undefined }} showBadge={true} />
								{#if software.rolled_back}
									<Badge variant="destructive">Rolled Back</Badge>
								{/if}
							</div>
						</div>
						<div class="flex flex-col items-end gap-2">
							<span class="text-xs text-muted-foreground">
								Installed: {formatDateTime(new Date(software.installed_date))}
							</span>
							{#if software.software?.versions && software.software.versions.length > 1}
								<Button
									size="sm"
									variant="outline"
									onclick={() => openRollbackDialog(software)}
								>
									Rollback
								</Button>
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
	title="Clone LPAR"
	entityType="LPAR"
	sourceName={lpar.name}
	fields={[
		{ name: 'name', label: 'New LPAR Name', required: true, placeholder: 'Enter new LPAR name' },
		{ name: 'code', label: 'New LPAR Code', required: true, placeholder: 'e.g., PROD-LPAR-2' }
	]}
	preview={{
		customer: lpar.customers?.name || 'N/A',
		package: lpar.packages?.name || 'N/A',
		'software count': lpar.lpar_software.length
	}}
	onClone={handleClone}
	loading={cloning}
/>

{#if selectedSoftware}
	<RollbackDialog
		bind:open={showRollbackDialog}
		softwareName={selectedSoftware.software?.name || 'Unknown Software'}
		softwareId={selectedSoftware.software_id}
		lparId={lpar.id}
		currentVersion={selectedSoftware.current_version}
		currentPtfLevel={selectedSoftware.current_ptf_level}
		versions={selectedSoftware.software?.versions || []}
	/>
{/if}
