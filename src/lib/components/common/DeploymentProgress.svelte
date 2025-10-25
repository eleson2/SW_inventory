<script lang="ts">
	import Card from '$components/ui/Card.svelte';

	interface Props {
		show: boolean;
		totalLpars: number;
		packageName: string;
		deploymentMode: string;
	}

	let { show, totalLpars, packageName, deploymentMode }: Props = $props();
</script>

{#if show}
	<!-- Full-page overlay -->
	<div
		class="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="deployment-progress-title"
	>
		<Card class="max-w-lg w-full p-8 space-y-6">
			<!-- Title -->
			<div class="text-center">
				<h2 id="deployment-progress-title" class="text-2xl font-bold mb-2">
					Deployment In Progress
				</h2>
				<p class="text-muted-foreground">
					Please wait while the package is deployed...
				</p>
			</div>

			<!-- Spinner -->
			<div class="flex justify-center py-8">
				<div
					class="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent"
				></div>
			</div>

			<!-- Details -->
			<div class="space-y-2 text-sm">
				<div class="flex justify-between">
					<span class="text-muted-foreground">Package:</span>
					<span class="font-medium">{packageName}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-muted-foreground">Target LPARs:</span>
					<span class="font-medium">{totalLpars}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-muted-foreground">Strategy:</span>
					<span class="font-medium">
						{deploymentMode === 'sequential' ? 'Sequential' : 'Parallel'}
					</span>
				</div>
			</div>

			<!-- Warning -->
			<div class="rounded-md bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
				⚠️ Please do not close this window or navigate away.
			</div>

			<!-- Status message -->
			<p class="text-center text-sm text-muted-foreground">
				{#if deploymentMode === 'sequential'}
					Deploying to LPARs one at a time. This may take several minutes...
				{:else}
					Deploying to all LPARs simultaneously. This may take a few minutes...
				{/if}
			</p>
		</Card>
	</div>
{/if}

<style>
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.animate-spin {
		animation: spin 1s linear infinite;
	}
</style>
