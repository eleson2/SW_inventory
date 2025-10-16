<script lang="ts">
	/**
	 * VersionManager - Master-Detail component for inline version management
	 * Allows adding, editing, deleting, and marking versions as current
	 */
	import type { software_versions } from '@prisma/client';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import Label from '$components/ui/Label.svelte';
	import Badge from '$components/ui/Badge.svelte';

	interface VersionRow extends Partial<software_versions> {
		_action?: 'create' | 'update' | 'delete';
		_isEditing?: boolean;
		_isNew?: boolean;
	}

	interface Props {
		versions: VersionRow[];
		onVersionsChange: (versions: VersionRow[]) => void;
		errors?: Record<string, string[]> | null;
	}

	let { versions = $bindable([]), onVersionsChange, errors = null }: Props = $props();

	let editingIndex = $state<number | null>(null);
	let editForm = $state<Partial<VersionRow>>({});

	// Format date for input field (YYYY-MM-DD)
	function formatDateForInput(date: Date | string | null | undefined): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toISOString().split('T')[0];
	}

	// Format date for display
	function formatDateDisplay(date: Date | string | null | undefined): string {
		if (!date) return 'N/A';
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString();
	}

	// Check if end of support has passed
	function isSupportEnded(date: Date | string | null | undefined): boolean {
		if (!date) return false;
		const d = typeof date === 'string' ? new Date(date) : date;
		return d < new Date();
	}

	// Add new version row
	function addVersion() {
		const newVersion: VersionRow = {
			version: '',
			ptf_level: '',
			release_date: new Date(),
			end_of_support: null,
			release_notes: '',
			is_current: versions.length === 0, // First version is current by default
			_action: 'create',
			_isNew: true,
			_isEditing: true
		};

		versions = [...versions, newVersion];
		editingIndex = versions.length - 1;
		editForm = { ...newVersion };
		onVersionsChange(versions);
	}

	// Start editing existing version
	function startEdit(index: number) {
		editingIndex = index;
		editForm = { ...versions[index] };
	}

	// Save edited version
	function saveVersion() {
		if (editingIndex === null) return;

		const updatedVersions = [...versions];
		const version = updatedVersions[editingIndex];

		// Update the version with form data
		updatedVersions[editingIndex] = {
			...version,
			...editForm,
			_action: version._isNew ? 'create' : 'update',
			_isEditing: false
		};

		// Ensure only one version is marked as current
		if (editForm.is_current) {
			updatedVersions.forEach((v, i) => {
				if (i !== editingIndex) {
					v.is_current = false;
				}
			});
		}

		versions = updatedVersions;
		editingIndex = null;
		editForm = {};
		onVersionsChange(versions);
	}

	// Cancel editing
	function cancelEdit() {
		if (editingIndex !== null && versions[editingIndex]._isNew) {
			// Remove new unsaved version
			versions = versions.filter((_, i) => i !== editingIndex);
		}
		editingIndex = null;
		editForm = {};
		onVersionsChange(versions);
	}

	// Mark version for deletion
	function deleteVersion(index: number) {
		const version = versions[index];

		if (version._isNew) {
			// Remove new unsaved version immediately
			versions = versions.filter((_, i) => i !== index);
		} else {
			// Mark existing version for deletion
			const updatedVersions = [...versions];
			updatedVersions[index] = {
				...version,
				_action: 'delete'
			};
			versions = updatedVersions;
		}

		onVersionsChange(versions);
	}

	// Restore deleted version
	function restoreVersion(index: number) {
		const updatedVersions = [...versions];
		const version = updatedVersions[index];
		updatedVersions[index] = {
			...version,
			_action: undefined
		};
		versions = updatedVersions;
		onVersionsChange(versions);
	}

	// Set version as current
	function setAsCurrent(index: number) {
		const updatedVersions = versions.map((v, i) => ({
			...v,
			is_current: i === index,
			_action: v._action || 'update'
		}));
		versions = updatedVersions;
		onVersionsChange(versions);
	}
</script>

<Card class="p-6">
	<div class="space-y-4">
		<div class="flex justify-between items-center">
			<h3 class="text-lg font-semibold">Version Management</h3>
			<Button type="button" variant="outline" size="sm" onclick={addVersion}>
				Add Version
			</Button>
		</div>

		{#if errors?.versions}
			<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
				{errors.versions}
			</div>
		{/if}

		{#if versions.length === 0}
			<div class="text-center py-8 text-muted-foreground">
				<p>No versions defined yet. Click "Add Version" to create one.</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each versions as version, index}
					{@const isDeleted = version._action === 'delete'}
					{@const isEditing = editingIndex === index}
					{@const supportEnded = isSupportEnded(version.end_of_support)}

					<div
						class="border rounded-lg p-4 {isDeleted ? 'opacity-50 bg-muted' : ''} {version.is_current ? 'border-primary bg-primary/5' : ''}"
					>
						{#if isEditing}
							<!-- Edit Mode -->
							<div class="space-y-4">
								<div class="grid grid-cols-2 gap-4">
									<div class="space-y-2">
										<Label for="version-{index}">
											Version <span class="text-destructive">*</span>
										</Label>
										<input
											id="version-{index}"
											type="text"
											bind:value={editForm.version}
											placeholder="e.g., V5R6M0 or 2.4.0"
											required
											class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										/>
									</div>

									<div class="space-y-2">
										<Label for="ptf-level-{index}">PTF Level</Label>
										<input
											id="ptf-level-{index}"
											type="text"
											bind:value={editForm.ptf_level}
											placeholder="e.g., PTF12345"
											class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										/>
									</div>
								</div>

								<div class="grid grid-cols-2 gap-4">
									<div class="space-y-2">
										<Label for="release-date-{index}">
											Release Date <span class="text-destructive">*</span>
										</Label>
										<input
											id="release-date-{index}"
											type="date"
											value={formatDateForInput(editForm.release_date)}
											onchange={(e) => {
												editForm.release_date = e.currentTarget.value
													? new Date(e.currentTarget.value)
													: new Date();
											}}
											required
											class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										/>
									</div>

									<div class="space-y-2">
										<Label for="end-of-support-{index}">End of Support</Label>
										<input
											id="end-of-support-{index}"
											type="date"
											value={formatDateForInput(editForm.end_of_support)}
											onchange={(e) => {
												editForm.end_of_support = e.currentTarget.value
													? new Date(e.currentTarget.value)
													: null;
											}}
											class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										/>
									</div>
								</div>

								<div class="space-y-2">
									<Label for="release-notes-{index}">Release Notes</Label>
									<textarea
										id="release-notes-{index}"
										bind:value={editForm.release_notes}
										placeholder="Enter release notes or change description"
										rows="3"
										class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									></textarea>
								</div>

								<div class="flex items-center space-x-2">
									<input
										id="is-current-{index}"
										type="checkbox"
										bind:checked={editForm.is_current}
										class="h-4 w-4 rounded border-gray-300"
									/>
									<Label for="is-current-{index}">Set as Current Version</Label>
								</div>

								<div class="flex gap-2">
									<Button type="button" size="sm" onclick={saveVersion}>Save</Button>
									<Button type="button" variant="outline" size="sm" onclick={cancelEdit}>
										Cancel
									</Button>
								</div>
							</div>
						{:else}
							<!-- Display Mode -->
							<div class="flex justify-between items-start">
								<div class="flex-1">
									<div class="flex items-center gap-2 mb-2">
										<h4 class="font-semibold text-lg">
											{version.version}
											{#if version.ptf_level}
												<span class="text-sm text-muted-foreground">({version.ptf_level})</span>
											{/if}
										</h4>
										{#if version.is_current}
											<Badge variant="default">Current</Badge>
										{/if}
										{#if version._isNew}
											<Badge variant="secondary">New</Badge>
										{/if}
										{#if isDeleted}
											<Badge variant="destructive">Deleted</Badge>
										{/if}
									</div>

									<div class="grid grid-cols-2 gap-4 text-sm">
										<div>
											<span class="text-muted-foreground">Release Date:</span>
											<span class="ml-2">{formatDateDisplay(version.release_date)}</span>
										</div>
										<div>
											<span class="text-muted-foreground">End of Support:</span>
											<span class="ml-2 {supportEnded ? 'text-destructive font-medium' : ''}">
												{formatDateDisplay(version.end_of_support)}
												{#if supportEnded}
													(Ended)
												{/if}
											</span>
										</div>
									</div>

									{#if version.release_notes}
										<div class="mt-3 text-sm">
											<p class="text-muted-foreground">{version.release_notes}</p>
										</div>
									{/if}
								</div>

								<div class="flex gap-2 ml-4">
									{#if isDeleted}
										<Button
											type="button"
											variant="outline"
											size="sm"
											onclick={() => restoreVersion(index)}
										>
											Restore
										</Button>
									{:else}
										{#if !version.is_current}
											<Button
												type="button"
												variant="outline"
												size="sm"
												onclick={() => setAsCurrent(index)}
											>
												Set Current
											</Button>
										{/if}
										<Button
											type="button"
											variant="outline"
											size="sm"
											onclick={() => startEdit(index)}
										>
											Edit
										</Button>
										<Button
											type="button"
											variant="destructive"
											size="sm"
											onclick={() => deleteVersion(index)}
										>
											Delete
										</Button>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</Card>
