<script lang="ts">
	import Label from '#lib/components/ui/Label.svelte';
	import Input from '#lib/components/ui/Input.svelte';

	let {
		label,
		id,
		name,
		type = 'text',
		value = $bindable(), // no fallback: optional form fields may be undefined
		placeholder = '',
		required = false,
		disabled = false,
		error = '',
		helperText = '',
		constraints = {},
		oninput,
		onblur,
		onchange
	}: {
		label: string;
		id: string;
		name: string;
		type?: string;
		value?: string | null;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		error?: string;
		helperText?: string;
		constraints?: Record<string, any>;
		oninput?: (e: Event) => void;
		onblur?: (e: FocusEvent) => void;
		onchange?: (e: Event) => void;
	} = $props();

	// Merge constraints with explicit props (explicit props take precedence)
	const mergedConstraints = $derived({
		...constraints,
		...(required !== undefined && { required }),
		...(disabled !== undefined && { disabled })
	});
</script>

<div class="space-y-2">
	<Label for={id} required={mergedConstraints.required}>
		{label}
	</Label>
	<Input
		{id}
		{name}
		{type}
		bind:value
		{placeholder}
		{error}
		{oninput}
		{onblur}
		{onchange}
		{...mergedConstraints}
	/>
	{#if helperText && !error}
		<p class="text-sm text-muted-foreground">{helperText}</p>
	{/if}
</div>
