<script lang="ts">
	import type { PageData } from './$types';
	import type { PackageItem } from '$lib/schemas/package';
	import { superForm } from 'sveltekit-superforms';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import FormCheckbox from '$components/common/FormCheckbox.svelte';
	import CloneModeToggle from '$components/common/CloneModeToggle.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';
	import PackageItemsManager from '$components/domain/PackageItemsManager.svelte';
	import FormTextarea from '$components/common/FormTextarea.svelte';
	import { useUnsavedChanges } from '$lib/utils/unsaved-changes.svelte';
	import FormValidationSummary from '$components/common/FormValidationSummary.svelte';
	import Breadcrumb from '$components/common/Breadcrumb.svelte';

	let { data }: { data: PageData } = $props();

	const breadcrumbItems = [
		{ label: 'Home', href: '/' },
		{ label: 'Packages', href: '/packages' },
		{ label: 'New Package' }
	];

	// Initialize Superforms (server-side validation only)
	const { form, errors, enhance, submitting, delayed, submitted } = superForm(data.form, {
		dataType: 'json',
		resetForm: false
	});

	let creationMode = $state<'blank' | 'clone'>('blank');
	let cloneSourceId = $state('');

	// Package items state for master-detail pattern (bound to form.items via $form)
	let packageItems = $state<PackageItem[]>([]);

	// Track unsaved changes
	const unsavedChanges = useUnsavedChanges();
	const initialFormState = JSON.stringify({
		name: $form.name,
		code: $form.code,
		version: $form.version,
		items: packageItems
	});

	// When clone source is selected, pre-fill form
	function handleCloneSourceSelect(sourceId: string) {
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

	// Reset form to blank state
	function handleBlankSelect() {
		$form.name = '';
		$form.code = '';
		$form.version = '';
		$form.description = '';
		$form.release_date = '';
		$form.active = true;
		packageItems = [];
	}

	// Sync packageItems with form.items when they change
	$effect(() => {
		$form.items = packageItems;
	});

	// Track changes for unsaved changes warning
	$effect(() => {
		const currentState = JSON.stringify({
			name: $form.name,
			code: $form.code,
			version: $form.version,
			items: packageItems
		});
		unsavedChanges.setHasChanges(currentState !== initialFormState);
	});

	// Update submitting state
	$effect(() => {
		unsavedChanges.setIsSubmitting($submitting || $delayed);
	});
</script>

<div class="space-y-6">
	<Breadcrumb items={breadcrumbItems} />

	<div>
		<h1 class="text-3xl font-bold tracking-tight">New Software Package</h1>
		<p class="text-muted-foreground mt-2">
			Create a new software package with items in one step.
		</p>
	</div>

	<!-- Unsaved Changes Banner -->
	{#if unsavedChanges.hasChanges}
		<div class="sticky top-0 z-10 rounded-md bg-amber-50 border border-amber-200 p-4 shadow-md">
			<div class="flex items-center gap-3">
				<svg class="w-5 h-5 text-amber-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
				</svg>
				<div class="flex-1">
					<p class="font-semibold text-amber-800">You have unsaved changes</p>
					<p class="text-sm text-amber-700 mt-1">
						{#if packageItems.length > 0}
							You have {packageItems.length} package item{packageItems.length !== 1 ? 's' : ''} that will be saved when you submit the form.
						{:else}
							Your changes will be saved when you submit the form below.
						{/if}
					</p>
				</div>
			</div>
		</div>
	{/if}

	<form method="POST" class="space-y-6" use:enhance>
		<FormValidationSummary errors={$errors} submitted={$submitted} />

		<!-- Package Information Card -->
		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Package Information</h2>
			<div class="space-y-6">
			<!-- Creation Mode Toggle -->
			<CloneModeToggle
				entityName="Package"
				items={data.allPackages}
				displayField="name"
				secondaryField="code"
				bind:mode={creationMode}
				bind:selectedId={cloneSourceId}
				onModeChange={(mode) => {
					creationMode = mode;
				}}
				onSourceSelect={handleCloneSourceSelect}
				onBlankSelect={handleBlankSelect}
			/>

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

			<FormTextarea
				label="Description"
				id="description"
				name="description"
				bind:value={$form.description}
				placeholder="Enter package description (optional)"
			/>

				<FormCheckbox
					label="Active"
					id="active"
					name="active"
					bind:checked={$form.active}
				/>
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
			<FormButtons loading={$submitting || $delayed} />
		</Card>
	</form>
</div>
