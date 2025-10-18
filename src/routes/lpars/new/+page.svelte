<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import Label from '$components/ui/Label.svelte';
	import SearchableSelect from '$components/common/SearchableSelect.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let creationMode = $state<'blank' | 'clone'>('blank');
	let cloneSourceId = $state('');

	let formData = $state({
		name: '',
		code: '',
		customer_id: '',
		description: '',
		current_package_id: '',
		active: true
	});

	// When clone source is selected, pre-fill form
	function handleCloneSourceSelect(sourceId: string) {
		cloneSourceId = sourceId;
		const source = data.allLpars.find((l) => l.id === sourceId);
		if (source) {
			formData.name = `${source.name} (Copy)`;
			formData.code = `${source.code}-COPY`;
			formData.customer_id = source.customer_id;
			formData.description = source.description || '';
			formData.current_package_id = source.current_package_id || '';
			formData.active = source.active;
		}
	}
</script>

<div class="space-y-6 max-w-2xl">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">New LPAR</h1>
		<p class="text-muted-foreground mt-2">
			Add a new logical partition to track
		</p>
	</div>

	<Card class="p-6">
		<form method="POST" class="space-y-6">
			<!-- Creation Mode Toggle -->
			<div class="space-y-3 pb-4 border-b">
				<Label>How would you like to create this LPAR?</Label>
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
									customer_id: '',
									description: '',
									current_package_id: '',
									active: true
								};
							}}
							class="h-4 w-4"
						/>
						<span>Create blank LPAR</span>
					</label>
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							name="creationMode"
							value="clone"
							bind:group={creationMode}
							class="h-4 w-4"
						/>
						<span>Create from existing LPAR</span>
					</label>
				</div>

				{#if creationMode === 'clone'}
					<div class="space-y-2 pt-2">
						<Label for="cloneSource">Select source LPAR</Label>
						<SearchableSelect
							items={data.allLpars}
							displayField="name"
							valueField="id"
							secondaryField="customers.name"
							placeholder="Search for LPAR to clone..."
							bind:value={cloneSourceId}
							onSelect={handleCloneSourceSelect}
						/>
						{#if cloneSourceId}
							<p class="text-sm text-muted-foreground">
								Form has been pre-filled with data from selected LPAR. You can edit any field
								before creating.
							</p>
						{/if}
					</div>
				{/if}
			</div>

			<FormField
				label="LPAR Name"
				id="name"
				name="name"
				bind:value={formData.name}
				required
				placeholder="Enter LPAR name"
				error={form?.errors?.name?.[0]}
			/>

			<FormField
				label="LPAR Code"
				id="code"
				name="code"
				bind:value={formData.code}
				required
				placeholder="LPAR-CODE"
				helperText="Uppercase alphanumeric with dashes/underscores"
				error={form?.errors?.code?.[0]}
			/>

			<div class="space-y-2">
				<Label for="customerId">Customer <span class="text-destructive">*</span></Label>
				<select
					id="customer_id"
					name="customer_id"
					bind:value={formData.customer_id}
					required
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<option value="">Select a customer...</option>
					{#each data.customers as customer}
						<option value={customer.id}>{customer.name} ({customer.code})</option>
					{/each}
				</select>
				{#if form?.errors?.customer_id?.[0]}
					<p class="text-sm text-destructive">{form.errors.customer_id[0]}</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="currentPackageId">Current Package</Label>
				<select
					id="current_package_id"
					name="current_package_id"
					bind:value={formData.current_package_id}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<option value="">None - assign later</option>
					{#each data.packages as pkg}
						<option value={pkg.id}>{pkg.name} ({pkg.code} {pkg.version})</option>
					{/each}
				</select>
				<p class="text-sm text-muted-foreground">Optional - can be assigned later</p>
				{#if form?.errors?.current_package_id?.[0]}
					<p class="text-sm text-destructive">{form.errors.current_package_id[0]}</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="description">Description</Label>
				<textarea
					id="description"
					name="description"
					bind:value={formData.description}
					placeholder="Enter LPAR description (optional)"
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

			<FormButtons />
		</form>
	</Card>
</div>
