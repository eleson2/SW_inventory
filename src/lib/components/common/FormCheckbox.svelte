<script lang="ts">
	import Label from '$components/ui/Label.svelte';

	interface Props {
		label: string;
		id: string;
		name: string;
		checked: boolean;
		helperText?: string;
		disabled?: boolean;
		constraints?: Record<string, any>;
	}

	let {
		label,
		id,
		name,
		checked = $bindable(),
		helperText,
		disabled = false,
		constraints = {}
	}: Props = $props();

	// Merge constraints with explicit props (explicit props take precedence)
	const mergedConstraints = $derived({
		...constraints,
		...(disabled !== undefined && { disabled })
	});
</script>

<div class="space-y-2">
	<div class="flex items-center space-x-2">
		<input
			type="checkbox"
			{id}
			{name}
			bind:checked
			class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
			{...mergedConstraints}
		/>
		<Label for={id}>{label}</Label>
	</div>
	{#if helperText}
		<p class="text-sm text-muted-foreground ml-6">{helperText}</p>
	{/if}
</div>
