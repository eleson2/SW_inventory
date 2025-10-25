<script lang="ts">
	import type { PageData } from './$types';
	import { superForm } from 'sveltekit-superforms';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import FormCheckbox from '$components/common/FormCheckbox.svelte';
	import CloneModeToggle from '$components/common/CloneModeToggle.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';
	import FormTextarea from '$components/common/FormTextarea.svelte';
	import FormValidationSummary from '$components/common/FormValidationSummary.svelte';
	import Breadcrumb from '$components/common/Breadcrumb.svelte';

	let { data }: { data: PageData } = $props();

	const breadcrumbItems = [
		{ label: 'Home', href: '/' },
		{ label: 'Customers', href: '/customers' },
		{ label: 'New Customer' }
	];

	// Initialize Superforms (server-side validation only)
	const { form, errors, enhance, submitting, delayed, submitted } = superForm(data.form, {
		dataType: 'json',
		resetForm: false
	});

	let creationMode = $state<'blank' | 'clone'>('blank');
	let cloneSourceId = $state('');

	// When clone source is selected, pre-fill form
	function handleCloneSourceSelect(sourceId: string) {
		const source = data.allCustomers.find((c) => c.id === sourceId);
		if (source) {
			$form.name = `${source.name} (Copy)`;
			$form.code = `${source.code}-COPY`;
			$form.description = source.description || '';
			$form.active = source.active;
		}
	}

	// Reset form to blank state
	function handleBlankSelect() {
		$form.name = '';
		$form.code = '';
		$form.description = '';
		$form.active = true;
	}
</script>

<div class="space-y-6 max-w-2xl">
	<Breadcrumb items={breadcrumbItems} />

	<div>
		<h1 class="text-3xl font-bold tracking-tight">New Customer</h1>
		<p class="text-muted-foreground mt-2">
			Add a new customer to the system
		</p>
	</div>

	<Card class="p-6">
		<form method="POST" class="space-y-6" use:enhance>
			<FormValidationSummary errors={$errors} submitted={$submitted} />

			<!-- Creation Mode Toggle -->
			<CloneModeToggle
				entityName="Customer"
				items={data.allCustomers}
				displayField="name"
				secondaryField="code"
				bind:mode={creationMode}
				bind:selectedId={cloneSourceId}
				onModeChange={(mode) => {
					creationMode = mode;
				}}
				onSourceSelect={handleCloneSourceSelect}
				onBlankSelect={handleBlankSelect}
			/>

			<FormField
				label="Customer Name"
				id="name"
				name="name"
				bind:value={$form.name}
				required
				placeholder="Enter customer name"
				error={$errors.name?._errors?.[0]}
			/>

			<FormField
				label="Customer Code"
				id="code"
				name="code"
				bind:value={$form.code}
				required
				placeholder="CUSTOMER-CODE"
				helperText="Uppercase alphanumeric with dashes/underscores"
				error={$errors.code?._errors?.[0]}
			/>

			<FormTextarea
				label="Description"
				id="description"
				name="description"
				bind:value={$form.description}
				placeholder="Enter customer description (optional)"
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
