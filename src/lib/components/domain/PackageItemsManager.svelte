<!--
	PackageItemsManager.svelte
	Master-detail component for managing package items inline

	Features:
	- Add/edit/delete package items
	- Software and version dropdowns
	- Drag-and-drop reordering
	- Inline validation
	- Visual state tracking (new/modified/deleted)
-->
<script lang="ts">
	import type { PackageItem } from '$lib/schemas/package';
	import Button from '$components/ui/Button.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import Label from '$components/ui/Label.svelte';

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
	let draggedIndex = $state<number | null>(null);

	// Add a new item
	function addItem() {
		const maxOrder = items.reduce((max, item) => Math.max(max, item.order_index), -1);
		items.push({
			software_id: '',
			software_version_id: '',
			required: true,
			order_index: maxOrder + 1
		});
		editingIndex = items.length - 1;
	}

	// Remove an item
	function removeItem(index: number) {
		const item = items[index];
		if (item.id) {
			// Mark existing item for deletion
			item._action = 'delete';
		} else {
			// Remove new item completely
			items.splice(index, 1);
		}
		editingIndex = null;
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

	// Drag and drop handlers
	function handleDragStart(index: number) {
		draggedIndex = index;
	}

	function handleDragOver(event: DragEvent, index: number) {
		event.preventDefault();
		if (draggedIndex === null || draggedIndex === index) return;

		const draggedItem = items[draggedIndex];
		items.splice(draggedIndex, 1);
		items.splice(index, 0, draggedItem);
		draggedIndex = index;

		// Reorder indices
		reorderIndices();
	}

	function handleDragEnd() {
		draggedIndex = null;
	}

	// Reorder indices after drag
	function reorderIndices() {
		items.forEach((item, index) => {
			item.order_index = index;
		});
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
				Add and configure software items for this package. Drag items to reorder installation sequence.
			</p>
			<p class="text-xs text-muted-foreground mt-1">
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
					class="border rounded-lg p-4 transition-all
						{draggedIndex === index ? 'opacity-50 scale-95' : 'hover:bg-accent/5'}
						{error ? 'bg-destructive/5 border-destructive' : 'bg-card'}
						{status === 'new' ? 'border-blue-500' : ''}
						{isEditing ? 'ring-2 ring-primary bg-primary/5' : ''}"
					role="listitem"
					draggable="true"
					ondragstart={() => handleDragStart(index)}
					ondragover={(e) => {
						e.preventDefault();
						handleDragOver(e, index);
					}}
					ondragend={handleDragEnd}
				>
					<div class="flex items-start gap-4">
						<!-- Drag Handle -->
						<div class="flex items-center justify-center w-8 pt-2 cursor-move text-muted-foreground">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
							</svg>
						</div>

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

								<div class="flex items-center gap-4">
									<Label class="flex items-center gap-2 cursor-pointer">
										<input
											type="checkbox"
											bind:checked={item.required}
											class="h-4 w-4 rounded border-gray-300"
										/>
										<span>Required</span>
									</Label>

									<div class="text-sm text-muted-foreground">
										Installation order: {item.order_index + 1}
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
									<div class="space-y-1">
										<div class="flex items-center gap-2">
											<span class="font-medium">
												{getSoftwareName(item.software_id)}
											</span>
											{#if status === 'new'}
												<Badge variant="outline" class="text-xs">New</Badge>
											{/if}
										</div>
										<div class="text-sm text-muted-foreground">
											Version: {getVersionDisplay(item.software_version_id, item.software_id)}
										</div>
										<div class="flex items-center gap-2 text-sm">
											{#if item.required}
												<Badge variant="default">Required</Badge>
											{:else}
												<Badge variant="outline">Optional</Badge>
											{/if}
											<span class="text-muted-foreground">Install order: {item.order_index + 1}</span>
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
											onclick={() => {
												if (confirm('Remove this item?')) {
													removeItem(index);
												}
											}}
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
			<span>•</span>
			<span>{visibleItems.filter(i => i.required).length} required</span>
			<span>•</span>
			<span>{visibleItems.filter(i => !i.required).length} optional</span>
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
