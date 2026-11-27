<script lang="ts">
	import type { ActionData } from './$types';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Breadcrumb from '#lib/components/common/Breadcrumb.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import UserForm from '#lib/components/admin/UserForm.svelte';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>New user - SW Inventory</title></svelte:head>

<div class="max-w-2xl space-y-6">
	<Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Users', href: '/admin/users' }, { label: 'New user' }]} />
	<PageHeader title="New user" />
	{#if form?.error}
		<p role="alert" class="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{form.error}</p>
	{/if}
	<Card class="p-6">
		<UserForm isNew submitLabel="Create user" />
	</Card>
</div>
