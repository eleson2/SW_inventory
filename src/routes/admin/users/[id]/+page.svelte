<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Breadcrumb from '#lib/components/common/Breadcrumb.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import UserForm from '#lib/components/admin/UserForm.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const inputClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm';
	const lastLogin = $derived(data.user.last_login_at ? new Date(data.user.last_login_at).toLocaleString() : 'never');
</script>

<svelte:head><title>{data.user.username} - Users - SW Inventory</title></svelte:head>

<div class="max-w-2xl space-y-6">
	<Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Users', href: '/admin/users' }, { label: data.user.username }]} />
	<PageHeader
		title={data.user.display_name}
		description="Created {new Date(data.user.created_at).toLocaleDateString()} · last login {lastLogin}"
	/>

	{#if form && 'error' in form}
		<p role="alert" class="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{form.error}</p>
	{:else if form && 'saved' in form}
		<p class="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">Saved.</p>
	{:else if form && 'passwordSet' in form}
		<p class="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
			Password set. The user's open sessions have ended.
		</p>
	{/if}

	<Card class="p-6">
		<UserForm action="?/update" values={data.user} envUser={data.isEnvUser} />
	</Card>

	<Card class="p-6 space-y-3">
		<h2 class="font-semibold">Password</h2>
		{#if data.isEnvUser}
			<p class="text-sm text-muted-foreground">The password of this login is AUTH_PASSWORD in .env.</p>
		{:else}
			{#if !data.user.has_password}
				<p class="text-sm text-muted-foreground">No password set: this user cannot log in yet.</p>
			{/if}
			<form method="POST" action="?/password" use:enhance class="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
				<label class="text-sm">
					<span class="mb-1 block font-medium">New password</span>
					<input name="password" type="password" required minlength="8" autocomplete="new-password" class={inputClass} />
				</label>
				<label class="text-sm">
					<span class="mb-1 block font-medium">Repeat</span>
					<input name="confirm" type="password" required minlength="8" autocomplete="new-password" class={inputClass} />
				</label>
				<Button type="submit" variant="outline">Set password</Button>
			</form>
			<p class="text-xs text-muted-foreground">Setting a password ends the user's open sessions.</p>
		{/if}
	</Card>
</div>
