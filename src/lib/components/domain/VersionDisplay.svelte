<script lang="ts">
	import type { SoftwareVersion } from '$types';
	import { formatSoftwareVersion } from '$utils/version-parser';
	import Badge from '$components/ui/Badge.svelte';

	let {
		version,
		showBadge = false
	}: {
		version: SoftwareVersion | null | undefined;
		showBadge?: boolean;
	} = $props();

	const formattedVersion = $derived(formatSoftwareVersion(version));
</script>

{#if showBadge}
	<Badge variant="outline">
		{formattedVersion}
	</Badge>
{:else}
	<span class="font-mono text-sm">
		{formattedVersion}
	</span>
{/if}
