<!--
	Tooltip.svelte
	Reusable tooltip component for providing contextual help

	Usage:
	<Tooltip text="This is a helpful explanation">
		<span>Hover me</span>
	</Tooltip>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		text: string;
		position?: 'top' | 'bottom' | 'left' | 'right';
		children: Snippet;
	}

	let { text, position = 'top', children }: Props = $props();

	let showTooltip = $state(false);

	const positionClasses = {
		top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
		bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
		left: 'right-full top-1/2 -translate-y-1/2 mr-2',
		right: 'left-full top-1/2 -translate-y-1/2 ml-2'
	};
</script>

<div class="relative inline-block">
	<div
		onmouseenter={() => showTooltip = true}
		onmouseleave={() => showTooltip = false}
		onfocus={() => showTooltip = true}
		onblur={() => showTooltip = false}
		role="tooltip"
		tabindex="0"
	>
		{@render children()}
	</div>

	{#if showTooltip}
		<div
			class="absolute z-50 px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg shadow-sm whitespace-nowrap {positionClasses[position]}"
			role="tooltip"
		>
			{text}
			<div class="absolute w-2 h-2 bg-gray-900 rotate-45 {position === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2' : position === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2' : position === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2' : 'left-[-4px] top-1/2 -translate-y-1/2'}"></div>
		</div>
	{/if}
</div>
