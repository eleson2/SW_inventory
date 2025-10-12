<script lang="ts">
	import Button from '$components/ui/Button.svelte';

	let {
		currentPage,
		totalPages,
		onPageChange
	}: {
		currentPage: number;
		totalPages: number;
		onPageChange: (page: number) => void;
	} = $props();

	function getPageNumbers(): (number | string)[] {
		if (totalPages <= 7) {
			return Array.from({ length: totalPages }, (_, i) => i + 1);
		}

		const pages: (number | string)[] = [1];

		if (currentPage > 3) {
			pages.push('...');
		}

		const start = Math.max(2, currentPage - 1);
		const end = Math.min(totalPages - 1, currentPage + 1);

		for (let i = start; i <= end; i++) {
			pages.push(i);
		}

		if (currentPage < totalPages - 2) {
			pages.push('...');
		}

		pages.push(totalPages);

		return pages;
	}

	const pageNumbers = $derived(getPageNumbers());
</script>

<div class="flex items-center justify-between px-2 py-4">
	<div class="text-sm text-muted-foreground">
		Page {currentPage} of {totalPages}
	</div>
	<div class="flex items-center gap-2">
		<Button
			variant="outline"
			size="sm"
			disabled={currentPage === 1}
			onclick={() => onPageChange(currentPage - 1)}
		>
			Previous
		</Button>

		{#each pageNumbers as page}
			{#if typeof page === 'number'}
				<Button
					variant={page === currentPage ? 'default' : 'outline'}
					size="sm"
					onclick={() => onPageChange(page)}
				>
					{page}
				</Button>
			{:else}
				<span class="px-2 text-muted-foreground">...</span>
			{/if}
		{/each}

		<Button
			variant="outline"
			size="sm"
			disabled={currentPage === totalPages}
			onclick={() => onPageChange(currentPage + 1)}
		>
			Next
		</Button>
	</div>
</div>
