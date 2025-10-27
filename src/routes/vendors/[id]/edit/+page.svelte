<script lang="ts">
	// @ts-nocheck - Superforms type inference issues with client-side validation
	import type { PageData } from './$types';
	import { superForm } from 'sveltekit-superforms';
	import { zod } from 'sveltekit-superforms/adapters';
	import { vendorSchema } from '$schemas';
	import { goto } from '$app/navigation';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import FormCheckbox from '$components/common/FormCheckbox.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';
	import FormErrorMessage from '$components/common/FormErrorMessage.svelte';

	let { data }: { data: PageData } = $props();

	// @ts-expect-error - Superforms type inference issue with Zod validators
	const { form, errors, enhance, message, constraints } = superForm(data.form, {
		dataType: 'json',
		resetForm: false,
		validators: zod(vendorSchema),
		// Redirect after successful submission
		onUpdated: ({ form }) => {
			if (form.valid) {
				goto('/vendors');
			}
		}
	});
</script>

<div class="space-y-6 max-w-2xl">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Edit Vendor</h1>
		<p class="text-muted-foreground mt-2">
			Update vendor information
		</p>
	</div>

	<Card class="p-6">
		<form method="POST" class="space-y-6" use:enhance>
			<FormField
				label="Vendor Name"
				id="name"
				name="name"
				bind:value={$form.name}
				placeholder="Enter vendor name"
				error={$errors.name?._errors?.[0]}
				constraints={$constraints.name}
			/>

			<FormField
				label="Vendor Code"
				id="code"
				name="code"
				bind:value={$form.code}
				placeholder="VENDOR-CODE"
				helperText="Uppercase alphanumeric with dashes/underscores"
				error={$errors.code?._errors?.[0]}
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
				error={$errors.website?._errors?.[0]}
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
				error={$errors.contact_email?._errors?.[0]}
				constraints={$constraints.contact_email}
			/>

			<FormCheckbox
				label="Active"
				id="active"
				name="active"
				bind:checked={$form.active}
				constraints={$constraints.active}
			/>

			<FormErrorMessage message={$message} />

			<FormButtons />
		</form>
	</Card>
</div>
