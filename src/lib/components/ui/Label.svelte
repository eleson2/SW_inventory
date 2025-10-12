<script lang="ts">
	import { cn } from '$utils/cn';

	let {
		for: htmlFor = '',
		class: className = '',
		required = false,
		children
	}: {
		for?: string;
		class?: string;
		required?: boolean;
		children: any;
	} = $props();
</script>

<label
	for={htmlFor}
	class={cn(
		'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
		className
	)}
>
	{@render children()}
	{#if required}
		<span class="text-destructive ml-1">*</span>
	{/if}
</label>
