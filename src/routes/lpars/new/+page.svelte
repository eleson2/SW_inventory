<script lang="ts">
	import type { PageData } from './$types';
	import { superForm} from 'sveltekit-superforms';
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
		const source = data.allLpars.find((l) => l.id === sourceId);
		if (source) {
			$form.name = `${source.name} (Copy)`;
			$form.code = `${source.code}-COPY`;
			$form.customer_id = source.customer_id;
			$form.description = source.description || '';
			$form.current_package_id = source.current_package_id || '';
			$form.active = source.active;
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
		<form method="POST" class="space-y-6" use:enhance>
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
								$form.name = '';
								$form.code = '';
								$form.customer_id = '';
								$form.description = '';
								$form.current_package_id = '';
								$form.active = true;
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
				bind:value={$form.name}
				required
				placeholder="Enter LPAR name"
				error={$errors.name?._errors?.[0]}
			/>

			<FormField
				label="LPAR Code"
				id="code"
				name="code"
				bind:value={$form.code}
				required
				placeholder="LPAR-CODE"
				helperText="Uppercase alphanumeric with dashes/underscores"
				error={$errors.code?._errors?.[0]}
			/>

			<div class="space-y-2">
				<Label for="customerId">Customer <span class="text-destructive">*</span></Label>
				<select
					id="customer_id"
					name="customer_id"
					bind:value={$form.customer_id}
					required
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<option value="">Select a customer...</option>
					{#each data.customers as customer}
						<option value={customer.id}>{customer.name} ({customer.code})</option>
					{/each}
				</select>
				{#if $errors.customer_id?._errors?.[0]}
					<p class="text-sm text-destructive">{$errors.customer_id._errors[0]}</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="currentPackageId">Current Package</Label>
				<select
					id="current_package_id"
					name="current_package_id"
					bind:value={$form.current_package_id}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<option value="">None - assign later</option>
					{#each data.packages as pkg}
						<option value={pkg.id}>{pkg.name} ({pkg.code} {pkg.version})</option>
					{/each}
				</select>
				<p class="text-sm text-muted-foreground">Optional - can be assigned later</p>
				{#if $errors.current_package_id?._errors?.[0]}
					<p class="text-sm text-destructive">{$errors.current_package_id._errors[0]}</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="description">Description</Label>
				<textarea
					id="description"
					name="description"
					bind:value={$form.description}
					placeholder="Enter LPAR description (optional)"
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

			<FormButtons />
		</form>
	</Card>
</div>
