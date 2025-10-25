<script lang="ts">
	import Label from '$components/ui/Label.svelte';

	interface Props {
		label: string;
		id: string;
		name: string;
		value: string;
		placeholder?: string;
		helperText?: string;
		error?: string;
		required?: boolean;
		rows?: number;
		disabled?: boolean;
		constraints?: Record<string, any>;
	}

	let {
		label,
		id,
		name,
		value = $bindable(),
		placeholder = '',
		helperText,
		error,
		required = false,
		rows = 3,
		disabled = false,
		constraints = {}
	}: Props = $props();

	// Merge constraints with explicit props (explicit props take precedence)
	const mergedConstraints = $derived({
		...constraints,
		...(required !== undefined && { required }),
		...(disabled !== undefined && { disabled })
	});
</script>

<div class="space-y-2">
	<Label for={id}>
		{label}
		{#if mergedConstraints.required}
			<span class="text-destructive">*</span>
		{/if}
	</Label>
	<textarea
		{id}
		{name}
		bind:value
		{placeholder}
		style="min-height: {rows * 2}rem;"
		class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
		{...mergedConstraints}
	></textarea>
	{#if helperText && !error}
		<p class="text-sm text-muted-foreground">{helperText}</p>
	{/if}
	{#if error}
		<p class="text-sm text-destructive">{error}</p>
	{/if}
</div>
