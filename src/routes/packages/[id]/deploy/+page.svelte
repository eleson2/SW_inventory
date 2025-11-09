<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	export let data: PageData;
	// data.form is the superforms form object returned from load
	// data.lpars is the array of available LPARs
	const { form, lpars, packageId } = data;
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-semibold">Deploy Package</h1>
	<p class="text-sm text-muted-foreground">Package: {packageId}</p>

	{#if !lpars || lpars.length === 0}
		<p class="text-sm text-muted-foreground">No LPARs available for deployment.</p>
	{:else}
		<form method="post" use:enhance>
			<fieldset class="space-y-3">
				<legend class="font-medium">Select LPARs to deploy to</legend>

				{#each lpars as lpar}
					<label class="flex items-center gap-3">
						<input type="checkbox" name="lparIds" value={lpar.id} />
						<span class="font-medium">{lpar.name}</span>
						{#if lpar.customer}
							<span class="text-sm text-muted-foreground"> — {lpar.customer}</span>
						{/if}
					</label>
				{/each}

				{#if form?.errors?.lparIds}
					<p class="text-sm text-destructive mt-2">{form.errors.lparIds}</p>
				{/if}
			</fieldset>

			<div class="mt-4 flex items-center gap-3">
				<button type="submit" class="btn btn-primary">Deploy to selected LPARs</button>
				<a class="btn btn-ghost" href={`/packages/${packageId}`}>Cancel</a>
			</div>
		</form>
	{/if}
</div>
