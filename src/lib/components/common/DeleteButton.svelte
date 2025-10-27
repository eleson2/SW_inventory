<script lang="ts">
	import Button from '$components/ui/Button.svelte';
	import DeleteConfirmationModal from '$components/common/DeleteConfirmationModal.svelte';

	let {
		entityName,
		entityId,
		entityLabel = '',
		variant = 'destructive',
		size = 'default',
		disabled = false
	}: {
		entityName: string;
		entityId: string;
		entityLabel?: string;
		variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
		size?: 'default' | 'sm' | 'lg';
		disabled?: boolean;
	} = $props();

	let showModal = $state(false);

	function handleClick() {
		showModal = true;
	}
</script>

<Button
	{variant}
	{size}
	{disabled}
	onclick={handleClick}
>
	Delete
</Button>

<DeleteConfirmationModal
	bind:show={showModal}
	{entityName}
	{entityLabel}
/>
