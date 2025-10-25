<script lang="ts">
	import type { PageData } from './$types';
	import { superForm} from 'sveltekit-superforms';
	import Card from '$components/ui/Card.svelte';
	import Label from '$components/ui/Label.svelte';
	import FormField from '$components/common/FormField.svelte';
	import FormCheckbox from '$components/common/FormCheckbox.svelte';
	import CloneModeToggle from '$components/common/CloneModeToggle.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';
	import FormTextarea from '$components/common/FormTextarea.svelte';

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

	// Reset form to blank state
	function handleBlankSelect() {
		$form.name = '';
		$form.code = '';
		$form.customer_id = '';
		$form.description = '';
		$form.current_package_id = '';
		$form.active = true;
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
			<CloneModeToggle
				entityName="LPAR"
				items={data.allLpars}
				displayField="name"
				secondaryField="customers.name"
				bind:mode={creationMode}
				bind:selectedId={cloneSourceId}
				onModeChange={(mode) => {
					creationMode = mode;
				}}
				onSourceSelect={handleCloneSourceSelect}
				onBlankSelect={handleBlankSelect}
			/>

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

			<FormTextarea
				label="Description"
				id="description"
				name="description"
				bind:value={$form.description}
				placeholder="Enter LPAR description (optional)"
			/>

			<FormCheckbox
				label="Active"
				id="active"
				name="active"
				bind:checked={$form.active}
			/>

			<FormButtons loading={$submitting || $delayed} />
		</form>
	</Card>
</div>
