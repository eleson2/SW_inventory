<!--
	TransactionId.svelte
	Displays a unique transaction ID for forms and operations
	Useful for tracking, debugging, and referencing specific transactions
-->
<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		prefix?: string;
		label?: string;
	}

	let { prefix = 'TXN', label = 'Transaction ID' }: Props = $props();

	// Generate unique transaction ID
	function generateTransactionId(): string {
		const timestamp = Date.now().toString(36).toUpperCase();
		const random = Math.random().toString(36).substring(2, 6).toUpperCase();
		return `${prefix}-${timestamp}-${random}`;
	}

	let transactionId = $state(generateTransactionId());

	// Copy to clipboard
	function copyToClipboard() {
		navigator.clipboard.writeText(transactionId).then(() => {
			alert(`Transaction ID copied: ${transactionId}`);
		});
	}
</script>

<div class="flex items-center gap-2 text-xs font-mono bg-muted px-3 py-2 rounded-md border border-border">
	<span class="text-muted-foreground">{label}:</span>
	<button
		type="button"
		onclick={copyToClipboard}
		class="font-semibold hover:text-primary transition-colors cursor-pointer"
		title="Click to copy"
	>
		{transactionId}
	</button>
	<svg
		class="w-3 h-3 text-muted-foreground"
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24"
		title="Click ID to copy"
	>
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
	</svg>
</div>
