<script lang="ts">
	import { cn } from '$utils/cn';

	let {
		class: className = '',
		children
	}: {
		class?: string;
		children: any;
	} = $props();
</script>

<div class="relative w-full overflow-auto">
	<table class={cn('w-full caption-bottom text-sm', className)}>
		{@render children()}
	</table>
</div>
