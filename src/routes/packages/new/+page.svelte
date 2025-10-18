<script lang="ts">
	import type { PageData } from './$types';
	import type { PackageItem } from '$lib/schemas/package';
	import { superForm } from 'sveltekit-superforms';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import Label from '$components/ui/Label.svelte';
	import SearchableSelect from '$components/common/SearchableSelect.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';
	import PackageItemsManager from '$components/domain/PackageItemsManager.svelte';

	let { data }: { data: PageData } = $props();

	// Initialize Superforms (server-side validation only)
	const { form, errors, enhance, submitting, delayed } = superForm(data.form, {
		dataType: 'json',
		resetForm: false
	});

	let creationMode = $state<'blank' | 'clone'>('blank');
	let cloneSourceId = $state('');

	// Package items state for master-detail pattern (bound to form.items via $form)
	let packageItems = $state<PackageItem[]>([]);

	// When clone source is selected, pre-fill form
	function handleCloneSourceSelect(sourceId: string) {
		cloneSourceId = sourceId;
		const source = data.allPackages.find((p) => p.id === sourceId);
		if (source) {
			$form.name = `${source.name} (Copy)`;
			$form.code = `${source.code}-COPY`;
			$form.version = `${source.version}.1`; // Increment version
			$form.description = source.description || '';
			$form.release_date = new Date().toISOString().split('T')[0];
			$form.active = source.active;

			// Clone package items if they exist
			if (source.package_items && source.package_items.length > 0) {
				packageItems = source.package_items.map((item, index) => ({
					software_id: item.software_id,
					software_version_id: item.software_version_id,
					required: item.required,
					order_index: index
				}));
				$form.items = packageItems;
			}
		}
	}

	// Sync packageItems with form.items when they change
	$effect(() => {
		$form.items = packageItems;
	});
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">New Software Package</h1>
		<p class="text-muted-foreground mt-2">
			Create a new software package with items in one step.
		</p>
	</div>

	<form method="POST" class="space-y-6" use:enhance>
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
								$form.name = '';
								$form.code = '';
								$form.version = '';
								$form.description = '';
								$form.release_date = '';
								$form.active = true;
								packageItems = [];
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
				bind:value={$form.name}
				required
				placeholder="Enter package name"
				error={$errors.name?._errors?.[0]}
			/>

			<FormField
				label="Package Code"
				id="code"
				name="code"
				bind:value={$form.code}
				required
				placeholder="PKG-CODE"
				helperText="Uppercase alphanumeric with dashes/underscores"
				error={$errors.code?._errors?.[0]}
			/>

			<FormField
				label="Version"
				id="version"
				name="version"
				bind:value={$form.version}
				required
				placeholder="e.g., 2025.1.0"
				helperText="Package version number"
				error={$errors.version?._errors?.[0]}
			/>

			<FormField
				label="Release Date"
				id="release_date"
				name="release_date"
				type="date"
				bind:value={$form.release_date}
				required
				error={$errors.release_date?._errors?.[0]}
			/>

			<div class="space-y-2">
				<Label for="description">Description</Label>
				<textarea
					id="description"
					name="description"
					bind:value={$form.description}
					placeholder="Enter package description (optional)"
					class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				></textarea>
			</div>

				<div class="flex items-center space-x-2">
					<input
						type="checkbox"
						id="active"
						name="active"
						bind:checked={$form.active}
						class="h-4 w-4 rounded border-gray-300"
					/>
					<Label for="active">Active</Label>
				</div>
			</div>
		</Card>

		<!-- Package Items Card -->
		<Card class="p-6">
			<PackageItemsManager
				bind:items={packageItems}
				allSoftware={data.allSoftware}
				errors={undefined}
			/>
		</Card>

		<!-- Submit Buttons -->
		<Card class="p-6">
			<FormButtons />
		</Card>
	</form>
</div>
