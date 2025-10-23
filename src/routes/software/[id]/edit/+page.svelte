<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import FormCheckbox from '$components/common/FormCheckbox.svelte';
	import FormSelect from '$components/common/FormSelect.svelte';
	import VersionManager from '$components/domain/VersionManager.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';
	import FormErrorMessage from '$components/common/FormErrorMessage.svelte';
	import FormTextarea from '$components/common/FormTextarea.svelte';
	import { useMasterDetailForm } from '$lib/utils/useMasterDetailForm';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Helper to safely access errors
	const errors = $derived(
		form && 'errors' in form ? form.errors as Record<string, string[]> : undefined
	);

	// Master form data (software)
	let formData = $state({
		name: data.software.name,
		vendor_id: data.software.vendor_id,
		description: data.software.description || '',
		active: data.software.active
	});

	// Detail form data (versions)
	let versions = $state(
		data.software.versions.map((v) => ({
			id: v.id,
			version: v.version,
			ptf_level: v.ptf_level || '',
			release_date: v.release_date,
			end_of_support: v.end_of_support,
			release_notes: v.release_notes || '',
			is_current: v.is_current,
			_action: undefined as 'create' | 'update' | 'delete' | undefined
		}))
	);

	// Handle version changes from VersionManager
	function handleVersionsChange(updatedVersions: any[]) {
		versions = updatedVersions;
	}

	// Use master-detail form utility
	const { handleSubmit, submitting } = useMasterDetailForm({
		onBuildFormData: (formData) => {
			// Add versions as JSON
			formData.set('versions', JSON.stringify(versions));

			// Find current version ID
			const currentVersion = versions.find((v) => v.is_current && v._action !== 'delete');
			if (currentVersion?.id) {
				formData.set('current_version_id', currentVersion.id);
			}
		}
	});
</script>

<div class="space-y-6 max-w-4xl">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Edit Software</h1>
		<p class="text-muted-foreground mt-2">
			Update software product information and manage versions
		</p>
	</div>

	<form method="POST" class="space-y-6" onsubmit={handleSubmit}>
		<!-- Master Entity: Software Information -->
		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Software Details</h2>
			<div class="space-y-6">
				<FormField
					label="Software Name"
					id="name"
					name="name"
					bind:value={formData.name}
					required
					placeholder="Enter software name"
					error={errors?.name?.[0]}
				/>

				<FormSelect
					label="Vendor"
					id="vendor_id"
					name="vendor_id"
					bind:value={formData.vendor_id}
					options={data.vendors}
					valueField="id"
					displayField="name"
					secondaryField="code"
					required
					error={errors?.vendor_id?.[0]}
				/>

				<FormTextarea
					label="Description"
					id="description"
					name="description"
					bind:value={formData.description}
					placeholder="Enter software description (optional)"
				/>

				<FormCheckbox
					label="Active"
					id="active"
					name="active"
					bind:checked={formData.active}
				/>
			</div>
		</Card>

		<!-- Detail Entity: Version Management -->
		<VersionManager bind:versions onVersionsChange={handleVersionsChange} errors={errors} />

		<!-- Form Actions -->
		<FormErrorMessage message={form?.message} />

		<FormButtons loading={submitting} />
	</form>
</div>
