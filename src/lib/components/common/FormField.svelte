<script lang="ts">
	import Label from '$components/ui/Label.svelte';
	import Input from '$components/ui/Input.svelte';

	let {
		label,
		id,
		name,
		type = 'text',
		value = $bindable(''),
		placeholder = '',
		required = false,
		disabled = false,
		error = '',
		helperText = ''
	}: {
		label: string;
		id: string;
		name: string;
		type?: string;
		value?: string;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		error?: string;
		helperText?: string;
	} = $props();
</script>

<div class="space-y-2">
	<Label for={id} {required}>
		{label}
	</Label>
	<Input
		{id}
		{name}
		{type}
		bind:value
		{placeholder}
		{required}
		{disabled}
		{error}
	/>
	{#if helperText && !error}
		<p class="text-sm text-muted-foreground">{helperText}</p>
	{/if}
</div>
