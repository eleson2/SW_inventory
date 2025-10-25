<script lang="ts">
	/**
	 * FormValidationSummary - Display validation errors at the top of forms
	 * Shows a summary of all errors with links to jump to each field
	 * Only displays after form submission attempt to avoid confusing users
	 */
	interface Props {
		errors: Record<string, any> | null | undefined;
		submitted?: boolean; // Only show errors after form submission
		title?: string;
	}

	let { errors, submitted = false, title = 'Please correct the following errors:' }: Props = $props();

	// Extract error messages from the errors object
	// Only show if form has been submitted to avoid confusing new users
	const errorList = $derived(() => {
		if (!errors || !submitted) return [];

		const errorMessages: Array<{ field: string; message: string; fieldId: string }> = [];

		Object.entries(errors).forEach(([field, value]) => {
			if (value && typeof value === 'object' && '_errors' in value) {
				// Zod/Superforms format: { _errors: ['message'] }
				const messages = value._errors || [];
				messages.forEach((message: string) => {
					if (message) { // Only include non-empty messages
						errorMessages.push({
							field: formatFieldName(field),
							message,
							fieldId: field
						});
					}
				});
			} else if (Array.isArray(value)) {
				// Array of error messages
				value.forEach((message: string) => {
					if (typeof message === 'string' && message) { // Only include non-empty messages
						errorMessages.push({
							field: formatFieldName(field),
							message,
							fieldId: field
						});
					}
				});
			} else if (typeof value === 'string' && value) {
				// String error message (only if non-empty)
				errorMessages.push({
					field: formatFieldName(field),
					message: value,
					fieldId: field
				});
			}
		});

		return errorMessages;
	});

	// Format field name for display (convert snake_case to Title Case)
	function formatFieldName(field: string): string {
		return field
			.split('_')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	// Scroll to field when clicked
	function scrollToField(fieldId: string) {
		const element = document.getElementById(fieldId);
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'center' });
			element.focus();
		}
	}
</script>

{#if errorList().length > 0}
	<div class="rounded-md bg-destructive/10 border border-destructive p-4" role="alert">
		<div class="flex items-start gap-3">
			<svg
				class="h-5 w-5 text-destructive flex-shrink-0 mt-0.5"
				fill="currentColor"
				viewBox="0 0 20 20"
			>
				<path
					fill-rule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
					clip-rule="evenodd"
				/>
			</svg>

			<div class="flex-1">
				<h3 class="text-sm font-semibold text-destructive mb-2">
					{title}
				</h3>
				<ul class="space-y-1 text-sm">
					{#each errorList() as error}
						<li>
							<button
								type="button"
								class="text-left hover:underline text-destructive/90 hover:text-destructive"
								onclick={() => scrollToField(error.fieldId)}
							>
								<strong>{error.field}:</strong>
								{error.message}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>
{/if}
