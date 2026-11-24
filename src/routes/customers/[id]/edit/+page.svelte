<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import { typedSuperForm } from '#lib/utils/superforms.ts';
	import { customerUpdateSchema } from '#lib/schemas/customer.ts';
	import { goto } from '$app/navigation';
	import Card from '#lib/components/ui/Card.svelte';
	import FormField from '#lib/components/common/FormField.svelte';
	import FormCheckbox from '#lib/components/common/FormCheckbox.svelte';
	import FormButtons from '#lib/components/common/FormButtons.svelte';
	import FormErrorMessage from '#lib/components/common/FormErrorMessage.svelte';
	import FormTextarea from '#lib/components/common/FormTextarea.svelte';
	import Breadcrumb from '#lib/components/common/Breadcrumb.svelte';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import TransactionId from '#lib/components/common/TransactionId.svelte';

	let { data }: { data: PageData } = $props();

	const breadcrumbItems = $derived([
		{ label: 'Home', href: '/' },
		{ label: 'Customers', href: '/customers' },
		{ label: data.customer.name, href: `/customers/${data.customer.id}` },
		{ label: 'Edit' }
	]);

	const { form, errors, enhance, message, constraints } = typedSuperForm(untrack(() => data.form), customerUpdateSchema, {
		dataType: 'json',
		resetForm: false,
		// Redirect after successful submission
		onUpdated: ({ form: updateForm }: { form: any }) => {
			if (updateForm.valid) {
				goto('/customers');
			}
		}
	});
</script>

<div class="space-y-6 max-w-2xl">
	<!-- Transaction ID -->
	<div class="flex justify-start mb-4">
		<TransactionId prefix="CUS-EDIT" label="Form ID" />
	</div>

	<Breadcrumb items={breadcrumbItems} />

	<PageHeader
		title="Edit Customer"
		description="Update customer information"
	/>

	<Card class="p-6">
		<form method="POST" class="space-y-6" use:enhance>
			<FormField
				label="Customer Name"
				id="name"
				name="name"
				bind:value={$form.name}
				placeholder="Enter customer name"
				error={$errors.name?.[0]}
				constraints={$constraints.name}
			/>

			<FormField
				label="Customer Code"
				id="code"
				name="code"
				bind:value={$form.code}
				placeholder="CUSTOMER-CODE"
				helperText="Uppercase alphanumeric with dashes/underscores"
				error={$errors.code?.[0]}
				constraints={$constraints.code}
			/>

			<FormTextarea
				label="Description"
				id="description"
				name="description"
				bind:value={$form.description as any}
				placeholder="Enter customer description (optional)"
				constraints={$constraints.description}
			/>

			<FormCheckbox
				label="Active"
				id="active"
				name="active"
				bind:checked={$form.active as any}
				constraints={$constraints.active}
			/>

			<FormErrorMessage message={$message} />

			<FormButtons />
		</form>
	</Card>
</div>
