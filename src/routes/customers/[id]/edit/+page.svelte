<script lang="ts">
	import type { PageData } from './$types';
	import { superForm } from 'sveltekit-superforms';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import FormCheckbox from '$components/common/FormCheckbox.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';
	import FormErrorMessage from '$components/common/FormErrorMessage.svelte';
	import FormTextarea from '$components/common/FormTextarea.svelte';

	let { data }: { data: PageData } = $props();

	const { form, errors, enhance, message } = superForm(data.form, {
		dataType: 'json',
		resetForm: false
	});
</script>

<div class="space-y-6 max-w-2xl">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Edit Customer</h1>
		<p class="text-muted-foreground mt-2">
			Update customer information
		</p>
	</div>

	<Card class="p-6">
		<form method="POST" class="space-y-6" use:enhance>
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

			<FormErrorMessage message={$message} />

			<FormButtons />
		</form>
	</Card>
</div>
