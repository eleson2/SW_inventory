<script lang="ts">
	// @ts-nocheck - Superforms type inference issues with client-side validation
	import type { PageData } from './$types';
	import { superForm } from 'sveltekit-superforms';
	import { zod } from 'sveltekit-superforms/adapters';
	import { lparSchema } from '$schemas';
	import { goto } from '$app/navigation';
	import Card from '$components/ui/Card.svelte';
	import Label from '$components/ui/Label.svelte';
	import FormField from '$components/common/FormField.svelte';
	import FormCheckbox from '$components/common/FormCheckbox.svelte';
	import CloneModeToggle from '$components/common/CloneModeToggle.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';
	import FormTextarea from '$components/common/FormTextarea.svelte';
	import FormValidationSummary from '$components/common/FormValidationSummary.svelte';
	import Breadcrumb from '$components/common/Breadcrumb.svelte';

	let { data }: { data: PageData } = $props();

	// Check if we have a pre-selected customer
	const hasPreselectedCustomer = !!data.preselectedCustomer;

	const breadcrumbItems = hasPreselectedCustomer
		? [
			{ label: 'Home', href: '/' },
			{ label: 'Customers', href: '/customers' },
			{ label: data.preselectedCustomer!.name, href: `/customers/${data.preselectedCustomer!.id}` },
			{ label: 'New LPAR' }
		]
		: [
			{ label: 'Home', href: '/' },
			{ label: 'LPARs', href: '/lpars' },
			{ label: 'New LPAR' }
		];

	// Initialize Superforms with client-side validation
	// @ts-expect-error - Superforms type inference issue with Zod validators
	const { form, errors, enhance, submitting, delayed, submitted, constraints } = superForm(data.form, {
		dataType: 'json',
		resetForm: false,
		validators: zod(lparSchema),
		// Redirect after successful submission
		onUpdated: ({ form }) => {
			if (form.valid) {
				// Redirect back to customer page if we came from there
				if (hasPreselectedCustomer) {
					goto(`/customers/${data.preselectedCustomer!.id}`);
				} else {
					goto('/lpars');
				}
			}
		}
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
		// Keep customer_id if pre-selected
		if (!hasPreselectedCustomer) {
			$form.customer_id = '';
		}
		$form.description = '';
		$form.current_package_id = '';
		$form.active = true;
	}
</script>

<div class="space-y-6 max-w-2xl">
	<Breadcrumb items={breadcrumbItems} />

	<div>
		<h1 class="text-3xl font-bold tracking-tight">New LPAR</h1>
		<p class="text-muted-foreground mt-2">
			{#if hasPreselectedCustomer}
				Add a new logical partition for {data.preselectedCustomer!.name}
			{:else}
				Add a new logical partition to track
			{/if}
		</p>
	</div>

	<Card class="p-6">
		<form method="POST" class="space-y-6" use:enhance>
			<FormValidationSummary errors={$errors} submitted={$submitted} />

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
				placeholder="Enter LPAR name"
				error={$errors.name?._errors?.[0]}
				constraints={$constraints.name}
			/>

			<FormField
				label="LPAR Code"
				id="code"
				name="code"
				bind:value={$form.code}
				placeholder="LPAR-CODE"
				helperText="Uppercase alphanumeric with dashes/underscores"
				error={$errors.code?._errors?.[0]}
				constraints={$constraints.code}
			/>

			{#if hasPreselectedCustomer}
				<!-- Show customer as readonly field when pre-selected -->
				<div class="space-y-2">
					<Label for="customer_id">Customer</Label>
					<div class="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm">
						<span class="font-medium">{data.preselectedCustomer!.name}</span>
						<span class="text-muted-foreground ml-2">({data.preselectedCustomer!.code})</span>
					</div>
					<input type="hidden" name="customer_id" value={$form.customer_id} />
					<p class="text-sm text-muted-foreground">
						Creating LPAR for this customer
					</p>
				</div>
			{:else}
				<!-- Show dropdown when no customer pre-selected -->
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
			{/if}

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
				constraints={$constraints.description}
			/>

			<FormCheckbox
				label="Active"
				id="active"
				name="active"
				bind:checked={$form.active}
				constraints={$constraints.active}
			/>

			<FormButtons loading={$submitting || $delayed} />
		</form>
	</Card>
</div>
