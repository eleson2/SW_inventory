<!--
	LparSoftwareManager.svelte
	Master-detail component for managing LPAR software installations inline

	Features:
	- Add/remove software installations
	- Software and version dropdowns (cascading)
	- Installation date tracking
	- Package compliance indicator
	- Inline validation
	- Visual state tracking (new/existing/deleted)
-->
<script lang="ts">
	import type { LparSoftwareInstallation } from '$lib/schemas/lpar';
	import Button from '$components/ui/Button.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import Label from '$components/ui/Label.svelte';
	import ConfirmationDialog from '$components/common/ConfirmationDialog.svelte';

	interface SoftwareWithVersions {
		id: string;
		name: string;
		vendors: { name: string };
		versions: Array<{
			id: string;
			version: string;
			ptf_level: string | null;
			is_current: boolean;
		}>;
	}

	interface PackageInfo {
		id: string;
		name: string;
		package_items: Array<{
			software_id: string;
		}>;
	}

	interface Props {
		installations: LparSoftwareInstallation[];
		allSoftware: SoftwareWithVersions[];
		assignedPackage?: PackageInfo | null;
		errors?: Record<string, string[]>;
	}

	let { installations = $bindable([]), allSoftware, assignedPackage, errors }: Props = $props();

	// Track which installation is being edited (inline editing)
	let editingIndex = $state<number | null>(null);

	// Confirmation dialog state
	let showDeleteConfirmation = $state(false);
	let installationToDelete = $state<number | null>(null);

	// Add a new installation
	function addInstallation() {
		installations.push({
			software_id: '',
			software_version_id: '',
			installed_date: new Date(),
			_action: undefined
		});
		editingIndex = installations.length - 1;
	}

	// Remove an installation
	// Initiate installation removal
	function initiateRemoveInstallation(index: number) {
		installationToDelete = index;
		showDeleteConfirmation = true;
	}

	// Confirm installation removal
	function confirmRemoveInstallation() {
		if (installationToDelete !== null) {
			const installation = installations[installationToDelete];
			if (installation.id) {
				// Mark existing installation for deletion
				installation._action = 'delete';
			} else {
				// Remove new installation completely
				installations.splice(installationToDelete, 1);
				if (editingIndex === installationToDelete) {
					editingIndex = null;
				}
			}
			installationToDelete = null;
		}
	}

	// Cancel installation removal
	function cancelRemoveInstallation() {
		installationToDelete = null;
	}

	// Get versions for selected software
	function getVersionsForSoftware(softwareId: string) {
		const software = allSoftware.find(s => s.id === softwareId);
		return software?.versions || [];
	}

	// Get software name
	function getSoftwareName(softwareId: string) {
		const software = allSoftware.find(s => s.id === softwareId);
		return software ? `${software.name} (${software.vendors.name})` : 'Unknown';
	}

	// Get version display
	function getVersionDisplay(versionId: string, softwareId: string) {
		const versions = getVersionsForSoftware(softwareId);
		const version = versions.find(v => v.id === versionId);
		if (!version) return 'Unknown';
		return version.ptf_level
			? `${version.version} (${version.ptf_level})`
			: version.version;
	}

	// Check if software is in assigned package
	function isInPackage(softwareId: string): boolean {
		if (!assignedPackage) return false;
		return assignedPackage.package_items.some(pi => pi.software_id === softwareId);
	}

	// Filter out deleted installations for display
	const visibleInstallations = $derived(installations.filter(inst => inst._action !== 'delete'));

	// Determine installation status for visual feedback
	function getInstallationStatus(installation: LparSoftwareInstallation): 'new' | 'existing' {
		return installation.id ? 'existing' : 'new';
	}

	// Validate installation
	function validateInstallation(installation: LparSoftwareInstallation): string | null {
		if (!installation.software_id) return 'Software is required';
		if (!installation.software_version_id) return 'Version is required';
		return null;
	}

	// Format date for display
	function formatDate(date: Date | string): string {
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString();
	}

	// Format date for input
	function formatDateForInput(date: Date | string | null | undefined): string {
		if (!date) return new Date().toISOString().split('T')[0];
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toISOString().split('T')[0];
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-lg font-semibold">Installed Software</h3>
			<p class="text-sm text-muted-foreground">
				Manage software installations for this LPAR.
			</p>
		</div>
		<Button type="button" size="sm" onclick={addInstallation}>
			Add Software
		</Button>
	</div>

	{#if errors?.installations}
		<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
			{errors.installations.join(', ')}
		</div>
	{/if}

	{#if visibleInstallations.length === 0}
		<div class="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
			<p>No software installed yet. Click "Add Software" to get started.</p>
		</div>
	{:else}
		<div class="space-y-2">
			{#each visibleInstallations as installation, index (installation.id || index)}
				{@const status = getInstallationStatus(installation)}
				{@const error = validateInstallation(installation)}
				{@const isEditing = editingIndex === index}

				<div
					class="border rounded-lg p-4 hover:bg-accent/5 transition-colors {error ? 'bg-destructive/5' : 'bg-card'} {status === 'new' ? 'border-blue-500' : ''}"
				>
					{#if isEditing}
						<!-- Edit Mode -->
						<div class="space-y-4">
							<div class="grid grid-cols-2 gap-4">
								<div class="space-y-2">
									<Label for="software-{index}">Software *</Label>
									<select
										id="software-{index}"
										bind:value={installation.software_id}
										onchange={() => {
											// Reset version when software changes
											installation.software_version_id = '';
										}}
										class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										required
									>
										<option value="">Select software...</option>
										{#each allSoftware as software}
											<option value={software.id}>
												{software.name} ({software.vendors.name})
												{#if isInPackage(software.id)}✓{/if}
											</option>
										{/each}
									</select>
								</div>

								<div class="space-y-2">
									<Label for="version-{index}">Version *</Label>
									<select
										id="version-{index}"
										bind:value={installation.software_version_id}
										class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										required
										disabled={!installation.software_id}
									>
										<option value="">Select version...</option>
										{#each getVersionsForSoftware(installation.software_id) as version}
											<option value={version.id}>
												{version.version}
												{#if version.ptf_level}
													({version.ptf_level})
												{/if}
												{#if version.is_current}
													(Current)
												{/if}
											</option>
										{/each}
									</select>
								</div>
							</div>

							<div class="space-y-2">
								<Label for="installed-date-{index}">Installation Date *</Label>
								<input
									id="installed-date-{index}"
									type="date"
									value={formatDateForInput(installation.installed_date)}
									onchange={(e) => {
										installation.installed_date = e.currentTarget.value
											? new Date(e.currentTarget.value)
											: new Date();
									}}
									class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									required
								/>
							</div>

							{#if error}
								<div class="text-sm text-destructive">
									{error}
								</div>
							{/if}

							<div class="flex gap-2">
								<Button
									type="button"
									size="sm"
									onclick={() => {
										if (!validateInstallation(installation)) {
											editingIndex = null;
										}
									}}
								>
									Done
								</Button>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									onclick={() => {
										if (!installation.id) {
											installations.splice(index, 1);
										}
										editingIndex = null;
									}}
								>
									Cancel
								</Button>
							</div>
						</div>
					{:else}
						<!-- Display Mode -->
						<div class="flex items-start justify-between">
							<div class="space-y-1">
								<div class="flex items-center gap-2">
									<span class="font-medium">
										{getSoftwareName(installation.software_id)}
									</span>
									{#if status === 'new'}
										<Badge variant="outline" class="text-xs">New</Badge>
									{/if}
									{#if isInPackage(installation.software_id)}
										<Badge variant="outline" class="text-xs">In Package</Badge>
									{/if}
								</div>
								<div class="text-sm text-muted-foreground">
									Version: {getVersionDisplay(installation.software_version_id, installation.software_id)}
								</div>
								<div class="text-xs text-muted-foreground">
									Installed: {formatDate(installation.installed_date)}
								</div>
							</div>

							<div class="flex gap-2">
								<Button
									type="button"
									size="sm"
									variant="ghost"
									onclick={() => editingIndex = index}
								>
									Edit
								</Button>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									onclick={() => initiateRemoveInstallation(index)}
								>
									Remove
								</Button>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Summary -->
	{#if visibleInstallations.length > 0}
		<div class="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
			<span>{visibleInstallations.length} installation{visibleInstallations.length !== 1 ? 's' : ''} total</span>
			{#if assignedPackage}
				<span>•</span>
				<span class="text-primary">
					{visibleInstallations.filter(i => isInPackage(i.software_id)).length} from assigned package
				</span>
			{/if}
			{#if installations.filter(i => !i.id).length > 0}
				<span>•</span>
				<span class="text-blue-600">{installations.filter(i => !i.id).length} new</span>
			{/if}
			{#if installations.filter(i => i._action === 'delete').length > 0}
				<span>•</span>
				<span class="text-destructive">{installations.filter(i => i._action === 'delete').length} to remove</span>
			{/if}
		</div>
	{/if}
</div>

<!-- Confirmation Dialog -->
<ConfirmationDialog
	bind:open={showDeleteConfirmation}
	title="Remove Software Installation"
	message="Are you sure you want to remove this software installation from the LPAR? This action cannot be undone."
	confirmLabel="Remove"
	cancelLabel="Cancel"
	variant="destructive"
	onConfirm={confirmRemoveInstallation}
	onCancel={cancelRemoveInstallation}
/>
