<script lang="ts" generics="T extends { id: string }">
	import Label from '$components/ui/Label.svelte';
	import SearchableSelect from '$components/common/SearchableSelect.svelte';

	interface Props {
		entityName: string;
		entityNamePlural?: string;
		items: T[];
		displayField: keyof T;
		secondaryField?: keyof T;
		mode: 'blank' | 'clone';
		selectedId: string;
		onModeChange: (mode: 'blank' | 'clone') => void;
		onSourceSelect: (sourceId: string) => void;
		onBlankSelect: () => void;
	}

	let {
		entityName,
		entityNamePlural = `${entityName}s`,
		items,
		displayField,
		secondaryField,
		mode = $bindable(),
		selectedId = $bindable(),
		onModeChange,
		onSourceSelect,
		onBlankSelect
	}: Props = $props();
</script>

<div class="space-y-3 pb-4 border-b">
	<Label>How would you like to create this {entityName.toLowerCase()}?</Label>
	<div class="flex gap-4">
		<label class="flex items-center gap-2 cursor-pointer">
			<input
				type="radio"
				name="creationMode"
				value="blank"
				bind:group={mode}
				onchange={() => {
					onModeChange('blank');
					onBlankSelect();
				}}
				class="h-4 w-4"
			/>
			<span>Create blank {entityName.toLowerCase()}</span>
		</label>
		<label class="flex items-center gap-2 cursor-pointer">
			<input
				type="radio"
				name="creationMode"
				value="clone"
				bind:group={mode}
				class="h-4 w-4"
			/>
			<span>Create from existing {entityName.toLowerCase()}</span>
		</label>
	</div>

	{#if mode === 'clone'}
		<div class="space-y-2 pt-2">
			<Label for="cloneSource">Select source {entityName.toLowerCase()}</Label>
			<SearchableSelect
				items={items}
				displayField={displayField as string}
				valueField="id"
				secondaryField={secondaryField as string | undefined}
				placeholder="Search for {entityName.toLowerCase()} to clone..."
				bind:value={selectedId}
				onSelect={onSourceSelect}
			/>
			{#if selectedId}
				<p class="text-sm text-muted-foreground">
					Form has been pre-filled with data from selected {entityName.toLowerCase()}. You can edit any
					field before creating.
				</p>
			{/if}
		</div>
	{/if}
</div>
