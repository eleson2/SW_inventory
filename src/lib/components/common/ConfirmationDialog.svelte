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
		requireConfirmation?: boolean;
		confirmationText?: string;
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
		details,
		requireConfirmation = false,
		confirmationText
	}: Props = $props();

	let userConfirmationText = $state('');
	let confirmationCheckbox = $state(false);

	const canConfirm = $derived(
		!requireConfirmation ||
		(confirmationText ? userConfirmationText === confirmationText : confirmationCheckbox)
	);

	function handleConfirm() {
		if (canConfirm) {
			onConfirm();
			open = false;
			resetState();
		}
	}

	function handleCancel() {
		onCancel();
		open = false;
		resetState();
	}

	function resetState() {
		userConfirmationText = '';
		confirmationCheckbox = false;
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

			<!-- Confirmation Requirement -->
			{#if requireConfirmation}
				{#if confirmationText}
					<!-- Require typing specific text -->
					<div class="space-y-2">
						<label for="confirmation-input" class="text-sm font-medium">
							Type <code class="bg-muted px-1 py-0.5 rounded text-destructive font-mono">{confirmationText}</code> to confirm
						</label>
						<input
							id="confirmation-input"
							type="text"
							bind:value={userConfirmationText}
							placeholder={confirmationText}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						/>
					</div>
				{:else}
					<!-- Require checkbox -->
					<div class="flex items-start gap-2 rounded-md bg-muted/50 p-3 border">
						<input
							id="confirmation-checkbox"
							type="checkbox"
							bind:checked={confirmationCheckbox}
							class="h-4 w-4 mt-0.5 rounded border-gray-300"
						/>
						<label for="confirmation-checkbox" class="text-sm cursor-pointer">
							I understand this action cannot be undone
						</label>
					</div>
				{/if}
			{/if}

			<!-- Actions -->
			<div class="flex gap-3 justify-end pt-2">
				<Button variant="outline" onclick={handleCancel}>
					{cancelLabel}
				</Button>
				<Button variant={variant} onclick={handleConfirm} disabled={!canConfirm}>
					{confirmLabel}
				</Button>
			</div>
		</Card>
	</div>
{/if}
