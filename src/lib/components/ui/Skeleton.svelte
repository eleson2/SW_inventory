<!--
	Skeleton.svelte
	Skeleton loading placeholder component

	Usage:
	<Skeleton class="h-4 w-full" />
	<Skeleton class="h-8 w-24 rounded-full" />
-->
<script lang="ts">
	import { cn } from '$utils/cn';

	interface Props {
		class?: string;
	}

	let { class: className }: Props = $props();
</script>

<div
	class={cn(
		'animate-pulse rounded-md bg-muted',
		className
	)}
	aria-busy="true"
	aria-live="polite"
></div>

<style>
	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.animate-pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
</style>
