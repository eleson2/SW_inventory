<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import Label from '$components/ui/Label.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let formData = $state({
		name: data.customer.name,
		code: data.customer.code,
		description: data.customer.description || '',
		active: data.customer.active
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
		<form method="POST" class="space-y-6">
			<FormField
				label="Customer Name"
				id="name"
				name="name"
				bind:value={formData.name}
				required
				placeholder="Enter customer name"
				error={form?.errors?.name?.[0]}
			/>

			<FormField
				label="Customer Code"
				id="code"
				name="code"
				bind:value={formData.code}
				required
				placeholder="CUSTOMER-CODE"
				helperText="Uppercase alphanumeric with dashes/underscores"
				error={form?.errors?.code?.[0]}
			/>

			<div class="space-y-2">
				<Label for="description">Description</Label>
				<textarea
					id="description"
					name="description"
					bind:value={formData.description}
					placeholder="Enter customer description (optional)"
					class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				></textarea>
			</div>

			<div class="flex items-center space-x-2">
				<input
					type="checkbox"
					id="active"
					name="active"
					bind:checked={formData.active}
					class="h-4 w-4 rounded border-gray-300"
				/>
				<Label for="active">Active</Label>
			</div>

			{#if form?.message}
				<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					{form.message}
				</div>
			{/if}

			<div class="flex gap-4">
				<Button type="submit">Update Customer</Button>
				<Button type="button" variant="outline" onclick={() => window.history.back()}>
					Cancel
				</Button>
			</div>
		</form>
	</Card>
</div>
