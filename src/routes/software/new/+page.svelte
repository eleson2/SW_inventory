<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import Label from '$components/ui/Label.svelte';
	import SearchableSelect from '$components/common/SearchableSelect.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let creationMode = $state<'blank' | 'clone'>('blank');
	let cloneSourceId = $state('');

	let formData = $state({
		name: '',
		vendor_id: '',
		description: '',
		version: '',
		ptf_level: '',
		release_date: new Date().toISOString().split('T')[0],
		active: true
	});

	// When clone source is selected, pre-fill form
	function handleCloneSourceSelect(sourceId: string) {
		cloneSourceId = sourceId;
		const source = data.allSoftware.find((s) => s.id === sourceId);
		if (source) {
			formData.name = `${source.name} (Copy)`;
			formData.vendor_id = source.vendor_id;
			formData.description = source.description || '';
			formData.version = source.current_version?.version || '';
			formData.ptf_level = source.current_version?.ptf_level || '';
			formData.release_date = source.current_version?.release_date
				? new Date(source.current_version.release_date).toISOString().split('T')[0]
				: new Date().toISOString().split('T')[0];
			formData.active = source.active;
		}
	}
</script>

<div class="space-y-6 max-w-2xl">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">New Software Product</h1>
		<p class="text-muted-foreground mt-2">
			Add a new software product to track
		</p>
	</div>

	<Card class="p-6">
		<form method="POST" class="space-y-6">
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
									version: '',
									ptf_level: '',
									release_date: new Date().toISOString().split('T')[0],
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
				error={form?.errors?.name?.[0]}
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
				{#if form?.errors?.vendor_id?.[0]}
					<p class="text-sm text-destructive">{form.errors.vendorId[0]}</p>
				{/if}
			</div>

			<FormField
				label="Initial Version"
				id="version"
				name="version"
				bind:value={formData.version}
				required
				placeholder="e.g., V2R4M0 or 2.4.0"
				helperText="Initial version number"
				error={form?.errors?.version?.[0]}
			/>

			<FormField
				label="PTF Level"
				id="ptf_level"
				name="ptf_level"
				bind:value={formData.ptf_level}
				placeholder="e.g., PTF12345 or SP1"
				helperText="Optional - initial PTF/patch level"
				error={form?.errors?.ptf_level?.[0]}
			/>

			<FormField
				label="Release Date"
				id="release_date"
				name="release_date"
				type="date"
				bind:value={formData.release_date}
				required
				helperText="Initial version release date"
				error={form?.errors?.release_date?.[0]}
			/>

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

			<div class="flex gap-4">
				<Button type="submit">Save & Close</Button>
				<Button type="button" variant="outline" onclick={() => window.history.back()}>
					Cancel
				</Button>
			</div>
		</form>
	</Card>
</div>
