<!--
	TermTooltip.svelte
	Tooltip for mainframe and software terminology with standardized explanations

	Usage:
	<TermTooltip term="ptf">PTF Level</TermTooltip>
	<TermTooltip term="lpar">LPAR</TermTooltip>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		term: 'ptf' | 'lpar' | 'package' | 'rollback' | 'compatibility' | 'vendor' | 'version';
		children: Snippet;
		position?: 'top' | 'bottom' | 'left' | 'right';
	}

	let { term, children, position = 'top' }: Props = $props();

	let showTooltip = $state(false);

	const explanations: Record<string, string> = {
		ptf: 'Program Temporary Fix - A vendor-specific patch level (e.g., IBM uses PTF12345, Broadcom uses SO12345)',
		lpar: 'Logical Partition - An isolated virtual environment running on mainframe hardware',
		package: 'A coordinated set of software versions tested together for deployment',
		rollback: 'Reverting software to a previous version due to issues with the current version',
		compatibility: 'How closely the installed software matches the assigned package (100% = perfect match)',
		vendor: 'The company that develops and maintains the software product',
		version: 'Software release identifier (e.g., V5R6M0 or 2.4.0) indicating feature sets and capabilities'
	};

	const positionClasses = {
		top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
		bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
		left: 'right-full top-1/2 -translate-y-1/2 mr-2',
		right: 'left-full top-1/2 -translate-y-1/2 ml-2'
	};
</script>

<span class="relative inline-block">
	<span
		class="border-b border-dotted border-muted-foreground cursor-help"
		onmouseenter={() => showTooltip = true}
		onmouseleave={() => showTooltip = false}
		onfocus={() => showTooltip = true}
		onblur={() => showTooltip = false}
		role="button"
		tabindex="0"
		aria-label={`Show definition for ${term}`}
	>
		{@render children()}
	</span>

	{#if showTooltip}
		<span
			class="absolute z-50 px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg shadow-lg max-w-xs {positionClasses[position]}"
			style="white-space: normal;"
			role="tooltip"
		>
			{explanations[term]}
			<span class="absolute w-2 h-2 bg-gray-900 rotate-45 {position === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2' : position === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2' : position === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2' : 'left-[-4px] top-1/2 -translate-y-1/2'}"></span>
		</span>
	{/if}
</span>
