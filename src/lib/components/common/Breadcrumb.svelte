<!--
	Breadcrumb.svelte
	Breadcrumb navigation component for showing user's location in hierarchy

	Usage:
	<Breadcrumb items={[
		{ label: 'Home', href: '/' },
		{ label: 'Vendors', href: '/vendors' },
		{ label: 'IBM' }  // Current page (no href)
	]} />
-->
<script lang="ts">
	import { goto } from '$app/navigation';

	export interface BreadcrumbItem {
		label: string;
		href?: string;
	}

	interface Props {
		items: BreadcrumbItem[];
	}

	let { items }: Props = $props();

	function handleClick(event: MouseEvent, href: string) {
		event.preventDefault();
		goto(href);
	}
</script>

<nav aria-label="Breadcrumb" class="flex items-center space-x-1 text-sm text-muted-foreground">
	{#each items as item, index}
		{#if index > 0}
			<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
				<path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
			</svg>
		{/if}

		{#if item.href}
			<a
				href={item.href}
				onclick={(e) => handleClick(e, item.href!)}
				class="hover:text-foreground transition-colors"
			>
				{item.label}
			</a>
		{:else}
			<span class="text-foreground font-medium">{item.label}</span>
		{/if}
	{/each}
</nav>
