<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import Label from '$components/ui/Label.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let formData = $state({
		name: '',
		vendorId: '',
		description: '',
		currentVersion: '',
		currentPtfLevel: '',
		active: true
	});
</script>

<div class="space-y-6 max-w-2xl">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">New Software Product</h1>
		<p class="text-muted-foreground mt-2">
			Add a new software product to track
		</p>
	</div>

	<Card class="p-6">
		<form method="POST" class="space-y-6">
			<FormField
				label="Software Name"
				id="name"
				name="name"
				bind:value={formData.name}
				required
				placeholder="Enter software name"
				error={form?.errors?.name?.[0]}
			/>

			<div class="space-y-2">
				<Label for="vendorId">Vendor <span class="text-destructive">*</span></Label>
				<select
					id="vendor_id"
					name="vendor_id"
					bind:value={formData.vendor_id}
					required
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<option value="">Select a vendor...</option>
					{#each data.vendors as vendor}
						<option value={vendor.id}>{vendor.name} ({vendor.code})</option>
					{/each}
				</select>
				{#if form?.errors?.vendor_id?.[0]}
					<p class="text-sm text-destructive">{form.errors.vendorId[0]}</p>
				{/if}
			</div>

			<FormField
				label="Current Version"
				id="currentVersion"
				name="currentVersion"
				bind:value={formData.currentVersion}
				required
				placeholder="e.g., V2R4M0 or 2.4.0"
				helperText="Version number from vendor designation"
				error={form?.errors?.currentVersion?.[0]}
			/>

			<FormField
				label="PTF Level"
				id="currentPtfLevel"
				name="currentPtfLevel"
				bind:value={formData.currentPtfLevel}
				placeholder="e.g., PTF12345 or SP1"
				helperText="Optional - current PTF/patch level"
				error={form?.errors?.currentPtfLevel?.[0]}
			/>

			<div class="space-y-2">
				<Label for="description">Description</Label>
				<textarea
					id="description"
					name="description"
					bind:value={formData.description}
					placeholder="Enter software description (optional)"
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
				<Button type="submit">Create Software</Button>
				<Button type="button" variant="outline" onclick={() => window.history.back()}>
					Cancel
				</Button>
			</div>
		</form>
	</Card>
</div>
