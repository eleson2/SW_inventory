<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import FormCheckbox from '$components/common/FormCheckbox.svelte';
	import Label from '$components/ui/Label.svelte';
	import VersionManager from '$components/domain/VersionManager.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';

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

	// Handle form submission
	function handleSubmit(event: SubmitEvent) {
		const formElement = event.target as HTMLFormElement;
		const formDataObj = new FormData(formElement);

		// Add versions as JSON
		formDataObj.set('versions', JSON.stringify(versions));

		// Find current version ID
		const currentVersion = versions.find((v) => v.is_current && v._action !== 'delete');
		if (currentVersion?.id) {
			formDataObj.set('current_version_id', currentVersion.id);
		}
	}
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

				<div class="space-y-2">
					<Label for="vendor_id">Vendor <span class="text-destructive">*</span></Label>
					<select
						id="vendor_id"
						name="vendor_id"
						bind:value={formData.vendor_id}
						required
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						{#each data.vendors as vendor}
							<option value={vendor.id}>{vendor.name} ({vendor.code})</option>
						{/each}
					</select>
					{#if errors?.vendor_id?.[0]}
						<p class="text-sm text-destructive">{errors.vendor_id[0]}</p>
					{/if}
				</div>

				<div class="space-y-2">
					<Label for="description">Description</Label>
					<textarea
						id="description"
						name="description"
						bind:value={formData.description}
						placeholder="Enter software description (optional)"
						class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					></textarea>
				</div>

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
		{#if form?.message}
			<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
				{form.message}
			</div>
		{/if}

		<FormButtons />
	</form>
</div>
