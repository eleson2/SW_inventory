<script lang="ts">
	import type { PageData } from './$types';
	import { typedSuperForm } from '$lib/utils/superforms';
	import { vendorUpdateSchema } from '$lib/schemas/vendor';
	import { goto } from '$app/navigation';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import FormCheckbox from '$components/common/FormCheckbox.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';
	import FormErrorMessage from '$components/common/FormErrorMessage.svelte';
	import Breadcrumb from '$components/common/Breadcrumb.svelte';
	import PageHeader from '$components/common/PageHeader.svelte';
	import TransactionId from '$components/common/TransactionId.svelte';

	let { data }: { data: PageData } = $props();

	const breadcrumbItems = [
		{ label: 'Home', href: '/' },
		{ label: 'Vendors', href: '/vendors' },
		{ label: data.vendor.name, href: `/vendors/${data.vendor.id}` },
		{ label: 'Edit' }
	];

	const { form, errors, enhance, message, constraints } = typedSuperForm(data.form, vendorUpdateSchema, {
		dataType: 'json',
		resetForm: false,
		// Redirect after successful submission
		onUpdated: ({ form: updateForm }: { form: any }) => {
			if (updateForm.valid) {
				goto('/vendors');
			}
		}
	});
</script>

<div class="space-y-6 max-w-2xl">
	<!-- Transaction ID -->
	<div class="flex justify-start mb-4">
		<TransactionId prefix="VND-EDIT" label="Form ID" />
	</div>

	<Breadcrumb items={breadcrumbItems} />

	<PageHeader
		title="Edit Vendor"
		description="Update vendor information"
	/>

	<Card class="p-6">
		<form method="POST" class="space-y-6" use:enhance>
			<FormField
				label="Vendor Name"
				id="name"
				name="name"
				bind:value={$form.name}
				placeholder="Enter vendor name"
				error={$errors.name?.[0]}
				constraints={$constraints.name}
			/>

			<FormField
				label="Vendor Code"
				id="code"
				name="code"
				bind:value={$form.code}
				placeholder="VENDOR-CODE"
				helperText="Uppercase alphanumeric with dashes/underscores"
				error={$errors.code?.[0]}
				constraints={$constraints.code}
			/>

			<FormField
				label="Website"
				id="website"
				name="website"
				type="url"
				bind:value={$form.website}
				placeholder="https://www.example.com"
				helperText="Optional - full URL including https://"
				error={$errors.website?.[0]}
				constraints={$constraints.website}
			/>

			<FormField
				label="Contact Email"
				id="contact_email"
				name="contact_email"
				type="email"
				bind:value={$form.contact_email}
				placeholder="contact@example.com"
				helperText="Optional - main contact email for this vendor"
				error={$errors.contact_email?.[0]}
				constraints={$constraints.contact_email}
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
