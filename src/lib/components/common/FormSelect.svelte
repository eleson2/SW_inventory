<script lang="ts" generics="T extends Record<string, any>">
	import Label from '$components/ui/Label.svelte';

	interface Props {
		label: string;
		id: string;
		name: string;
		value: string;
		options: T[];
		valueField: keyof T;
		displayField: keyof T;
		secondaryField?: keyof T;
		placeholder?: string;
		helperText?: string;
		error?: string;
		required?: boolean;
		disabled?: boolean;
	}

	let {
		label,
		id,
		name,
		value = $bindable(),
		options,
		valueField,
		displayField,
		secondaryField,
		placeholder = 'Select an option...',
		helperText,
		error,
		required = false,
		disabled = false
	}: Props = $props();
</script>

<div class="space-y-2">
	<Label for={id}>
		{label}
		{#if required}
			<span class="text-destructive">*</span>
		{/if}
	</Label>
	<select
		{id}
		{name}
		bind:value
		{required}
		{disabled}
		class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
	>
		<option value="">{placeholder}</option>
		{#each options as option}
			<option value={option[valueField]}>
				{option[displayField]}
				{#if secondaryField && option[secondaryField]}
					({option[secondaryField]})
				{/if}
			</option>
		{/each}
	</select>
	{#if helperText && !error}
		<p class="text-sm text-muted-foreground">{helperText}</p>
	{/if}
	{#if error}
		<p class="text-sm text-destructive">{error}</p>
	{/if}
</div>
