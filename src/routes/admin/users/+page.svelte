<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { ROLES } from '#lib/utils/permissions.ts';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Users - SW Inventory</title></svelte:head>

<div class="space-y-6">
	<PageHeader title="Users" description="Who can log in, and who is an administrator or may create packages">
		{#snippet actions()}
			<Button href="/admin/users/new">New user</Button>
		{/snippet}
	</PageHeader>

	<Card class="overflow-x-auto">
		<table class="w-full text-sm">
			<thead class="border-b bg-muted/50 text-left">
				<tr>
					<th class="px-4 py-2 font-medium">Username</th>
					<th class="px-4 py-2 font-medium">Name</th>
					<th class="px-4 py-2 font-medium">Email</th>
					<th class="px-4 py-2 font-medium">Rights</th>
					<th class="px-4 py-2 font-medium">Last login</th>
				</tr>
			</thead>
			<tbody>
				{#each data.users as user (user.id)}
					<tr class="border-b last:border-0 hover:bg-muted/30 {user.active ? '' : 'text-muted-foreground'}">
						<td class="px-4 py-2">
							<a href="/admin/users/{user.id}" class="font-medium text-primary hover:underline">{user.username}</a>
							{#if user.username === data.envUsername}<span class="ml-1 text-xs text-muted-foreground">(.env)</span>{/if}
						</td>
						<td class="px-4 py-2">{user.display_name}</td>
						<td class="px-4 py-2">{user.email ?? ''}</td>
						<td class="px-4 py-2 space-x-1">
							{#if !user.active}<Badge variant="secondary">Inactive</Badge>{/if}
							{#each user.roles as role (role)}
								<Badge variant={role === 'admin' ? 'default' : 'outline'}>{ROLES[role].label}</Badge>
							{/each}
						</td>
						<td class="px-4 py-2" title={user.last_login_at ? new Date(user.last_login_at).toLocaleString() : ''}>
							{user.last_login_at ? formatDistanceToNow(new Date(user.last_login_at), { addSuffix: true }) : 'never'}
						</td>
					</tr>
				{:else}
					<tr><td colspan="5" class="px-4 py-6 text-muted-foreground">No users yet.</td></tr>
				{/each}
			</tbody>
		</table>
	</Card>
</div>
