<script lang="ts">
	import { toast, type Toast } from '$stores/toast';
	import { fly, fade } from 'svelte/transition';

	let toasts = $state<Toast[]>([]);

	$effect(() => {
		const unsubscribe = toast.subscribe((value) => {
			toasts = value;
		});
		return unsubscribe;
	});
</script>

<div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
	<!-- Dismiss All button (shows when multiple toasts) -->
	{#if toasts.length > 1}
		<div in:fly={{ y: -20, duration: 200 }} out:fade={{ duration: 150 }}>
			<button
				type="button"
				onclick={() => toast.dismissAll()}
				class="w-full rounded-lg bg-gray-800 text-white px-3 py-2 text-xs font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 shadow-lg"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
				Dismiss All ({toasts.length})
			</button>
		</div>
	{/if}

	{#each toasts as t (t.id)}
		<div
			in:fly={{ y: -50, duration: 300 }}
			out:fade={{ duration: 200 }}
			class="rounded-lg border shadow-lg p-4 flex items-start gap-3 {t.type === 'success'
				? 'bg-green-50 border-green-200 text-green-800'
				: t.type === 'error'
					? 'bg-red-50 border-red-200 text-red-800'
					: 'bg-blue-50 border-blue-200 text-blue-800'}"
		>
			<!-- Icon -->
			<div class="flex-shrink-0">
				{#if t.type === 'success'}
					<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
							clip-rule="evenodd"
						/>
					</svg>
				{:else if t.type === 'error'}
					<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
							clip-rule="evenodd"
						/>
					</svg>
				{:else}
					<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
							clip-rule="evenodd"
						/>
					</svg>
				{/if}
			</div>

			<!-- Message -->
			<div class="flex-1 text-sm font-medium">
				{t.message}
			</div>

			<!-- Close button -->
			<button
				type="button"
				onclick={() => toast.dismiss(t.id)}
				class="flex-shrink-0 inline-flex rounded-md p-1 hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-offset-2"
				aria-label="Dismiss"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/each}
</div>
