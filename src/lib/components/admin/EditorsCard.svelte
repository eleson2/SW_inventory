<!--
	Editors of a customer, vendor or package (scoped "editor" roles) and its contact.
	Everyone sees the list; administrators add, remove and pick the contact.
	Server side: loadEditors() and editorActions() in #lib/server/editors.ts.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Card from '#lib/components/ui/Card.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import type { EditorsData } from '#lib/server/editors.ts';

	let {
		editors,
		what,
		form = null
	}: {
		editors: EditorsData;
		/** "customer", "vendor" or "package" (for the explanation) */
		what: string;
		/** The page's ActionData; shows editor messages */
		form?: Record<string, unknown> | null;
	} = $props();

	const meaning: Record<string, string> = {
		customer: 'the customer and its LPARs, including rollouts and deployments to them',
		vendor: 'the vendor, its software, versions and bundles',
		package: 'the package itself (rollouts and deployments are done by the editors of each LPAR’s customer)'
	};

	const keep = () => async ({ update }: { update: (opts?: { reset?: boolean }) => Promise<void> }) => update({ reset: true });
	const selectClass = 'h-9 rounded-md border border-input bg-background px-2 text-sm';
</script>

<Card class="p-6 space-y-3">
	<div>
		<h2 class="text-lg font-semibold">Editors</h2>
		<p class="text-sm text-muted-foreground">
			Can change {meaning[what] ?? `this ${what}`}. The contact is the person responsible. Administrators can change it too{what === 'customer' ? '; global editors can change the customer but not its LPARs' : ', and so can global editors'}.
		</p>
	</div>

	{#if form?.editorError}
		<p role="alert" class="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{form.editorError}</p>
	{:else if form?.editorSaved}
		<p class="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">{form.editorSaved}</p>
	{/if}

	{#if editors.editors.length === 0}
		<p class="text-sm text-muted-foreground">No editors assigned.</p>
	{:else}
		<ul class="divide-y text-sm">
			{#each editors.editors as editor (editor.id)}
				<li class="flex flex-wrap items-center gap-2 py-2">
					<span class="font-medium {editor.active ? '' : 'text-muted-foreground line-through'}">{editor.display_name}</span>
					<span class="text-muted-foreground">({editor.username})</span>
					{#if editor.is_contact}<Badge>Contact</Badge>{/if}
					{#if !editor.active}<Badge variant="secondary">Inactive</Badge>{/if}
					{#if editors.canManage}
						<span class="ml-auto flex gap-2">
							<form method="POST" action="?/setContact" use:enhance={keep}>
								<input type="hidden" name="role_id" value={editor.is_contact ? '' : editor.id} />
								<Button type="submit" variant="outline" size="sm">{editor.is_contact ? 'Not contact' : 'Make contact'}</Button>
							</form>
							<form method="POST" action="?/removeEditor" use:enhance={keep}>
								<input type="hidden" name="role_id" value={editor.id} />
								<Button type="submit" variant="outline" size="sm">Remove</Button>
							</form>
						</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if editors.canManage}
		{#if editors.candidates.length > 0}
			<form method="POST" action="?/addEditor" use:enhance={keep} class="flex flex-wrap items-center gap-3 border-t pt-3 text-sm">
				<select name="user_id" required class={selectClass} aria-label="User to add as editor">
					<option value="">Add editor…</option>
					{#each editors.candidates as user (user.id)}
						<option value={user.id}>{user.display_name} ({user.username})</option>
					{/each}
				</select>
				<label class="flex items-center gap-1.5">
					<input type="checkbox" name="contact" />
					Contact
				</label>
				<Button type="submit" size="sm">Add</Button>
			</form>
		{:else}
			<p class="border-t pt-3 text-xs text-muted-foreground">Every active user is already an editor. Create users under Users.</p>
		{/if}
	{/if}
</Card>
