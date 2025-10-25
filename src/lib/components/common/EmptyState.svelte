<!--
	EmptyState.svelte
	Standardized empty state component for list pages

	Usage:
	<EmptyState
		icon="📦"
		title="No packages found"
		description="Get started by creating your first package"
		actionLabel="Create Package"
		actionHref="/packages/new"
	/>
-->
<script lang="ts">
	import Button from '$components/ui/Button.svelte';

	interface Props {
		icon?: string;
		title: string;
		description?: string;
		actionLabel?: string;
		actionHref?: string;
		onAction?: () => void;
		showBackground?: boolean;
	}

	let {
		icon,
		title,
		description,
		actionLabel,
		actionHref,
		onAction,
		showBackground = true
	}: Props = $props();
</script>

<div class="flex flex-col items-center justify-center py-12 px-4 {showBackground ? 'bg-muted/20 rounded-lg border border-dashed border-muted-foreground/30' : ''}">
	{#if icon}
		<div class="text-6xl mb-4 opacity-50">
			{icon}
		</div>
	{:else}
		<svg
			class="w-16 h-16 mb-4 text-muted-foreground/50"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="1.5"
				d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
			/>
		</svg>
	{/if}

	<h3 class="text-lg font-semibold text-foreground mb-2">{title}</h3>

	{#if description}
		<p class="text-sm text-muted-foreground text-center max-w-md mb-4">
			{description}
		</p>
	{/if}

	{#if actionLabel}
		{#if actionHref}
			<a href={actionHref} data-sveltekit-reload>
				<Button>{actionLabel}</Button>
			</a>
		{:else if onAction}
			<Button onclick={onAction}>{actionLabel}</Button>
		{/if}
	{/if}
</div>
