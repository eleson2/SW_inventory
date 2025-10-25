<script lang="ts">
	import type { SoftwareVersion } from '$types';
	import { formatSoftwareVersion } from '$utils/version-parser';
	import Badge from '$components/ui/Badge.svelte';
	import TermTooltip from '$components/common/TermTooltip.svelte';

	let {
		version,
		showBadge = false,
		showTooltips = false
	}: {
		version: SoftwareVersion | null | undefined;
		showBadge?: boolean;
		showTooltips?: boolean;
	} = $props();

	const formattedVersion = $derived(formatSoftwareVersion(version));
	const hasPtfLevel = $derived(version?.ptfLevel != null && version.ptfLevel !== '');
</script>

{#if showBadge}
	<Badge variant="outline">
		{#if showTooltips && hasPtfLevel}
			<TermTooltip term="version">{version?.version || ''}</TermTooltip>
			{#if version?.ptfLevel}
				(<TermTooltip term="ptf">{version.ptfLevel}</TermTooltip>)
			{/if}
		{:else}
			{formattedVersion}
		{/if}
	</Badge>
{:else}
	<span class="font-mono text-sm">
		{#if showTooltips && hasPtfLevel}
			<TermTooltip term="version">{version?.version || ''}</TermTooltip>
			{#if version?.ptfLevel}
				(<TermTooltip term="ptf">{version.ptfLevel}</TermTooltip>)
			{/if}
		{:else}
			{formattedVersion}
		{/if}
	</span>
{/if}
