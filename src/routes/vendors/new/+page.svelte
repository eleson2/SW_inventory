<script lang="ts">
	import type { PageData } from './$types';
	import { superForm } from 'sveltekit-superforms';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import Label from '$components/ui/Label.svelte';
	import SearchableSelect from '$components/common/SearchableSelect.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';

	let { data }: { data: PageData } = $props();

	// Initialize Superforms (server-side validation only)
	const { form, errors, enhance, submitting, delayed } = superForm(data.form, {
		dataType: 'json',
		resetForm: false
	});

	let creationMode = $state<'blank' | 'clone'>('blank');
	let cloneSourceId = $state('');

	// When clone source is selected, pre-fill form
	function handleCloneSourceSelect(sourceId: string) {
		cloneSourceId = sourceId;
		const source = data.allVendors.find((v) => v.id === sourceId);
		if (source) {
			$form.name = `${source.name} (Copy)`;
			$form.code = `${source.code}-COPY`;
			$form.website = source.website || '';
			$form.contact_email = source.contact_email || '';
			$form.active = source.active;
		}
	}
</script>

<div class="space-y-6 max-w-2xl">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">New Vendor</h1>
		<p class="text-muted-foreground mt-2">
			Add a new software vendor to the system
		</p>
	</div>

	<Card class="p-6">
		<form method="POST" class="space-y-6" use:enhance>
			<!-- Creation Mode Toggle -->
			<div class="space-y-3 pb-4 border-b">
				<Label>How would you like to create this vendor?</Label>
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
								$form.website = '';
								$form.contact_email = '';
								$form.active = true;
							}}
							class="h-4 w-4"
						/>
						<span>Create blank vendor</span>
					</label>
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							name="creationMode"
							value="clone"
							bind:group={creationMode}
							class="h-4 w-4"
						/>
						<span>Create from existing vendor</span>
					</label>
				</div>

				{#if creationMode === 'clone'}
					<div class="space-y-2 pt-2">
						<Label for="cloneSource">Select source vendor</Label>
						<SearchableSelect
							items={data.allVendors}
							displayField="name"
							valueField="id"
							secondaryField="code"
							placeholder="Search for vendor to clone..."
							bind:value={cloneSourceId}
							onSelect={handleCloneSourceSelect}
						/>
						{#if cloneSourceId}
							<p class="text-sm text-muted-foreground">
								Form has been pre-filled with data from selected vendor. You can edit any field
								before creating.
							</p>
						{/if}
					</div>
				{/if}
			</div>

			<FormField
				label="Vendor Name"
				id="name"
				name="name"
				bind:value={$form.name}
				required
				placeholder="Enter vendor name"
				error={$errors.name?._errors?.[0]}
			/>

			<FormField
				label="Vendor Code"
				id="code"
				name="code"
				bind:value={$form.code}
				required
				placeholder="VENDOR-CODE"
				helperText="Uppercase alphanumeric with dashes/underscores"
				error={$errors.code?._errors?.[0]}
			/>

			<FormField
				label="Website"
				id="website"
				name="website"
				type="url"
				bind:value={$form.website}
				placeholder="https://www.example.com"
				helperText="Optional - full URL including https://"
				error={$errors.website?._errors?.[0]}
			/>

			<FormField
				label="Contact Email"
				id="contact_email"
				name="contact_email"
				type="email"
				bind:value={$form.contact_email}
				placeholder="contact@example.com"
				helperText="Optional - main contact email for this vendor"
				error={$errors.contact_email?._errors?.[0]}
			/>

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

			<FormButtons />
		</form>
	</Card>
</div>
