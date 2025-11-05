<script lang="ts">
	import type { PageData } from './$types';
	import { superForm } from 'sveltekit-superforms';
	import { zod } from 'sveltekit-superforms/adapters';
	import { customerSchema } from '$schemas';
	import type { SuperFormClient } from '$lib/types/superforms';
	import { goto } from '$app/navigation';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import FormCheckbox from '$components/common/FormCheckbox.svelte';
	import CloneModeToggle from '$components/common/CloneModeToggle.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';
	import FormTextarea from '$components/common/FormTextarea.svelte';
	import FormValidationSummary from '$components/common/FormValidationSummary.svelte';
	import Breadcrumb from '$components/common/Breadcrumb.svelte';
	import PageHeader from '$components/common/PageHeader.svelte';

	let { data }: { data: PageData } = $props();

	const typedForm = data.form as unknown as SuperFormClient<typeof customerSchema>;

	const breadcrumbItems = [
		{ label: 'Home', href: '/' },
		{ label: 'Customers', href: '/customers' },
		{ label: 'New Customer' }
	];

	// Initialize Superforms with client-side validation
	const { form, errors, enhance, submitting, delayed, submitted, constraints, validateField } = superForm(typedForm, {
		dataType: 'json',
		resetForm: false,
		validators: zod(customerSchema),
		validationMethod: 'submit-only',
		onResult: ({ result }) => {
			if (result.type === 'redirect') {
				goto(result.location);
			}
		}
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

	<PageHeader
		title="New Customer"
		description="Add a new customer to the system"
	/>

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
				placeholder="Enter customer name"
				error={$errors.name?._errors?.[0]}
				constraints={$constraints.name}
			/>

			<FormField
				label="Customer Code"
				id="code"
				name="code"
				bind:value={$form.code}
				placeholder="CUSTOMER-CODE"
				helperText="Uppercase alphanumeric with dashes/underscores (will auto-uppercase)"
				error={$errors.code?._errors?.[0]}
				constraints={$constraints.code}
				oninput={(e) => {
					const input = e.target as HTMLInputElement;
					const cursorPos = input.selectionStart;
					$form.code = input.value.toUpperCase();
					setTimeout(() => {
						input.setSelectionRange(cursorPos, cursorPos);
					}, 0);
				}}
				onblur={() => validateField('code')}
			/>

			<FormTextarea
				label="Description"
				id="description"
				name="description"
				bind:value={$form.description}
				placeholder="Enter customer description (optional)"
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
