<script lang="ts">
	import type { PageData } from './$types';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import StatusBadge from '$components/common/StatusBadge.svelte';
	import DeleteButton from '$components/common/DeleteButton.svelte';
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

	// Compatibility score color coding and context
	const compatibilityInfo = $derived(() => {
		if (compatibility >= 90) {
			return {
				color: 'bg-green-500',
				textColor: 'text-green-700',
				bgColor: 'bg-green-50',
				borderColor: 'border-green-200',
				label: 'Excellent',
				message: 'LPAR is fully compliant with assigned package'
			};
		} else if (compatibility >= 75) {
			return {
				color: 'bg-blue-500',
				textColor: 'text-blue-700',
				bgColor: 'bg-blue-50',
				borderColor: 'border-blue-200',
				label: 'Good',
				message: 'Minor version differences detected'
			};
		} else if (compatibility >= 50) {
			return {
				color: 'bg-amber-500',
				textColor: 'text-amber-700',
				bgColor: 'bg-amber-50',
				borderColor: 'border-amber-200',
				label: 'Fair',
				message: 'Several software items do not match package'
			};
		} else {
			return {
				color: 'bg-red-500',
				textColor: 'text-red-700',
				bgColor: 'bg-red-50',
				borderColor: 'border-red-200',
				label: 'Poor',
				message: 'Significant drift from assigned package detected'
			};
		}
	});

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
			<DeleteButton
				entityName="LPAR"
				entityId={lpar.id}
				entityLabel={lpar.name}
				variant="destructive"
			/>
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
						<dt class="text-sm font-medium text-muted-foreground mb-2">
							Package Compatibility
							<span
								class="ml-1 text-xs cursor-help"
								title="Measures how closely installed software matches the assigned package. 100% = perfect match."
							>
								ⓘ
							</span>
						</dt>
						<dd class="mt-2">
							<div class="p-3 rounded-lg border {compatibilityInfo().borderColor} {compatibilityInfo().bgColor}">
								<div class="flex items-center justify-between mb-2">
									<span class="text-sm font-semibold {compatibilityInfo().textColor}">
										{compatibilityInfo().label} ({compatibility}%)
									</span>
									<Badge
										variant={compatibility >= 90 ? 'default' : compatibility >= 75 ? 'secondary' : 'destructive'}
									>
										{compatibility}%
									</Badge>
								</div>
								<div class="bg-gray-200 rounded-full h-3 mb-2">
									<div
										class="{compatibilityInfo().color} h-3 rounded-full transition-all duration-500"
										style="width: {compatibility}%"
									></div>
								</div>
								<p class="text-xs {compatibilityInfo().textColor}">
									{compatibilityInfo().message}
								</p>
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
