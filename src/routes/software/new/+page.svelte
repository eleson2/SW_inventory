<script lang="ts">
	import type { PageData } from './$types';
	import { superForm } from 'sveltekit-superforms';
	import { zod } from 'sveltekit-superforms/adapters';
	import { softwareSchema } from '$schemas';
	import Card from '$components/ui/Card.svelte';
	import Label from '$components/ui/Label.svelte';
	import FormField from '$components/common/FormField.svelte';
	import FormCheckbox from '$components/common/FormCheckbox.svelte';
	import CloneModeToggle from '$components/common/CloneModeToggle.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';
	import VersionManager from '$components/domain/VersionManager.svelte';
	import FormErrorMessage from '$components/common/FormErrorMessage.svelte';
	import FormTextarea from '$components/common/FormTextarea.svelte';
	import FormValidationSummary from '$components/common/FormValidationSummary.svelte';
	import Breadcrumb from '$components/common/Breadcrumb.svelte';

	let { data }: { data: PageData } = $props();

	const breadcrumbItems = [
		{ label: 'Home', href: '/' },
		{ label: 'Software', href: '/software' },
		{ label: 'New Software' }
	];

	// Initialize Superforms with client-side validation
	const { form, errors, enhance, submitting, delayed, submitted, constraints } = superForm(data.form, {
		dataType: 'json',
		resetForm: false,
		validators: zod(softwareSchema)
	});

	let creationMode = $state<'blank' | 'clone'>('blank');
	let cloneSourceId = $state('');

	// Versions state for master-detail pattern
	let versions = $state<any[]>([
		{
			version: '',
			ptf_level: '',
			release_date: new Date().toISOString().split('T')[0],
			end_of_support: '',
			release_notes: '',
			is_current: true,
			_isNew: true,
			_isEditing: true
		}
	]);

	// Sync versions with form.versions
	$effect(() => {
		$form.versions = versions;
	});

	// When clone source is selected, pre-fill form
	function handleCloneSourceSelect(sourceId: string) {
		const source = data.allSoftware.find((s) => s.id === sourceId);
		if (source) {
			$form.name = `${source.name} (Copy)`;
			$form.vendor_id = source.vendor_id;
			$form.description = source.description || '';
			$form.active = source.active;

			// Clone versions if they exist
			if (source.current_version) {
				versions = [{
					version: source.current_version.version,
					ptf_level: source.current_version.ptf_level || '',
					release_date: source.current_version.release_date
						? new Date(source.current_version.release_date).toISOString().split('T')[0]
						: new Date().toISOString().split('T')[0],
					end_of_support: '',
					release_notes: '',
					is_current: true,
					_isNew: true
				}];
			}
		}
	}

	// Reset form to blank state
	function handleBlankSelect() {
		$form.name = '';
		$form.vendor_id = '';
		$form.description = '';
		$form.active = true;
		versions = [{
			version: '',
			ptf_level: '',
			release_date: new Date().toISOString().split('T')[0],
			end_of_support: '',
			release_notes: '',
			is_current: true,
			_isNew: true,
			_isEditing: true
		}];
	}

	// Handle version changes
	function handleVersionsChange(updatedVersions: any[]) {
		versions = updatedVersions;
	}
</script>

<div class="space-y-6">
	<Breadcrumb items={breadcrumbItems} />

	<div>
		<h1 class="text-3xl font-bold tracking-tight">New Software Product</h1>
		<p class="text-muted-foreground mt-2">
			Create a new software product with version history in one step
		</p>
	</div>

	<form method="POST" class="space-y-6" use:enhance>
		<FormValidationSummary errors={$errors} submitted={$submitted} />

		<!-- Software Information Card -->
		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Software Details</h2>
			<div class="space-y-6">
				<!-- Creation Mode Toggle -->
				<CloneModeToggle
					entityName="Software"
					items={data.allSoftware}
					displayField="name"
					secondaryField="vendors.name"
					bind:mode={creationMode}
					bind:selectedId={cloneSourceId}
					onModeChange={(mode) => {
						creationMode = mode;
					}}
					onSourceSelect={handleCloneSourceSelect}
					onBlankSelect={handleBlankSelect}
				/>

				<FormField
					label="Software Name"
					id="name"
					name="name"
					bind:value={$form.name}
					placeholder="Enter software name"
					error={$errors.name?._errors?.[0]}
					constraints={$constraints.name}
				/>

				<div class="space-y-2">
					<Label for="vendorId">Vendor <span class="text-destructive">*</span></Label>
					<select
						id="vendor_id"
						name="vendor_id"
						bind:value={$form.vendor_id}
						required
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<option value="">Select a vendor...</option>
						{#each data.vendors as vendor}
							<option value={vendor.id}>{vendor.name} ({vendor.code})</option>
						{/each}
					</select>
					{#if $errors.vendor_id?._errors?.[0]}
						<p class="text-sm text-destructive">{$errors.vendor_id._errors[0]}</p>
					{/if}
				</div>

				<FormTextarea
					label="Description"
					id="description"
					name="description"
					bind:value={$form.description}
					placeholder="Enter software description (optional)"
					constraints={$constraints.description}
				/>

				<FormCheckbox
					label="Active"
					id="active"
					name="active"
					bind:checked={$form.active}
					constraints={$constraints.active}
				/>

				<FormErrorMessage message={form?.message} />
			</div>
		</Card>

		<!-- Version Management Card -->
		<VersionManager bind:versions onVersionsChange={handleVersionsChange} errors={errors} />

		<!-- Submit Buttons -->
		<Card class="p-6">
			<FormButtons loading={$submitting || $delayed} />
		</Card>
	</form>
</div>
