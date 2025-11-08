<script lang="ts">
	import type { PageData } from './$types';
	import { typedSuperForm } from '$lib/utils/superforms';
	import { customerUpdateSchema } from '$lib/schemas/customer';
	import { goto } from '$app/navigation';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import FormCheckbox from '$components/common/FormCheckbox.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';
	import FormErrorMessage from '$components/common/FormErrorMessage.svelte';
	import FormTextarea from '$components/common/FormTextarea.svelte';
	import Breadcrumb from '$components/common/Breadcrumb.svelte';
	import PageHeader from '$components/common/PageHeader.svelte';

	let { data }: { data: PageData } = $props();

	const breadcrumbItems = [
		{ label: 'Home', href: '/' },
		{ label: 'Customers', href: '/customers' },
		{ label: data.customer.name, href: `/customers/${data.customer.id}` },
		{ label: 'Edit' }
	];

	const { form, errors, enhance, message, constraints } = typedSuperForm(data.form, customerUpdateSchema, {
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
