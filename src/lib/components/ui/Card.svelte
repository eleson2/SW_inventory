<script lang="ts">
	import { cn } from '$utils/cn';

	let {
		class: className = '',
		children
	}: {
		class?: string;
		children: any;
	} = $props();
</script>

<div
	class={cn(
		'rounded-lg border bg-card text-card-foreground shadow-sm',
		className
	)}
>
	{@render children()}
</div>
