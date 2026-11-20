/**
 * Utility for handling master-detail forms with nested JSON data
 *
 * Common pattern for forms that manage a main entity (master) with related entities (detail)
 * Examples: Software with Versions, LPAR with Software Installations, Package with Items
 *
 * The server side reads these posts with validateMasterDetailForm (src/lib/server/master-detail-form.ts).
 *
 * Usage:
 *   const masterDetail = useMasterDetailForm({ onBuildFormData: (fd) => fd.set('items', JSON.stringify(items)) });
 *   <form method="POST" use:masterDetail.enhance> ... <FormButtons loading={masterDetail.submitting} />
 */
import { enhance as kitEnhance } from '$app/forms';

interface MasterDetailFormOptions {
	/**
	 * Callback to add detail data to FormData before submission
	 * Use this to add nested JSON data (e.g., versions, items, installations)
	 */
	onBuildFormData: (formData: FormData) => void;
}

export function useMasterDetailForm(options: MasterDetailFormOptions) {
	let submitting = $state(false);

	/**
	 * Form action: progressive enhancement via SvelteKit's enhance. Redirects navigate;
	 * failures update the page's `form` prop without resetting the user's edits.
	 */
	function enhance(form: HTMLFormElement) {
		return kitEnhance(form, ({ formData }) => {
			options.onBuildFormData(formData);
			submitting = true;
			return async ({ update }) => {
				await update({ reset: false });
				submitting = false;
			};
		});
	}

	return {
		enhance,
		get submitting() {
			return submitting;
		}
	};
}
