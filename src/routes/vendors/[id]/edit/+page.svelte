<script lang="ts">
	import type { PageData } from './$types';
	import { superForm } from 'sveltekit-superforms';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import FormCheckbox from '$components/common/FormCheckbox.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';
	import FormErrorMessage from '$components/common/FormErrorMessage.svelte';

	let { data }: { data: PageData } = $props();

	const { form, errors, enhance, message } = superForm(data.form, {
		dataType: 'json',
		resetForm: false
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
				required
				placeholder="Enter vendor name"
				error={$errors.name?._errors?.[0]}
			/>

			<FormField
				label="Vendor Code"
				id="code"
				name="code"
				bind:value={$form.code}
				required
				placeholder="VENDOR-CODE"
				helperText="Uppercase alphanumeric with dashes/underscores"
				error={$errors.code?._errors?.[0]}
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
			/>

			<FormCheckbox
				label="Active"
				id="active"
				name="active"
				bind:checked={$form.active}
			/>

			<FormErrorMessage message={$message} />

			<FormButtons />
		</form>
	</Card>
</div>
