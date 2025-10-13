<script lang="ts">
	import type { PageData } from './$types';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import StatusBadge from '$components/common/StatusBadge.svelte';
	import VersionDisplay from '$components/domain/VersionDisplay.svelte';
	import CloneDialog from '$components/common/CloneDialog.svelte';
	import { formatDateTime } from '$utils/date-format';

	let { data }: { data: PageData } = $props();
	const { lpar, compatibility } = data;

	let showCloneDialog = $state(false);
	let cloning = $state(false);

	async function handleClone(formData: Record<string, string>) {
		cloning = true;
		try {
			const response = await fetch('/api/clone', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					entityType: 'lpar',
					sourceId: lpar.id,
					data: {
						name: formData.name,
						code: formData.code,
						customerId: formData.customerId || lpar.customerId
					}
				})
			});

			const result = await response.json();
			if (result.success) {
				window.location.href = `/lpars/${result.data.id}`;
			} else {
				alert(`Error: ${result.error}`);
			}
		} catch (error) {
			console.error('Clone error:', error);
			alert('Failed to clone LPAR');
		} finally {
			cloning = false;
			showCloneDialog = false;
		}
	}
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
						{#if lpar.customer}
							<a href="/customers/{lpar.customer.id}" class="text-primary hover:underline">
								{lpar.customer.name}
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
			{#if lpar.currentPackage}
				<dl class="space-y-3">
					<div>
						<dt class="text-sm font-medium text-muted-foreground">Current Package</dt>
						<dd class="text-sm mt-1">
							<a href="/packages/{lpar.currentPackage.id}" class="text-primary hover:underline">
								{lpar.currentPackage.name}
							</a>
						</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-muted-foreground">Package Code</dt>
						<dd class="mt-1">
							<Badge variant="outline">{lpar.currentPackage.code}</Badge>
						</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-muted-foreground">Package Version</dt>
						<dd class="mt-1">
							<Badge>{lpar.currentPackage.version}</Badge>
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
			<Button size="sm" onclick={() => window.location.href = `/lpars/${lpar.id}/software/add`}>
				Add Software
			</Button>
		</div>

		{#if lpar.softwareInstalled.length === 0}
			<p class="text-sm text-muted-foreground text-center py-8">No software installed</p>
		{:else}
			<div class="space-y-3">
				{#each lpar.softwareInstalled as software}
					<div class="flex items-center justify-between p-4 border rounded-lg">
						<div class="flex-1">
							<div class="font-medium">
								{software.software?.name || `Software ${software.softwareId}`}
							</div>
							<div class="flex items-center gap-3 mt-1">
								<VersionDisplay version={software.version} showBadge={true} />
								{#if software.rolledBack}
									<Badge variant="destructive">Rolled Back</Badge>
								{/if}
							</div>
						</div>
						<div class="flex flex-col items-end gap-2">
							<span class="text-xs text-muted-foreground">
								Installed: {formatDateTime(software.installedDate)}
							</span>
							{#if software.previousVersion}
								<Button
									size="sm"
									variant="outline"
									onclick={() => {
										// TODO: Implement rollback
										console.log('Rollback', software.softwareId);
									}}
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
		customer: lpar.customer?.name || 'N/A',
		package: lpar.currentPackage?.name || 'N/A',
		'software count': lpar.softwareInstalled.length
	}}
	onClone={handleClone}
	loading={cloning}
/>
