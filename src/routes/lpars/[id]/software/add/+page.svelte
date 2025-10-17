<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import Label from '$components/ui/Label.svelte';
	import Badge from '$components/ui/Badge.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let formData = $state({
		software_id: '',
		software_version_id: ''
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
		<h1 class="text-3xl font-bold tracking-tight">Install Software on LPAR</h1>
		<p class="text-muted-foreground mt-2">
			Installing software on <strong>{data.lpar.name}</strong> ({data.lpar.code})
		</p>
	</div>

	{#if data.lpar.customers}
		<Card class="p-4 bg-muted/50">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm font-medium">Customer</p>
					<p class="text-sm text-muted-foreground">{data.lpar.customers.name}</p>
				</div>
				{#if data.lpar.packages}
					<div class="text-right">
						<p class="text-sm font-medium">Assigned Package</p>
						<p class="text-sm text-muted-foreground">
							{data.lpar.packages.name} (v{data.lpar.packages.version})
						</p>
					</div>
				{/if}
			</div>
		</Card>
	{/if}

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
				{#if data.software.length === 0}
					<p class="text-sm text-muted-foreground">
						All available software is already installed on this LPAR
					</p>
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
						<p class="text-sm text-destructive">
							No versions available for this software. Please add a version first.
						</p>
					{/if}
				</div>
			{/if}

			{#if form?.message}
				<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					{form.message}
				</div>
			{/if}

			<div class="flex gap-4">
				<Button
					type="submit"
					disabled={!formData.software_id || !formData.software_version_id || data.software.length === 0}
				>
					Install Software
				</Button>
				<Button
					type="button"
					variant="outline"
					onclick={() => window.location.href = `/lpars/${data.lpar.id}`}
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
				{#if selectedSoftware.versions.length > 0}
					<div>
						<dt class="font-medium text-muted-foreground">Current Version</dt>
						<dd>
							{#each selectedSoftware.versions as version}
								{#if version.is_current}
									<Badge>{version.version}</Badge>
									{#if version.ptf_level}
										<Badge variant="outline">{version.ptf_level}</Badge>
									{/if}
								{/if}
							{/each}
						</dd>
					</div>
				{/if}
			</dl>
		</Card>
	{/if}
</div>
