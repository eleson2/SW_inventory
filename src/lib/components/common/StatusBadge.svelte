<script lang="ts">
	import Badge from '$components/ui/Badge.svelte';

	let {
		active
	}: {
		active: boolean;
	} = $props();
</script>

<Badge variant={active ? 'success' : 'secondary'}>
	{active ? 'Active' : 'Inactive'}
</Badge>
