<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import Label from '$components/ui/Label.svelte';
	import SearchableSelect from '$components/common/SearchableSelect.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';
	import VersionManager from '$components/domain/VersionManager.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Helper to safely access errors
	const errors = $derived(
		form && 'errors' in form ? form.errors as Record<string, string[]> : undefined
	);

	let creationMode = $state<'blank' | 'clone'>('blank');
	let cloneSourceId = $state('');

	let formData = $state({
		name: '',
		vendor_id: '',
		description: '',
		active: true
	});

	// Versions state for master-detail pattern
	let versions = $state<any[]>([
		{
			version: '',
			ptf_level: '',
			release_date: new Date(),
			end_of_support: null,
			release_notes: '',
			is_current: true,
			_isNew: true,
			_isEditing: true
		}
	]);

	// When clone source is selected, pre-fill form
	function handleCloneSourceSelect(sourceId: string) {
		cloneSourceId = sourceId;
		const source = data.allSoftware.find((s) => s.id === sourceId);
		if (source) {
			formData.name = `${source.name} (Copy)`;
			formData.vendor_id = source.vendor_id;
			formData.description = source.description || '';
			formData.active = source.active;

			// Clone versions if they exist
			if (source.current_version) {
				versions = [{
					version: source.current_version.version,
					ptf_level: source.current_version.ptf_level || '',
					release_date: source.current_version.release_date
						? new Date(source.current_version.release_date)
						: new Date(),
					end_of_support: null,
					release_notes: '',
					is_current: true,
					_isNew: true
				}];
			}
		}
	}

	// Handle version changes
	function handleVersionsChange(updatedVersions: any[]) {
		versions = updatedVersions;
	}

	// Handle form submission
	async function handleSubmit(event: Event) {
		event.preventDefault();
		const formElement = event.target as HTMLFormElement;
		const formDataToSend = new FormData(formElement);

		// Add versions as JSON
		formDataToSend.set('versions', JSON.stringify(versions));

		// Find current version ID
		const currentVersion = versions.find((v) => v.is_current && v._action !== 'delete');
		if (currentVersion?.id) {
			formDataToSend.set('current_version_id', currentVersion.id);
		}

		// Submit the form
		try {
			const response = await fetch(formElement.action, {
				method: 'POST',
				body: formDataToSend
			});

			if (response.redirected) {
				window.location.href = response.url;
			} else {
				// Handle error
				window.location.reload();
			}
		} catch (error) {
			console.error('Error submitting form:', error);
		}
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">New Software Product</h1>
		<p class="text-muted-foreground mt-2">
			Create a new software product with version history in one step
		</p>
	</div>

	<form method="POST" class="space-y-6" onsubmit={handleSubmit}>
		<!-- Software Information Card -->
		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Software Details</h2>
			<div class="space-y-6">
				<!-- Creation Mode Toggle -->
				<div class="space-y-3 pb-4 border-b">
					<Label>How would you like to create this software?</Label>
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
										vendor_id: '',
										description: '',
										active: true
									};
								}}
								class="h-4 w-4"
							/>
							<span>Create blank software</span>
						</label>
						<label class="flex items-center gap-2 cursor-pointer">
							<input
								type="radio"
								name="creationMode"
								value="clone"
								bind:group={creationMode}
								class="h-4 w-4"
							/>
							<span>Create from existing software</span>
						</label>
					</div>

					{#if creationMode === 'clone'}
						<div class="space-y-2 pt-2">
							<Label for="cloneSource">Select source software</Label>
							<SearchableSelect
								items={data.allSoftware}
								displayField="name"
								valueField="id"
								secondaryField="vendors.name"
								placeholder="Search for software to clone..."
								bind:value={cloneSourceId}
								onSelect={handleCloneSourceSelect}
							/>
							{#if cloneSourceId}
								<p class="text-sm text-muted-foreground">
									Form has been pre-filled with data from selected software. You can edit any field
									before creating.
								</p>
							{/if}
						</div>
					{/if}
				</div>

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
					<Label for="vendorId">Vendor <span class="text-destructive">*</span></Label>
					<select
						id="vendor_id"
						name="vendor_id"
						bind:value={formData.vendor_id}
						required
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<option value="">Select a vendor...</option>
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

		<!-- Version Management Card -->
		<VersionManager bind:versions onVersionsChange={handleVersionsChange} errors={errors} />

		<!-- Submit Buttons -->
		<Card class="p-6">
			<FormButtons />
		</Card>
	</form>
</div>
