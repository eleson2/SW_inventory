<!--
	KeyboardShortcutsHelp.svelte
	Help dialog showing available keyboard shortcuts
-->
<script lang="ts">
	import Card from '$components/ui/Card.svelte';
	import Button from '$components/ui/Button.svelte';
	import { fade } from 'svelte/transition';

	interface Props {
		open: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	const shortcuts = [
		{
			category: 'Navigation',
			items: [
				{ keys: ['?'], description: 'Show this help dialog' },
				{ keys: ['Esc'], description: 'Close dialogs and modals' },
				{ keys: ['g', 'h'], description: 'Go to Home' },
				{ keys: ['g', 'v'], description: 'Go to Vendors' },
				{ keys: ['g', 's'], description: 'Go to Software' },
				{ keys: ['g', 'p'], description: 'Go to Packages' },
				{ keys: ['g', 'l'], description: 'Go to LPARs' },
				{ keys: ['g', 'c'], description: 'Go to Customers' }
			]
		},
		{
			category: 'Actions',
			items: [
				{ keys: ['n'], description: 'Create New (on list pages)' },
				{ keys: ['/'], description: 'Focus search box' }
			]
		}
	];

	function handleEscape(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			open = false;
		}
	}
</script>

<svelte:window onkeydown={handleEscape} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={() => open = false}
		role="dialog"
		aria-modal="true"
		transition:fade={{ duration: 200 }}
	>
		<Card
			class="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="p-6">
				<div class="flex items-center justify-between mb-6">
					<div>
						<h2 class="text-2xl font-bold">Keyboard Shortcuts</h2>
						<p class="text-sm text-muted-foreground mt-1">
							Speed up your workflow with these shortcuts
						</p>
					</div>
					<button
						onclick={() => open = false}
						class="rounded-md p-2 hover:bg-accent transition-colors"
						aria-label="Close"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div class="space-y-6">
					{#each shortcuts as section}
						<div>
							<h3 class="text-lg font-semibold mb-3">{section.category}</h3>
							<div class="space-y-2">
								{#each section.items as shortcut}
									<div class="flex items-center justify-between py-2 px-3 rounded hover:bg-accent/50 transition-colors">
										<span class="text-sm">{shortcut.description}</span>
										<div class="flex gap-1">
											{#each shortcut.keys as key}
												<kbd class="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded shadow-sm">
													{key}
												</kbd>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>

				<div class="mt-6 pt-4 border-t">
					<Button variant="outline" onclick={() => open = false} class="w-full">
						Close
					</Button>
				</div>
			</div>
		</Card>
	</div>
{/if}
