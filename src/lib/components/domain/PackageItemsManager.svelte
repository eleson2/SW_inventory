<!--
	PackageItemsManager.svelte
	Master-detail component for managing package items inline

	Features:
	- Add/edit/delete package items
	- Software and version dropdowns
	- Inline validation
	- Visual state tracking (new/modified/deleted)
-->
<script lang="ts">
	import type { PackageItem } from '$lib/schemas/package';
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

	interface Props {
		items: PackageItem[];
		allSoftware: SoftwareWithVersions[];
		errors?: Record<string, string[]>;
	}

	let { items = $bindable([]), allSoftware, errors }: Props = $props();

	// Track which item is being edited (inline editing)
	let editingIndex = $state<number | null>(null);

	// Confirmation dialog state
	let showDeleteConfirmation = $state(false);
	let itemToDelete = $state<number | null>(null);

	// Add a new item
	function addItem() {
		items.push({
			software_id: '',
			software_version_id: ''
		});
		editingIndex = items.length - 1;
	}

	// Initiate item removal
	function initiateRemoveItem(index: number) {
		itemToDelete = index;
		showDeleteConfirmation = true;
	}

	// Confirm item removal
	function confirmRemoveItem() {
		if (itemToDelete !== null) {
			const item = items[itemToDelete];
			if (item.id) {
				// Mark existing item for deletion
				item._action = 'delete';
			} else {
				// Remove new item completely
				items.splice(itemToDelete, 1);
			}
			editingIndex = null;
			itemToDelete = null;
		}
	}

	// Cancel item removal
	function cancelRemoveItem() {
		itemToDelete = null;
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

	// Filter out deleted items for display
	const visibleItems = $derived(items.filter(item => item._action !== 'delete'));

	// Determine item status for visual feedback
	function getItemStatus(item: PackageItem): 'new' | 'modified' | 'existing' {
		if (!item.id) return 'new';
		if (item._action === 'delete') return 'existing'; // Won't be displayed
		// Could add more sophisticated change tracking here
		return 'existing';
	}

	// Validate item
	function validateItem(item: PackageItem): string | null {
		if (!item.software_id) return 'Software is required';
		if (!item.software_version_id) return 'Version is required';
		return null;
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-lg font-semibold">Package Items</h3>
			<p class="text-sm text-muted-foreground">
				Add and configure software items for this package.
			</p>
			<p class="text-xs text-muted-foreground mt-2">
				💡 Changes are saved when you submit the entire form below.
			</p>
		</div>
		<Button type="button" size="sm" onclick={addItem}>
			Add Item
		</Button>
	</div>

	<!-- Validation Summary -->
	{#if visibleItems.some(i => validateItem(i))}
		<div class="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
			<div class="flex items-start gap-2">
				<svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
				</svg>
				<div>
					<strong>{visibleItems.filter(i => validateItem(i)).length} item(s) have validation errors.</strong>
					<br/>
					Please complete all required fields before submitting the form.
				</div>
			</div>
		</div>
	{/if}

	{#if errors?.items}
		<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
			{errors.items.join(', ')}
		</div>
	{/if}

	{#if visibleItems.length === 0}
		<div class="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
			<p>No items yet. Click "Add Item" to get started.</p>
		</div>
	{:else}
		<div class="space-y-2">
			{#each visibleItems as item, index (item.id || index)}
				{@const status = getItemStatus(item)}
				{@const error = validateItem(item)}
				{@const isEditing = editingIndex === index}

				<div
					class="border rounded-lg p-4 transition-all hover:bg-accent/5
						{error ? 'bg-destructive/5 border-destructive' : 'bg-card'}
						{status === 'new' ? 'border-blue-500' : ''}
						{isEditing ? 'ring-2 ring-primary bg-primary/5' : ''}"
					role="listitem"
				>
					<div class="flex items-start gap-4">
						<!-- Content -->
						<div class="flex-1 space-y-3">
							{#if isEditing}
								<!-- Edit Mode -->
								<div class="grid grid-cols-2 gap-4">
									<div class="space-y-2">
										<Label for="software-{index}">Software *</Label>
										<select
											id="software-{index}"
											bind:value={item.software_id}
											onchange={() => {
												// Reset version when software changes
												item.software_version_id = '';
											}}
											class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
											required
										>
											<option value="">Select software...</option>
											{#each allSoftware as software}
												<option value={software.id}>
													{software.name} ({software.vendors.name})
												</option>
											{/each}
										</select>
									</div>

									<div class="space-y-2">
										<Label for="version-{index}">Version *</Label>
										<select
											id="version-{index}"
											bind:value={item.software_version_id}
											class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
											required
											disabled={!item.software_id}
										>
											<option value="">Select version...</option>
											{#each getVersionsForSoftware(item.software_id) as version}
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
											if (!validateItem(item)) {
												editingIndex = null;
											}
										}}
									>
										Apply Changes
									</Button>
									<Button
										type="button"
										size="sm"
										variant="ghost"
										onclick={() => {
											if (!item.id) {
												items.splice(index, 1);
											}
											editingIndex = null;
										}}
									>
										Cancel
									</Button>
								</div>
								<p class="text-xs text-muted-foreground mt-2">
									Click "Apply Changes" to finish editing this item. Remember to submit the form to save all changes.
								</p>
							{:else}
								<!-- Display Mode -->
								<div class="flex items-start justify-between">
									<div class="space-y-2">
										<div class="flex items-center gap-2">
											<span class="font-medium text-base">
												{getSoftwareName(item.software_id)}
											</span>
											{#if status === 'new'}
												<Badge variant="outline" class="text-xs">New</Badge>
											{/if}
										</div>
										<div class="text-sm text-muted-foreground">
											Version: <span class="font-medium">{getVersionDisplay(item.software_version_id, item.software_id)}</span>
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
											onclick={() => initiateRemoveItem(index)}
										>
											Remove
										</Button>
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Summary -->
	{#if visibleItems.length > 0}
		<div class="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
			<span>{visibleItems.length} item{visibleItems.length !== 1 ? 's' : ''} total</span>
			{#if items.filter(i => !i.id).length > 0}
				<span>•</span>
				<span class="text-blue-600">{items.filter(i => !i.id).length} new</span>
			{/if}
			{#if items.filter(i => i._action === 'delete').length > 0}
				<span>•</span>
				<span class="text-destructive">{items.filter(i => i._action === 'delete').length} to delete</span>
			{/if}
		</div>
	{/if}
</div>

<!-- Confirmation Dialog -->
<ConfirmationDialog
	bind:open={showDeleteConfirmation}
	title="Remove Package Item"
	message="Are you sure you want to remove this item from the package? This action cannot be undone."
	confirmLabel="Remove"
	cancelLabel="Cancel"
	variant="destructive"
	onConfirm={confirmRemoveItem}
	onCancel={cancelRemoveItem}
/>
