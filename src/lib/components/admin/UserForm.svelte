<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';

	interface UserValues {
		username?: string;
		display_name?: string;
		email?: string | null;
		is_admin?: boolean;
		can_create_packages?: boolean;
		active?: boolean;
	}

	let {
		values = {},
		action = '',
		isNew = false,
		envUser = false,
		submitLabel = 'Save'
	}: {
		values?: UserValues;
		action?: string;
		isNew?: boolean;
		/** The .env login: username and rights come from .env */
		envUser?: boolean;
		submitLabel?: string;
	} = $props();

	const inputClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm';
</script>

<form method="POST" {action} use:enhance={() => async ({ update }) => update({ reset: false })} class="space-y-4">
	<div class="grid gap-4 sm:grid-cols-2">
		<label class="text-sm">
			<span class="mb-1 block font-medium">Username</span>
			<input
				name="username"
				required
				maxlength="50"
				autocomplete="off"
				value={values.username ?? ''}
				readonly={envUser}
				class="{inputClass} {envUser ? 'bg-muted' : ''}"
			/>
			<span class="mt-1 block text-xs text-muted-foreground">Lowercase letters, digits, dot, dash, underscore</span>
		</label>
		<label class="text-sm">
			<span class="mb-1 block font-medium">Name</span>
			<input name="display_name" required maxlength="100" value={values.display_name ?? ''} class={inputClass} />
		</label>
		<label class="text-sm sm:col-span-2">
			<span class="mb-1 block font-medium">Email <span class="font-normal text-muted-foreground">(optional)</span></span>
			<input name="email" type="email" maxlength="200" value={values.email ?? ''} class={inputClass} />
		</label>
		{#if isNew}
			<label class="text-sm sm:col-span-2">
				<span class="mb-1 block font-medium">Password</span>
				<input name="password" type="password" required minlength="8" autocomplete="new-password" class={inputClass} />
				<span class="mt-1 block text-xs text-muted-foreground">At least 8 characters. The user can change it under "My account".</span>
			</label>
		{/if}
	</div>

	<fieldset class="space-y-2 text-sm" disabled={envUser}>
		<legend class="mb-1 font-medium">Rights</legend>
		<label class="flex items-start gap-2">
			<input type="checkbox" name="is_admin" checked={envUser || (values.is_admin ?? false)} class="mt-0.5" />
			<span>Administrator <span class="text-muted-foreground">— can change everything, including users</span></span>
		</label>
		<label class="flex items-start gap-2">
			<input type="checkbox" name="can_create_packages" checked={values.can_create_packages ?? false} class="mt-0.5" />
			<span>Can create packages <span class="text-muted-foreground">— and becomes an editor of the packages they create</span></span>
		</label>
		{#if !isNew}
			<label class="flex items-start gap-2">
				<input type="checkbox" name="active" checked={envUser || (values.active ?? true)} class="mt-0.5" />
				<span>Active <span class="text-muted-foreground">— inactive users cannot log in; their sessions end at once</span></span>
			</label>
		{/if}
	</fieldset>
	{#if envUser}
		<!-- disabled fields are not submitted; the server keeps the .env user's rights anyway -->
		<input type="hidden" name="is_admin" value="on" />
		<input type="hidden" name="active" value="on" />
		{#if values.can_create_packages}<input type="hidden" name="can_create_packages" value="on" />{/if}
		<p class="text-xs text-muted-foreground">This is the login from .env (AUTH_USERNAME): always an active administrator.</p>
	{:else if !isNew}
		<!-- marks that the form has the Active checkbox, so unticking it means inactive -->
		<input type="hidden" name="active_present" value="1" />
	{/if}

	<Button type="submit">{submitLabel}</Button>
</form>
