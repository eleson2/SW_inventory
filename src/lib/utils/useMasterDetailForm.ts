/**
 * Utility for handling master-detail forms with nested JSON data
 *
 * Common pattern for forms that manage a main entity (master) with related entities (detail)
 * Examples: Software with Versions, LPAR with Software Installations, Package with Items
 */

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
				body: formData
			});

			if (response.redirected) {
				window.location.href = response.url;
			} else if (response.ok && options.onSuccess) {
				options.onSuccess(response);
			} else {
				// Server returned error - reload to show validation errors
				window.location.reload();
			}
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
		submitting
	};
}
