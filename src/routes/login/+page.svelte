<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let submitting = $state(false);

	const inputClass =
		'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
</script>

<svelte:head>
	<title>Sign in - SW Inventory</title>
</svelte:head>

<div class="flex min-h-[60vh] items-center justify-center">
	<div class="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
		<h1 class="mb-1 text-2xl font-semibold">Sign in</h1>
		<p class="mb-6 text-sm text-muted-foreground">Software Inventory Management System</p>

		{#if form?.message}
			<div role="alert" class="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{form.message}
			</div>
		{/if}

		<form
			method="POST"
			class="space-y-4"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			<div class="space-y-2">
				<label for="username" class="text-sm font-medium">Username</label>
				<input
					id="username"
					name="username"
					type="text"
					autocomplete="username"
					required
					value={form?.username ?? ''}
					class={inputClass}
				/>
			</div>
			<div class="space-y-2">
				<label for="password" class="text-sm font-medium">Password</label>
				<input id="password" name="password" type="password" autocomplete="current-password" required class={inputClass} />
			</div>
			<Button type="submit" class="w-full" disabled={submitting}>
				{submitting ? 'Signing in…' : 'Sign in'}
			</Button>
		</form>
	</div>
</div>
