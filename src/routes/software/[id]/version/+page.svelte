<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import FormErrorMessage from '$components/common/FormErrorMessage.svelte';
	import FormTextarea from '$components/common/FormTextarea.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let formData = $state({
		version: '',
		ptf_level: '',
		release_date: new Date().toISOString().split('T')[0],
		release_notes: ''
	});
</script>

<div class="space-y-6 max-w-2xl">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">New Software Version</h1>
		<p class="text-muted-foreground mt-2">
			Add a new version for {data.software.name}
		</p>
	</div>

	<Card class="p-6">
		<div class="mb-6 space-y-2">
			<h3 class="font-semibold">Current Version</h3>
			<div class="rounded-md bg-muted p-4">
				{#if data.software.current_version}
					<p class="text-sm">
						<span class="font-medium">Version:</span> {data.software.current_version.version}
					</p>
					{#if data.software.current_version.ptf_level}
						<p class="text-sm mt-1">
							<span class="font-medium">PTF Level:</span> {data.software.current_version.ptf_level}
						</p>
					{/if}
				{:else}
					<p class="text-sm text-muted-foreground">No current version set</p>
				{/if}
			</div>
		</div>

		<form method="POST" class="space-y-6">
			<FormField
				label="Version"
				id="version"
				name="version"
				bind:value={formData.version}
				required
				placeholder="e.g., V2R5M0 or 2.5.0"
				helperText="The new version number"
				error={form?.errors?.version?.[0]}
			/>

			<FormField
				label="PTF Level"
				id="ptf_level"
				name="ptf_level"
				bind:value={formData.ptf_level}
				placeholder="e.g., PTF12345 or SP1"
				helperText="Optional - PTF/patch level for this version"
				error={form?.errors?.ptf_level?.[0]}
			/>

			<FormField
				label="Release Date"
				id="release_date"
				name="release_date"
				type="date"
				bind:value={formData.release_date}
				required
				helperText="When this version was released"
				error={form?.errors?.release_date?.[0]}
			/>

			<FormTextarea
				label="Release Notes"
				id="release_notes"
				name="release_notes"
				bind:value={formData.release_notes}
				placeholder="Enter release notes or change description (optional)"
				helperText="Optional - describe changes in this version"
			/>

			<FormErrorMessage message={form?.message} />

			<div class="flex gap-4">
				<Button type="submit">Add New Version</Button>
				<Button type="button" variant="outline" onclick={() => window.history.back()}>
					Cancel
				</Button>
			</div>
		</form>
	</Card>

	{#if data.software.versions && data.software.versions.length > 0}
		<Card class="p-6">
			<h3 class="font-semibold mb-4">Version History</h3>
			<div class="space-y-3">
				{#each data.software.versions as version}
					<div class="rounded-md border p-3">
						<div class="flex items-center gap-2">
							<p class="font-medium">{version.version}</p>
							{#if version.is_current}
								<span class="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 text-xs font-medium">Current</span>
							{/if}
						</div>
						{#if version.ptf_level}
							<p class="text-sm text-muted-foreground">PTF: {version.ptf_level}</p>
						{/if}
						{#if version.release_notes}
							<p class="text-sm text-muted-foreground mt-1">{version.release_notes}</p>
						{/if}
						<p class="text-xs text-muted-foreground mt-1">
							Released: {new Date(version.release_date).toLocaleDateString()}
						</p>
						{#if version.end_of_support}
							<p class="text-xs text-muted-foreground">
								End of Support: {new Date(version.end_of_support).toLocaleDateString()}
							</p>
						{/if}
					</div>
				{/each}
			</div>
		</Card>
	{/if}
</div>
