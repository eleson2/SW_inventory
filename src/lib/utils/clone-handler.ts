/**
 * Reusable clone handler utility for entity detail pages
 * Consolidates duplicate clone logic across all detail pages
 */
import { toast } from '$stores/toast';

export type EntityType = 'software' | 'package' | 'lpar' | 'customer' | 'vendor';

export interface CloneHandlerOptions {
	entityType: EntityType;
	sourceId: string;
	redirectPath: (id: string) => string;
	errorMessage?: string;
}

/**
 * Creates a reusable clone handler function
 *
 * @example
 * const handleClone = createCloneHandler({
 *   entityType: 'customer',
 *   sourceId: customer.id,
 *   redirectPath: (id) => `/customers/${id}`
 * });
 *
 * // Use with CloneDialog
 * await handleClone(formData);
 */
export function createCloneHandler(options: CloneHandlerOptions) {
	const { entityType, sourceId, redirectPath, errorMessage } = options;

	return async (formData: Record<string, string>) => {
		try {
			const response = await fetch('/api/clone', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					entityType,
					sourceId,
					data: formData
				})
			});

			const result = await response.json();

			if (result.success) {
				toast.success(`${entityType.charAt(0).toUpperCase() + entityType.slice(1)} cloned successfully!`);
				window.location.href = redirectPath(result.data.id);
			} else {
				toast.error(`Error: ${result.error}`);
				throw new Error(result.error);
			}
		} catch (error) {
			console.error('Clone error:', error);
			const message = errorMessage || `Failed to clone ${entityType}`;
			toast.error(message);
			throw error;
		}
	};
}

/**
 * Hook for managing clone dialog state and handler
 * Returns everything needed for clone functionality
 *
 * @example
 * const clone = useCloneHandler({
 *   entityType: 'customer',
 *   sourceId: customer.id,
 *   redirectPath: (id) => `/customers/${id}`
 * });
 *
 * // In your component:
 * <Button onclick={() => clone.open()}>Clone</Button>
 * <CloneDialog bind:open={clone.isOpen} onClone={clone.handleClone} loading={clone.isLoading} />
 */
export function useCloneHandler(options: CloneHandlerOptions) {
	let isOpen = $state(false);
	let isLoading = $state(false);

	const handler = createCloneHandler(options);

	const handleClone = async (formData: Record<string, string>) => {
		isLoading = true;
		try {
			await handler(formData);
		} finally {
			isLoading = false;
			isOpen = false;
		}
	};

	return {
		isOpen: $derived(isOpen),
		isLoading: $derived(isLoading),
		open: () => { isOpen = true; },
		close: () => { isOpen = false; },
		handleClone
	};
}
