<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import Label from '$components/ui/Label.svelte';
	import Badge from '$components/ui/Badge.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let formData = $state({
		software_id: '',
		software_version_id: '',
		required: true,
		order_index: data.nextOrderIndex
	});

	// Track selected software to show available versions
	let selectedSoftware = $derived(
		data.software.find((s) => s.id === formData.software_id)
	);

	// Reset version when software changes
	$effect(() => {
		if (formData.software_id && !selectedSoftware?.versions.find(v => v.id === formData.software_version_id)) {
			formData.software_version_id = '';
		}
	});
</script>

<div class="space-y-6 max-w-2xl">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Add Software to Package</h1>
		<p class="text-muted-foreground mt-2">
			Adding software to <strong>{data.package.name}</strong> ({data.package.code} v{data.package.version})
		</p>
	</div>

	<Card class="p-6">
		<form method="POST" class="space-y-6">
			<div class="space-y-2">
				<Label for="software_id">Software <span class="text-destructive">*</span></Label>
				<select
					id="software_id"
					name="software_id"
					bind:value={formData.software_id}
					required
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<option value="">Select software...</option>
					{#each data.software as software}
						<option value={software.id}>
							{software.name} ({software.vendors.name})
						</option>
					{/each}
				</select>
				{#if form?.errors?.software_id}
					<p class="text-sm text-destructive">{form.errors.software_id[0]}</p>
				{/if}
			</div>

			{#if selectedSoftware}
				<div class="space-y-2">
					<Label for="software_version_id">Version <span class="text-destructive">*</span></Label>
					<select
						id="software_version_id"
						name="software_version_id"
						bind:value={formData.software_version_id}
						required
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<option value="">Select version...</option>
						{#each selectedSoftware.versions as version}
							<option value={version.id}>
								{version.version}
								{#if version.ptf_level}
									- {version.ptf_level}
								{/if}
								{#if version.is_current}
									(Current)
								{/if}
							</option>
						{/each}
					</select>
					{#if form?.errors?.software_version_id}
						<p class="text-sm text-destructive">{form.errors.software_version_id[0]}</p>
					{/if}
					{#if selectedSoftware.versions.length === 0}
						<p class="text-sm text-muted-foreground">No versions available for this software</p>
					{/if}
				</div>
			{/if}

			<FormField
				label="Installation Order"
				id="order_index"
				name="order_index"
				type="number"
				bind:value={formData.order_index}
				required
				min={1}
				helperText="Order in which this software should be installed"
				error={form?.errors?.order_index?.[0]}
			/>

			<div class="flex items-center space-x-2">
				<input
					type="checkbox"
					id="required"
					name="required"
					bind:checked={formData.required}
					class="h-4 w-4 rounded border-gray-300"
				/>
				<Label for="required">Required (must be installed)</Label>
			</div>

			{#if form?.message}
				<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					{form.message}
				</div>
			{/if}

			<div class="flex gap-4">
				<Button type="submit" disabled={!formData.software_id || !formData.software_version_id}>
					Add Software
				</Button>
				<Button
					type="button"
					variant="outline"
					onclick={() => window.location.href = `/packages/${data.package.id}`}
				>
					Cancel
				</Button>
			</div>
		</form>
	</Card>

	{#if selectedSoftware}
		<Card class="p-6">
			<h2 class="text-lg font-semibold mb-3">Software Details</h2>
			<dl class="space-y-2 text-sm">
				<div>
					<dt class="font-medium text-muted-foreground">Vendor</dt>
					<dd>{selectedSoftware.vendors.name}</dd>
				</div>
				<div>
					<dt class="font-medium text-muted-foreground">Code</dt>
					<dd><Badge variant="outline">{selectedSoftware.code}</Badge></dd>
				</div>
				{#if selectedSoftware.description}
					<div>
						<dt class="font-medium text-muted-foreground">Description</dt>
						<dd>{selectedSoftware.description}</dd>
					</div>
				{/if}
				<div>
					<dt class="font-medium text-muted-foreground">Available Versions</dt>
					<dd>{selectedSoftware.versions.length}</dd>
				</div>
			</dl>
		</Card>
	{/if}
</div>
