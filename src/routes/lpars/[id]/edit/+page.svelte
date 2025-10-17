<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import Label from '$components/ui/Label.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let formData = $state({
		name: data.lpar.name,
		code: data.lpar.code,
		customer_id: data.lpar.customerId,
		description: data.lpar.description || '',
		current_package_id: data.lpar.currentPackageId || '',
		active: data.lpar.active
	});
</script>

<div class="space-y-6 max-w-2xl">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Edit LPAR</h1>
		<p class="text-muted-foreground mt-2">
			Update LPAR information
		</p>
	</div>

	<Card class="p-6">
		<form method="POST" class="space-y-6">
			<FormField
				label="LPAR Name"
				id="name"
				name="name"
				bind:value={formData.name}
				required
				placeholder="Enter LPAR name"
				error={form?.errors?.name?.[0]}
			/>

			<FormField
				label="LPAR Code"
				id="code"
				name="code"
				bind:value={formData.code}
				required
				placeholder="LPAR-CODE"
				helperText="Uppercase alphanumeric with dashes/underscores"
				error={form?.errors?.code?.[0]}
			/>

			<div class="space-y-2">
				<Label for="customerId">Customer <span class="text-destructive">*</span></Label>
				<select
					id="customer_id"
					name="customer_id"
					bind:value={formData.customer_id}
					required
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{#each data.customers as customer}
						<option value={customer.id}>{customer.name} ({customer.code})</option>
					{/each}
				</select>
				{#if form?.errors?.customer_id?.[0]}
					<p class="text-sm text-destructive">{form.errors.customerId[0]}</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="currentPackageId">Current Package</Label>
				<select
					id="current_package_id"
					name="current_package_id"
					bind:value={formData.current_package_id}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<option value="">None</option>
					{#each data.packages as pkg}
						<option value={pkg.id}>{pkg.name} ({pkg.code} {pkg.version})</option>
					{/each}
				</select>
				<p class="text-sm text-muted-foreground">Optional - can be changed later</p>
				{#if form?.errors?.current_package_id?.[0]}
					<p class="text-sm text-destructive">{form.errors.currentPackageId[0]}</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="description">Description</Label>
				<textarea
					id="description"
					name="description"
					bind:value={formData.description}
					placeholder="Enter LPAR description (optional)"
					class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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

			<FormButtons />
		</form>
	</Card>
</div>
