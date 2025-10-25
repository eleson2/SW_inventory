<script lang="ts">
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';

	interface Props {
		open: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		variant?: 'default' | 'destructive';
		onConfirm: () => void;
		onCancel: () => void;
		details?: string[];
	}

	let {
		open = $bindable(false),
		title,
		message,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		variant = 'default',
		onConfirm,
		onCancel,
		details
	}: Props = $props();

	function handleConfirm() {
		onConfirm();
		open = false;
	}

	function handleCancel() {
		onCancel();
		open = false;
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleCancel();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleCancel();
		}
	}
</script>

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="dialog-title"
	>
		<!-- Dialog -->
		<Card class="max-w-md w-full p-6 space-y-4">
			<!-- Title -->
			<h2 id="dialog-title" class="text-xl font-semibold">
				{title}
			</h2>

			<!-- Message -->
			<p class="text-muted-foreground">
				{message}
			</p>

			<!-- Details (optional list) -->
			{#if details && details.length > 0}
				<div class="rounded-md bg-muted p-3 max-h-48 overflow-y-auto">
					<ul class="text-sm space-y-1">
						{#each details as detail}
							<li>{detail}</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Warning for destructive actions -->
			{#if variant === 'destructive'}
				<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					⚠️ This action cannot be undone.
				</div>
			{/if}

			<!-- Actions -->
			<div class="flex gap-3 justify-end pt-2">
				<Button variant="outline" onclick={handleCancel}>
					{cancelLabel}
				</Button>
				<Button variant={variant} onclick={handleConfirm}>
					{confirmLabel}
				</Button>
			</div>
		</Card>
	</div>
{/if}
