<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { GLOBAL_ROLES, ROLES, hasGlobalRole } from '#lib/utils/permissions.ts';
	import ResponsibilitiesList from '#lib/components/admin/ResponsibilitiesList.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const user = $derived(page.data.user);
	const inputClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm';
</script>

<svelte:head><title>My account - SW Inventory</title></svelte:head>

<div class="max-w-xl space-y-6">
	<PageHeader title="My account" description="{user?.display_name} ({user?.username})" />

	<Card class="p-6 space-y-2 text-sm">
		<h2 class="font-semibold">Rights</h2>
		<ul class="list-disc pl-5">
			{#each GLOBAL_ROLES.filter((r) => user && hasGlobalRole(user, r)) as role (role)}
				<li>{ROLES[role].label}: {ROLES[role].description}</li>
			{/each}
			<li>Can see every page and report</li>
		</ul>
		<h3 class="pt-2 font-semibold">Editor of</h3>
		<ResponsibilitiesList items={data.responsibilities} empty="No customer, vendor or package assigned to you." />
	</Card>

	<Card class="p-6 space-y-3">
		<h2 class="font-semibold">Change password</h2>
		{#if data.isEnvUser}
			<p class="text-sm text-muted-foreground">You are logged in with the login from .env; its password is AUTH_PASSWORD there.</p>
		{:else}
			{#if form && 'error' in form}
				<p role="alert" class="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{form.error}</p>
			{:else if form && 'passwordSet' in form}
				<p class="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
					Password changed. Your sessions elsewhere have ended.
				</p>
			{/if}
			<form method="POST" action="?/password" use:enhance class="space-y-3">
				<label class="block text-sm">
					<span class="mb-1 block font-medium">Current password</span>
					<input name="current" type="password" required autocomplete="current-password" class={inputClass} />
				</label>
				<label class="block text-sm">
					<span class="mb-1 block font-medium">New password</span>
					<input name="password" type="password" required minlength="8" autocomplete="new-password" class={inputClass} />
				</label>
				<label class="block text-sm">
					<span class="mb-1 block font-medium">Repeat new password</span>
					<input name="confirm" type="password" required minlength="8" autocomplete="new-password" class={inputClass} />
				</label>
				<Button type="submit">Change password</Button>
			</form>
		{/if}
	</Card>
</div>
