<script lang="ts">
	import { page } from '$app/stores';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
</script>

<div class="flex items-center justify-center min-h-[60vh]">
	<Card class="max-w-2xl w-full p-8">
		<div class="space-y-4">
			<div class="flex items-center gap-3">
				<div class="text-4xl">⚠️</div>
				<div>
					<h1 class="text-2xl font-bold text-destructive">
						{$page.status}: {$page.error?.message || 'An error occurred'}
					</h1>
					<p class="text-muted-foreground mt-1">
						{#if $page.status === 404}
							The page you're looking for doesn't exist.
						{:else if $page.status === 500}
							An internal server error occurred.
						{:else}
							Something went wrong.
						{/if}
					</p>
				</div>
			</div>

			{#if $page.error?.message}
				<div class="rounded-md bg-destructive/10 p-4">
					<p class="text-sm font-mono text-destructive">
						{$page.error.message}
					</p>
				</div>
			{/if}

			<div class="flex gap-3 pt-4">
				<Button href="/">Go Home</Button>
				<Button variant="outline" onclick={() => window.history.back()}>
					Go Back
				</Button>
			</div>
		</div>
	</Card>
</div>
