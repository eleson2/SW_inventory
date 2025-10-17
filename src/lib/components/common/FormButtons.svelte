<!--
	FormButtons.svelte
	Standardized form action buttons component

	Provides consistent "Save & Close" and "Apply" buttons for all forms.

	Features:
	- Save & Close: Submits form and redirects (default form action)
	- Apply: Submits form but stays on page (optional, via named action)
	- Cancel: Returns to previous page
	- Loading states for both save buttons
	- Disabled state support
-->
<script lang="ts">
	import Button from '$components/ui/Button.svelte';

	interface Props {
		loading?: boolean;
		disabled?: boolean;
		showApply?: boolean;
		applyAction?: string;
		onCancel?: () => void;
		saveLabel?: string;
		applyLabel?: string;
	}

	let {
		loading = false,
		disabled = false,
		showApply = false,
		applyAction = '?/apply',
		onCancel,
		saveLabel = 'Save & Close',
		applyLabel = 'Apply'
	}: Props = $props();

	function handleCancel() {
		if (onCancel) {
			onCancel();
		} else {
			window.history.back();
		}
	}
</script>

<div class="flex gap-3 pt-4 border-t">
	<!-- Save & Close Button (primary action) -->
	<Button type="submit" disabled={loading || disabled}>
		{#if loading}
			<svg
				class="animate-spin -ml-1 mr-2 h-4 w-4"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
			>
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
			Saving...
		{:else}
			{saveLabel}
		{/if}
	</Button>

	<!-- Apply Button (optional, stays on page) -->
	{#if showApply}
		<Button
			type="submit"
			variant="outline"
			disabled={loading || disabled}
			formaction={applyAction}
		>
			{applyLabel}
		</Button>
	{/if}

	<!-- Cancel Button -->
	<Button type="button" variant="outline" onclick={handleCancel} disabled={loading}>
		Cancel
	</Button>
</div>

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
