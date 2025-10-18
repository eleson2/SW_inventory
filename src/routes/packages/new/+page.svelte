<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import type { PackageItem } from '$lib/schemas/package';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import Label from '$components/ui/Label.svelte';
	import SearchableSelect from '$components/common/SearchableSelect.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';
	import PackageItemsManager from '$components/domain/PackageItemsManager.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Helper to safely access errors
	const errors = $derived(
		form && 'errors' in form ? form.errors as Record<string, string[]> : undefined
	);

	let creationMode = $state<'blank' | 'clone'>('blank');
	let cloneSourceId = $state('');

	let formData = $state({
		name: '',
		code: '',
		version: '',
		description: '',
		release_date: '',
		active: true
	});

	// Package items state for master-detail pattern
	let packageItems = $state<PackageItem[]>([]);

	// When clone source is selected, pre-fill form
	function handleCloneSourceSelect(sourceId: string) {
		cloneSourceId = sourceId;
		const source = data.allPackages.find((p) => p.id === sourceId);
		if (source) {
			formData.name = `${source.name} (Copy)`;
			formData.code = `${source.code}-COPY`;
			formData.version = `${source.version}.1`; // Increment version
			formData.description = source.description || '';
			formData.release_date = new Date().toISOString().split('T')[0];
			formData.active = source.active;

			// Clone package items if they exist
			if (source.package_items && source.package_items.length > 0) {
				packageItems = source.package_items.map((item, index) => ({
					software_id: item.software_id,
					software_version_id: item.software_version_id,
					required: item.required,
					order_index: index
				}));
			}
		}
	}

	// Handle form submission with items
	async function handleSubmit(event: Event) {
		event.preventDefault();
		const formElement = event.target as HTMLFormElement;
		const formDataToSend = new FormData(formElement);

		// Add items as JSON
		formDataToSend.set('items', JSON.stringify(packageItems));

		// Submit the form
		try {
			const response = await fetch(formElement.action, {
				method: 'POST',
				body: formDataToSend
			});

			if (response.redirected) {
				window.location.href = response.url;
			} else {
				// Handle error - the form will show errors from the action
				window.location.reload();
			}
		} catch (error) {
			console.error('Error submitting form:', error);
		}
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">New Software Package</h1>
		<p class="text-muted-foreground mt-2">
			Create a new software package with items in one step.
		</p>
	</div>

	<form method="POST" class="space-y-6" onsubmit={handleSubmit}>
		<!-- Package Information Card -->
		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Package Information</h2>
			<div class="space-y-6">
			<!-- Creation Mode Toggle -->
			<div class="space-y-3 pb-4 border-b">
				<Label>How would you like to create this package?</Label>
				<div class="flex gap-4">
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							name="creationMode"
							value="blank"
							bind:group={creationMode}
							onchange={() => {
								cloneSourceId = '';
								formData = {
									name: '',
									code: '',
									version: '',
									description: '',
									release_date: '',
									active: true
								};
							}}
							class="h-4 w-4"
						/>
						<span>Create blank package</span>
					</label>
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							name="creationMode"
							value="clone"
							bind:group={creationMode}
							class="h-4 w-4"
						/>
						<span>Create from existing package</span>
					</label>
				</div>

				{#if creationMode === 'clone'}
					<div class="space-y-2 pt-2">
						<Label for="cloneSource">Select source package</Label>
						<SearchableSelect
							items={data.allPackages}
							displayField="name"
							valueField="id"
							secondaryField="code"
							placeholder="Search for package to clone..."
							bind:value={cloneSourceId}
							onSelect={handleCloneSourceSelect}
						/>
						{#if cloneSourceId}
							{@const source = data.allPackages.find((p) => p.id === cloneSourceId)}
							<div class="text-sm space-y-1">
								<p class="text-muted-foreground">
									Form has been pre-filled with data from selected package. You can edit any field
									before creating.
								</p>
								{#if source && source.package_items.length > 0}
									<p class="text-primary font-medium">
										✓ Package items ({source.package_items.length} items) have been cloned! You can modify them below before creating.
									</p>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<FormField
				label="Package Name"
				id="name"
				name="name"
				bind:value={formData.name}
				required
				placeholder="Enter package name"
				error={errors?.name?.[0]}
			/>

			<FormField
				label="Package Code"
				id="code"
				name="code"
				bind:value={formData.code}
				required
				placeholder="PKG-CODE"
				helperText="Uppercase alphanumeric with dashes/underscores"
				error={errors?.code?.[0]}
			/>

			<FormField
				label="Version"
				id="version"
				name="version"
				bind:value={formData.version}
				required
				placeholder="e.g., 2025.1.0"
				helperText="Package version number"
				error={errors?.version?.[0]}
			/>

			<FormField
				label="Release Date"
				id="release_date"
				name="release_date"
				type="date"
				bind:value={formData.release_date}
				required
				error={errors?.release_date?.[0]}
			/>

			<div class="space-y-2">
				<Label for="description">Description</Label>
				<textarea
					id="description"
					name="description"
					bind:value={formData.description}
					placeholder="Enter package description (optional)"
					class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				></textarea>
			</div>

				<div class="flex items-center space-x-2">
					<input
						type="checkbox"
						id="active"
						name="active"
						bind:checked={formData.active}
						class="h-4 w-4 rounded border-gray-300"
					/>
					<Label for="active">Active</Label>
				</div>

				{#if form?.message}
					<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{form.message}
					</div>
				{/if}
			</div>
		</Card>

		<!-- Package Items Card -->
		<Card class="p-6">
			<PackageItemsManager
				bind:items={packageItems}
				allSoftware={data.allSoftware}
				errors={errors}
			/>
		</Card>

		<!-- Submit Buttons -->
		<Card class="p-6">
			<FormButtons />
		</Card>
	</form>
</div>
