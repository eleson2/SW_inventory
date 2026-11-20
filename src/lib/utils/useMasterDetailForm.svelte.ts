/**
 * Utility for handling master-detail forms with nested JSON data
 *
 * Common pattern for forms that manage a main entity (master) with related entities (detail)
 * Examples: Software with Versions, LPAR with Software Installations, Package with Items
 */
import { applyAction, deserialize } from '$app/forms';

interface MasterDetailFormOptions {
	/**
	 * Callback to add detail data to FormData before submission
	 * Use this to add nested JSON data (e.g., versions, items, installations)
	 */
	onBuildFormData: (formData: FormData) => void;

	/**
	 * Optional success callback
	 */
	onSuccess?: (response: Response) => void;

	/**
	 * Optional error callback
	 */
	onError?: (error: Error) => void;
}

export function useMasterDetailForm(options: MasterDetailFormOptions) {
	let submitting = $state(false);

	/**
	 * Form submission handler
	 * Intercepts submit, builds FormData with detail data, and handles submission
	 */
	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitting = true;

		const form = event.target as HTMLFormElement;
		const formData = new FormData(form);

		// Allow caller to add nested detail data
		options.onBuildFormData(formData);

		try {
			const response = await fetch(form.action, {
				method: 'POST',
				body: formData,
				headers: { accept: 'application/json', 'x-sveltekit-action': 'true' }
			});

			// Kit answers with a serialized ActionResult (redirect/success/failure/error).
			// applyAction follows redirects and updates the page's `form` prop on failure,
			// so validation errors show without losing the user's unsaved edits.
			const result = deserialize(await response.text());
			if (result.type === 'success' && options.onSuccess) {
				options.onSuccess(response);
			}
			await applyAction(result);
		} catch (error) {
			console.error('Form submission error:', error);
			if (options.onError) {
				options.onError(error as Error);
			}
		} finally {
			submitting = false;
		}
	}

	return {
		handleSubmit,
		get submitting() {
			return submitting;
		}
	};
}
