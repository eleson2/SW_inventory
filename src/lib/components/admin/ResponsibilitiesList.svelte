<!-- What a user is editor of (scoped editor roles); from loadResponsibilities() in #lib/server/editors.ts -->
<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import type { Responsibility } from '#lib/server/editors.ts';

	let { items, empty = 'Not an editor of any customer, vendor or package.' }: { items: Responsibility[]; empty?: string } = $props();

	const path = { customer: '/customers', vendor: '/vendors', package: '/packages' } as const;
	const label = { customer: 'Customer', vendor: 'Vendor', package: 'Package' } as const;
</script>

{#if items.length === 0}
	<p class="text-sm text-muted-foreground">{empty}</p>
{:else}
	<ul class="space-y-1 text-sm">
		{#each items as item (item.id)}
			<li class="flex items-center gap-2">
				<span class="w-20 text-muted-foreground">{label[item.scope_type]}</span>
				{#if item.name}
					<a href="{path[item.scope_type]}/{item.scope_id}" class="text-primary hover:underline">{item.name}</a>
				{:else}
					<span class="text-muted-foreground">(deleted)</span>
				{/if}
				{#if item.is_contact}<Badge>Contact</Badge>{/if}
			</li>
		{/each}
	</ul>
{/if}
