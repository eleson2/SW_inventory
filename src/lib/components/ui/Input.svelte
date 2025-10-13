<script lang="ts">
	import { cn } from '$utils/cn';

	let {
		type = 'text',
		value = $bindable(''),
		placeholder = '',
		disabled = false,
		required = false,
		class: className = '',
		error = '',
		id = '',
		name = ''
	}: {
		type?: string;
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		required?: boolean;
		class?: string;
		error?: string;
		id?: string;
		name?: string;
	} = $props();
</script>

<input
	{type}
	{placeholder}
	{disabled}
	{required}
	{id}
	{name}
	bind:value
	class={cn(
		'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground',
		'ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium',
		'placeholder:text-muted-foreground',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
		'disabled:cursor-not-allowed disabled:opacity-50',
		error && 'border-destructive',
		className
	)}
/>
{#if error}
	<p class="mt-1 text-sm text-destructive">{error}</p>
{/if}
