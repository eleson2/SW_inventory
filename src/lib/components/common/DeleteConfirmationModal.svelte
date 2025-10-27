<script lang="ts">
	import Button from '$components/ui/Button.svelte';
	import { enhance } from '$app/forms';

	let {
		show = $bindable(false),
		entityName,
		entityLabel = '',
		onConfirm
	}: {
		show?: boolean;
		entityName: string;
		entityLabel?: string;
		onConfirm?: () => void;
	} = $props();

	let isSubmitting = $state(false);
	let errorMessage = $state('');

	function handleCancel() {
		show = false;
		errorMessage = '';
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			handleCancel();
		}
	}
</script>

{#if show}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
		onclick={handleBackdropClick}
		role="button"
		tabindex="-1"
	>
		<!-- Modal -->
		<div
			class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="delete-modal-title"
		>
			<!-- Icon -->
			<div class="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
				<svg
					class="w-6 h-6 text-red-600"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					/>
				</svg>
			</div>

			<!-- Title -->
			<div class="text-center">
				<h3 id="delete-modal-title" class="text-lg font-semibold text-gray-900">
					Delete {entityName}
				</h3>
				<p class="mt-2 text-sm text-gray-500">
					Are you sure you want to delete
					{#if entityLabel}
						<span class="font-medium text-gray-900">"{entityLabel}"</span>
					{:else}
						this {entityName.toLowerCase()}
					{/if}?
					This action will permanently remove the {entityName.toLowerCase()} from the database.
				</p>
			</div>

			<!-- Error Message -->
			{#if errorMessage}
				<div class="rounded-md bg-red-50 p-4 border border-red-200">
					<div class="flex">
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
							</svg>
						</div>
						<div class="ml-3">
							<p class="text-sm text-red-800">{errorMessage}</p>
						</div>
					</div>
				</div>
			{/if}

			<!-- Actions -->
			<div class="flex gap-3 pt-2">
				<Button
					type="button"
					variant="outline"
					class="flex-1"
					onclick={handleCancel}
					disabled={isSubmitting}
				>
					Cancel
				</Button>
				<form
					method="POST"
					action="?/delete"
					class="flex-1"
					use:enhance={() => {
						isSubmitting = true;
						errorMessage = '';
						return async ({ result, update }) => {
							if (result.type === 'failure' && result.data?.error) {
								errorMessage = result.data.error;
								isSubmitting = false;
							} else if (result.type === 'redirect') {
								// Success - close modal and redirect
								show = false;
								if (onConfirm) onConfirm();
							} else {
								await update();
								isSubmitting = false;
							}
						};
					}}
				>
					<Button
						type="submit"
						variant="destructive"
						class="w-full"
						disabled={isSubmitting}
					>
						{isSubmitting ? 'Deleting...' : 'Delete'}
					</Button>
				</form>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Prevent body scroll when modal is open */
	:global(body:has(.fixed.inset-0)) {
		overflow: hidden;
	}
</style>
