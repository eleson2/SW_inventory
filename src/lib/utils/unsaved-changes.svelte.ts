/**
 * Utility for tracking and warning about unsaved form changes
 *
 * Usage:
 * const unsavedChanges = useUnsavedChanges();
 * $effect(() => {
 *   unsavedChanges.setHasChanges(someFormState !== initialState);
 * });
 */

import { onMount } from 'svelte';
import { goto as svelteGoto, beforeNavigate } from '$app/navigation';

export function useUnsavedChanges() {
	let hasChanges = $state(false);
	let isSubmitting = $state(false);

	// Handle browser navigation/refresh
	function handleBeforeUnload(e: BeforeUnloadEvent) {
		if (hasChanges && !isSubmitting) {
			e.preventDefault();
			// Modern browsers show a generic message
			return (e.returnValue = '');
		}
	}

	onMount(() => {
		// Add beforeunload listener
		window.addEventListener('beforeunload', handleBeforeUnload);

		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});

	// Handle SvelteKit navigation
	beforeNavigate(({ cancel, to }) => {
		if (hasChanges && !isSubmitting && to) {
			const confirmed = confirm(
				'You have unsaved changes. Are you sure you want to leave this page? All unsaved changes will be lost.'
			);
			if (!confirmed) {
				cancel();
			}
		}
	});

	return {
		get hasChanges() {
			return hasChanges;
		},
		setHasChanges(value: boolean) {
			hasChanges = value;
		},
		setIsSubmitting(value: boolean) {
			isSubmitting = value;
		}
	};
}
