<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import Label from '$components/ui/Label.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let formData = $state({
		newVersion: '',
		newPtfLevel: '',
		releaseNotes: ''
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
				<p class="text-sm">
					<span class="font-medium">Version:</span> {data.software.currentVersion}
				</p>
				{#if data.software.currentPtfLevel}
					<p class="text-sm mt-1">
						<span class="font-medium">PTF Level:</span> {data.software.currentPtfLevel}
					</p>
				{/if}
			</div>
		</div>

		<form method="POST" class="space-y-6">
			<FormField
				label="New Version"
				id="newVersion"
				name="newVersion"
				bind:value={formData.newVersion}
				required
				placeholder="e.g., V2R5M0 or 2.5.0"
				helperText="The new version number to set as current"
				error={form?.errors?.newVersion?.[0]}
			/>

			<FormField
				label="New PTF Level"
				id="newPtfLevel"
				name="newPtfLevel"
				bind:value={formData.newPtfLevel}
				placeholder="e.g., PTF12345 or SP1"
				helperText="Optional - PTF/patch level for this version"
				error={form?.errors?.newPtfLevel?.[0]}
			/>

			<div class="space-y-2">
				<Label for="releaseNotes">Release Notes</Label>
				<textarea
					id="releaseNotes"
					name="releaseNotes"
					bind:value={formData.releaseNotes}
					placeholder="Enter release notes or change description (optional)"
					class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				></textarea>
				<p class="text-sm text-muted-foreground">
					Optional - describe changes in this version
				</p>
			</div>

			{#if form?.message}
				<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					{form.message}
				</div>
			{/if}

			<div class="flex gap-4">
				<Button type="submit">Add New Version</Button>
				<Button type="button" variant="outline" onclick={() => window.history.back()}>
					Cancel
				</Button>
			</div>
		</form>
	</Card>

	{#if data.software.versionHistory && data.software.versionHistory.length > 0}
		<Card class="p-6">
			<h3 class="font-semibold mb-4">Version History</h3>
			<div class="space-y-3">
				{#each data.software.versionHistory as version}
					<div class="rounded-md border p-3">
						<p class="font-medium">{version.version}</p>
						{#if version.ptfLevel}
							<p class="text-sm text-muted-foreground">PTF: {version.ptfLevel}</p>
						{/if}
						{#if version.releaseNotes}
							<p class="text-sm text-muted-foreground mt-1">{version.releaseNotes}</p>
						{/if}
						<p class="text-xs text-muted-foreground mt-1">
							{new Date(version.timestamp).toLocaleDateString()}
						</p>
					</div>
				{/each}
			</div>
		</Card>
	{/if}
</div>
