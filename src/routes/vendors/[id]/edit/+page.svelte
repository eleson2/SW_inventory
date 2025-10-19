<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import FormCheckbox from '$components/common/FormCheckbox.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let formData = $state({
		name: data.vendor.name,
		code: data.vendor.code,
		website: data.vendor.website || '',
		contact_email: data.vendor.contact_email || '',
		active: data.vendor.active
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
		<form method="POST" class="space-y-6">
			<FormField
				label="Vendor Name"
				id="name"
				name="name"
				bind:value={formData.name}
				required
				placeholder="Enter vendor name"
				error={form?.errors?.name?.[0]}
			/>

			<FormField
				label="Vendor Code"
				id="code"
				name="code"
				bind:value={formData.code}
				required
				placeholder="VENDOR-CODE"
				helperText="Uppercase alphanumeric with dashes/underscores"
				error={form?.errors?.code?.[0]}
			/>

			<FormField
				label="Website"
				id="website"
				name="website"
				type="url"
				bind:value={formData.website}
				placeholder="https://www.example.com"
				helperText="Optional - full URL including https://"
				error={form?.errors?.website?.[0]}
			/>

			<FormField
				label="Contact Email"
				id="contact_email"
				name="contact_email"
				type="email"
				bind:value={formData.contact_email}
				placeholder="contact@example.com"
				helperText="Optional - main contact email for this vendor"
				error={form?.errors?.contact_email?.[0]}
			/>

			<FormCheckbox
				label="Active"
				id="active"
				name="active"
				bind:checked={formData.active}
			/>

			{#if form?.message}
				<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					{form.message}
				</div>
			{/if}

			<FormButtons />
		</form>
	</Card>
</div>
